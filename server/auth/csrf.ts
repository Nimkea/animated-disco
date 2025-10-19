import { nanoid } from 'nanoid';

export function generateCSRFToken(): string {
  return nanoid(32);
}

export function validateCSRFToken(headerToken: string | undefined, cookieToken: string | undefined): boolean {
  if (!headerToken || !cookieToken) {
    return false;
  }
  return headerToken === cookieToken;
}
