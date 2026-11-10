/**
 * Digital Farm Lab simulation engine (pure TypeScript, no dependencies).
 *
 * SHARED FILE: an identical copy lives in mobile/src/simulation/engine.ts.
 * The mobile app runs it week by week for the interactive simulation; the
 * server re-runs it from the submitted decisions to get the official score,
 * so learners cannot fake results.
 *
 * Scoring weights (total 100):
 *   Yield 35 · Irrigation 20 · Soil & nutrients 15 · Pest management 15 · Profit 15
 * Soil moisture below 20% (wilting point) causes heavy crop damage.
 */
import {
  CROPS,
  SOILS,
  COSTS,
  FERTILIZER_UNITS,
  FERTILIZER_PLANS,
  PLANTING_TEMP_PER_WEEK,
  PLANTING_YIELD_PENALTY_PER_WEEK,
  WILTING_POINT_PCT,
  WATERLOGGING_PCT,
  type CropId,
  type SoilType,
  type Climate,
  type GrowthStage,
  type FertilizerLevel,
  type FertilizerPlan,
} from './crops';

export const SCORE_WEIGHTS = {
  yield: 35,
  irrigation: 20,
  soil: 15,
  pest: 15,
  profit: 15,
} as const;

export interface SimScenario {
  crop: CropId;
  soil: SoilType;
  weeks: number;
  rainfallMm: number[];
  temperatureC: number[];
  startMoisturePct: number;
  budget: number;
  waterAllowanceMm: number;
  /** 1-based week numbers when a pest outbreak happens. */
  pestWeeks: number[];
  /** Planting date shift in weeks from the recommended date (0 = recommended). */
  plantingShiftWeeks?: number;
}

export interface WeekDecision {
  irrigationMm: number;
  fertilizer: FertilizerLevel;
  pestControl: boolean;
}

export interface WeekLog {
  week: number;
  stage: GrowthStage;
  rainMm: number;
  irrigationMm: number;
  temperatureC: number;
  evapotranspirationMm: number;
  runoffMm: number;
  moisturePct: number;
  cropHealthPct: number;
  pestOutbreak: boolean;
  events: string[];
}

export interface SimState {
  week: number; // weeks completed
  moistureMm: number;
  health: number; // 0..1 multiplicative crop health
  nitrogenApplied: number;
  irrigationTotalMm: number;
  irrigationWastedMm: number;
  rainTotalMm: number;
  weeksInOptimal: number;
  /** Weeks in the optimal band, or too wet while the learner (correctly) did not irrigate. */
  weeksWellManaged: number;
  weeksBelowWilting: number;
  weeksWaterlogged: number;
  /** Waterlogged weeks where the learner still irrigated. */
  weeksOverwatered: number;
  pestOutbreaks: number;
  pestOutbreaksControlled: number;
  unnecessarySprays: number;
  costs: { water: number; fertilizer: number; pest: number; fixed: number };
  logs: WeekLog[];
}

export interface ScoreBreakdown {
  yield: number;
  irrigation: number;
  soil: number;
  pest: number;
  profit: number;
}

export interface SimResult {
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: ScoreBreakdown;
  yieldTonsPerHa: number;
  potentialYield: number;
  revenue: number;
  totalCost: number;
  profit: number;
  overBudget: boolean;
  waterUsedMm: number;
  waterAllowanceMm: number;
  weeksInOptimal: number;
  weeksBelowWilting: number;
  feedback: string[];
  logs: WeekLog[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export function stageForWeek(cropId: CropId, week: number, totalWeeks: number): GrowthStage {
  const split = CROPS[cropId].stageSplit;
  const progress = (week - 0.5) / totalWeeks;
  let acc = 0;
  for (const stage of ['initial', 'development', 'mid-season', 'late-season'] as GrowthStage[]) {
    acc += split[stage];
    if (progress <= acc) return stage;
  }
  return 'late-season';
}

/** Reference evapotranspiration for a week (mm) from mean temperature. */
export function weeklyET0(tempC: number): number {
  return 7 * Math.max(1, 0.17 * tempC + 0.6);
}

/** Deterministic pseudo-random generator so the same seed = same weather. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generates weekly rainfall + temperature for a climate preset. */
export function generateWeather(
  climate: Climate,
  weeks: number,
  avgTempC: number,
  seed = 42,
): { rainfallMm: number[]; temperatureC: number[] } {
  const rand = mulberry32(seed);
  const meanRain = { dry: 8, normal: 22, wet: 32 }[climate];
  const rainfallMm: number[] = [];
  const temperatureC: number[] = [];
  for (let w = 0; w < weeks; w++) {
    const dryWeek = rand() < (climate === 'dry' ? 0.5 : climate === 'normal' ? 0.25 : 0.1);
    const rain = dryWeek ? 0 : meanRain * (0.4 + rand() * 1.4);
    rainfallMm.push(Math.round(rain));
    temperatureC.push(round(avgTempC + (rand() - 0.5) * 6, 0));
  }
  return { rainfallMm, temperatureC };
}

/**
 * Weather for a given week (1-based), taking the planting shift into account.
 * Shifting planting moves the season along the weather record (reflected at the
 * ends so values stay realistic) and changes temperature a little per week.
 */
export function weatherAt(scenario: SimScenario, week: number): { rainMm: number; temperatureC: number } {
  const shift = Math.round(scenario.plantingShiftWeeks ?? 0);
  const n = scenario.rainfallMm.length;
  if (n === 0) return { rainMm: 0, temperatureC: 22 };
  let idx = week - 1 + shift;
  // Reflect out-of-range weeks back into the record: -1 -> 0, -2 -> 1, n -> n-1, ...
  while (idx < 0 || idx >= n) idx = idx < 0 ? -idx - 1 : 2 * n - idx - 1;
  const baseTemp = scenario.temperatureC[idx] ?? 22;
  return { rainMm: scenario.rainfallMm[idx] ?? 0, temperatureC: round(baseTemp + shift * PLANTING_TEMP_PER_WEEK, 0) };
}

export function createInitialState(scenario: SimScenario): SimState {
  const soil = SOILS[scenario.soil];
  return {
    week: 0,
    moistureMm: (clamp(scenario.startMoisturePct, 0, 100) / 100) * soil.capacityMm,
    health: 1,
    nitrogenApplied: 0,
    irrigationTotalMm: 0,
    irrigationWastedMm: 0,
    rainTotalMm: 0,
    weeksInOptimal: 0,
    weeksWellManaged: 0,
    weeksBelowWilting: 0,
    weeksWaterlogged: 0,
    weeksOverwatered: 0,
    pestOutbreaks: 0,
    pestOutbreaksControlled: 0,
    unnecessarySprays: 0,
    costs: { water: 0, fertilizer: 0, pest: 0, fixed: COSTS.fixedPerCrop[scenario.crop] },
    logs: [],
  };
}

export function sanitizeDecision(d: Partial<WeekDecision> | undefined): WeekDecision {
  return {
    irrigationMm: clamp(Math.round(Number(d?.irrigationMm) || 0), 0, 60),
    fertilizer: d?.fertilizer === 'low' || d?.fertilizer === 'high' ? d.fertilizer : 'none',
    pestControl: Boolean(d?.pestControl),
  };
}

/** Advances the simulation by one week. Returns a NEW state (immutable). */
export function stepWeek(scenario: SimScenario, prev: SimState, rawDecision: Partial<WeekDecision>): SimState {
  const decision = sanitizeDecision(rawDecision);
  const crop = CROPS[scenario.crop];
  const soil = SOILS[scenario.soil];
  const week = prev.week + 1;
  const stage = stageForWeek(scenario.crop, week, scenario.weeks);
  const { rainMm: rain, temperatureC: temp } = weatherAt(scenario, week);
  const events: string[] = [];

  const s: SimState = {
    ...prev,
    week,
    costs: { ...prev.costs },
    logs: [...prev.logs],
  };

  // --- Water balance ---------------------------------------------------
  const et = weeklyET0(temp) * crop.kc[stage];
  let water = s.moistureMm + rain + decision.irrigationMm - et;
  let runoff = 0;
  if (water > soil.capacityMm) {
    runoff = water - soil.capacityMm;
    water = soil.capacityMm;
  }
  water = Math.max(0, water);
  water -= water * soil.weeklyDrainage;
  s.moistureMm = water;
  const moisturePct = (water / soil.capacityMm) * 100;

  // Any runoff in a week you irrigated counts as wasted irrigation water:
  // the soil was already full, so that water was not needed.
  s.irrigationTotalMm += decision.irrigationMm;
  s.irrigationWastedMm += Math.min(decision.irrigationMm, runoff);
  s.rainTotalMm += rain;
  s.costs.water += decision.irrigationMm * COSTS.waterPerMm;

  // --- Water stress ------------------------------------------------------
  const sensitivity = stage === 'mid-season' ? 1.5 : stage === 'initial' ? 0.8 : 1;
  const [optMin, optMax] = crop.optimalMoisture;
  let loss = 0;
  if (moisturePct < WILTING_POINT_PCT) {
    loss += 0.1 * sensitivity;
    s.weeksBelowWilting += 1;
    events.push(`⚠️ Soil moisture ${Math.round(moisturePct)}% is below the 20% wilting point – plants are wilting.`);
  } else if (moisturePct < optMin) {
    loss += 0.025 * sensitivity;
    events.push('Soil is drier than ideal – mild water stress.');
  } else if (moisturePct > WATERLOGGING_PCT) {
    loss += 0.04;
    s.weeksWaterlogged += 1;
    if (decision.irrigationMm > 0) {
      s.weeksOverwatered += 1;
      events.push('💧 Soil is waterlogged and you still irrigated – roots are short of oxygen.');
    } else {
      s.weeksWellManaged += 1;
      events.push('💧 Heavy rain waterlogged the soil. Good call not irrigating.');
    }
  } else if (moisturePct > optMax) {
    loss += 0.01;
    if (decision.irrigationMm === 0) s.weeksWellManaged += 1;
    events.push('Soil is wetter than ideal.');
  } else {
    s.weeksInOptimal += 1;
    s.weeksWellManaged += 1;
  }

  // --- Heat stress -----------------------------------------------------
  if (temp >= 35) {
    loss += 0.03;
    events.push(`🔥 Heat wave (${temp}°C) stressed the crop.`);
  }

  // --- Fertilizer --------------------------------------------------------
  const units = FERTILIZER_UNITS[decision.fertilizer];
  if (units > 0) {
    s.nitrogenApplied += units;
    s.costs.fertilizer += units * COSTS.fertilizerPerUnit;
    if (stage === 'late-season') events.push('Fertilizer late in the season is mostly wasted.');
  }

  // --- Pests -------------------------------------------------------------
  const outbreak = scenario.pestWeeks.includes(week);
  if (decision.pestControl) s.costs.pest += COSTS.pestSpray;
  if (outbreak) {
    s.pestOutbreaks += 1;
    if (decision.pestControl) {
      s.pestOutbreaksControlled += 1;
      events.push('🐛 Pest outbreak controlled.');
    } else {
      loss += 0.12 * crop.pestSusceptibility;
      events.push('🐛 Pest outbreak was not controlled – crop damaged.');
    }
  } else if (decision.pestControl) {
    s.unnecessarySprays += 1;
    events.push('Spraying with no pests present costs money and harms beneficial insects.');
  }

  s.health = clamp(s.health * (1 - loss), 0, 1);

  s.logs.push({
    week,
    stage,
    rainMm: rain,
    irrigationMm: decision.irrigationMm,
    temperatureC: temp,
    evapotranspirationMm: round(et),
    runoffMm: round(runoff),
    moisturePct: round(moisturePct),
    cropHealthPct: round(s.health * 100),
    pestOutbreak: outbreak,
    events,
  });
  return s;
}

/** Converts a finished state into scores and feedback. */
export function scoreSimulation(scenario: SimScenario, s: SimState): SimResult {
  const crop = CROPS[scenario.crop];
  const weeks = Math.max(1, s.week);
  const feedback: string[] = [];

  // Nutrients: 60% of yield possible with zero fertilizer.
  const nRatio = s.nitrogenApplied / crop.nitrogenNeed;
  const nutrientFactor = clamp(0.6 + 0.4 * Math.min(1, nRatio), 0.6, 1);
  // Planting away from the recommended date shortens the useful season a little.
  const shiftWeeks = Math.abs(Math.round(scenario.plantingShiftWeeks ?? 0));
  const plantingFactor = clamp(1 - shiftWeeks * PLANTING_YIELD_PENALTY_PER_WEEK, 0.5, 1);
  const yieldTons = crop.potentialYield * s.health * nutrientFactor * plantingFactor;

  const yieldScore = clamp((yieldTons / crop.potentialYield) * 100, 0, 100);

  // Irrigation (20%): time in the optimal band + water efficiency + allowance.
  const optimalPct = (s.weeksInOptimal / weeks) * 100;
  const managedPct = (s.weeksWellManaged / weeks) * 100;
  const efficiency = s.irrigationTotalMm > 0 ? 100 - (s.irrigationWastedMm / s.irrigationTotalMm) * 100 : 100;
  const overAllowance = Math.max(0, s.irrigationTotalMm - scenario.waterAllowanceMm);
  const allowancePenalty = scenario.waterAllowanceMm > 0 ? (overAllowance / scenario.waterAllowanceMm) * 100 : 0;
  const irrigationScore = clamp(0.7 * managedPct + 0.3 * efficiency - allowancePenalty - s.weeksBelowWilting * 5, 0, 100);

  // Soil & nutrients: right amount of fertilizer, no waterlogging.
  let soilScore = 100;
  if (nRatio < 1) soilScore -= (1 - nRatio) * 50;
  if (nRatio > 1.3) soilScore -= Math.min(50, (nRatio - 1.3) * 80);
  soilScore -= s.weeksOverwatered * 10;
  soilScore = clamp(soilScore, 0, 100);

  // Pest management: control outbreaks, avoid unnecessary sprays.
  const pestControlRate = s.pestOutbreaks > 0 ? s.pestOutbreaksControlled / s.pestOutbreaks : 1;
  const pestScore = clamp(pestControlRate * 100 - s.unnecessarySprays * 10, 0, 100);

  // Profit: margin over costs, penalised when over budget.
  const revenue = yieldTons * crop.pricePerTon;
  const totalCost = s.costs.water + s.costs.fertilizer + s.costs.pest + s.costs.fixed;
  const profit = revenue - totalCost;
  const overBudget = totalCost > scenario.budget;
  const maxProfit = crop.potentialYield * crop.pricePerTon - COSTS.fixedPerCrop[scenario.crop];
  let profitScore = maxProfit > 0 ? (profit / maxProfit) * 100 : 0;
  if (overBudget) profitScore -= 25;
  profitScore = clamp(profitScore, 0, 100);

  const breakdown: ScoreBreakdown = {
    yield: round(yieldScore),
    irrigation: round(irrigationScore),
    soil: round(soilScore),
    pest: round(pestScore),
    profit: round(profitScore),
  };
  const totalScore = round(
    (breakdown.yield * SCORE_WEIGHTS.yield +
      breakdown.irrigation * SCORE_WEIGHTS.irrigation +
      breakdown.soil * SCORE_WEIGHTS.soil +
      breakdown.pest * SCORE_WEIGHTS.pest +
      breakdown.profit * SCORE_WEIGHTS.profit) /
      100,
  );
  const grade = totalScore >= 80 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : totalScore >= 50 ? 'D' : 'F';

  if (s.weeksBelowWilting > 0)
    feedback.push(`Soil fell below the 20% wilting point in ${s.weeksBelowWilting} week(s). Irrigate earlier in dry spells.`);
  if (managedPct < 50)
    feedback.push(`Moisture was in the ideal ${crop.optimalMoisture[0]}–${crop.optimalMoisture[1]}% band only ${Math.round(optimalPct)}% of the time.`);
  if (efficiency < 80) feedback.push('A lot of irrigation water ran off. Avoid irrigating right before or after heavy rain.');
  if (overAllowance > 0) feedback.push(`You used ${Math.round(overAllowance)} mm more irrigation than the allowance.`);
  if (nRatio < 0.8) feedback.push('The crop was short of nutrients. Apply fertilizer in the development stage.');
  if (nRatio > 1.3) feedback.push('Too much fertilizer – it wastes money and can pollute water.');
  if (s.pestOutbreaks > s.pestOutbreaksControlled) feedback.push('Some pest outbreaks were not controlled. Scout and spray when outbreaks are forecast.');
  if (s.unnecessarySprays > 2) feedback.push('You sprayed many times without pests. Only spray when needed.');
  if (overBudget) feedback.push('You went over budget.');
  if (shiftWeeks > 0)
    feedback.push(
      `Planting ${shiftWeeks} week(s) ${(scenario.plantingShiftWeeks ?? 0) < 0 ? 'early' : 'late'} cost about ${Math.round(
        (1 - plantingFactor) * 100,
      )}% of potential yield.`,
    );
  if (feedback.length === 0) feedback.push('Excellent farm management! 🌱');

  return {
    totalScore,
    grade,
    breakdown,
    yieldTonsPerHa: round(yieldTons, 2),
    potentialYield: crop.potentialYield,
    revenue: Math.round(revenue),
    totalCost: Math.round(totalCost),
    profit: Math.round(profit),
    overBudget,
    waterUsedMm: Math.round(s.irrigationTotalMm),
    waterAllowanceMm: scenario.waterAllowanceMm,
    weeksInOptimal: s.weeksInOptimal,
    weeksBelowWilting: s.weeksBelowWilting,
    feedback,
    logs: s.logs,
  };
}

/** Runs a whole season from a list of decisions (one per week). */
export function runSimulation(scenario: SimScenario, decisions: Partial<WeekDecision>[]): SimResult {
  let state = createInitialState(scenario);
  for (let w = 0; w < scenario.weeks; w++) {
    state = stepWeek(scenario, state, decisions[w] ?? {});
  }
  return scoreSimulation(scenario, state);
}

// ---------------------------------------------------------------------------
// Baseline + quick experiments ("change one parameter and compare")
// ---------------------------------------------------------------------------

/** The parameters a learner can change in a quick experiment. */
export interface ExperimentParams {
  /** % change to every baseline irrigation (e.g. -20 = 20% less water). */
  irrigationChangePct: number;
  fertilizerPlan: FertilizerPlan;
  /** Weeks earlier (negative) or later (positive) than recommended. */
  plantingShiftWeeks: number;
}

export const BASELINE_PARAMS: ExperimentParams = { irrigationChangePct: 0, fertilizerPlan: 'recommended', plantingShiftWeeks: 0 };

export function sanitizeParams(p: Partial<ExperimentParams> | undefined): ExperimentParams {
  const plan = p?.fertilizerPlan;
  return {
    irrigationChangePct: clamp(Math.round(Number(p?.irrigationChangePct) || 0), -100, 100),
    fertilizerPlan: plan && plan in FERTILIZER_PLANS ? plan : 'recommended',
    plantingShiftWeeks: clamp(Math.round(Number(p?.plantingShiftWeeks) || 0), -8, 8),
  };
}

/** Which parameters differ from the baseline (used to label a run). */
export function changedParams(p: ExperimentParams): (keyof ExperimentParams)[] {
  return (Object.keys(BASELINE_PARAMS) as (keyof ExperimentParams)[]).filter((k) => p[k] !== BASELINE_PARAMS[k]);
}

/** Fertilizer schedule: 2 units a week from the start of development until the target is met. */
function fertilizerSchedule(scenario: SimScenario, factor: number): FertilizerLevel[] {
  const crop = CROPS[scenario.crop];
  let remaining = Math.round(crop.nitrogenNeed * factor);
  const plan: FertilizerLevel[] = [];
  for (let w = 1; w <= scenario.weeks; w++) {
    const stage = stageForWeek(scenario.crop, w, scenario.weeks);
    if (remaining > 0 && stage !== 'initial' && stage !== 'late-season') {
      plan.push(remaining >= 2 ? 'high' : 'low');
      remaining -= remaining >= 2 ? 2 : 1;
    } else plan.push('none');
  }
  return plan;
}

/**
 * The baseline: a sensible "standard practice" plan at the recommended planting date.
 * Each week it irrigates (in 10 mm steps, max 40 mm, never past the water allowance)
 * to aim for the middle of the crop's ideal moisture band, applies the recommended
 * fertilizer, and sprays only in pest weeks.
 */
export function baselineDecisions(scenario: SimScenario): WeekDecision[] {
  const base: SimScenario = { ...scenario, plantingShiftWeeks: 0 };
  const crop = CROPS[base.crop];
  const soil = SOILS[base.soil];
  const fert = fertilizerSchedule(base, 1);
  const targetMm = ((crop.optimalMoisture[0] + crop.optimalMoisture[1]) / 2 / 100) * soil.capacityMm;
  let state = createInitialState(base);
  const decisions: WeekDecision[] = [];
  for (let w = 1; w <= base.weeks; w++) {
    const { rainMm, temperatureC } = weatherAt(base, w);
    const et = weeklyET0(temperatureC) * crop.kc[stageForWeek(base.crop, w, base.weeks)];
    const expected = (state.moistureMm + rainMm - et) * (1 - soil.weeklyDrainage);
    const shortfall = targetMm - expected;
    const wanted = shortfall > 0 ? clamp(Math.round(shortfall / (1 - soil.weeklyDrainage) / 10) * 10, 0, 40) : 0;
    // Standard practice stays inside the scenario's water allowance.
    const left = Math.max(0, base.waterAllowanceMm - state.irrigationTotalMm);
    const irrigationMm = Math.min(wanted, Math.floor(left / 10) * 10);
    const d: WeekDecision = { irrigationMm, fertilizer: fert[w - 1], pestControl: base.pestWeeks.includes(w) };
    decisions.push(d);
    state = stepWeek(base, state, d);
  }
  return decisions;
}

/** Builds the weekly decisions for an experiment by changing the baseline plan. */
export function experimentDecisions(scenario: SimScenario, rawParams: Partial<ExperimentParams>): WeekDecision[] {
  const p = sanitizeParams(rawParams);
  const base = baselineDecisions(scenario);
  const fert = fertilizerSchedule(scenario, FERTILIZER_PLANS[p.fertilizerPlan].factor);
  return base.map((d, i) => ({
    irrigationMm: clamp(Math.round(d.irrigationMm * (1 + p.irrigationChangePct / 100)), 0, 60),
    fertilizer: fert[i],
    pestControl: d.pestControl,
  }));
}

/** Runs one experiment and returns its decisions and result. */
export function runExperiment(scenario: SimScenario, rawParams: Partial<ExperimentParams>) {
  const params = sanitizeParams(rawParams);
  const decisions = experimentDecisions(scenario, params);
  const result = runSimulation({ ...scenario, plantingShiftWeeks: params.plantingShiftWeeks }, decisions);
  return { params, decisions, result };
}

/** Headline numbers used to compare any run with the baseline. */
export interface RunSummary {
  totalScore: number;
  yieldTonsPerHa: number;
  waterUsedMm: number;
  totalCost: number;
  profit: number;
}

export function summarize(r: SimResult): RunSummary {
  return { totalScore: r.totalScore, yieldTonsPerHa: r.yieldTonsPerHa, waterUsedMm: r.waterUsedMm, totalCost: r.totalCost, profit: r.profit };
}

/** The baseline run for a scenario. */
export function runBaseline(scenario: SimScenario): SimResult {
  return runExperiment(scenario, BASELINE_PARAMS).result;
}
