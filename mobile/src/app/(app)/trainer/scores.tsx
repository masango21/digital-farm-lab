import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTrainerLearners, useTrainerScores } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Card, ChipGroup, EmptyState, ErrorView, Loading, Muted, Screen } from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import { colors, scoreColor, spacing } from '@/theme';

export default function TrainerScoresScreen() {
  const { scenarioId, title } = useLocalSearchParams<{ scenarioId?: string; title?: string }>();
  const [view, setView] = useState<'learners' | 'attempts'>('learners');
  const learners = useTrainerLearners(scenarioId);
  const scores = useTrainerScores(scenarioId);
  const active = view === 'learners' ? learners : scores;

  return (
    <Screen refreshing={active.isRefetching} onRefresh={active.refetch}>
      <Stack.Screen options={{ title: title ? `Scores: ${title}` : 'All learner scores' }} />
      <ChipGroup
        value={view}
        onChange={setView}
        options={[
          { value: 'learners', label: '👥 By learner' },
          { value: 'attempts', label: '📝 Every attempt' },
        ]}
      />
      {active.isLoading ? (
        <Loading />
      ) : active.error ? (
        <ErrorView message={errorMessage(active.error)} onRetry={active.refetch} />
      ) : view === 'learners' ? (
        (learners.data ?? []).length === 0 ? (
          <EmptyState icon="people-outline" title="No scores yet" message="When learners finish your scenarios their scores show up here." />
        ) : (
          learners.data!.map((l, i) => (
            <Card key={l.learnerId}>
              <View style={s.row}>
                <Text style={s.rank}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{l.learnerName}</Text>
                  <Muted>{l.learnerEmail}</Muted>
                  <Text style={s.meta}>
                    {l.attempts} attempt{l.attempts === 1 ? '' : 's'} · avg {l.averageScore ?? '–'} · avg irrigation {l.averageIrrigation ?? '–'}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[s.score, { color: scoreColor(l.bestScore ?? 0) }]}>{Math.round(l.bestScore ?? 0)}</Text>
                  <Text style={s.meta}>best</Text>
                </View>
              </View>
            </Card>
          ))
        )
      ) : (scores.data ?? []).length === 0 ? (
        <EmptyState icon="document-text-outline" title="No attempts yet" message="Learner attempts will appear here." />
      ) : (
        scores.data!.map((r) => (
          <Card key={r.attemptId} onPress={() => router.push(`/attempt/${r.attemptId}`)}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.learnerName}</Text>
                <Muted>
                  {r.cropEmoji} {r.scenarioTitle}
                </Muted>
                <Text style={s.meta}>
                  {formatDateTime(r.createdAt)} · 💧 {r.waterUsedMm} mm · irrigation {Math.round(r.irrigationScore)}
                </Text>
              </View>
              <Text style={[s.score, { color: scoreColor(r.totalScore) }]}>{Math.round(r.totalScore)}</Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rank: { fontSize: 16, fontWeight: '800', color: colors.textMuted, width: 34 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  score: { fontSize: 26, fontWeight: '800' },
});
