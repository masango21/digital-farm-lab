import { and, asc, eq, ne } from 'drizzle-orm';
import { db as defaultDb } from '../db/client';
import { farms, fields, scenarios, sensorReadings, type Scenario } from '../db/schema';
import { CROPS } from '../simulation/crops';
import { runBaseline, weatherAt } from '../simulation/engine';
import { toSimScenario } from './scenario';

type Db = typeof defaultDb;

/** The trainer's farm, created on first use. */
export async function ensureFarm(ownerId: string, ownerName: string, db: Db = defaultDb) {
  const [existing] = await db.select().from(farms).where(eq(farms.ownerId, ownerId)).orderBy(asc(farms.createdAt)).limit(1);
  if (existing) return existing;
  const first = ownerName.trim().split(/\s+/)[0] || 'Trainer';
  const [farm] = await db.insert(farms).values({ ownerId, name: `${first}'s Training Farm` }).returning();
  return farm;
}

/** Creates a field for a new scenario on the trainer's farm. */
export async function createFieldFor(s: Pick<Scenario, 'crop' | 'soil'>, ownerId: string, ownerName: string, db: Db = defaultDb) {
  const farm = await ensureFarm(ownerId, ownerName, db);
  const count = (await db.select({ id: fields.id }).from(fields).where(eq(fields.farmId, farm.id))).length;
  const [field] = await db
    .insert(fields)
    .values({ farmId: farm.id, name: `Field ${count + 1} · ${CROPS[s.crop].name}`, soil: s.soil })
    .returning();
  return field;
}

/**
 * Writes the synthetic weekly sensor feed for a scenario's field: rain gauge and air
 * temperature (the scenario's weather inputs) plus a soil-moisture probe reading
 * from the baseline plan. Replaces any earlier readings for the scenario.
 */
export async function writeSensorReadings(s: Scenario, db: Db = defaultDb) {
  if (!s.fieldId) return;
  const sim = toSimScenario(s);
  const logs = runBaseline(sim).logs;
  const start = s.createdAt.getTime();
  await db.delete(sensorReadings).where(eq(sensorReadings.scenarioId, s.id));
  await db.insert(sensorReadings).values(
    logs.map((l) => {
      const w = weatherAt(sim, l.week);
      return {
        fieldId: s.fieldId!,
        scenarioId: s.id,
        week: l.week,
        recordedAt: new Date(start + l.week * 7 * 86_400_000),
        soilMoisturePct: l.moisturePct,
        rainfallMm: w.rainMm,
        temperatureC: w.temperatureC,
      };
    }),
  );
}

/** Keeps the field's soil in step with its scenario. */
export async function syncFieldSoil(s: Scenario, db: Db = defaultDb) {
  if (s.fieldId) await db.update(fields).set({ soil: s.soil }).where(eq(fields.id, s.fieldId));
}

/** Removes a scenario's field once no other scenario uses it. */
export async function removeFieldIfUnused(fieldId: string | null, exceptScenarioId: string, db: Db = defaultDb) {
  if (!fieldId) return;
  const [other] = await db
    .select({ id: scenarios.id })
    .from(scenarios)
    .where(and(eq(scenarios.fieldId, fieldId), ne(scenarios.id, exceptScenarioId)))
    .limit(1);
  if (!other) await db.delete(fields).where(eq(fields.id, fieldId));
}
