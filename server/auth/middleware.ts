import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from './jwt';
import { validateCSRFToken } from './csrf';
import rateLimit from 'express-rate-limit';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        jwtId: string;
      };
    }
  }
}

export type AuthRequest = Request;

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.sid;
    
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    // Check if session is revoked
    const session = await prisma.session.findUnique({
      where: { jwtId: payload.jwtId },
    });

    if (!session || session.revokedAt) {
      return res.status(401).json({ message: 'Unauthorized: Session revoked' });
    }

    req.authUser = {
      id: payload.userId,
      email: payload.email,
      jwtId: payload.jwtId,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Unauthorized: Please log in first' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  const headerToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies.csrfToken;

  if (!validateCSRFToken(headerToken, cookieToken)) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  next();
}

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
