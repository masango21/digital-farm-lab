/**
 * Runs the API with an in-memory PGlite Postgres – no Neon account needed.
 * Data is lost when you stop the server. Emails are printed to the console.
 *   npm run dev:local
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.DATABASE_URL = 'pglite://memory';
process.env.JWT_SECRET ??= 'local-dev-secret-local-dev-secret-123456';
process.env.TRAINER_INVITE_CODE ??= 'FARM-TRAINER-2026';
process.env.EMAIL_FROM_ADDRESS ??= 'dev@localhost.test';
process.env.EMAIL_DEV_LOG_ONLY = 'true';
process.env.CLOUDINARY_CLOUD_NAME ??= '';

const { PGlite } = await import('@electric-sql/pglite');
const { drizzle } = await import('drizzle-orm/pglite');
const schema = await import('../src/db/schema');
const { setTestDb } = await import('../src/db/client');

const pg = new PGlite();
const dir = join(import.meta.dirname, '../drizzle');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
  for (const stmt of readFileSync(join(dir, f), 'utf8').split('--> statement-breakpoint')) if (stmt.trim()) await pg.exec(stmt);
}
const db = drizzle(pg, { schema });
setTestDb(db);

const { seedDatabase } = await import('../src/db/seed');
await seedDatabase(db as never);

// Ready-made, already-verified demo accounts (local in-memory mode only).
const bcrypt = (await import('bcryptjs')).default;
const DEMO_PASSWORD = 'Demo1234';
const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
await db.insert(schema.users).values([
  { name: 'Demo Learner', email: 'learner@demo.test', passwordHash: demoHash, role: 'learner', emailVerified: true },
  { name: 'Demo Trainer', email: 'trainer@demo.test', passwordHash: demoHash, role: 'trainer', emailVerified: true },
]);

const { createApp } = await import('../src/app');
const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, '0.0.0.0', () => {
  console.log(`\n🌱 Local API (in-memory DB) on http://localhost:${port}`);
  console.log(`   Trainer invite code: ${process.env.TRAINER_INVITE_CODE}`);
  console.log(`   Demo accounts (password ${DEMO_PASSWORD}): learner@demo.test · trainer@demo.test`);
  console.log('   Verification codes are printed below as [DEV EMAIL]\n');
});
