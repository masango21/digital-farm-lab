import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Attempt,
  AttemptSummary,
  Scenario,
  ScenarioInput,
  ScenarioStats,
  TrainerLearner,
  TrainerOverviewRow,
  TrainerScore,
  UploadSignature,
} from './types';
import type { WeekDecision } from '@/simulation/engine';

export const keys = {
  scenarios: (filter?: object) => ['scenarios', filter ?? {}] as const,
  scenario: (id: string) => ['scenario', id] as const,
  stats: (id: string) => ['scenario-stats', id] as const,
  myAttempts: (scenarioId?: string) => ['my-attempts', scenarioId ?? 'all'] as const,
  attempt: (id: string) => ['attempt', id] as const,
  trainerOverview: ['trainer-overview'] as const,
  trainerScores: (scenarioId?: string) => ['trainer-scores', scenarioId ?? 'all'] as const,
  trainerLearners: (scenarioId?: string) => ['trainer-learners', scenarioId ?? 'all'] as const,
};

const qs = (params: Record<string, string | undefined>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return s ? `?${s}` : '';
};

export function useScenarios(filter: { crop?: string; difficulty?: string; mine?: boolean } = {}) {
  return useQuery({
    queryKey: keys.scenarios(filter),
    queryFn: () =>
      api<{ scenarios: Scenario[] }>(
        `/api/scenarios${qs({ crop: filter.crop, difficulty: filter.difficulty, mine: filter.mine ? 'true' : undefined })}`,
      ).then((r) => r.scenarios),
  });
}

export function useScenario(id: string | undefined) {
  return useQuery({
    queryKey: keys.scenario(id ?? ''),
    enabled: !!id,
    queryFn: () => api<{ scenario: Scenario }>(`/api/scenarios/${id}`).then((r) => r.scenario),
  });
}

export function useScenarioStats(id: string | undefined) {
  return useQuery({
    queryKey: keys.stats(id ?? ''),
    enabled: !!id,
    queryFn: () => api<ScenarioStats>(`/api/scenarios/${id}/stats`),
  });
}

export function useSaveScenario(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ScenarioInput>) =>
      api<{ scenario: Scenario }>(id ? `/api/scenarios/${id}` : '/api/scenarios', { method: id ? 'PATCH' : 'POST', body: input }).then(
        (r) => r.scenario,
      ),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['scenarios'] });
      qc.invalidateQueries({ queryKey: keys.trainerOverview });
      qc.setQueryData(keys.scenario(s.id), s);
    },
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/scenarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios'] });
      qc.invalidateQueries({ queryKey: keys.trainerOverview });
    },
  });
}

export function useSubmitAttempt(scenarioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (decisions: WeekDecision[]) =>
      api<{ attempt: Attempt }>(`/api/scenarios/${scenarioId}/attempts`, { method: 'POST', body: { decisions } }).then((r) => r.attempt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attempts'] });
      qc.invalidateQueries({ queryKey: keys.stats(scenarioId) });
    },
  });
}

export function useMyAttempts(scenarioId?: string) {
  return useQuery({
    queryKey: keys.myAttempts(scenarioId),
    queryFn: () => api<{ attempts: AttemptSummary[] }>(`/api/attempts/me${qs({ scenarioId })}`).then((r) => r.attempts),
  });
}

export function useAttempt(id: string | undefined) {
  return useQuery({
    queryKey: keys.attempt(id ?? ''),
    enabled: !!id,
    queryFn: () => api<{ attempt: Attempt }>(`/api/attempts/${id}`).then((r) => r.attempt),
  });
}

export function useTrainerOverview() {
  return useQuery({
    queryKey: keys.trainerOverview,
    queryFn: () => api<{ scenarios: TrainerOverviewRow[] }>('/api/trainer/overview').then((r) => r.scenarios),
  });
}

export function useTrainerScores(scenarioId?: string) {
  return useQuery({
    queryKey: keys.trainerScores(scenarioId),
    queryFn: () => api<{ scores: TrainerScore[] }>(`/api/trainer/scores${qs({ scenarioId })}`).then((r) => r.scores),
  });
}

export function useTrainerLearners(scenarioId?: string) {
  return useQuery({
    queryKey: keys.trainerLearners(scenarioId),
    queryFn: () => api<{ learners: TrainerLearner[] }>(`/api/trainer/learners${qs({ scenarioId })}`).then((r) => r.learners),
  });
}

/** Uploads a local image straight to Cloudinary using a server-signed request. */
export async function uploadScenarioImage(uri: string, mimeType = 'image/jpeg'): Promise<{ url: string; publicId: string }> {
  const sig = await api<UploadSignature>('/api/uploads/signature', { method: 'POST', body: {} });
  const form = new FormData();
  if (uri.startsWith('blob:') || uri.startsWith('data:')) {
    // Web
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob);
  } else {
    // iOS / Android
    form.append('file', { uri, name: `scenario.${mimeType.split('/')[1] ?? 'jpg'}`, type: mimeType } as unknown as Blob);
  }
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Image upload failed');
  return { url: data.secure_url as string, publicId: data.public_id as string };
}
