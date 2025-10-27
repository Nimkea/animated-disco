import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for security. Generate one with: openssl rand -hex 32');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long for security');
}

export interface JWTPayload {
  userId: string;
  email: string;
  jwtId: string;
}

export function signToken(payload: Omit<JWTPayload, 'jwtId'>): { token: string; jwtId: string } {
  const jwtId = nanoid();
  const token = jwt.sign(
    { ...payload, jwtId },
    JWT_SECRET!,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return { token, jwtId };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
