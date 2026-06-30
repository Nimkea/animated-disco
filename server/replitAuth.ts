import type { Express, RequestHandler } from "express";

/**
 * Legacy Replit Auth has been removed.
 *
 * The app now uses the custom JWT email/password auth implementation under
 * server/auth/*. This compatibility module intentionally does not register
 * /api/login, /api/callback, /api/logout, passport, sessions, or OIDC.
 *
 * It exists only to keep any accidental stale imports from breaking TypeScript.
 */
export async function setupAuth(_app: Express) {
  console.warn(
    "[replitAuth] Legacy Replit Auth is disabled. Use server/auth routes instead."
  );
}

export const isAuthenticated: RequestHandler = async (_req, res) => {
  return res.status(410).json({
    message: "Legacy Replit Auth has been removed. Use /auth/login instead.",
  });
};
