import { pgTable, pgEnum, uuid, text, boolean, integer, real, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { WeekDecision, SimResult } from '../simulation/engine';

export const roleEnum = pgEnum('user_role', ['learner', 'trainer']);
export const codePurposeEnum = pgEnum('code_purpose', ['verify_email', 'reset_password']);
export const cropEnum = pgEnum('crop', ['maize', 'tomato', 'wheat', 'potato', 'spinach']);
export const soilEnum = pgEnum('soil', ['sandy', 'loam', 'clay']);
export const climateEnum = pgEnum('climate', ['dry', 'normal', 'wet']);
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);

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

export const scenarios = pgTable(
  'scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trainerId: uuid('trainer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    decisions: jsonb('decisions').$type<WeekDecision[]>().notNull(),
    result: jsonb('result').$type<SimResult>().notNull(),
    totalScore: real('total_score').notNull(),
    irrigationScore: real('irrigation_score').notNull(),
    yieldTonsPerHa: real('yield_tons_per_ha').notNull(),
    waterUsedMm: real('water_used_mm').notNull(),
    profit: real('profit').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attempts_learner_idx').on(t.learnerId), index('attempts_scenario_idx').on(t.scenarioId)],
);

export type User = typeof users.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
