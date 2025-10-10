import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from './password';
import { signToken } from './jwt';
import { generateCSRFToken } from './csrf';
import { requireAuth, loginRateLimiter, type AuthRequest } from './middleware';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === data.email 
          ? 'Email already registered' 
          : 'Username already taken' 
      });
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Generate unique referral code
    const userReferralCode = `REF${data.username.substring(0, 4).toUpperCase()}${Date.now().toString().slice(-4)}`;

    // Handle referral if provided
    let referredBy: string | null = null;
    if (data.referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: data.referralCode },
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        referralCode: userReferralCode,
        referredBy,
      },
    });

    // Create balance record
    await prisma.balance.create({
      data: {
        userId: user.id,
      },
    });

    // Create referral relationships if applicable
    if (referredBy) {
      // Get referrer's referrer chain (up to 3 levels)
      const referrerChain = await getReferrerChain(referredBy);
      
      for (let i = 0; i < Math.min(referrerChain.length, 3); i++) {
        await prisma.referral.create({
          data: {
            referrerId: referrerChain[i],
            referredUserId: user.id,
            level: i + 1,
          },
        });
      }
    }

    // Create session and JWT
    const { token, jwtId } = signToken({
      userId: user.id,
      email: user.email,
    });

    await prisma.session.create({
      data: {
        jwtId,
        userId: user.id,
      },
    });

    // Set cookie
    res.cookie('sid', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create new session (rotate jwtId)
    const { token, jwtId } = signToken({
      userId: user.id,
      email: user.email,
    });

    await prisma.session.create({
      data: {
        jwtId,
        userId: user.id,
      },
    });

    // Set cookie
    res.cookie('sid', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const jwtId = req.authUser?.jwtId;

    if (jwtId) {
      // Revoke session
      await prisma.session.update({
        where: { jwtId },
        data: { revokedAt: new Date() },
      });
    }

    // Clear cookie
    res.clearCookie('sid');
    res.status(204).send();
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      select: {
        id: true,
        email: true,
        username: true,
        referralCode: true,
        isAdmin: true,
        xp: true,
        level: true,
        streak: true,
        lastCheckIn: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /auth/csrf
router.get('/csrf', (req, res) => {
  const csrfToken = generateCSRFToken();
  
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.json({ csrfToken });
});

// Helper function to get referrer chain
async function getReferrerChain(userId: string): Promise<string[]> {
  const chain: string[] = [userId];
  let currentUserId = userId;

  for (let i = 0; i < 2; i++) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { referredBy: true },
    });

    if (!user?.referredBy) break;
    
    chain.push(user.referredBy);
    currentUserId = user.referredBy;
  }

  return chain;
}

export default router;
