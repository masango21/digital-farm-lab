import type { Scenario } from '@/api/types';
import { FERTILIZER_PLANS, IRRIGATION_CHANGE_OPTIONS, PLANTING_SHIFT_OPTIONS, type FertilizerPlan } from '@/simulation/crops';
import { BASELINE_PARAMS, changedParams, type ExperimentParams, type SimScenario } from '@/simulation/engine';

export function toSimScenario(sc: Scenario): SimScenario {
  return {
    crop: sc.crop,
    soil: sc.soil,
    weeks: sc.weeks,
    rainfallMm: sc.rainfallMm,
    temperatureC: sc.temperatureC,
    startMoisturePct: sc.startMoisturePct,
    budget: sc.budget,
    waterAllowanceMm: sc.waterAllowanceMm,
    pestWeeks: sc.pestWeeks,
  };
}

export type ParamKey = keyof ExperimentParams;

export const PARAMS: Record<ParamKey, { label: string; icon: string; help: string; options: { value: number | FertilizerPlan; label: string }[] }> = {
  irrigationChangePct: {
    label: 'Irrigation',
    icon: '💧',
    help: 'Scale every irrigation in the baseline plan up or down.',
    options: IRRIGATION_CHANGE_OPTIONS.map((v) => ({ value: v, label: v === 0 ? 'Baseline' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%` })),
  },
  fertilizerPlan: {
    label: 'Fertiliser',
    icon: '🧪',
    help: 'How much fertiliser to apply compared with what this crop needs.',
    options: (Object.keys(FERTILIZER_PLANS) as FertilizerPlan[]).map((v) => ({ value: v, label: FERTILIZER_PLANS[v].label })),
  },
  plantingShiftWeeks: {
    label: 'Planting date',
    icon: '📅',
    help: 'Plant earlier or later than the recommended date.',
    options: PLANTING_SHIFT_OPTIONS.map((v) => ({ value: v, label: v === 0 ? 'On time' : `${Math.abs(v)} wk ${v < 0 ? 'early' : 'late'}` })),
  },
};

/** "Irrigation −20%", "Planting 2 weeks late", or "Baseline plan". */
export function describeParams(p: ExperimentParams | null | undefined): string {
  if (!p) return 'Week-by-week plan';
  const changed = changedParams(p);
  if (!changed.length) return 'Baseline plan (no changes)';
  return changed
    .map((k) => {
      if (k === 'irrigationChangePct') return `Irrigation ${p.irrigationChangePct > 0 ? '+' : '−'}${Math.abs(p.irrigationChangePct)}%`;
      if (k === 'fertilizerPlan') return `${FERTILIZER_PLANS[p.fertilizerPlan].label} fertiliser`;
      const w = Math.abs(p.plantingShiftWeeks);
      return `Planted ${w} week${w === 1 ? '' : 's'} ${p.plantingShiftWeeks < 0 ? 'early' : 'late'}`;
    })
    .join(' · ');
}

/** Three reflection prompts tailored to what the learner just did. */
export function reflectionPrompts(mode: 'weekly' | 'experiment', p: ExperimentParams | null): string[] {
  const changed = p ? changedParams(p)[0] : undefined;
  const why =
    mode === 'experiment' && changed
      ? `You changed one thing: ${describeParams(p).toLowerCase()}. Why do you think the yield, water use and profit changed the way they did?`
      : mode === 'experiment'
        ? 'You ran the baseline plan. Which of its decisions do you think mattered most for the result, and why?'
        : 'Which week was hardest to manage, and what would you do differently next time?';
  const tradeOff =
    changed === 'irrigationChangePct'
      ? 'Was the trade-off worth it? Weigh the water saved or used against the change in yield and profit.'
      : changed === 'fertilizerPlan'
        ? 'Was the change in fertiliser cost worth the change in yield? What else would a farmer think about (e.g. run-off into rivers)?'
        : changed === 'plantingShiftWeeks'
          ? 'What real-world risks come with planting earlier or later (frost, heat, rain timing, market prices)?'
          : 'How did your result compare with the baseline? What did the baseline do better or worse than you?';
  const limits = 'This model is simplified. What would a real farmer need to check before using this lesson on their own farm?';
  return [why, tradeOff, limits];
}

export const withOneChange = (key: ParamKey, value: number | string): ExperimentParams => ({ ...BASELINE_PARAMS, [key]: value });
