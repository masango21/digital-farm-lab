import { Router } from 'express';
import { z } from 'zod';
import { and, avg, count, desc, eq, max, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { attempts, scenarios, users, type Scenario } from '../db/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { parseBody, parseQuery } from '../middleware/validate';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { deleteImage, isOwnCloudinaryAsset } from '../lib/cloudinary';
import { toSimScenario } from '../lib/scenario';
import { CROPS, type CropId } from '../simulation/crops';
import { generateWeather, runSimulation } from '../simulation/engine';

export const scenariosRouter = Router();
scenariosRouter.use(requireAuth);

const weeklyArray = z.array(z.number().min(0).max(300));

const scenarioInput = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(120),
  description: z.string().trim().min(10, 'Add a short description (10+ characters)').max(2000),
  learningGoals: z.string().trim().max(1000).default(''),
  crop: z.enum(['maize', 'tomato', 'wheat', 'potato', 'spinach']),
  soil: z.enum(['sandy', 'loam', 'clay']),
  climate: z.enum(['dry', 'normal', 'wet']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  weeks: z.number().int().min(4).max(30).optional(),
  avgTemperatureC: z.number().min(0).max(45).default(24),
  startMoisturePct: z.number().min(0).max(100).default(50),
  budget: z.number().min(0).max(10_000_000),
  waterAllowanceMm: z.number().min(0).max(5000),
  pestWeeks: z.array(z.number().int().min(1).max(30)).max(30).default([]),
  /** Optional: trainer-defined weekly rainfall instead of the generated pattern. */
  rainfallMm: weeklyArray.optional(),
  imageUrl: z.string().url().nullable().optional(),
  imagePublicId: z.string().nullable().optional(),
  isPublished: z.boolean().default(false),
});

function serialize(s: Scenario, trainerName?: string | null) {
  const crop = CROPS[s.crop];
  return { ...s, cropName: crop.name, cropEmoji: crop.emoji, trainerName: trainerName ?? undefined };
}

async function loadOwned(id: string, trainerId: string) {
  const [s] = await db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1);
  if (!s) throw notFound('Scenario not found');
  if (s.trainerId !== trainerId) throw forbidden('You can only manage your own scenarios');
  return s;
}

function buildWeather(input: { climate: 'dry' | 'normal' | 'wet'; weeks: number; avgTemperatureC: number; rainfallMm?: number[] }) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const generated = generateWeather(input.climate, input.weeks, input.avgTemperatureC, seed);
  if (input.rainfallMm) {
    if (input.rainfallMm.length !== input.weeks) throw badRequest(`rainfallMm must have exactly ${input.weeks} values`, 'VALIDATION_ERROR');
    generated.rainfallMm = input.rainfallMm;
  }
  return generated;
}

function validateExtras(
  data: { pestWeeks: number[]; imageUrl?: string | null; imagePublicId?: string | null },
  weeks: number,
  userId: string,
) {
  if (data.pestWeeks.some((w) => w > weeks)) throw badRequest(`Pest weeks must be between 1 and ${weeks}`, 'VALIDATION_ERROR', { pestWeeks: 'Out of range' });
  if (data.imageUrl && (!data.imagePublicId || !isOwnCloudinaryAsset(data.imageUrl, data.imagePublicId, userId))) {
    throw badRequest('Image must be uploaded through the app', 'INVALID_IMAGE');
  }
}

// GET /api/scenarios?crop=maize&difficulty=beginner&mine=true
scenariosRouter.get('/', async (req, res) => {
  const q = parseQuery(
    z.object({
      crop: z.enum(['maize', 'tomato', 'wheat', 'potato', 'spinach']).optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      mine: z.enum(['true', 'false']).optional(),
    }),
    req,
  );
  const user = req.user!;
  const conds: SQL[] = [];
  if (q.mine === 'true' && user.role === 'trainer') conds.push(eq(scenarios.trainerId, user.id));
  else if (user.role === 'trainer') conds.push(or(eq(scenarios.isPublished, true), eq(scenarios.trainerId, user.id))!);
  else conds.push(eq(scenarios.isPublished, true));
  if (q.crop) conds.push(eq(scenarios.crop, q.crop));
  if (q.difficulty) conds.push(eq(scenarios.difficulty, q.difficulty));

  const rows = await db
    .select({ scenario: scenarios, trainerName: users.name })
    .from(scenarios)
    .innerJoin(users, eq(users.id, scenarios.trainerId))
    .where(and(...conds))
    .orderBy(desc(scenarios.createdAt));
  res.json({ scenarios: rows.map((r) => serialize(r.scenario, r.trainerName)) });
});

// GET /api/scenarios/:id
scenariosRouter.get('/:id', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Scenario not found');
  const [row] = await db
    .select({ scenario: scenarios, trainerName: users.name })
    .from(scenarios)
    .innerJoin(users, eq(users.id, scenarios.trainerId))
    .where(eq(scenarios.id, id.data))
    .limit(1);
  if (!row || (!row.scenario.isPublished && row.scenario.trainerId !== req.user!.id)) throw notFound('Scenario not found');
  res.json({ scenario: serialize(row.scenario, row.trainerName) });
});

// GET /api/scenarios/:id/stats – used by learners to compare their score with others
scenariosRouter.get('/:id/stats', async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Scenario not found');
  const [all] = await db
    .select({ attempts: count(), average: avg(attempts.totalScore), best: max(attempts.totalScore), avgIrrigation: avg(attempts.irrigationScore) })
    .from(attempts)
    .where(eq(attempts.scenarioId, id.data));
  const [mine] = await db
    .select({ attempts: count(), best: max(attempts.totalScore), average: avg(attempts.totalScore) })
    .from(attempts)
    .where(and(eq(attempts.scenarioId, id.data), eq(attempts.learnerId, req.user!.id)));
  const num = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);
  res.json({
    overall: { attempts: all.attempts, average: num(all.average), best: num(all.best), averageIrrigation: num(all.avgIrrigation) },
    mine: { attempts: mine.attempts, average: num(mine.average), best: num(mine.best) },
  });
});

// POST /api/scenarios  (trainer)
scenariosRouter.post('/', requireRole('trainer'), async (req, res) => {
  const body = parseBody(scenarioInput, req);
  const weeks = body.weeks ?? CROPS[body.crop as CropId].seasonWeeks;
  validateExtras(body, weeks, req.user!.id);
  const weather = buildWeather({ ...body, weeks });
  const [created] = await db
    .insert(scenarios)
    .values({
      trainerId: req.user!.id,
      title: body.title,
      description: body.description,
      learningGoals: body.learningGoals,
      crop: body.crop,
      soil: body.soil,
      climate: body.climate,
      difficulty: body.difficulty,
      weeks,
      avgTemperatureC: body.avgTemperatureC,
      rainfallMm: weather.rainfallMm,
      temperatureC: weather.temperatureC,
      startMoisturePct: body.startMoisturePct,
      budget: body.budget,
      waterAllowanceMm: body.waterAllowanceMm,
      pestWeeks: [...new Set(body.pestWeeks)].sort((a, b) => a - b),
      imageUrl: body.imageUrl ?? null,
      imagePublicId: body.imagePublicId ?? null,
      isPublished: body.isPublished,
    })
    .returning();
  res.status(201).json({ scenario: serialize(created, req.user!.name) });
});

// PATCH /api/scenarios/:id  (owner trainer)
scenariosRouter.patch('/:id', requireRole('trainer'), async (req, res) => {
  const existing = await loadOwned(String(req.params.id), req.user!.id);
  const body = parseBody(scenarioInput.partial(), req);
  const merged = {
    crop: body.crop ?? existing.crop,
    climate: body.climate ?? existing.climate,
    avgTemperatureC: body.avgTemperatureC ?? existing.avgTemperatureC,
    weeks: body.weeks ?? (body.crop ? CROPS[body.crop].seasonWeeks : existing.weeks),
    pestWeeks: body.pestWeeks ?? existing.pestWeeks,
  };
  validateExtras({ ...body, pestWeeks: merged.pestWeeks }, merged.weeks, req.user!.id);

  const weatherChanged =
    merged.climate !== existing.climate || merged.weeks !== existing.weeks || merged.avgTemperatureC !== existing.avgTemperatureC || !!body.rainfallMm;
  const weather = weatherChanged ? buildWeather({ ...merged, rainfallMm: body.rainfallMm }) : null;

  if (body.imagePublicId !== undefined && existing.imagePublicId && body.imagePublicId !== existing.imagePublicId) {
    await deleteImage(existing.imagePublicId);
  }

  const [updated] = await db
    .update(scenarios)
    .set({
      ...body,
      weeks: merged.weeks,
      pestWeeks: [...new Set(merged.pestWeeks)].sort((a, b) => a - b),
      ...(weather ? { rainfallMm: weather.rainfallMm, temperatureC: weather.temperatureC } : {}),
      updatedAt: new Date(),
    })
    .where(eq(scenarios.id, existing.id))
    .returning();
  res.json({ scenario: serialize(updated, req.user!.name) });
});

// DELETE /api/scenarios/:id  (owner trainer)
scenariosRouter.delete('/:id', requireRole('trainer'), async (req, res) => {
  const existing = await loadOwned(String(req.params.id), req.user!.id);
  await db.delete(scenarios).where(eq(scenarios.id, existing.id));
  await deleteImage(existing.imagePublicId);
  res.status(204).end();
});

// POST /api/scenarios/:id/attempts  (learner submits a completed simulation)
scenariosRouter.post('/:id/attempts', requireRole('learner'), async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Scenario not found');
  const [scenario] = await db.select().from(scenarios).where(and(eq(scenarios.id, id.data), eq(scenarios.isPublished, true))).limit(1);
  if (!scenario) throw notFound('Scenario not found');

  const body = parseBody(
    z.object({
      decisions: z
        .array(
          z.object({
            irrigationMm: z.number().min(0).max(60),
            fertilizer: z.enum(['none', 'low', 'high']),
            pestControl: z.boolean(),
          }),
        )
        .length(scenario.weeks, `Submit exactly ${scenario.weeks} weekly decisions`),
    }),
    req,
  );

  // Server re-runs the engine – the client's own score is never trusted.
  const result = runSimulation(toSimScenario(scenario), body.decisions);
  const [attempt] = await db
    .insert(attempts)
    .values({
      scenarioId: scenario.id,
      learnerId: req.user!.id,
      decisions: body.decisions,
      result,
      totalScore: result.totalScore,
      irrigationScore: result.breakdown.irrigation,
      yieldTonsPerHa: result.yieldTonsPerHa,
      waterUsedMm: result.waterUsedMm,
      profit: result.profit,
    })
    .returning();
  res.status(201).json({ attempt });
});
