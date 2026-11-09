import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useMyAttempts, useTrainerOverview, useTrainerScores } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Badge, Banner, Button, Card, EmptyState, ErrorView, H2, Loading, Muted, Screen, Stat } from '@/components/ui';
import { formatDateTime, gradeFor } from '@/utils/format';
import { colors, gradeColor, scoreColor, spacing } from '@/theme';

export default function ProgressScreen() {
  const { user } = useAuth();
  return user?.role === 'trainer' ? <TrainerScores /> : <LearnerProgress />;
}

function LearnerProgress() {
  const query = useMyAttempts();
  const [selected, setSelected] = useState<string[]>([]);
  const attempts = query.data ?? [];

  const summary = useMemo(() => {
    if (!attempts.length) return null;
    const best = Math.max(...attempts.map((a) => a.totalScore));
    const avg = attempts.reduce((s, a) => s + a.totalScore, 0) / attempts.length;
    const avgIrr = attempts.reduce((s, a) => s + a.irrigationScore, 0) / attempts.length;
    return { best, avg, avgIrr };
  }, [attempts]);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]));
  }

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorView message={errorMessage(query.error)} onRetry={query.refetch} />;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={query.refetch}>
      {!attempts.length ? (
        <EmptyState
          icon="stats-chart-outline"
          title="No attempts yet"
          message="Run a simulation and your scores will appear here."
          action={<Button title="Browse scenarios" onPress={() => router.navigate('/')} />}
        />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Attempts" value={String(attempts.length)} />
              <Stat label="Best score" value={summary!.best.toFixed(0)} />
              <Stat label="Average" value={summary!.avg.toFixed(0)} />
              <Stat label="Avg irrigation" value={summary!.avgIrr.toFixed(0)} />
            </View>
          </Card>
          <Banner tone="info" text="Tap two attempts to compare them side by side." />
          {selected.length === 2 && (
            <Button
              title="Compare selected"
              icon="git-compare-outline"
              onPress={() => router.push({ pathname: '/compare', params: { a: selected[0], b: selected[1] } })}
            />
          )}
          <H2 style={{ marginTop: spacing.md }}>History</H2>
          {attempts.map((a) => {
            const isSel = selected.includes(a.id);
            const grade = gradeFor(a.totalScore);
            return (
              <Card key={a.id} onPress={() => toggle(a.id)} style={isSel ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>
                      {a.cropEmoji} {a.scenarioTitle}
                    </Text>
                    <Muted>{formatDateTime(a.createdAt)}</Muted>
                    <Text style={s.meta}>
                      💧 {a.waterUsedMm} mm · 🌾 {a.yieldTonsPerHa} t/ha · Irrigation {Math.round(a.irrigationScore)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[s.score, { color: scoreColor(a.totalScore) }]}>{Math.round(a.totalScore)}</Text>
                    <Badge label={grade} color={colors.white} bg={gradeColor(grade)} />
                  </View>
                </View>
                <Button title="View details" variant="ghost" onPress={() => router.push(`/attempt/${a.id}`)} />
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function TrainerScores() {
  const overview = useTrainerOverview();
  const recent = useTrainerScores();

  if (overview.isLoading || recent.isLoading) return <Loading />;
  if (overview.error) return <ErrorView message={errorMessage(overview.error)} onRetry={overview.refetch} />;

  const rows = overview.data ?? [];
  const totalAttempts = rows.reduce((s, r) => s + r.attempts, 0);
  return (
    <Screen
      refreshing={overview.isRefetching}
      onRefresh={() => {
        overview.refetch();
        recent.refetch();
      }}
    >
      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Stat label="Scenarios" value={String(rows.length)} />
          <Stat label="Attempts" value={String(totalAttempts)} />
          <Stat label="Learners" value={String(new Set((recent.data ?? []).map((r) => r.learnerId)).size)} />
        </View>
      </Card>
      <Button title="All learner scores" icon="people-outline" variant="secondary" onPress={() => router.push('/trainer/scores')} />

      <H2 style={{ marginTop: spacing.lg }}>By scenario</H2>
      {rows.length === 0 && <Muted>Create a scenario to start collecting scores.</Muted>}
      {rows.map((r) => (
        <Card key={r.scenarioId} onPress={() => router.push({ pathname: '/trainer/scores', params: { scenarioId: r.scenarioId, title: r.title } })}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>
                {r.cropEmoji} {r.title}
              </Text>
              <Muted>
                {r.attempts} attempt{r.attempts === 1 ? '' : 's'} {r.isPublished ? '' : '· Draft'}
              </Muted>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.small}>Avg {r.averageScore ?? '–'}</Text>
              <Text style={s.small}>Best {r.bestScore ?? '–'}</Text>
            </View>
          </View>
        </Card>
      ))}

      <H2 style={{ marginTop: spacing.lg }}>Latest attempts</H2>
      {(recent.data ?? []).slice(0, 10).map((r) => (
        <Card key={r.attemptId} onPress={() => router.push(`/attempt/${r.attemptId}`)}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{r.learnerName}</Text>
              <Muted>
                {r.cropEmoji} {r.scenarioTitle} · {formatDateTime(r.createdAt)}
              </Muted>
            </View>
            <Text style={[s.score, { color: scoreColor(r.totalScore) }]}>{Math.round(r.totalScore)}</Text>
          </View>
        </Card>
      ))}
      {recent.data?.length === 0 && <Muted>No learner attempts yet.</Muted>}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  score: { fontSize: 28, fontWeight: '800' },
  small: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
