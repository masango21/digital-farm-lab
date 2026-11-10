import { createHmac } from 'node:crypto';
import { and, asc, eq, inArray, lt, or } from 'drizzle-orm';
import { db } from '../db/client';
import { attempts, credentialEvents, scenarios, users } from '../db/schema';
import { env } from '../config/env';
import { CROPS } from '../simulation/crops';

const MAX_DELIVERY_ATTEMPTS = 8;

/**
 * Issues the scenario's microcredential once a learner has a run that scored at least
 * CREDENTIAL_MIN_SCORE and has answered its reflection prompts. Idempotent: one
 * credential per learner per scenario. Returns true when a new one was issued.
 */
export async function maybeIssueCredential(attemptId: string): Promise<boolean> {
  const [r] = await db
    .select({ a: attempts, s: scenarios, u: users })
    .from(attempts)
    .innerJoin(scenarios, eq(scenarios.id, attempts.scenarioId))
    .innerJoin(users, eq(users.id, attempts.learnerId))
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!r || r.a.totalScore < env.CREDENTIAL_MIN_SCORE || !r.a.reflectedAt) return false;

  const crop = CROPS[r.s.crop];
  const occurredAt = new Date().toISOString();
  const payload = {
    type: 'microcredential.earned',
    occurredAt,
    issuer: { name: 'Digital Farm Lab', app: 'digital-farm-lab' },
    // Identity: AgriLearn matches the learner by verified email.
    learner: { id: r.u.id, email: r.u.email, name: r.u.name, emailVerified: r.u.emailVerified },
    credential: {
      code: `DFL-${r.s.crop.toUpperCase()}-${r.s.id.slice(0, 8)}`,
      title: `Digital Farm Lab: ${r.s.title}`,
      description: `Ran a ${crop.name.toLowerCase()} scenario, scored ${r.a.totalScore.toFixed(0)}/100 and reflected on the trade-offs.`,
      agrilearnModuleCode: r.s.agrilearnModuleCode,
      scenarioId: r.s.id,
      attemptId: r.a.id,
      score: r.a.totalScore,
      grade: r.a.result.grade,
      mode: r.a.mode,
    },
  };
  const inserted = await db
    .insert(credentialEvents)
    .values({ learnerId: r.u.id, scenarioId: r.s.id, attemptId: r.a.id, payload })
    .onConflictDoNothing()
    .returning({ id: credentialEvents.id });
  if (inserted.length) void deliverPendingCredentials().catch((e) => console.warn('Credential delivery failed', e));
  return inserted.length > 0;
}

export function signPayload(body: string): string {
  return `sha256=${createHmac('sha256', env.AGRILEARN_WEBHOOK_SECRET).update(body).digest('hex')}`;
}

let running = false;

/** Sends pending (and retryable failed) events to AgriLearn. Safe to call often. */
export async function deliverPendingCredentials(): Promise<{ sent: number; failed: number }> {
  if (!env.AGRILEARN_WEBHOOK_URL || running) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const due = await db
      .select()
      .from(credentialEvents)
      .where(
        and(
          inArray(credentialEvents.status, ['pending', 'failed']),
          or(eq(credentialEvents.status, 'pending'), lt(credentialEvents.deliveryAttempts, MAX_DELIVERY_ATTEMPTS)),
        ),
      )
      .orderBy(asc(credentialEvents.createdAt))
      .limit(25);
    for (const ev of due) {
      const body = JSON.stringify({ id: ev.id, ...ev.payload });
      let error: string | null = null;
      try {
        const res = await fetch(env.AGRILEARN_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-dfl-event-id': ev.id, // lets AgriLearn ignore duplicates
            'x-dfl-signature': signPayload(body),
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) error = `HTTP ${res.status}`;
      } catch (e) {
        error = (e as Error).message;
      }
      await db
        .update(credentialEvents)
        .set(
          error
            ? { status: 'failed', lastError: error.slice(0, 500), deliveryAttempts: ev.deliveryAttempts + 1 }
            : { status: 'sent', lastError: null, sentAt: new Date(), deliveryAttempts: ev.deliveryAttempts + 1 },
        )
        .where(eq(credentialEvents.id, ev.id));
      if (error) failed++;
      else sent++;
    }
  } finally {
    running = false;
  }
  return { sent, failed };
}
