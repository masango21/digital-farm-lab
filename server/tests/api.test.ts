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
process.env.AGRILEARN_WEBHOOK_SECRET = 'agrilearn-test-secret';
process.env.CREDENTIAL_MIN_SCORE = '30';

/** Fake AgriLearn Passport endpoint that records microcredential events. */
const agrilearnEvents: { headers: Record<string, string | string[] | undefined>; body: string }[] = [];
let agrilearn: Server;

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
  const { createServer } = await import('node:http');
  agrilearn = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      agrilearnEvents.push({ headers: req.headers, body });
      res.writeHead(202).end();
    });
  });
  await new Promise<void>((r) => agrilearn.listen(0, '127.0.0.1', r));
  process.env.AGRILEARN_WEBHOOK_URL = `http://127.0.0.1:${(agrilearn.address() as AddressInfo).port}/passport/events`;

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
  agrilearn?.close();
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
  const signupCode = sentCodes['nolo@example.com'];
  assert.ok(signupCode, 'sign-up emails a code');
  delete sentCodes['nolo@example.com'];
  const unverified = await call('POST', '/api/auth/login', { email: 'nolo@example.com', password: 'Password123' });
  assert.equal(unverified.status, 403);
  assert.equal(unverified.json.error.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(sentCodes['nolo@example.com'], undefined, 'login must not email a code');
  sentCodes['nolo@example.com'] = signupCode;

  // Wrong code rejected
  const wrong = await call('POST', '/api/auth/verify-email', { email: 'nolo@example.com', code: '000000' === sentCodes['nolo@example.com'] ? '111111' : '000000' });
  assert.equal(wrong.status, 400);

  const trainer = await signUp('Thandi Trainer', 'thandi@example.com', 'trainer', 'TRAIN-ME');
  const learner = await signUp('Sipho Learner', 'sipho@example.com', 'learner');

  // Duplicate verified email blocked
  const dup = await call('POST', '/api/auth/register', { name: 'Xolani', email: 'sipho@example.com', password: 'Password123' });
  assert.equal(dup.status, 409);

  // verify-email must never give a token for an already-verified account (no password, any code)
  const hijack = await call('POST', '/api/auth/verify-email', { email: 'sipho@example.com', code: '000000' });
  assert.equal(hijack.status, 409);
  assert.equal(hijack.json.error.code, 'ALREADY_VERIFIED');
  assert.equal(hijack.json.token, undefined);

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
  await call('PATCH', `/api/scenarios/${sc.id}`, { difficulty: 'advanced' }, trainer);
  const published = await call('PATCH', `/api/scenarios/${sc.id}`, { isPublished: true }, trainer);
  // A partial update must not reset other settings to their defaults.
  assert.equal(published.json.scenario.difficulty, 'advanced');
  assert.deepEqual(published.json.scenario.pestWeeks, [5]);
  assert.deepEqual(published.json.scenario.rainfallMm, sc.rainfallMm, 'weather unchanged');
  const list = await call('GET', '/api/scenarios', undefined, learner);
  assert.equal(list.json.scenarios.length, 1);

  // Virtual farm: the scenario sits on a field with a weekly synthetic sensor feed.
  const farmsRes = await call('GET', '/api/farms', undefined, learner);
  assert.equal(farmsRes.status, 200);
  assert.equal(farmsRes.json.farms.length, 1);
  const farm = farmsRes.json.farms[0];
  assert.equal(farm.name, "Thandi's Training Farm");
  assert.equal(farm.fields[0].soil, 'loam');
  const feed = farm.fields[0].scenarios[0].readings;
  assert.equal(feed.length, 16);
  assert.deepEqual(feed.map((r: { rainfallMm: number }) => r.rainfallMm), sc.rainfallMm, 'rain gauge = scenario weather');
  assert.ok(feed.every((r: { soilMoisturePct: number; source: string }) => r.soilMoisturePct >= 0 && r.source === 'synthetic'));
  const detail = await call('GET', `/api/scenarios/${sc.id}`, undefined, learner);
  assert.equal(detail.json.scenario.farmName, "Thandi's Training Farm");

  // Golden journey: change one parameter, run, compare with baseline, get a score.
  const exp = await call('POST', `/api/scenarios/${sc.id}/attempts`, {
    mode: 'experiment',
    params: { irrigationChangePct: -20, fertilizerPlan: 'recommended', plantingShiftWeeks: 0 },
  }, learner);
  assert.equal(exp.status, 201, JSON.stringify(exp.json));
  assert.equal(exp.json.attempt.mode, 'experiment');
  assert.equal(exp.json.attempt.decisions.length, 16);
  assert.ok(exp.json.attempt.baseline.waterUsedMm > 0);
  assert.ok(Math.abs(exp.json.attempt.result.waterUsedMm - exp.json.attempt.baseline.waterUsedMm * 0.8) <= 16);
  assert.equal(typeof exp.json.attempt.totalScore, 'number');
  const badExp = await call('POST', `/api/scenarios/${sc.id}/attempts`, { mode: 'experiment', params: { irrigationChangePct: 500 } }, learner);
  assert.equal(badExp.status, 400);

  // Reflection prompts: only the learner who made the run can answer them.
  const answers = [{ prompt: 'Why did yield change?', answer: 'Less water meant the soil dried below the ideal band.' }];
  const refl = await call('PUT', `/api/attempts/${exp.json.attempt.id}/reflection`, { answers }, learner);
  assert.equal(refl.status, 200, JSON.stringify(refl.json));
  assert.deepEqual(refl.json.reflection, answers);
  assert.equal((await call('PUT', `/api/attempts/${exp.json.attempt.id}/reflection`, { answers }, trainer)).status, 404);
  assert.equal((await call('PUT', `/api/attempts/${exp.json.attempt.id}/reflection`, { answers: [{ prompt: 'x', answer: '' }] }, learner)).status, 400);
  const seen = await call('GET', `/api/attempts/${exp.json.attempt.id}`, undefined, trainer);
  assert.deepEqual(seen.json.attempt.reflection, answers, 'trainer can read the reflection');

  // Microcredential: score >= CREDENTIAL_MIN_SCORE (30 in tests) + reflection -> signed event to AgriLearn.
  assert.equal(refl.json.credentialEarned, true);
  for (let i = 0; i < 50 && agrilearnEvents.length === 0; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(agrilearnEvents.length, 1);
  const ev = agrilearnEvents[0];
  const { createHmac } = await import('node:crypto');
  assert.equal(ev.headers['x-dfl-signature'], `sha256=${createHmac('sha256', 'agrilearn-test-secret').update(ev.body).digest('hex')}`);
  const evBody = JSON.parse(ev.body);
  assert.equal(evBody.type, 'microcredential.earned');
  assert.equal(evBody.learner.email, 'sipho@example.com');
  assert.equal(evBody.credential.attemptId, exp.json.attempt.id);
  assert.equal(ev.headers['x-dfl-event-id'], evBody.id);
  const again2 = await call('PUT', `/api/attempts/${exp.json.attempt.id}/reflection`, { answers }, learner);
  assert.equal(again2.json.credentialEarned, false, 'only one credential per scenario');
  const creds = await call('GET', '/api/attempts/credentials/me', undefined, learner);
  assert.equal(creds.json.credentials.length, 1);
  assert.equal(creds.json.credentials[0].status, 'sent');
  const trainerCreds = await call('GET', '/api/trainer/credentials', undefined, trainer);
  assert.equal(trainerCreds.json.agrilearnConnected, true);
  assert.equal(trainerCreds.json.credentials[0].learnerName, 'Sipho Learner');

  // Shareable results: a public read-only page, first name only, can be switched off.
  assert.equal((await call('POST', `/api/attempts/${exp.json.attempt.id}/share`, {}, trainer)).status, 404);
  const share = await call('POST', `/api/attempts/${exp.json.attempt.id}/share`, {}, learner);
  assert.equal(share.status, 200);
  assert.match(share.json.url, /\/share\/[A-Za-z0-9_-]{16}$/);
  const again = await call('POST', `/api/attempts/${exp.json.attempt.id}/share`, {}, learner);
  assert.equal(again.json.url, share.json.url, 'same link when shared twice');
  const publicPage = await fetch(share.json.url.replace(/^https?:\/\/[^/]+/, base));
  const html = await publicPage.text();
  assert.equal(publicPage.status, 200);
  assert.match(html, /Sipho's farm result/);
  assert.match(html, /Irrigation −20%/);
  assert.ok(!html.includes('sipho@example.com') && !html.includes('Learner'), 'no email or surname on the public page');
  assert.equal((await call('DELETE', `/api/attempts/${exp.json.attempt.id}/share`, undefined, learner)).status, 204);
  assert.equal((await fetch(share.json.url.replace(/^https?:\/\/[^/]+/, base))).status, 404);

  // Learner submits two attempts
  const good = Array.from({ length: 16 }, (_, i) => ({ irrigationMm: 20, fertilizer: i < 4 ? 'high' : 'none', pestControl: i === 4 }));
  const lazy = Array.from({ length: 16 }, () => ({ irrigationMm: 0, fertilizer: 'none', pestControl: false }));
  const a1 = await call('POST', `/api/scenarios/${sc.id}/attempts`, { decisions: good }, learner);
  assert.equal(a1.status, 201, JSON.stringify(a1.json));
  const a2 = await call('POST', `/api/scenarios/${sc.id}/attempts`, { decisions: lazy }, learner);
  assert.ok(a1.json.attempt.totalScore > a2.json.attempt.totalScore);
  assert.equal((await call('POST', `/api/scenarios/${sc.id}/attempts`, { decisions: good.slice(1) }, learner)).status, 400);

  const mine = await call('GET', '/api/attempts/me', undefined, learner);
  assert.equal(mine.json.attempts.length, 3);
  const stats = await call('GET', `/api/scenarios/${sc.id}/stats`, undefined, learner);
  assert.equal(stats.json.mine.attempts, 3);

  // Trainer sees learner scores
  const scores = await call('GET', '/api/trainer/scores', undefined, trainer);
  assert.equal(scores.json.scores.length, 3);
  assert.equal(scores.json.scores[0].learnerName, 'Sipho Learner');
  const learners = await call('GET', '/api/trainer/learners', undefined, trainer);
  assert.equal(learners.json.learners[0].attempts, 3);
  const overview = await call('GET', '/api/trainer/overview', undefined, trainer);
  assert.equal(overview.json.scenarios[0].attempts, 3);
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
  const afterDelete = await call('GET', '/api/farms', undefined, trainer);
  assert.equal(afterDelete.json.farms.length, 0, 'empty field removed with its scenario');
});
