import { Router } from 'express';
import { z } from 'zod';
import { and, avg, count, desc, eq, max } from 'drizzle-orm';
import { db } from '../db/client';
import { attempts, credentialEvents, scenarios, users } from '../db/schema';
import { env } from '../config/env';
import { requireAuth, requireRole } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { CROPS } from '../simulation/crops';

export const trainerRouter = Router();
trainerRouter.use(requireAuth, requireRole('trainer'));

const round = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);

// GET /api/trainer/overview – one row per scenario the trainer owns
trainerRouter.get('/overview', async (req, res) => {
  const rows = await db
    .select({
      scenarioId: scenarios.id,
      title: scenarios.title,
      crop: scenarios.crop,
      isPublished: scenarios.isPublished,
      attempts: count(attempts.id),
      averageScore: avg(attempts.totalScore),
      bestScore: max(attempts.totalScore),
    })
    .from(scenarios)
    .leftJoin(attempts, eq(attempts.scenarioId, scenarios.id))
    .where(eq(scenarios.trainerId, req.user!.id))
    .groupBy(scenarios.id)
    .orderBy(desc(scenarios.createdAt));
  res.json({
    scenarios: rows.map((r) => ({ ...r, cropEmoji: CROPS[r.crop].emoji, averageScore: round(r.averageScore), bestScore: round(r.bestScore) })),
  });
});

// GET /api/trainer/scores?scenarioId=... – every learner attempt on the trainer's scenarios
trainerRouter.get('/scores', async (req, res) => {
  const q = parseQuery(z.object({ scenarioId: z.string().uuid().optional() }), req);
  const rows = await db
    .select({
      attemptId: attempts.id,
      scenarioId: scenarios.id,
      scenarioTitle: scenarios.title,
      crop: scenarios.crop,
      learnerId: users.id,
      learnerName: users.name,
      learnerEmail: users.email,
      totalScore: attempts.totalScore,
      irrigationScore: attempts.irrigationScore,
      yieldTonsPerHa: attempts.yieldTonsPerHa,
      waterUsedMm: attempts.waterUsedMm,
      profit: attempts.profit,
      mode: attempts.mode,
      reflectedAt: attempts.reflectedAt,
      createdAt: attempts.createdAt,
    })
    .from(attempts)
    .innerJoin(scenarios, eq(scenarios.id, attempts.scenarioId))
    .innerJoin(users, eq(users.id, attempts.learnerId))
    .where(and(eq(scenarios.trainerId, req.user!.id), q.scenarioId ? eq(scenarios.id, q.scenarioId) : undefined))
    .orderBy(desc(attempts.createdAt))
    .limit(500);
  res.json({ scores: rows.map((r) => ({ ...r, cropEmoji: CROPS[r.crop].emoji })) });
});

// GET /api/trainer/credentials – microcredentials earned on the trainer's scenarios + AgriLearn delivery status
trainerRouter.get('/credentials', async (req, res) => {
  const rows = await db
    .select({
      id: credentialEvents.id,
      learnerName: users.name,
      scenarioTitle: scenarios.title,
      crop: scenarios.crop,
      status: credentialEvents.status,
      lastError: credentialEvents.lastError,
      createdAt: credentialEvents.createdAt,
      sentAt: credentialEvents.sentAt,
    })
    .from(credentialEvents)
    .innerJoin(scenarios, eq(scenarios.id, credentialEvents.scenarioId))
    .innerJoin(users, eq(users.id, credentialEvents.learnerId))
    .where(eq(scenarios.trainerId, req.user!.id))
    .orderBy(desc(credentialEvents.createdAt))
    .limit(200);
  res.json({ agrilearnConnected: Boolean(env.AGRILEARN_WEBHOOK_URL), credentials: rows.map((r) => ({ ...r, cropEmoji: CROPS[r.crop].emoji })) });
});

// GET /api/trainer/learners?scenarioId=... – best score per learner
trainerRouter.get('/learners', async (req, res) => {
  const q = parseQuery(z.object({ scenarioId: z.string().uuid().optional() }), req);
  const rows = await db
    .select({
      learnerId: users.id,
      learnerName: users.name,
      learnerEmail: users.email,
      attempts: count(attempts.id),
      bestScore: max(attempts.totalScore),
      averageScore: avg(attempts.totalScore),
      averageIrrigation: avg(attempts.irrigationScore),
    })
    .from(attempts)
    .innerJoin(scenarios, eq(scenarios.id, attempts.scenarioId))
    .innerJoin(users, eq(users.id, attempts.learnerId))
    .where(and(eq(scenarios.trainerId, req.user!.id), q.scenarioId ? eq(scenarios.id, q.scenarioId) : undefined))
    .groupBy(users.id)
    .orderBy(desc(max(attempts.totalScore)));
  res.json({
    learners: rows.map((r) => ({
      ...r,
      bestScore: round(r.bestScore),
      averageScore: round(r.averageScore),
      averageIrrigation: round(r.averageIrrigation),
    })),
  });
});
