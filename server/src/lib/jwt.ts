import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { User } from '../db/schema';

export interface TokenPayload {
  sub: string;
  role: 'learner' | 'trainer';
  tv: number;
}

export function signToken(user: Pick<User, 'id' | 'role' | 'tokenVersion'>): string {
  const payload: TokenPayload = { sub: user.id, role: user.role, tv: user.tokenVersion };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
