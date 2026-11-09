import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/auth/AuthContext';
import { useDeleteScenario, useMyAttempts, useSaveScenario, useScenario, useScenarioStats } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Badge, Banner, Button, Card, ErrorView, H2, Loading, Muted, Screen, Stat } from '@/components/ui';
import { CROPS, SOILS } from '@/simulation/crops';
import { capitalize, formatDateTime, formatRand } from '@/utils/format';
import { colors, scoreColor, spacing } from '@/theme';

export default function ScenarioDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const scenario = useScenario(id);
  const stats = useScenarioStats(id);
  const isLearner = user?.role === 'learner';
  const mine = useMyAttempts(isLearner ? id : undefined);
  const save = useSaveScenario(id);
  const del = useDeleteScenario();

  if (scenario.isLoading) return <Loading />;
  if (scenario.error || !scenario.data) return <ErrorView message={errorMessage(scenario.error)} onRetry={scenario.refetch} />;

  const sc = scenario.data;
  const crop = CROPS[sc.crop];
  const soil = SOILS[sc.soil];
  const isOwner = sc.trainerId === user?.id;
  const totalRain = sc.rainfallMm.reduce((a, b) => a + b, 0);

  function onDelete() {
    const run = () =>
      del.mutate(sc.id, {
        onSuccess: () => router.back(),
      });
    if (Platform.OS === 'web') return run();
    Alert.alert('Delete scenario?', 'All learner attempts for this scenario will also be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen refreshing={stats.isRefetching} onRefresh={() => { scenario.refetch(); stats.refetch(); mine.refetch(); }}>
      <Stack.Screen options={{ title: `${crop.emoji} ${crop.name}` }} />
      {sc.imageUrl && <Image source={{ uri: sc.imageUrl }} style={s.image} contentFit="cover" />}
      <View style={s.badges}>
        <Badge label={capitalize(sc.difficulty)} />
        <Badge label={`${capitalize(sc.climate)} season`} color={colors.water} bg={colors.waterLight} />
        {!sc.isPublished && <Badge label="Draft – learners can't see this" color={colors.warning} bg={colors.warningLight} />}
      </View>
      <Text style={s.title}>{sc.title}</Text>
      <Muted>{sc.description}</Muted>
      {!!sc.learningGoals && <Text style={s.goals}>🎯 {sc.learningGoals}</Text>}
      <Text style={s.by}>Created by {sc.trainerName}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <H2>Farm conditions</H2>
        <Row label="Crop" value={`${crop.emoji} ${crop.name} (${sc.weeks} weeks)`} />
        <Row label="Soil" value={`${soil.name} – holds ${soil.capacityMm} mm`} />
        <Row label="Ideal moisture" value={`${crop.optimalMoisture[0]}–${crop.optimalMoisture[1]}%`} />
        <Row label="Starting moisture" value={`${sc.startMoisturePct}%`} />
        <Row label="Expected rain" value={`${totalRain} mm over the season`} />
        <Row label="Avg temperature" value={`${sc.avgTemperatureC}°C`} />
        <Row label="Irrigation allowance" value={`${sc.waterAllowanceMm} mm`} />
        <Row label="Budget" value={formatRand(sc.budget)} />
        <Row label="Pest risk" value={sc.pestWeeks.length ? `${sc.pestWeeks.length} outbreak(s) expected` : 'Low'} />
      </Card>

      {isLearner && (
        <>
          <Button title="Start simulation" icon="play" onPress={() => router.push(`/simulate/${sc.id}`)} />
          <Card style={{ marginTop: spacing.md }}>
            <H2>How you compare</H2>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Your best" value={stats.data?.mine.best?.toFixed(0) ?? '–'} />
              <Stat label="Your average" value={stats.data?.mine.average?.toFixed(0) ?? '–'} />
              <Stat label="Everyone avg" value={stats.data?.overall.average?.toFixed(0) ?? '–'} />
              <Stat label="Top score" value={stats.data?.overall.best?.toFixed(0) ?? '–'} />
            </View>
          </Card>
          {(mine.data?.length ?? 0) > 0 && (
            <Card>
              <H2>Your attempts</H2>
              {mine.data!.map((a) => (
                <View key={a.id} style={s.attemptRow}>
                  <Text style={{ flex: 1, color: colors.textMuted }} onPress={() => router.push(`/attempt/${a.id}`)}>
                    {formatDateTime(a.createdAt)}
                  </Text>
                  <Text style={[s.attemptScore, { color: scoreColor(a.totalScore) }]} onPress={() => router.push(`/attempt/${a.id}`)}>
                    {Math.round(a.totalScore)}
                  </Text>
                </View>
              ))}
              {mine.data!.length >= 2 && (
                <Button
                  title="Compare my last two"
                  variant="ghost"
                  icon="git-compare-outline"
                  onPress={() => router.push({ pathname: '/compare', params: { a: mine.data![1].id, b: mine.data![0].id } })}
                />
              )}
            </Card>
          )}
        </>
      )}

      {isOwner && (
        <>
          {(save.error || del.error) && <Banner tone="error" text={errorMessage(save.error ?? del.error)} />}
          <Card>
            <H2>Learner results</H2>
            <View style={{ flexDirection: 'row' }}>
              <Stat label="Attempts" value={String(stats.data?.overall.attempts ?? 0)} />
              <Stat label="Average" value={stats.data?.overall.average?.toFixed(0) ?? '–'} />
              <Stat label="Best" value={stats.data?.overall.best?.toFixed(0) ?? '–'} />
              <Stat label="Avg irrigation" value={stats.data?.overall.averageIrrigation?.toFixed(0) ?? '–'} />
            </View>
            <Button
              title="View learner scores"
              variant="secondary"
              icon="people-outline"
              onPress={() => router.push({ pathname: '/trainer/scores', params: { scenarioId: sc.id, title: sc.title } })}
            />
          </Card>
          <Button
            title={sc.isPublished ? 'Unpublish (hide from learners)' : 'Publish to learners'}
            icon={sc.isPublished ? 'eye-off-outline' : 'megaphone-outline'}
            variant={sc.isPublished ? 'secondary' : 'primary'}
            loading={save.isPending}
            onPress={() => save.mutate({ isPublished: !sc.isPublished })}
          />
          <Button title="Edit scenario" icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/trainer/scenario-form', params: { id: sc.id } })} />
          <Button title="Delete scenario" icon="trash-outline" variant="ghost" loading={del.isPending} onPress={onDelete} />
        </>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  image: { width: '100%', height: 180, borderRadius: 12, marginBottom: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  goals: { fontSize: 14, color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },
  by: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  attemptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  attemptScore: { fontSize: 18, fontWeight: '800' },
});
