import { Router } from 'express';
import { and, asc, eq, inArray, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { farms, fields, scenarios, sensorReadings } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { CROPS, SOILS } from '../simulation/crops';

export const farmsRouter = Router();
farmsRouter.use(requireAuth);

/**
 * GET /api/farms – the virtual farms with their fields, the scenarios on each field
 * and each scenario's synthetic weekly sensor feed. Learners see fields with published
 * scenarios; trainers also see their own drafts.
 */
farmsRouter.get('/', async (req, res) => {
  const user = req.user!;
  const visible: SQL =
    user.role === 'trainer' ? or(eq(scenarios.isPublished, true), eq(scenarios.trainerId, user.id))! : eq(scenarios.isPublished, true);

  const rows = await db
    .select({
      farmId: farms.id,
      farmName: farms.name,
      region: farms.region,
      ownerId: farms.ownerId,
      fieldId: fields.id,
      fieldName: fields.name,
      areaHa: fields.areaHa,
      soil: fields.soil,
      scenarioId: scenarios.id,
      title: scenarios.title,
      crop: scenarios.crop,
      isPublished: scenarios.isPublished,
      weeks: scenarios.weeks,
    })
    .from(scenarios)
    .innerJoin(fields, eq(fields.id, scenarios.fieldId))
    .innerJoin(farms, eq(farms.id, fields.farmId))
    .where(and(visible))
    .orderBy(asc(farms.createdAt), asc(fields.createdAt));

  const ids = rows.map((r) => r.scenarioId);
  const readings = ids.length
    ? await db
        .select({
          scenarioId: sensorReadings.scenarioId,
          week: sensorReadings.week,
          recordedAt: sensorReadings.recordedAt,
          soilMoisturePct: sensorReadings.soilMoisturePct,
          rainfallMm: sensorReadings.rainfallMm,
          temperatureC: sensorReadings.temperatureC,
          source: sensorReadings.source,
        })
        .from(sensorReadings)
        .where(inArray(sensorReadings.scenarioId, ids))
        .orderBy(asc(sensorReadings.week))
    : [];

  type FieldOut = {
    id: string;
    name: string;
    areaHa: number;
    soil: string;
    soilName: string;
    scenarios: {
      id: string;
      title: string;
      crop: string;
      cropName: string;
      cropEmoji: string;
      isPublished: boolean;
      weeks: number;
      optimalMoisture: [number, number];
      readings: Omit<(typeof readings)[number], 'scenarioId'>[];
    }[];
  };
  const out = new Map<string, { id: string; name: string; region: string; isMine: boolean; fields: Map<string, FieldOut> }>();
  for (const r of rows) {
    if (!out.has(r.farmId)) out.set(r.farmId, { id: r.farmId, name: r.farmName, region: r.region, isMine: r.ownerId === user.id, fields: new Map() });
    const farm = out.get(r.farmId)!;
    if (!farm.fields.has(r.fieldId))
      farm.fields.set(r.fieldId, { id: r.fieldId, name: r.fieldName, areaHa: r.areaHa, soil: r.soil, soilName: SOILS[r.soil].name, scenarios: [] });
    const crop = CROPS[r.crop];
    farm.fields.get(r.fieldId)!.scenarios.push({
      id: r.scenarioId,
      title: r.title,
      crop: r.crop,
      cropName: crop.name,
      cropEmoji: crop.emoji,
      isPublished: r.isPublished,
      weeks: r.weeks,
      optimalMoisture: crop.optimalMoisture,
      readings: readings.filter((x) => x.scenarioId === r.scenarioId).map(({ scenarioId: _s, ...rest }) => rest),
    });
  }
  res.json({ farms: [...out.values()].map((f) => ({ ...f, fields: [...f.fields.values()] })) });
});
