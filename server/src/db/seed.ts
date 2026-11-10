/**
 * Seeds one starter scenario per crop, owned by a "Digital Farm Lab Team"
 * system trainer account (which cannot sign in). Safe to run more than once.
 *   npm run db:seed
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db as defaultDb } from './client';
import { farms, scenarios, users } from './schema';
import { createFieldFor, writeSensorReadings } from '../lib/farm';
import { CROPS, type CropId, type SoilType, type Climate } from '../simulation/crops';
import { generateWeather } from '../simulation/engine';

const SYSTEM_EMAIL = 'team@digitalfarmlab.system';

interface Starter {
  title: string;
  description: string;
  learningGoals: string;
  crop: CropId;
  soil: SoilType;
  climate: Climate;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  avgTemperatureC: number;
  startMoisturePct: number;
  budget: number;
  waterAllowanceMm: number;
  pestWeeks: number[];
  seed: number;
}

const STARTERS: Starter[] = [
  {
    title: 'Maize in a Dry Highveld Summer',
    description: 'Rain is unreliable this season. Keep your maize above the 20% wilting point, especially during mid-season when cobs form.',
    learningGoals: 'Irrigation timing · drought stress · critical growth stages',
    crop: 'maize', soil: 'loam', climate: 'dry', difficulty: 'beginner',
    avgTemperatureC: 26, startMoisturePct: 55, budget: 25000, waterAllowanceMm: 420, pestWeeks: [7], seed: 101,
  },
  {
    title: 'Tomatoes on Sandy Soil',
    description: 'Sandy soil drains fast. Tomatoes need steady moisture – plan small, frequent irrigations and watch for whitefly.',
    learningGoals: 'Soil type and water holding · steady moisture · pest scouting',
    crop: 'tomato', soil: 'sandy', climate: 'normal', difficulty: 'intermediate',
    avgTemperatureC: 25, startMoisturePct: 50, budget: 80000, waterAllowanceMm: 380, pestWeeks: [5, 9], seed: 202,
  },
  {
    title: 'Winter Wheat in the Western Cape',
    description: 'A wet winter with regular cold fronts. Your challenge is knowing when NOT to irrigate – avoid waterlogging and wasted water, but watch for dry spells.',
    learningGoals: 'Waterlogging · water efficiency · when NOT to irrigate',
    crop: 'wheat', soil: 'loam', climate: 'wet', difficulty: 'intermediate',
    avgTemperatureC: 15, startMoisturePct: 65, budget: 18000, waterAllowanceMm: 120, pestWeeks: [10], seed: 303,
  },
  {
    title: 'Potatoes with a Tight Water Allowance',
    description: 'Your dam is low and you only have a small irrigation allowance. Shallow potato roots need water often – make every millimetre count.',
    learningGoals: 'Water budgeting · efficiency · trade-offs between yield and cost',
    crop: 'potato', soil: 'loam', climate: 'dry', difficulty: 'advanced',
    avgTemperatureC: 22, startMoisturePct: 50, budget: 60000, waterAllowanceMm: 320, pestWeeks: [6, 11], seed: 404,
  },
  {
    title: 'Quick Spinach for the School Garden',
    description: 'A short 8-week spinach crop. Learn the basics of watering, feeding and protecting leafy greens.',
    learningGoals: 'Basics of irrigation · fertilizer for leafy crops',
    crop: 'spinach', soil: 'loam', climate: 'normal', difficulty: 'beginner',
    avgTemperatureC: 18, startMoisturePct: 60, budget: 22000, waterAllowanceMm: 150, pestWeeks: [4], seed: 505,
  },
];

type Db = typeof defaultDb;

export async function seedDatabase(db: Db = defaultDb) {
  let [trainer] = await db.select().from(users).where(eq(users.email, SYSTEM_EMAIL)).limit(1);
  if (!trainer) {
    [trainer] = await db
      .insert(users)
      .values({
        name: 'Digital Farm Lab Team',
        email: SYSTEM_EMAIL,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        role: 'trainer',
        emailVerified: false, // cannot sign in
      })
      .returning();
    console.log('Created system trainer');
  }

  for (const s of STARTERS) {
    const [exists] = await db
      .select({ id: scenarios.id })
      .from(scenarios)
      .where(and(eq(scenarios.trainerId, trainer.id), eq(scenarios.title, s.title)))
      .limit(1);
    if (exists) {
      console.log(`• exists: ${s.title}`);
      continue;
    }
    const weeks = CROPS[s.crop].seasonWeeks;
    const weather = generateWeather(s.climate, weeks, s.avgTemperatureC, s.seed);
    const { seed: _seed, ...rest } = s;
    await db.insert(scenarios).values({
      ...rest,
      trainerId: trainer.id,
      weeks,
      rainfallMm: weather.rainfallMm,
      temperatureC: weather.temperatureC,
      isPublished: true,
    });
    console.log(`✓ created: ${s.title}`);
  }

  // The demo farm for the starter scenarios (ensureFarm reuses it afterwards).
  const [demoFarm] = await db.select().from(farms).where(eq(farms.ownerId, trainer.id)).limit(1);
  if (!demoFarm) await db.insert(farms).values({ ownerId: trainer.id, name: 'Digital Farm Lab Demo Farm', region: 'Gauteng, South Africa' });

  // Give every scenario without a field (starters and older scenarios) a field + sensor feed.
  const orphans = await db
    .select({ scenario: scenarios, ownerName: users.name })
    .from(scenarios)
    .innerJoin(users, eq(users.id, scenarios.trainerId))
    .where(isNull(scenarios.fieldId));
  for (const { scenario, ownerName } of orphans) {
    const field = await createFieldFor(scenario, scenario.trainerId, ownerName, db);
    const [withField] = await db.update(scenarios).set({ fieldId: field.id }).where(eq(scenarios.id, scenario.id)).returning();
    await writeSensorReadings(withField, db);
    console.log(`✓ field + sensor feed: ${scenario.title}`);
  }
  console.log('Seeding complete');
}

// Run directly with `npm run db:seed`
if (process.argv[1]?.replace(/\\/g, '/').endsWith('db/seed.ts')) {
  seedDatabase().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
