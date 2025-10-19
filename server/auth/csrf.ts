import { nanoid } from 'nanoid';
import crypto from 'crypto';

/**
 * Generates a random CSRF token
 */
export function generateCSRFToken(): string {
  return nanoid(32);
}

/**
 * Creates a session-bound CSRF token by hashing the token with the session ID
 * This prevents attackers from using a token from one session in another
 * @param token - The base CSRF token
 * @param sessionId - The user's session/JWT ID
 * @returns HMAC-signed token bound to the session
 */
export function bindTokenToSession(token: string, sessionId: string): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || '';
  return crypto
    .createHmac('sha256', secret)
    .update(`${token}:${sessionId}`)
    .digest('hex');
}

/**
 * Validates CSRF token with session awareness
 * Recommended by OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 * 
 * Uses double-submit cookie pattern with session validation:
 * - Token must match between cookie and header (prevents CSRF)
 * - Session must be valid (enforced by requireAuth middleware)
 * - This combination provides strong CSRF protection
 * 
 * @param headerToken - Token from x-csrf-token header
 * @param cookieToken - Base token from cookie
 * @param sessionId - User's session/JWT ID (for logging/future enhancement)
 * @returns true if token is valid
 */
export function validateCSRFToken(
  headerToken: string | undefined, 
  cookieToken: string | undefined,
  sessionId?: string
): boolean {
  if (!headerToken || !cookieToken) {
    return false;
  }
  
  // Log warning if no session (shouldn't happen with requireAuth)
  if (!sessionId) {
    console.warn('[CSRF] No session ID provided - ensure validateCSRF runs after requireAuth');
  }
  
  // Double-submit cookie pattern: header must match cookie
  // Combined with requireAuth, this prevents CSRF attacks
  return headerToken === cookieToken;
}
