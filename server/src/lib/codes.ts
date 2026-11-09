import { randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { emailCodes } from '../db/schema';

export type CodePurpose = 'verify_email' | 'reset_password';

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

/** Creates a fresh 6-digit code and invalidates older unused ones. */
export async function createCode(userId: string, purpose: CodePurpose): Promise<string> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await db
    .update(emailCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(emailCodes.userId, userId), eq(emailCodes.purpose, purpose), isNull(emailCodes.usedAt)));
  await db.insert(emailCodes).values({
    userId,
    purpose,
    codeHash: hash(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
  });
  return code;
}

export type CodeCheck = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

/** Checks a code; marks it used on success. */
export async function consumeCode(userId: string, purpose: CodePurpose, code: string): Promise<CodeCheck> {
  const [row] = await db
    .select()
    .from(emailCodes)
    .where(and(eq(emailCodes.userId, userId), eq(emailCodes.purpose, purpose), isNull(emailCodes.usedAt)))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (!row) return 'invalid';
  if (row.expiresAt.getTime() < Date.now()) return 'expired';
  if (row.attempts >= MAX_ATTEMPTS) return 'too_many_attempts';

  const a = Buffer.from(hash(code.trim()));
  const b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.id, row.id));
    return 'invalid';
  }
  await db.update(emailCodes).set({ usedAt: new Date() }).where(eq(emailCodes.id, row.id));
  return 'ok';
}

export const CODE_TTL = CODE_TTL_MINUTES;
