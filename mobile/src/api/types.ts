import type { CropId, SoilType, Climate } from '@/simulation/crops';
import type { ExperimentParams, RunSummary, SimResult, WeekDecision } from '@/simulation/engine';

export type RunMode = 'weekly' | 'experiment';

export type Role = 'learner' | 'trainer';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Scenario {
  id: string;
  trainerId: string;
  trainerName?: string;
  title: string;
  description: string;
  learningGoals: string;
  crop: CropId;
  cropName: string;
  cropEmoji: string;
  soil: SoilType;
  climate: Climate;
  difficulty: Difficulty;
  weeks: number;
  avgTemperatureC: number;
  rainfallMm: number[];
  temperatureC: number[];
  startMoisturePct: number;
  budget: number;
  waterAllowanceMm: number;
  pestWeeks: number[];
  imageUrl: string | null;
  imagePublicId: string | null;
  agrilearnModuleCode: string | null;
  isPublished: boolean;
  fieldId: string | null;
  fieldName?: string | null;
  farmName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioInput {
  title: string;
  description: string;
  learningGoals: string;
  crop: CropId;
  soil: SoilType;
  climate: Climate;
  difficulty: Difficulty;
  avgTemperatureC: number;
  startMoisturePct: number;
  budget: number;
  waterAllowanceMm: number;
  pestWeeks: number[];
  imageUrl: string | null;
  imagePublicId: string | null;
  agrilearnModuleCode: string;
  isPublished: boolean;
}

export interface Credential {
  id: string;
  scenarioId: string;
  attemptId: string;
  scenarioTitle: string;
  crop: CropId;
  cropEmoji: string;
  code: string;
  score: number;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt: string | null;
}

export interface TrainerCredential {
  id: string;
  learnerName: string;
  scenarioTitle: string;
  cropEmoji: string;
  status: 'pending' | 'sent' | 'failed';
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface ScenarioStats {
  overall: { attempts: number; average: number | null; best: number | null; averageIrrigation: number | null };
  mine: { attempts: number; average: number | null; best: number | null };
}

export interface AttemptSummary {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  crop: CropId;
  cropEmoji: string;
  mode: RunMode;
  params: ExperimentParams | null;
  totalScore: number;
  irrigationScore: number;
  yieldTonsPerHa: number;
  waterUsedMm: number;
  profit: number;
  createdAt: string;
}

export interface Attempt {
  id: string;
  scenarioId: string;
  learnerId: string;
  learnerName?: string;
  scenarioTitle?: string;
  crop?: CropId;
  cropEmoji?: string;
  mode: RunMode;
  params: ExperimentParams | null;
  decisions: WeekDecision[];
  result: SimResult;
  baseline: RunSummary | null;
  reflection: Reflection[] | null;
  reflectedAt: string | null;
  shareToken: string | null;
  totalScore: number;
  createdAt: string;
}

export interface Reflection {
  prompt: string;
  answer: string;
}

export type SubmitAttempt = { mode: 'weekly'; decisions: WeekDecision[] } | { mode: 'experiment'; params: ExperimentParams };

export interface TrainerScore {
  attemptId: string;
  scenarioId: string;
  scenarioTitle: string;
  crop: CropId;
  cropEmoji: string;
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  totalScore: number;
  irrigationScore: number;
  yieldTonsPerHa: number;
  waterUsedMm: number;
  profit: number;
  mode: RunMode;
  reflectedAt: string | null;
  createdAt: string;
}

export interface TrainerLearner {
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  attempts: number;
  bestScore: number | null;
  averageScore: number | null;
  averageIrrigation: number | null;
}

export interface TrainerOverviewRow {
  scenarioId: string;
  title: string;
  crop: CropId;
  cropEmoji: string;
  isPublished: boolean;
  attempts: number;
  averageScore: number | null;
  bestScore: number | null;
}

export interface SensorReading {
  week: number;
  recordedAt: string;
  soilMoisturePct: number;
  rainfallMm: number;
  temperatureC: number;
  source: string;
}

export interface FarmField {
  id: string;
  name: string;
  areaHa: number;
  soil: SoilType;
  soilName: string;
  scenarios: {
    id: string;
    title: string;
    crop: CropId;
    cropName: string;
    cropEmoji: string;
    isPublished: boolean;
    weeks: number;
    optimalMoisture: [number, number];
    readings: SensorReading[];
  }[];
}

export interface Farm {
  id: string;
  name: string;
  region: string;
  isMine: boolean;
  fields: FarmField[];
}

export interface UploadSignature {
  timestamp: number;
  folder: string;
  signature: string;
  apiKey: string;
  cloudName: string;
  uploadUrl: string;
}
