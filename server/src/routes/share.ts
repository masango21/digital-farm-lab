import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { env } from '../config/env';
import { attempts, scenarios, users } from '../db/schema';
import { CROPS, FERTILIZER_PLANS } from '../simulation/crops';
import { changedParams, type ExperimentParams, type RunSummary } from '../simulation/engine';

/** Public, read-only result pages: GET /share/:token (no sign-in needed). */
export const shareRouter = Router();

export function shareUrl(req: Request, token: string) {
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
  return `${base}/share/${token}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const rand = (n: number) => `${n < 0 ? '−' : ''}R&nbsp;${Math.abs(Math.round(n)).toLocaleString('en-ZA').replace(/\s/g, '&nbsp;')}`;

function describe(mode: string, p: ExperimentParams | null) {
  if (mode !== 'experiment' || !p) return 'Week-by-week plan';
  const c = changedParams(p);
  if (!c.length) return 'Baseline plan';
  return c
    .map((k) =>
      k === 'irrigationChangePct'
        ? `Irrigation ${p.irrigationChangePct > 0 ? '+' : '−'}${Math.abs(p.irrigationChangePct)}%`
        : k === 'fertilizerPlan'
          ? `${FERTILIZER_PLANS[p.fertilizerPlan].label} fertiliser`
          : `Planted ${Math.abs(p.plantingShiftWeeks)} week(s) ${p.plantingShiftWeeks < 0 ? 'early' : 'late'}`,
    )
    .join(' · ');
}

/** Money rows show the rand difference (a % of a near-zero profit is meaningless); others show %. */
function row(label: string, base: number, run: number, fmt: (n: number) => string, lowerIsBetter = false, money = false) {
  const pct = base !== 0 ? ((run - base) / Math.abs(base)) * 100 : run === 0 ? 0 : 100;
  const same = money ? Math.abs(run - base) < 1 : Math.abs(pct) < 0.5;
  const good = lowerIsBetter ? run < base : run > base;
  const cls = same ? 'same' : good ? 'up' : 'down';
  const amount = money ? rand(Math.abs(run - base)) : `${Math.min(999, Math.abs(pct)).toFixed(0)}%`;
  const delta = same ? '=' : `${run > base ? '▲' : '▼'} ${amount}`;
  return `<tr><td>${label}</td><td>${fmt(base)}</td><td><b>${fmt(run)}</b></td><td><span class="pill ${cls}">${delta}</span></td></tr>`;
}

shareRouter.get('/:token', async (req, res) => {
  const token = String(req.params.token);
  const [r] = /^[A-Za-z0-9_-]{10,40}$/.test(token)
    ? await db
        .select({ a: attempts, title: scenarios.title, crop: scenarios.crop, learner: users.name })
        .from(attempts)
        .innerJoin(scenarios, eq(scenarios.id, attempts.scenarioId))
        .innerJoin(users, eq(users.id, attempts.learnerId))
        .where(eq(attempts.shareToken, token))
        .limit(1)
    : [];
  res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex');
  if (!r) {
    res.status(404).type('html').send(page('Link not found', '<h1>Link not found</h1><p>This result is no longer shared.</p>'));
    return;
  }
  const crop = CROPS[r.crop];
  const result = r.a.result;
  const b = r.a.baseline as RunSummary | null;
  const first = esc(r.learner.split(' ')[0] ?? 'A learner');
  const table = b
    ? `<table><thead><tr><th></th><th>Baseline</th><th>This run</th><th>Change</th></tr></thead><tbody>
        ${row('Score', b.totalScore, result.totalScore, (n) => n.toFixed(0))}
        ${row('Yield', b.yieldTonsPerHa, result.yieldTonsPerHa, (n) => `${n.toFixed(1)} t/ha`)}
        ${row('Water used', b.waterUsedMm, result.waterUsedMm, (n) => `${Math.round(n)} mm`, true)}
        ${row('Cost', b.totalCost, result.totalCost, rand, true, true)}
        ${row('Profit', b.profit, result.profit, rand, false, true)}
      </tbody></table>`
    : '';
  const body = `
    <p class="kicker">${crop.emoji} ${esc(r.title)}</p>
    <h1>${first}'s farm result</h1>
    <p class="muted">${esc(describe(r.a.mode, r.a.params))} · ${r.a.createdAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
    <div class="grade"><span class="g g-${result.grade}">${result.grade}</span><span>${result.totalScore.toFixed(1)} / 100</span></div>
    ${b ? '<h2>Compared with the baseline</h2>' + table : ''}
    <p class="note"><b>Teaching model – not agronomic advice.</b> Digital Farm Lab is a simplified simulation with synthetic weather and sensor data.</p>`;
  res.type('html').send(page(`${first}'s ${crop.name} result – Digital Farm Lab`, body));
});

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<style>
:root{--g:#2F6B2F;--bg:#F4F7F2;--t:#1D2A1D;--m:#5B6B5B;--b:#D5DDD2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--t)}
header{background:var(--g);color:#fff;padding:14px 16px;font-weight:800}
main{max-width:560px;margin:16px auto;padding:20px 16px;background:#fff;border:1px solid var(--b);border-radius:16px}
@media(max-width:600px){main{margin:12px}}
h1{font-size:24px;margin:4px 0}h2{font-size:17px;margin:24px 0 8px}.kicker{color:var(--g);font-weight:700;margin:0;font-size:14px}
.muted{color:var(--m);margin:4px 0 0;font-size:14px}
.grade{display:flex;align-items:baseline;gap:12px;margin-top:16px;font-size:18px;font-weight:700}
.g{font-size:56px;font-weight:900;line-height:1}.g-A{color:#1E8449}.g-B{color:#58A23C}.g-C{color:#E9A23B}.g-D{color:#B9770E}.g-F{color:#C0392B}
table{width:100%;border-collapse:collapse;font-size:14px}th{font-size:11px;text-transform:uppercase;color:var(--m);text-align:right;padding:6px 4px}
td{padding:9px 4px;border-top:1px solid var(--b);text-align:right}td:first-child,th:first-child{text-align:left;color:var(--m)}
.pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:700}.up{background:#E8F3E3;color:#1E8449}.down{background:#FADBD8;color:#C0392B}.same{background:var(--bg);color:var(--m)}
.note{margin-top:24px;padding:12px;background:#FCF3CF;border-radius:10px;font-size:13px;color:#7a5a0a}
</style></head><body><header>🌱 Digital Farm Lab</header><main>${body}</main></body></html>`;
}
