import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAttempt, useMyAttempts } from '@/api/hooks';
import type { Attempt } from '@/api/types';
import { errorMessage } from '@/api/client';
import { Card, EmptyState, ErrorView, H2, Loading, Muted, Screen } from '@/components/ui';
import { MoistureChart } from '@/components/MoistureChart';
import { CROPS } from '@/simulation/crops';
import { formatDateTime, formatRand } from '@/utils/format';
import { colors, scoreColor, spacing } from '@/theme';

export default function Compare() {
  const { a, b } = useLocalSearchParams<{ a: string; b?: string }>();
  const first = useAttempt(a);
  const second = useAttempt(b);

  if (!b) return <PickSecond firstId={a} />;
  if (first.isLoading || second.isLoading) return <Loading />;
  if (first.error || second.error || !first.data || !second.data)
    return <ErrorView message={errorMessage(first.error ?? second.error)} onRetry={() => { first.refetch(); second.refetch(); }} />;

  // Show the older attempt on the left.
  const [x, y] = [first.data, second.data].sort((p, q) => +new Date(p.createdAt) - +new Date(q.createdAt));
  const rows: { label: string; get: (t: Attempt) => number; fmt?: (n: number) => string; lowerIsBetter?: boolean }[] = [
    { label: 'Total score', get: (t) => t.result.totalScore },
    { label: 'Yield score', get: (t) => t.result.breakdown.yield },
    { label: 'Irrigation score', get: (t) => t.result.breakdown.irrigation },
    { label: 'Soil score', get: (t) => t.result.breakdown.soil },
    { label: 'Pest score', get: (t) => t.result.breakdown.pest },
    { label: 'Profit score', get: (t) => t.result.breakdown.profit },
    { label: 'Yield (t/ha)', get: (t) => t.result.yieldTonsPerHa },
    { label: 'Water used (mm)', get: (t) => t.result.waterUsedMm, lowerIsBetter: true },
    { label: 'Weeks below 20%', get: (t) => t.result.weeksBelowWilting, lowerIsBetter: true },
    { label: 'Profit', get: (t) => t.result.profit, fmt: formatRand },
  ];

  const diff = y.result.totalScore - x.result.totalScore;
  const sameScenario = x.scenarioId === y.scenarioId;

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Text style={[s.diff, { color: diff >= 0 ? colors.success : colors.danger }]}>
          {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} points
        </Text>
        <Muted center>{diff >= 0 ? 'Your newer attempt scored higher. Great progress! 🌱' : 'Your newer attempt scored lower – check what changed below.'}</Muted>
        {!sameScenario && <Muted center>Note: these attempts are from different scenarios.</Muted>}
      </Card>

      <Card>
        <View style={[s.tr, { borderBottomWidth: 1 }]}>
          <Text style={[s.label, s.head]}> </Text>
          <Text style={[s.cell, s.head]}>
            {x.cropEmoji} {formatDateTime(x.createdAt)}
          </Text>
          <Text style={[s.cell, s.head]}>
            {y.cropEmoji} {formatDateTime(y.createdAt)}
          </Text>
        </View>
        {rows.map((row) => {
          const vx = row.get(x);
          const vy = row.get(y);
          const better = (p: number, q: number) => (row.lowerIsBetter ? p < q : p > q);
          const fmt = row.fmt ?? ((n: number) => String(Math.round(n * 10) / 10));
          return (
            <View key={row.label} style={s.tr}>
              <Text style={s.label}>{row.label}</Text>
              <Text style={[s.cell, better(vx, vy) && s.win]}>{fmt(vx)}</Text>
              <Text style={[s.cell, better(vy, vx) && s.win]}>{fmt(vy)}</Text>
            </View>
          );
        })}
      </Card>

      {[x, y].map((t, i) => {
        const crop = t.crop ? CROPS[t.crop] : null;
        return (
          crop && (
            <Card key={t.id}>
              <H2>
                {i === 0 ? 'Earlier' : 'Later'} attempt – moisture ({Math.round(t.result.totalScore)} pts)
              </H2>
              <MoistureChart logs={t.result.logs} optimal={crop.optimalMoisture} totalWeeks={t.result.logs.length} />
            </Card>
          )
        );
      })}
    </Screen>
  );
}

function PickSecond({ firstId }: { firstId: string }) {
  const first = useAttempt(firstId);
  const list = useMyAttempts(first.data?.scenarioId);
  if (first.isLoading || list.isLoading) return <Loading />;
  const others = (list.data ?? []).filter((t) => t.id !== firstId);
  if (!others.length)
    return <EmptyState icon="git-compare-outline" title="Nothing to compare yet" message="Run this scenario again, then compare your attempts." />;
  return (
    <Screen>
      <H2>Pick an attempt to compare with</H2>
      {others.map((t) => (
        <Card key={t.id} onPress={() => router.setParams({ b: t.id })}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {t.cropEmoji} {t.scenarioTitle}
              </Text>
              <Muted>{formatDateTime(t.createdAt)}</Muted>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: scoreColor(t.totalScore) }}>{Math.round(t.totalScore)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  diff: { fontSize: 28, fontWeight: '900', marginBottom: spacing.sm },
  tr: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, alignItems: 'center' },
  label: { flex: 1.3, fontSize: 13, color: colors.textMuted },
  cell: { flex: 1, fontSize: 14, textAlign: 'center', color: colors.text },
  head: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  win: { color: colors.success, fontWeight: '800' },
});
