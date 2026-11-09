/**
 * End-to-end API test using an in-memory PGlite Postgres (no Neon needed).
 * Emails are captured from the console log instead of being sent.
 */
import { test, before, after } from 'node:test';
import type { Server } from 'node:http';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.DATABASE_URL = 'pglite://memory';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.TRAINER_INVITE_CODE = 'TRAIN-ME';
process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';
process.env.EMAIL_DEV_LOG_ONLY = 'true';
process.env.NODE_ENV = 'test';

const sentCodes: Record<string, string> = {};
const origLog = console.log;
console.log = (...args: unknown[]) => {
  const msg = args.join(' ');
  const m = msg.match(/to=(\S+)[\s\S]*?code is (\d{6})/);
  if (m) sentCodes[m[1]] = m[2];
};


let base = '';
let server: Server;
let call: (method: string, path: string, body?: unknown, token?: string) => Promise<{ status: number; json: any }>;

before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const schema = await import('../src/db/schema');
  const { setTestDb } = await import('../src/db/client');
  const pg = new PGlite();
  const dir = join(import.meta.dirname, '../drizzle');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(join(dir, f), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await pg.exec(stmt);
    }
  }
  setTestDb(drizzle(pg, { schema }));
  const { createApp } = await import('../src/app');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).catch((e) => {
      throw new Error(`${method} ${path} failed: ${e.cause?.message ?? e.message}`);
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
});

after(() => {
  server?.close();
  console.log = origLog;
});

async function signUp(name: string, email: string, role: 'learner' | 'trainer', trainerCode?: string) {
  const r = await call('POST', '/api/auth/register', { name, email, password: 'Password123', role, trainerCode });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const v = await call('POST', '/api/auth/verify-email', { email, code: sentCodes[email] });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  return v.json.token as string;
}

test('full learner + trainer flow', async () => {
  // Trainer needs invite code
  const bad = await call('POST', '/api/auth/register', { name: 'T', email: 't@example.com', password: 'Password123', role: 'trainer' });
  assert.equal(bad.status, 400);

  // Unverified user cannot log in
  await call('POST', '/api/auth/register', { name: 'Nolo', email: 'nolo@example.com', password: 'Password123' });
  const unverified = await call('POST', '/api/auth/login', { email: 'nolo@example.com', password: 'Password123' });
  assert.equal(unverified.status, 403);
  assert.equal(unverified.json.error.code, 'EMAIL_NOT_VERIFIED');

  // Wrong code rejected
  const wrong = await call('POST', '/api/auth/verify-email', { email: 'nolo@example.com', code: '000000' === sentCodes['nolo@example.com'] ? '111111' : '000000' });
  assert.equal(wrong.status, 400);

  const trainer = await signUp('Thandi Trainer', 'thandi@example.com', 'trainer', 'TRAIN-ME');
  const learner = await signUp('Sipho Learner', 'sipho@example.com', 'learner');

  // Duplicate verified email blocked
  const dup = await call('POST', '/api/auth/register', { name: 'Xolani', email: 'sipho@example.com', password: 'Password123' });
  assert.equal(dup.status, 409);

  // Trainer creates a scenario; learner cannot
  const input = {
    title: 'Dry maize test', description: 'A dry season to test irrigation', crop: 'maize', soil: 'loam', climate: 'dry',
    budget: 30000, waterAllowanceMm: 300, pestWeeks: [5], isPublished: false,
  };
  assert.equal((await call('POST', '/api/scenarios', input, learner)).status, 403);
  const created = await call('POST', '/api/scenarios', input, trainer);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const sc = created.json.scenario;
  assert.equal(sc.weeks, 16);
  assert.equal(sc.rainfallMm.length, 16);

  // Draft not visible to learner
  assert.equal((await call('GET', `/api/scenarios/${sc.id}`, undefined, learner)).status, 404);
  await call('PATCH', `/api/scenarios/${sc.id}`, { isPublished: true }, trainer);
  const list = await call('GET', '/api/scenarios', undefined, learner);
  assert.equal(list.json.scenarios.length, 1);

  // Learner submits two attempts
  const good = Array.from({ length: 16 }, (_, i) => ({ irrigationMm: 20, fertilizer: i < 4 ? 'high' : 'none', pestControl: i === 4 }));
  const lazy = Array.from({ length: 16 }, () => ({ irrigationMm: 0, fertilizer: 'none', pestControl: false }));
  const a1 = await call('POST', `/api/scenarios/${sc.id}/attempts`, { decisions: good }, learner);
  assert.equal(a1.status, 201, JSON.stringify(a1.json));
  const a2 = await call('POST', `/api/scenarios/${sc.id}/attempts`, { decisions: lazy }, learner);
  assert.ok(a1.json.attempt.totalScore > a2.json.attempt.totalScore);
  assert.equal((await call('POST', `/api/scenarios/${sc.id}/attempts`, { decisions: good.slice(1) }, learner)).status, 400);

  const mine = await call('GET', '/api/attempts/me', undefined, learner);
  assert.equal(mine.json.attempts.length, 2);
  const stats = await call('GET', `/api/scenarios/${sc.id}/stats`, undefined, learner);
  assert.equal(stats.json.mine.attempts, 2);

  // Trainer sees learner scores
  const scores = await call('GET', '/api/trainer/scores', undefined, trainer);
  assert.equal(scores.json.scores.length, 2);
  assert.equal(scores.json.scores[0].learnerName, 'Sipho Learner');
  const learners = await call('GET', '/api/trainer/learners', undefined, trainer);
  assert.equal(learners.json.learners[0].attempts, 2);
  const overview = await call('GET', '/api/trainer/overview', undefined, trainer);
  assert.equal(overview.json.scenarios[0].attempts, 2);
  assert.equal((await call('GET', '/api/trainer/scores', undefined, learner)).status, 403);
  assert.equal((await call('GET', `/api/attempts/${a1.json.attempt.id}`, undefined, trainer)).status, 200);

  // Password recovery
  await call('POST', '/api/auth/forgot-password', { email: 'sipho@example.com' });
  const reset = await call('POST', '/api/auth/reset-password', { email: 'sipho@example.com', code: sentCodes['sipho@example.com'], newPassword: 'NewPass456' });
  assert.equal(reset.status, 200, JSON.stringify(reset.json));
  assert.equal((await call('GET', '/api/auth/me', undefined, learner)).status, 401, 'old token revoked after reset');
  const login = await call('POST', '/api/auth/login', { email: 'sipho@example.com', password: 'NewPass456' });
  assert.equal(login.status, 200);

  // Delete scenario
  assert.equal((await call('DELETE', `/api/scenarios/${sc.id}`, undefined, trainer)).status, 204);
});
