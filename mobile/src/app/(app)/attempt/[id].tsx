import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { useAttempt, useScenarioStats } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Button, Card, ErrorView, H2, Loading, Muted, Screen, ScoreBar, Stat } from '@/components/ui';
import { MoistureChart } from '@/components/MoistureChart';
import { CROPS } from '@/simulation/crops';
import { SCORE_WEIGHTS } from '@/simulation/engine';
import { capitalize, formatDateTime, formatRand } from '@/utils/format';
import { colors, gradeColor, spacing } from '@/theme';

export default function AttemptResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const query = useAttempt(id);
  const stats = useScenarioStats(query.data?.scenarioId);
  const [showWeeks, setShowWeeks] = useState(false);

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorView message={errorMessage(query.error)} onRetry={query.refetch} />;

  const a = query.data;
  const r = a.result;
  const crop = a.crop ? CROPS[a.crop] : null;
  const isMine = a.learnerId === user?.id;

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Text style={s.scenario}>
          {a.cropEmoji} {a.scenarioTitle}
        </Text>
        {!isMine && <Muted>Learner: {a.learnerName}</Muted>}
        <Muted>{formatDateTime(a.createdAt)}</Muted>
        <Text style={[s.grade, { color: gradeColor(r.grade) }]}>{r.grade}</Text>
        <Text style={s.total}>{r.totalScore} / 100</Text>
        {stats.data && (
          <Muted>
            Average for this scenario: {stats.data.overall.average?.toFixed(0) ?? '–'} · Top: {stats.data.overall.best?.toFixed(0) ?? '–'}
          </Muted>
        )}
      </Card>

      <Card>
        <H2>Score breakdown</H2>
        <ScoreBar label="🌾 Yield" value={r.breakdown.yield} weight={SCORE_WEIGHTS.yield} />
        <ScoreBar label="💧 Irrigation" value={r.breakdown.irrigation} weight={SCORE_WEIGHTS.irrigation} />
        <ScoreBar label="🪱 Soil & nutrients" value={r.breakdown.soil} weight={SCORE_WEIGHTS.soil} />
        <ScoreBar label="🐛 Pest management" value={r.breakdown.pest} weight={SCORE_WEIGHTS.pest} />
        <ScoreBar label="💰 Profit" value={r.breakdown.profit} weight={SCORE_WEIGHTS.profit} />
      </Card>

      <Card>
        <View style={s.stats}>
          <Stat label="Yield (t/ha)" value={String(r.yieldTonsPerHa)} sub={`max ${r.potentialYield}`} />
          <Stat label="Water used" value={`${r.waterUsedMm} mm`} sub={`allowance ${r.waterAllowanceMm}`} />
          <Stat label="Profit" value={formatRand(r.profit)} sub={r.overBudget ? 'Over budget!' : 'Within budget'} />
        </View>
        <View style={s.stats}>
          <Stat label="Weeks in ideal moisture" value={String(r.weeksInOptimal)} />
          <Stat label="Weeks below 20%" value={String(r.weeksBelowWilting)} />
          <Stat label="Revenue" value={formatRand(r.revenue)} />
        </View>
      </Card>

      <Card>
        <H2>What to improve</H2>
        {r.feedback.map((f, i) => (
          <Text key={i} style={s.feedback}>
            • {f}
          </Text>
        ))}
      </Card>

      {crop && (
        <Card>
          <H2>Soil moisture over the season</H2>
          <MoistureChart logs={r.logs} optimal={crop.optimalMoisture} totalWeeks={r.logs.length} />
        </Card>
      )}

      <Button title={showWeeks ? 'Hide week-by-week log' : 'Show week-by-week log'} variant="ghost" onPress={() => setShowWeeks((v) => !v)} />
      {showWeeks && (
        <Card>
          <View style={[s.tr, s.th]}>
            {['Wk', 'Stage', 'Rain', 'Irr.', 'Moist.', 'Health'].map((h) => (
              <Text key={h} style={[s.td, s.thText]}>
                {h}
              </Text>
            ))}
          </View>
          {r.logs.map((l) => (
            <View key={l.week} style={s.tr}>
              <Text style={s.td}>{l.week}</Text>
              <Text style={s.td}>{capitalize(l.stage.split('-')[0])}</Text>
              <Text style={s.td}>{l.rainMm}</Text>
              <Text style={s.td}>{l.irrigationMm}</Text>
              <Text style={[s.td, l.moisturePct < 20 && { color: colors.danger, fontWeight: '700' }]}>{Math.round(l.moisturePct)}%</Text>
              <Text style={s.td}>{Math.round(l.cropHealthPct)}%</Text>
            </View>
          ))}
        </Card>
      )}

      {isMine && (
        <>
          <Button title="Try this scenario again" icon="refresh" onPress={() => router.replace(`/simulate/${a.scenarioId}`)} />
          <Button
            title="Compare with another attempt"
            variant="secondary"
            icon="git-compare-outline"
            onPress={() => router.push({ pathname: '/compare', params: { a: a.id } })}
          />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  scenario: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  grade: { fontSize: 72, fontWeight: '900', marginTop: spacing.sm },
  total: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  stats: { flexDirection: 'row', marginBottom: spacing.sm },
  feedback: { fontSize: 14, color: colors.text, marginBottom: 6, lineHeight: 20 },
  tr: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  th: { borderBottomWidth: 1 },
  thText: { fontWeight: '700', color: colors.textMuted },
  td: { flex: 1, fontSize: 12, color: colors.text, textAlign: 'center' },
});
