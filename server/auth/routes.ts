import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { hashPassword, comparePassword, generateResetToken } from './password';
import { signToken } from './jwt';
import { generateCSRFToken } from './csrf';
import { requireAuth, loginRateLimiter, type AuthRequest } from './middleware';
import rateLimit from 'express-rate-limit';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';

const router = Router();

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const verifyTokenSchema = z.object({
  token: z.string(),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

// Rate limiters for auth endpoints
const registrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 registration attempts per 15 minutes per IP
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  },
});

// POST /auth/register
router.post('/register', registrationRateLimiter, async (req, res) => {
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

    // Return generic message to prevent user enumeration
    // OWASP recommendation: Don't reveal which field (email/username) already exists
    // https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
    if (existingUser) {
      return res.status(400).json({ 
        message: 'An account with this email or username already exists' 
      });
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Generate unique referral code
    const userReferralCode = `XNRT${nanoid(8).toUpperCase()}`;

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

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with verification token
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        referralCode: userReferralCode,
        referredBy,
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
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

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.username, emailVerificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, user can resend later
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: false,
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

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        emailVerified: false 
      });
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
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('sid', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
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

// POST /auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const data = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: data.token,
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      return res.status(400).json({ message: 'Verification token has expired. Please request a new one.' });
    }

    // Mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    // Create session and JWT for automatic login after verification
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
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('sid', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Email verified successfully!',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: true,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/resend-verification
router.post('/resend-verification', forgotPasswordRateLimiter, async (req, res) => {
  try {
    const data = resendVerificationSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Always return same message to prevent user enumeration
    const uniformResponse = { message: 'If an account exists with this email and is not yet verified, a verification link has been sent' };

    if (!user) {
      return res.json(uniformResponse);
    }

    if (user.emailVerified) {
      // Don't reveal that email is already verified - return same message
      return res.json(uniformResponse);
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.username, emailVerificationToken);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      // Still return uniform response even if email fails
    }

    res.json(uniformResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Resend verification error:', error);
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
        emailVerified: true,
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
  const isProd = process.env.NODE_ENV === 'production';
  
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  res.json({ csrfToken });
});

// POST /auth/forgot-password
router.post('/forgot-password', forgotPasswordRateLimiter, async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.json({ message: 'If an account exists with this email, a password reset link has been sent' });
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, user.username, token);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ message: 'If an account exists with this email, a password reset link has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/verify-reset-token
router.post('/verify-reset-token', async (req, res) => {
  try {
    const data = verifyTokenSchema.parse(req.body);

    const resetToken = await prisma.passwordReset.findUnique({
      where: { token: data.token },
    });

    if (!resetToken) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (resetToken.usedAt) {
      return res.status(400).json({ message: 'This reset token has already been used' });
    }

    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    res.json({ valid: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Verify token error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const resetToken = await prisma.passwordReset.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!resetToken) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (resetToken.usedAt) {
      return res.status(400).json({ message: 'This reset token has already been used' });
    }

    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    const passwordHash = await hashPassword(data.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { userId: resetToken.userId },
        data: { revokedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
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
