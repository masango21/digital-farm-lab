import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type User } from '../db/schema';
import { verifyToken } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || user.tokenVersion !== payload.tv) {
    throw unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }
  if (!user.emailVerified) throw forbidden('Please verify your email first', 'EMAIL_NOT_VERIFIED');
  req.user = user;
  next();
}

export const requireRole =
  (...roles: User['role'][]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw forbidden(`Only ${roles.join(' or ')}s can do this`);
    }
    next();
  };
