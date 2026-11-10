import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { attempts, credentialEvents, scenarios, users } from '../db/schema';
import { maybeIssueCredential } from '../lib/credentials';
import { requireAuth } from '../middleware/auth';
import { parseBody, parseQuery } from '../middleware/validate';
import { notFound } from '../lib/errors';
import { CROPS } from '../simulation/crops';
import { randomBytes } from 'node:crypto';
import { shareUrl } from './share';

export const attemptsRouter = Router();
attemptsRouter.use(requireAuth);

const summaryFields = {
  id: attempts.id,
  scenarioId: attempts.scenarioId,
  mode: attempts.mode,
  params: attempts.params,
  totalScore: attempts.totalScore,
  irrigationScore: attempts.irrigationScore,
  yieldTonsPerHa: attempts.yieldTonsPerHa,
  waterUsedMm: attempts.waterUsedMm,
  profit: attempts.profit,
  createdAt: attempts.createdAt,
  scenarioTitle: scenarios.title,
  crop: scenarios.crop,
};

// GET /api/attempts/me?scenarioId=...  – learner's own history
attemptsRouter.get('/me', async (req, res) => {
  const q = parseQuery(z.object({ scenarioId: z.string().uuid().optional() }), req);
  const rows = await db
    .select(summaryFields)
    .from(attempts)
    .innerJoin(scenarios, eq(scenarios.id, attempts.scenarioId))
    .where(and(eq(attempts.learnerId, req.user!.id), q.scenarioId ? eq(attempts.scenarioId, q.scenarioId) : undefined))
    .orderBy(desc(attempts.createdAt))
    .limit(200);
  res.json({ attempts: rows.map((r) => ({ ...r, cropEmoji: CROPS[r.crop].emoji })) });
});

// PUT /api/attempts/:id/reflection – learner saves answers to the reflection prompts
attemptsRouter.put('/:id/reflection', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Attempt not found');
  const body = parseBody(
    z.object({
      answers: z
        .array(
          z.object({
            prompt: z.string().trim().min(1).max(400),
            answer: z.string().trim().min(3, 'Write at least a few words').max(2000),
          }),
        )
        .min(1)
        .max(5),
    }),
    req,
  );
  const [updated] = await db
    .update(attempts)
    .set({ reflection: body.answers, reflectedAt: new Date() })
    .where(and(eq(attempts.id, id.data), eq(attempts.learnerId, req.user!.id)))
    .returning({ reflection: attempts.reflection, reflectedAt: attempts.reflectedAt });
  if (!updated) throw notFound('Attempt not found');
  // A good run + a completed reflection earns the scenario's microcredential.
  const credentialEarned = await maybeIssueCredential(id.data);
  res.json({ ...updated, credentialEarned });
});

// GET /api/attempts/credentials/me – the learner's microcredentials and their AgriLearn status
attemptsRouter.get('/credentials/me', async (req, res) => {
  const rows = await db
    .select({
      id: credentialEvents.id,
      scenarioId: credentialEvents.scenarioId,
      attemptId: credentialEvents.attemptId,
      payload: credentialEvents.payload,
      status: credentialEvents.status,
      createdAt: credentialEvents.createdAt,
      sentAt: credentialEvents.sentAt,
      scenarioTitle: scenarios.title,
      crop: scenarios.crop,
    })
    .from(credentialEvents)
    .innerJoin(scenarios, eq(scenarios.id, credentialEvents.scenarioId))
    .where(eq(credentialEvents.learnerId, req.user!.id))
    .orderBy(desc(credentialEvents.createdAt));
  res.json({
    credentials: rows.map(({ payload, ...r }) => ({
      ...r,
      cropEmoji: CROPS[r.crop].emoji,
      code: (payload.credential as { code: string }).code,
      score: (payload.credential as { score: number }).score,
    })),
  });
});

// POST /api/attempts/:id/share – learner creates (or reuses) a public read-only link
attemptsRouter.post('/:id/share', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Attempt not found');
  const [row] = await db
    .select({ shareToken: attempts.shareToken })
    .from(attempts)
    .where(and(eq(attempts.id, id.data), eq(attempts.learnerId, req.user!.id)))
    .limit(1);
  if (!row) throw notFound('Attempt not found');
  let token = row.shareToken;
  if (!token) {
    token = randomBytes(12).toString('base64url');
    await db.update(attempts).set({ shareToken: token }).where(eq(attempts.id, id.data));
  }
  res.json({ url: shareUrl(req, token), token });
});

// DELETE /api/attempts/:id/share – learner turns the public link off
attemptsRouter.delete('/:id/share', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Attempt not found');
  const [row] = await db
    .update(attempts)
    .set({ shareToken: null })
    .where(and(eq(attempts.id, id.data), eq(attempts.learnerId, req.user!.id)))
    .returning({ id: attempts.id });
  if (!row) throw notFound('Attempt not found');
  res.status(204).end();
});

// GET /api/attempts/:id – full result (owner learner or the scenario's trainer)
attemptsRouter.get('/:id', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Attempt not found');
  const [row] = await db
    .select({ attempt: attempts, scenarioTitle: scenarios.title, crop: scenarios.crop, trainerId: scenarios.trainerId, learnerName: users.name })
    .from(attempts)
    .innerJoin(scenarios, eq(scenarios.id, attempts.scenarioId))
    .innerJoin(users, eq(users.id, attempts.learnerId))
    .where(eq(attempts.id, id.data))
    .limit(1);
  const me = req.user!.id;
  if (!row || (row.attempt.learnerId !== me && row.trainerId !== me)) throw notFound('Attempt not found');
  res.json({
    attempt: { ...row.attempt, scenarioTitle: row.scenarioTitle, crop: row.crop, cropEmoji: CROPS[row.crop].emoji, learnerName: row.learnerName },
  });
});
