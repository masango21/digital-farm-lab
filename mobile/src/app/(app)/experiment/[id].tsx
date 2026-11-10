import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useScenario, useSubmitAttempt } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Banner, Button, Card, ChipGroup, ErrorView, H2, Loading, Muted, Screen, Segmented } from '@/components/ui';
import { BaselineComparison, headline } from '@/components/BaselineComparison';
import { ModelNotice } from '@/components/ModelNotice';
import { CROPS } from '@/simulation/crops';
import { runBaseline, runExperiment, summarize } from '@/simulation/engine';
import { PARAMS, describeParams, toSimScenario, withOneChange, type ParamKey } from '@/utils/experiment';
import { colors, gradeColor, spacing } from '@/theme';

/**
 * Golden journey: choose a scenario → change ONE parameter → run →
 * see the outcome compared with the baseline → receive a score.
 */
export default function Experiment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useScenario(id);
  const submit = useSubmitAttempt(id ?? '');
  const [param, setParam] = useState<ParamKey>('irrigationChangePct');
  const [value, setValue] = useState<number | string>(-20);

  const sim = useMemo(() => (query.data ? toSimScenario(query.data) : null), [query.data]);
  const baseline = useMemo(() => (sim ? runBaseline(sim) : null), [sim]);
  const params = withOneChange(param, value);
  const preview = useMemo(() => (sim ? runExperiment(sim, params).result : null), [sim, param, value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (query.isLoading) return <Loading />;
  if (!query.data || !baseline || !preview) return <ErrorView message={errorMessage(query.error)} onRetry={query.refetch} />;

  const sc = query.data;
  const crop = CROPS[sc.crop];
  const meta = PARAMS[param];
  const isBaseline = describeParams(params).startsWith('Baseline');

  function pickParam(k: ParamKey) {
    // Only one parameter changes at a time: switching resets the others to the baseline.
    setParam(k);
    setValue(k === 'irrigationChangePct' ? -20 : k === 'fertilizerPlan' ? 'half' : 2);
  }

  function run() {
    submit.mutate({ mode: 'experiment', params }, { onSuccess: (attempt) => router.replace(`/attempt/${attempt.id}`) });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Quick experiment' }} />
      <Text style={s.kicker}>
        {crop.emoji} {sc.title}
      </Text>
      <Text style={s.title}>Change one thing. See what happens.</Text>
      <Muted>
        The baseline is a standard-practice plan for this farm: it irrigates to keep soil moisture in the ideal band (within the{' '}
        {sc.waterAllowanceMm} mm allowance), applies the recommended fertiliser and sprays only when pests arrive.
      </Muted>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={s.step}>STEP 1 · WHAT TO CHANGE</Text>
        <Segmented
          value={param}
          onChange={pickParam}
          options={(Object.keys(PARAMS) as ParamKey[]).map((k) => ({ value: k, label: `${PARAMS[k].icon} ${PARAMS[k].label}` }))}
        />
        <Text style={s.step}>STEP 2 · HOW MUCH</Text>
        <Muted>{meta.help}</Muted>
        <View style={{ height: spacing.sm }} />
        <ChipGroup options={meta.options} value={value as never} onChange={(v) => setValue(v)} />
        {param === 'irrigationChangePct' && baseline.waterUsedMm === 0 && (
          <Banner tone="info" text="The baseline needs no irrigation in this wet season, so changing irrigation has no effect here." />
        )}
      </Card>

      <Card>
        <View style={s.previewHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.step}>PREVIEW</Text>
            <H2>{describeParams(params)}</H2>
          </View>
          <View style={s.gradeBox}>
            <Text style={[s.grade, { color: gradeColor(preview.grade) }]}>{preview.grade}</Text>
            <Text style={s.gradeScore}>{preview.totalScore.toFixed(0)}</Text>
          </View>
        </View>
        <Text style={s.headline}>{headline(summarize(baseline), summarize(preview))}</Text>
        <BaselineComparison baseline={summarize(baseline)} run={summarize(preview)} runLabel="This run" />
      </Card>

      <ModelNotice compact />
      {submit.error && <Banner tone="error" text={errorMessage(submit.error)} />}
      <Button title={isBaseline ? 'Run the baseline & get my score' : 'Run & get my score'} icon="play" onPress={run} loading={submit.isPending} />
      <Muted center>Your score is calculated on the server and saved to your progress.</Muted>
    </Screen>
  );
}

const s = StyleSheet.create({
  kicker: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  step: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  previewHead: { flexDirection: 'row', alignItems: 'flex-start' },
  gradeBox: { alignItems: 'center', minWidth: 56 },
  grade: { fontSize: 34, fontWeight: '900', lineHeight: 38 },
  gradeScore: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  headline: { fontSize: 14, color: colors.text, marginBottom: spacing.sm, lineHeight: 20 },
});
