import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { prisma } from "../lib/db";
import { handleApiError, sendDbUnavailable, sendForbidden, sendUnauthorized } from "../lib/api-response";
import { validateCSRFToken } from "./csrf";
import { verifyToken } from "./jwt";

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

function clearAuthCookies(res: Response) {
  res.clearCookie("sid", { path: "/" });
  res.clearCookie("csrfToken", { path: "/" });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.sid;

    if (!token) {
      return sendUnauthorized(res, "Unauthorized: Please log in first");
    }

    const payload = verifyToken(token);
    if (!payload) {
      clearAuthCookies(res);
      return sendUnauthorized(res, "Unauthorized: Invalid or expired session");
    }

    // Check if session is revoked. DB outages are reported as 503 instead of a generic 500.
    let session;
    try {
      session = await prisma.session.findUnique({
        where: { jwtId: payload.jwtId },
        select: { id: true, revokedAt: true },
      });
    } catch (error) {
      return sendDbUnavailable(res, error);
    }

    if (!session || session.revokedAt) {
      clearAuthCookies(res);
      return sendUnauthorized(res, "Unauthorized: Session revoked or expired");
    }

    req.authUser = {
      id: payload.userId,
      email: payload.email,
      jwtId: payload.jwtId,
    };

    next();
  } catch (error) {
    return handleApiError(error, res, "auth.requireAuth");
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.authUser) {
      return sendUnauthorized(res, "Unauthorized: Please log in first");
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.authUser.id },
        select: { isAdmin: true },
      });
    } catch (error) {
      return sendDbUnavailable(res, error);
    }

    if (!user?.isAdmin) {
      return sendForbidden(res, "Forbidden: Admin access required");
    }

    next();
  } catch (error) {
    return handleApiError(error, res, "auth.requireAdmin");
  }
}

export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  const headerToken = req.headers["x-csrf-token"] as string;
  const cookieToken = req.cookies.csrfToken;

  if (!validateCSRFToken(headerToken, cookieToken)) {
    return sendForbidden(res, "Invalid CSRF token");
  }

  next();
}

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: { message: "Too many login attempts, please try again later", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});
