import type { Scenario } from '../db/schema';
import type { SimScenario } from '../simulation/engine';

export function toSimScenario(s: Scenario): SimScenario {
  return {
    crop: s.crop,
    soil: s.soil,
    weeks: s.weeks,
    rainfallMm: s.rainfallMm,
    temperatureC: s.temperatureC,
    startMoisturePct: s.startMoisturePct,
    budget: s.budget,
    waterAllowanceMm: s.waterAllowanceMm,
    pestWeeks: s.pestWeeks,
  };
}
