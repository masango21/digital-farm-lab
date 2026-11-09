/**
 * Crop + soil reference data for the Digital Farm Lab simulation.
 *
 * SHARED FILE: an identical copy lives in mobile/src/simulation/crops.ts.
 * Run `npm run sync-engine` in /server after editing so both stay identical.
 *
 * Values are simplified for teaching (loosely based on FAO-56 crop
 * coefficients and typical South African yields/prices). They are not
 * agronomic advice.
 */

export type CropId = 'maize' | 'tomato' | 'wheat' | 'potato' | 'spinach';
export type SoilType = 'sandy' | 'loam' | 'clay';
export type Climate = 'dry' | 'normal' | 'wet';
export type GrowthStage = 'initial' | 'development' | 'mid-season' | 'late-season';

export interface CropProfile {
  id: CropId;
  name: string;
  emoji: string;
  description: string;
  seasonWeeks: number;
  /** Soil moisture % band where the crop grows best. */
  optimalMoisture: [number, number];
  /** Potential yield in tonnes per hectare under perfect management. */
  potentialYield: number;
  /** Farm-gate price in ZAR per tonne (teaching value). */
  pricePerTon: number;
  /** Crop coefficient (Kc) per growth stage. */
  kc: Record<GrowthStage, number>;
  /** Fraction of the season spent in each stage (sums to 1). */
  stageSplit: Record<GrowthStage, number>;
  /** Fertilizer units needed across the season for full yield. */
  nitrogenNeed: number;
  /** 0..1 – how badly unmanaged pests hurt this crop. */
  pestSusceptibility: number;
  tips: string[];
}

export const CROPS: Record<CropId, CropProfile> = {
  maize: {
    id: 'maize',
    name: 'Maize',
    emoji: '🌽',
    description: 'Summer staple grain. Very sensitive to drought during tasselling/silking (mid-season).',
    seasonWeeks: 16,
    optimalMoisture: [40, 70],
    potentialYield: 8,
    pricePerTon: 4200,
    kc: { initial: 0.4, development: 0.8, 'mid-season': 1.2, 'late-season': 0.6 },
    stageSplit: { initial: 0.15, development: 0.3, 'mid-season': 0.35, 'late-season': 0.2 },
    nitrogenNeed: 8,
    pestSusceptibility: 0.7,
    tips: ['Protect moisture in mid-season – that is when cobs form.', 'Fall armyworm is the main pest threat.'],
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato',
    emoji: '🍅',
    description: 'High-value vegetable. Needs steady moisture – swings cause blossom-end rot and cracking.',
    seasonWeeks: 14,
    optimalMoisture: [50, 75],
    potentialYield: 60,
    pricePerTon: 6500,
    kc: { initial: 0.6, development: 0.9, 'mid-season': 1.15, 'late-season': 0.8 },
    stageSplit: { initial: 0.2, development: 0.3, 'mid-season': 0.3, 'late-season': 0.2 },
    nitrogenNeed: 10,
    pestSusceptibility: 0.9,
    tips: ['Keep moisture steady – avoid big dry/wet swings.', 'Whitefly and Tuta absoluta can wipe out a crop.'],
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    emoji: '🌾',
    description: 'Winter cereal. Tolerates cooler weather; most water-sensitive at flowering.',
    seasonWeeks: 18,
    optimalMoisture: [35, 65],
    potentialYield: 5,
    pricePerTon: 5600,
    kc: { initial: 0.4, development: 0.75, 'mid-season': 1.15, 'late-season': 0.4 },
    stageSplit: { initial: 0.15, development: 0.25, 'mid-season': 0.4, 'late-season': 0.2 },
    nitrogenNeed: 6,
    pestSusceptibility: 0.5,
    tips: ['Stop irrigating as grain ripens (late season).', 'Aphids and rust are common problems.'],
  },
  potato: {
    id: 'potato',
    name: 'Potato',
    emoji: '🥔',
    description: 'Tuber crop with shallow roots. Needs frequent, light watering and loose soil.',
    seasonWeeks: 15,
    optimalMoisture: [50, 75],
    potentialYield: 45,
    pricePerTon: 4800,
    kc: { initial: 0.5, development: 0.8, 'mid-season': 1.15, 'late-season': 0.75 },
    stageSplit: { initial: 0.15, development: 0.25, 'mid-season': 0.4, 'late-season': 0.2 },
    nitrogenNeed: 9,
    pestSusceptibility: 0.8,
    tips: ['Shallow roots – little and often beats one big irrigation.', 'Waterlogging rots tubers.'],
  },
  spinach: {
    id: 'spinach',
    name: 'Spinach',
    emoji: '🥬',
    description: 'Fast leafy crop. Short season, loves nitrogen and cool, moist soil.',
    seasonWeeks: 8,
    optimalMoisture: [50, 80],
    potentialYield: 20,
    pricePerTon: 7000,
    kc: { initial: 0.7, development: 0.9, 'mid-season': 1.0, 'late-season': 0.95 },
    stageSplit: { initial: 0.2, development: 0.3, 'mid-season': 0.35, 'late-season': 0.15 },
    nitrogenNeed: 5,
    pestSusceptibility: 0.6,
    tips: ['Short season – mistakes cannot be fixed later.', 'Leaf miners and aphids attack young leaves.'],
  },
};

export interface SoilProfile {
  id: SoilType;
  name: string;
  /** Plant-available water the root zone holds when full (mm). */
  capacityMm: number;
  /** Fraction of stored water lost to deep drainage each week. */
  weeklyDrainage: number;
  description: string;
}

export const SOILS: Record<SoilType, SoilProfile> = {
  sandy: { id: 'sandy', name: 'Sandy', capacityMm: 60, weeklyDrainage: 0.12, description: 'Drains fast, holds little water. Irrigate little and often.' },
  loam: { id: 'loam', name: 'Loam', capacityMm: 100, weeklyDrainage: 0.05, description: 'Balanced – holds water and drains well.' },
  clay: { id: 'clay', name: 'Clay', capacityMm: 140, weeklyDrainage: 0.02, description: 'Holds lots of water but waterlogs easily.' },
};

/** Below this soil moisture % plants wilt and take heavy damage. */
export const WILTING_POINT_PCT = 20;
/** Above this soil moisture % roots lack oxygen (waterlogging). */
export const WATERLOGGING_PCT = 95;

export const IRRIGATION_OPTIONS_MM = [0, 10, 20, 30, 40] as const;
export type FertilizerLevel = 'none' | 'low' | 'high';
export const FERTILIZER_UNITS: Record<FertilizerLevel, number> = { none: 0, low: 1, high: 2 };

/** Costs in ZAR per hectare. */
export const COSTS = {
  waterPerMm: 18,
  fertilizerPerUnit: 650,
  pestSpray: 900,
  /** Fixed cost of seed + land prep per hectare, scaled by crop value. */
  fixedPerCrop: { maize: 6000, tomato: 45000, wheat: 5000, potato: 30000, spinach: 12000 } as Record<CropId, number>,
};

export const CROP_LIST = Object.values(CROPS);
