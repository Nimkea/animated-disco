import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for secure token signing');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  jwtId: string;
}

export function signToken(payload: Omit<JWTPayload, 'jwtId'>): { token: string; jwtId: string } {
  const jwtId = nanoid();
  const token = jwt.sign(
    { ...payload, jwtId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return { token, jwtId };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
