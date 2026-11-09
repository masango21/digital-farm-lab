import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { attempts, scenarios, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { notFound } from '../lib/errors';
import { CROPS } from '../simulation/crops';

export const attemptsRouter = Router();
attemptsRouter.use(requireAuth);

const summaryFields = {
  id: attempts.id,
  scenarioId: attempts.scenarioId,
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
