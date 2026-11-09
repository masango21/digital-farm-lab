import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, generateWeather, type SimScenario, type WeekDecision } from '../src/simulation/engine';
import { CROPS, type CropId } from '../src/simulation/crops';

function scenario(crop: CropId, climate: 'dry' | 'normal' | 'wet' = 'dry'): SimScenario {
  const weeks = CROPS[crop].seasonWeeks;
  const w = generateWeather(climate, weeks, 25, 7);
  return { crop, soil: 'loam', weeks, ...w, startMoisturePct: 55, budget: 100000, waterAllowanceMm: 400, pestWeeks: [3] };
}

/** A sensible strategy: irrigate when dry, fertilize early, spray on pest week. */
function smartDecisions(s: SimScenario): WeekDecision[] {
  return Array.from({ length: s.weeks }, (_, i) => ({
    irrigationMm: s.rainfallMm[i] < 15 ? 30 : s.rainfallMm[i] < 30 ? 10 : 0,
    fertilizer: i < Math.ceil(CROPS[s.crop].nitrogenNeed / 2) ? 'high' : 'none',
    pestControl: s.pestWeeks.includes(i + 1),
  }));
}

test('weather generation is deterministic', () => {
  assert.deepEqual(generateWeather('dry', 10, 25, 1), generateWeather('dry', 10, 25, 1));
});

for (const crop of Object.keys(CROPS) as CropId[]) {
  test(`${crop}: good management beats neglect`, () => {
    const s = scenario(crop);
    const good = runSimulation(s, smartDecisions(s));
    const neglect = runSimulation(s, []);
    assert.ok(good.totalScore > neglect.totalScore, `${good.totalScore} should be > ${neglect.totalScore}`);
    assert.ok(good.totalScore >= 0 && good.totalScore <= 100);
    assert.equal(good.logs.length, s.weeks);
    assert.ok(neglect.weeksBelowWilting > 0, 'neglect in a dry season should hit the 20% wilting point');
  });
}

test('irrigation is weighted 20% of the total', () => {
  const s = scenario('maize');
  const r = runSimulation(s, smartDecisions(s));
  const b = r.breakdown;
  const expected = (b.yield * 35 + b.irrigation * 20 + b.soil * 15 + b.pest * 15 + b.profit * 15) / 100;
  assert.ok(Math.abs(r.totalScore - expected) < 0.2);
});

test('over-irrigating wastes water and lowers irrigation score', () => {
  const s = scenario('wheat', 'wet');
  const flood = runSimulation(s, Array.from({ length: s.weeks }, () => ({ irrigationMm: 40, fertilizer: 'none' as const, pestControl: false })));
  const smart = runSimulation(s, smartDecisions(s));
  assert.ok(flood.breakdown.irrigation < smart.breakdown.irrigation);
});
