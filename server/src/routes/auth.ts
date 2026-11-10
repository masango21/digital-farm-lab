import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type User } from '../db/schema';
import { env } from '../config/env';
import { parseBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { signToken } from '../lib/jwt';
import { createCode, consumeCode, CODE_TTL, type CodeCheck } from '../lib/codes';
import { sendEmail, verificationEmail, resetEmail, passwordChangedEmail } from '../lib/email';
import { checkEmailDeliverable, normalizeEmail } from '../lib/emailValidation';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors';

export const authRouter = Router();

// Brute-force protection on sensitive endpoints.
const strictLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
authRouter.use(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/resend-verification'], strictLimiter);

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, emailVerified: u.emailVerified, createdAt: u.createdAt };
}

async function findByEmail(e: string) {
  const [u] = await db.select().from(users).where(eq(users.email, normalizeEmail(e))).limit(1);
  return u;
}

function codeError(result: CodeCheck) {
  if (result === 'expired') return badRequest('This code has expired. Request a new one.', 'CODE_EXPIRED');
  if (result === 'too_many_attempts') return badRequest('Too many wrong attempts. Request a new code.', 'CODE_LOCKED');
  return badRequest('That code is not correct', 'CODE_INVALID');
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const body = parseBody(
    z.object({
      name: z.string().trim().min(2, 'Name is too short').max(80),
      email,
      password,
      role: z.enum(['learner', 'trainer']).default('learner'),
      trainerCode: z.string().optional(),
    }),
    req,
  );
  if (body.role === 'trainer' && body.trainerCode !== env.TRAINER_INVITE_CODE) {
    throw badRequest('The trainer invite code is not correct', 'INVALID_TRAINER_CODE', { trainerCode: 'Invalid trainer code' });
  }
  const deliverable = await checkEmailDeliverable(body.email);
  if (!deliverable.ok) throw badRequest(deliverable.reason!, 'EMAIL_UNDELIVERABLE', { email: deliverable.reason });

  const existing = await findByEmail(body.email);
  if (existing?.emailVerified) throw conflict('An account with this email already exists. Try signing in.', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(body.password, 12);
  let user: User;
  if (existing) {
    // Unverified account – let the owner of the inbox restart sign-up.
    [user] = await db
      .update(users)
      .set({ name: body.name, passwordHash, role: body.role, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
  } else {
    [user] = await db.insert(users).values({ name: body.name, email: body.email, passwordHash, role: body.role }).returning();
  }

  const otp = await createCode(user.id, 'verify_email');
  await sendEmail({ to: { email: user.email, name: user.name }, ...verificationEmail(user.name, otp, CODE_TTL) });
  res.status(201).json({ message: 'Account created. Check your email for a 6-digit code.', email: user.email });
});

// POST /api/auth/verify-email
authRouter.post('/verify-email', async (req, res) => {
  const body = parseBody(z.object({ email, code }), req);
  const user = await findByEmail(body.email);
  if (!user) throw badRequest('That code is not correct', 'CODE_INVALID');
  // Never hand out a token here for an already-verified account: that would let
  // anyone who knows the email sign in without a password.
  if (user.emailVerified) throw conflict('This email is already verified. Please sign in.', 'ALREADY_VERIFIED');
  const result = await consumeCode(user.id, 'verify_email', body.code);
  if (result !== 'ok') throw codeError(result);
  const [updated] = await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// POST /api/auth/resend-verification
authRouter.post('/resend-verification', async (req, res) => {
  const body = parseBody(z.object({ email }), req);
  const user = await findByEmail(body.email);
  if (user && !user.emailVerified) {
    const otp = await createCode(user.id, 'verify_email');
    await sendEmail({ to: { email: user.email, name: user.name }, ...verificationEmail(user.name, otp, CODE_TTL) });
  }
  // Same response either way so attackers can't discover which emails exist.
  res.json({ message: 'If that account needs verifying, a new code has been sent.' });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const body = parseBody(z.object({ email, password: z.string().min(1, 'Enter your password') }), req);
  const user = await findByEmail(body.email);
  const ok = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
  if (!user || !ok) throw unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');
  // Codes are only emailed at sign-up (or when the user taps "Send a new code").
  if (!user.emailVerified) {
    throw forbidden('Please verify your email using the code we sent when you signed up.', 'EMAIL_NOT_VERIFIED');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req, res) => {
  const body = parseBody(z.object({ email }), req);
  const user = await findByEmail(body.email);
  if (user) {
    const otp = await createCode(user.id, 'reset_password');
    await sendEmail({ to: { email: user.email, name: user.name }, ...resetEmail(user.name, otp, CODE_TTL) });
  }
  res.json({ message: 'If an account exists for that email, a reset code has been sent.' });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res) => {
  const body = parseBody(z.object({ email, code, newPassword: password }), req);
  const user = await findByEmail(body.email);
  if (!user) throw badRequest('That code is not correct', 'CODE_INVALID');
  const result = await consumeCode(user.id, 'reset_password', body.code);
  if (result !== 'ok') throw codeError(result);

  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  // Receiving the reset code also proves the inbox is real, so mark verified.
  const [updated] = await db
    .update(users)
    .set({ passwordHash, emailVerified: true, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  await sendEmail({ to: { email: updated.email, name: updated.name }, ...passwordChangedEmail(updated.name) }).catch(() => {});
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) });
});

// PATCH /api/auth/me  (update display name)
authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = parseBody(z.object({ name: z.string().trim().min(2).max(80) }), req);
  const [updated] = await db.update(users).set({ name: body.name, updatedAt: new Date() }).where(eq(users.id, req.user!.id)).returning();
  res.json({ user: publicUser(updated) });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const body = parseBody(z.object({ currentPassword: z.string().min(1), newPassword: password }), req);
  const ok = await bcrypt.compare(body.currentPassword, req.user!.passwordHash);
  if (!ok) throw badRequest('Current password is incorrect', 'INVALID_CREDENTIALS', { currentPassword: 'Incorrect password' });
  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  const [updated] = await db
    .update(users)
    .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, req.user!.id))
    .returning();
  await sendEmail({ to: { email: updated.email, name: updated.name }, ...passwordChangedEmail(updated.name) }).catch(() => {});
  res.json({ token: signToken(updated), user: publicUser(updated) });
});
