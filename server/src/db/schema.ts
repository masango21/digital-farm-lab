import { pgTable, pgView, pgEnum, uuid, text, boolean, integer, real, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { WeekDecision, SimResult, ExperimentParams, RunSummary } from '../simulation/engine';

export const roleEnum = pgEnum('user_role', ['learner', 'trainer']);
export const codePurposeEnum = pgEnum('code_purpose', ['verify_email', 'reset_password']);
export const cropEnum = pgEnum('crop', ['maize', 'tomato', 'wheat', 'potato', 'spinach']);
export const soilEnum = pgEnum('soil', ['sandy', 'loam', 'clay']);
export const climateEnum = pgEnum('climate', ['dry', 'normal', 'wet']);
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
/** weekly = learner made every weekly decision; experiment = changed one parameter of the baseline plan. */
export const runModeEnum = pgEnum('run_mode', ['weekly', 'experiment']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('learner'),
    emailVerified: boolean('email_verified').notNull().default(false),
    /** Bumped on password reset so old JWTs stop working. */
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const emailCodes = pgTable(
  'email_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: codePurposeEnum('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_codes_user_purpose_idx').on(t.userId, t.purpose)],
);

/** A virtual training farm. Each trainer gets one automatically. */
export const farms = pgTable(
  'farms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    region: text('region').notNull().default('South Africa'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('farms_owner_idx').on(t.ownerId)],
);

/** A field (plot) on a farm. Each scenario is played on one field. */
export const fields = pgTable(
  'fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    areaHa: real('area_ha').notNull().default(1),
    soil: soilEnum('soil').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('fields_farm_idx').on(t.farmId)],
);

export const scenarios = pgTable(
  'scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainerId: uuid('trainer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fieldId: uuid('field_id').references(() => fields.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    learningGoals: text('learning_goals').notNull().default(''),
    crop: cropEnum('crop').notNull(),
    soil: soilEnum('soil').notNull(),
    climate: climateEnum('climate').notNull(),
    difficulty: difficultyEnum('difficulty').notNull().default('beginner'),
    weeks: integer('weeks').notNull(),
    avgTemperatureC: real('avg_temperature_c').notNull(),
    rainfallMm: jsonb('rainfall_mm').$type<number[]>().notNull(),
    temperatureC: jsonb('temperature_c').$type<number[]>().notNull(),
    startMoisturePct: real('start_moisture_pct').notNull(),
    budget: real('budget').notNull(),
    waterAllowanceMm: real('water_allowance_mm').notNull(),
    pestWeeks: jsonb('pest_weeks').$type<number[]>().notNull(),
    /** Optional AgriLearn module this scenario belongs to (sent with microcredentials). */
    agrilearnModuleCode: text('agrilearn_module_code'),
    imageUrl: text('image_url'),
    imagePublicId: text('image_public_id'),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scenarios_trainer_idx').on(t.trainerId), index('scenarios_published_idx').on(t.isPublished)],
);

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    learnerId: uuid('learner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: runModeEnum('mode').notNull().default('weekly'),
    /** Experiment parameters (null for weekly runs). */
    params: jsonb('params').$type<ExperimentParams>(),
    decisions: jsonb('decisions').$type<WeekDecision[]>().notNull(),
    result: jsonb('result').$type<SimResult>().notNull(),
    /** The scenario's baseline run at the time of this attempt, for comparison. */
    baseline: jsonb('baseline').$type<RunSummary>(),
    /** Learner's answers to the reflection prompts shown after the run. */
    reflection: jsonb('reflection').$type<{ prompt: string; answer: string }[]>(),
    reflectedAt: timestamp('reflected_at', { withTimezone: true }),
    /** Random token for the public, read-only share link (null = not shared). */
    shareToken: text('share_token'),
    totalScore: real('total_score').notNull(),
    irrigationScore: real('irrigation_score').notNull(),
    yieldTonsPerHa: real('yield_tons_per_ha').notNull(),
    waterUsedMm: real('water_used_mm').notNull(),
    profit: real('profit').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('attempts_learner_idx').on(t.learnerId),
    index('attempts_scenario_idx').on(t.scenarioId),
    uniqueIndex('attempts_share_token_idx').on(t.shareToken),
  ],
);

/**
 * Synthetic weekly sensor feed for a field during a scenario's season: soil-moisture
 * probe (from the baseline plan), rain gauge and air temperature. These readings are
 * the weather inputs that drive the crop model.
 */
export const sensorReadings = pgTable(
  'sensor_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    week: integer('week').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    soilMoisturePct: real('soil_moisture_pct').notNull(),
    rainfallMm: real('rainfall_mm').notNull(),
    temperatureC: real('temperature_c').notNull(),
    source: text('source').notNull().default('synthetic'),
  },
  (t) => [uniqueIndex('sensor_readings_scenario_week_idx').on(t.scenarioId, t.week), index('sensor_readings_field_idx').on(t.fieldId)],
);

export const deliveryStatusEnum = pgEnum('delivery_status', ['pending', 'sent', 'failed']);

/**
 * Outbox of microcredential events for the AgriLearn Passport. One per learner per
 * scenario. Delivered to AGRILEARN_WEBHOOK_URL and retried until accepted.
 */
export const credentialEvents = pgTable(
  'credential_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    learnerId: uuid('learner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('microcredential.earned'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: deliveryStatusEnum('status').notNull().default('pending'),
    deliveryAttempts: integer('delivery_attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('credential_events_learner_scenario_idx').on(t.learnerId, t.scenarioId), index('credential_events_status_idx').on(t.status)],
);

/** "runs" and "scores" from the spec: read-only views over attempts. */
export const runs = pgView('runs').as((qb) =>
  qb
    .select({
      id: attempts.id,
      scenarioId: attempts.scenarioId,
      learnerId: attempts.learnerId,
      mode: attempts.mode,
      params: attempts.params,
      decisions: attempts.decisions,
      createdAt: attempts.createdAt,
    })
    .from(attempts),
);

export const scores = pgView('scores').as((qb) =>
  qb
    .select({
      runId: attempts.id,
      scenarioId: attempts.scenarioId,
      learnerId: attempts.learnerId,
      totalScore: attempts.totalScore,
      irrigationScore: attempts.irrigationScore,
      yieldTonsPerHa: attempts.yieldTonsPerHa,
      waterUsedMm: attempts.waterUsedMm,
      profit: attempts.profit,
      createdAt: attempts.createdAt,
    })
    .from(attempts),
);

export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type Field = typeof fields.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
