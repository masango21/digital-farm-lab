import type { CropId, SoilType, Climate } from '@/simulation/crops';
import type { SimResult, WeekDecision } from '@/simulation/engine';

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
  isPublished: boolean;
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
  isPublished: boolean;
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
  decisions: WeekDecision[];
  result: SimResult;
  totalScore: number;
  createdAt: string;
}

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

export interface UploadSignature {
  timestamp: number;
  folder: string;
  signature: string;
  apiKey: string;
  cloudName: string;
  uploadUrl: string;
}
