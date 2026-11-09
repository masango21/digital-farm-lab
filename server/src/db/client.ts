import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../config/env';
import * as schema from './schema';

/**
 * Neon serverless driver over HTTPS – ideal for Render's free tier
 * (no long-lived TCP pool to keep alive, works when Neon scales to zero).
 */
function createDb() {
  return drizzle(neon(env.DATABASE_URL), { schema });
}

type Db = ReturnType<typeof createDb>;

// Tests swap in an in-memory PGlite database via setTestDb().
let instance: Db | null = env.DATABASE_URL.startsWith('pglite') ? null : createDb();

export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    if (!instance) throw new Error('Database not initialised');
    const value = Reflect.get(instance as object, prop);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export function setTestDb(testDb: unknown) {
  instance = testDb as Db;
}

export { schema };
