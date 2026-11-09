import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useScenario, useSubmitAttempt } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Banner, Button, Card, ChipGroup, ErrorView, H2, Loading, Muted, Screen, ScoreBar } from '@/components/ui';
import { MoistureChart } from '@/components/MoistureChart';
import { COSTS, CROPS, IRRIGATION_OPTIONS_MM, SOILS, WILTING_POINT_PCT, type FertilizerLevel } from '@/simulation/crops';
import {
  createInitialState,
  scoreSimulation,
  stageForWeek,
  stepWeek,
  weeklyET0,
  SCORE_WEIGHTS,
  type SimScenario,
  type SimState,
  type WeekDecision,
} from '@/simulation/engine';
import { capitalize, formatRand } from '@/utils/format';
import { colors, gradeColor, spacing } from '@/theme';

export default function Simulate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useScenario(id);
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorView message={errorMessage(query.error)} onRetry={query.refetch} />;
  const sc = query.data;
  const sim: SimScenario = {
    crop: sc.crop,
    soil: sc.soil,
    weeks: sc.weeks,
    rainfallMm: sc.rainfallMm,
    temperatureC: sc.temperatureC,
    startMoisturePct: sc.startMoisturePct,
    budget: sc.budget,
    waterAllowanceMm: sc.waterAllowanceMm,
    pestWeeks: sc.pestWeeks,
  };
  return <SimulationRunner scenarioId={sc.id} title={sc.title} scenario={sim} />;
}

function SimulationRunner({ scenarioId, title, scenario }: { scenarioId: string; title: string; scenario: SimScenario }) {
  const crop = CROPS[scenario.crop];
  const soil = SOILS[scenario.soil];
  const [state, setState] = useState<SimState>(() => createInitialState(scenario));
  const [decisions, setDecisions] = useState<WeekDecision[]>([]);
  const [irrigationMm, setIrrigation] = useState<number>(0);
  const [fertilizer, setFertilizer] = useState<FertilizerLevel>('none');
  const [pestControl, setPestControl] = useState(false);
  const submit = useSubmitAttempt(scenarioId);

  const finished = state.week >= scenario.weeks;
  const week = state.week + 1; // the week we are deciding for
  const stage = stageForWeek(scenario.crop, Math.min(week, scenario.weeks), scenario.weeks);
  const moisturePct = (state.moistureMm / soil.capacityMm) * 100;
  const forecastRain = scenario.rainfallMm[week - 1] ?? 0;
  const forecastTemp = scenario.temperatureC[week - 1] ?? 22;
  const pestAlert = scenario.pestWeeks.includes(week);
  const lastLog = state.logs[state.logs.length - 1];
  const spent = state.costs.water + state.costs.fertilizer + state.costs.pest + state.costs.fixed;
  const preview = useMemo(() => (finished ? scoreSimulation(scenario, state) : null), [finished, scenario, state]);

  // Simple projection: moisture next week if the learner picks the current irrigation.
  const projectedPct = useMemo(() => {
    const et = weeklyET0(forecastTemp) * crop.kc[stage];
    let w = Math.min(soil.capacityMm, Math.max(0, state.moistureMm + forecastRain + irrigationMm - et));
    w -= w * soil.weeklyDrainage;
    return (w / soil.capacityMm) * 100;
  }, [state.moistureMm, forecastRain, irrigationMm, forecastTemp, crop, stage, soil]);

  function nextWeek() {
    const d: WeekDecision = { irrigationMm, fertilizer, pestControl };
    setState((s) => stepWeek(scenario, s, d));
    setDecisions((ds) => [...ds, d]);
    setFertilizer('none');
    setPestControl(false);
  }

  function undo() {
    const prev = decisions.slice(0, -1);
    let s = createInitialState(scenario);
    for (const d of prev) s = stepWeek(scenario, s, d);
    setDecisions(prev);
    setState(s);
  }

  async function onSubmit() {
    submit.mutate(decisions, {
      onSuccess: (attempt) => router.replace(`/attempt/${attempt.id}`),
    });
  }

  const moistureTone = moisturePct < WILTING_POINT_PCT ? colors.danger : moisturePct < crop.optimalMoisture[0] || moisturePct > crop.optimalMoisture[1] ? colors.accent : colors.water;

  return (
    <Screen>
      <Stack.Screen options={{ title: finished ? 'Season complete' : `Week ${week} of ${scenario.weeks}` }} />
      <Text style={s.title}>
        {crop.emoji} {title}
      </Text>

      {/* Progress */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(state.week / scenario.weeks) * 100}%` }]} />
      </View>
      <Muted>
        {finished ? 'All weeks done.' : `Growth stage: ${capitalize(stage)}`} · Soil: {soil.name}
      </Muted>

      {/* Farm status */}
      <Card style={{ marginTop: spacing.md }}>
        <View style={s.gauges}>
          <Gauge label="Soil moisture" value={`${Math.round(moisturePct)}%`} color={moistureTone} sub={`Ideal ${crop.optimalMoisture[0]}–${crop.optimalMoisture[1]}%`} />
          <Gauge label="Crop health" value={`${Math.round(state.health * 100)}%`} color={state.health > 0.8 ? colors.success : state.health > 0.5 ? colors.accent : colors.danger} />
          <Gauge
            label="Water used"
            value={`${state.irrigationTotalMm} mm`}
            color={state.irrigationTotalMm > scenario.waterAllowanceMm ? colors.danger : colors.water}
            sub={`of ${scenario.waterAllowanceMm} mm`}
          />
          <Gauge label="Spent" value={formatRand(spent)} color={spent > scenario.budget ? colors.danger : colors.text} sub={`of ${formatRand(scenario.budget)}`} />
        </View>
      </Card>

      <Card>
        <H2>Soil moisture</H2>
        <MoistureChart logs={state.logs} optimal={crop.optimalMoisture} totalWeeks={scenario.weeks} />
      </Card>

      {lastLog && lastLog.events.length > 0 && (
        <Card style={{ backgroundColor: '#FFFDF5' }}>
          <Text style={s.eventsTitle}>Week {lastLog.week} report</Text>
          {lastLog.events.map((e, i) => (
            <Text key={i} style={s.event}>
              • {e}
            </Text>
          ))}
        </Card>
      )}

      {!finished ? (
        <>
          <Card style={{ borderColor: colors.water }}>
            <H2>Week {week} forecast</H2>
            <Text style={s.forecast}>
              🌧️ {forecastRain} mm rain · 🌡️ {forecastTemp}°C · Crop needs ~{Math.round(weeklyET0(forecastTemp) * crop.kc[stage])} mm water
            </Text>
            {pestAlert && <Banner tone="warning" text="🐛 Pest alert! Scouts found pests in the field this week." />}
            {moisturePct < crop.optimalMoisture[0] + 5 && <Banner tone="error" text={`Soil is getting dry. Below ${WILTING_POINT_PCT}% your crop will wilt.`} />}
          </Card>

          <Card>
            <H2>Your decisions</H2>
            <ChipGroup
              label="💧 Irrigation this week"
              value={irrigationMm}
              onChange={setIrrigation}
              options={IRRIGATION_OPTIONS_MM.map((mm) => ({ value: mm, label: mm === 0 ? 'None' : `${mm} mm` }))}
            />
            <Text style={s.projection}>
              Projected moisture after this week: <Text style={{ fontWeight: '800' }}>{Math.round(projectedPct)}%</Text> · Cost{' '}
              {formatRand(irrigationMm * COSTS.waterPerMm)}
            </Text>
            <ChipGroup
              label="🧪 Fertilizer"
              value={fertilizer}
              onChange={setFertilizer}
              options={[
                { value: 'none', label: 'None' },
                { value: 'low', label: `Low (${formatRand(COSTS.fertilizerPerUnit)})` },
                { value: 'high', label: `High (${formatRand(COSTS.fertilizerPerUnit * 2)})` },
              ]}
            />
            <Muted>
              Applied so far: {state.nitrogenApplied} of ~{crop.nitrogenNeed} units this crop needs.
            </Muted>
            <View style={{ height: spacing.md }} />
            <ChipGroup
              label="🐛 Pest control"
              value={pestControl ? 'yes' : 'no'}
              onChange={(v) => setPestControl(v === 'yes')}
              options={[
                { value: 'no', label: "Don't spray" },
                { value: 'yes', label: `Spray (${formatRand(COSTS.pestSpray)})` },
              ]}
            />
          </Card>

          <Button title={week === scenario.weeks ? 'Finish season' : `Go to week ${week + 1}`} icon="arrow-forward" onPress={nextWeek} />
          {decisions.length > 0 && <Button title="Undo last week" variant="ghost" icon="arrow-undo-outline" onPress={undo} />}
        </>
      ) : (
        preview && (
          <Card>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={[s.grade, { color: gradeColor(preview.grade) }]}>{preview.grade}</Text>
              <Text style={s.total}>{preview.totalScore} / 100</Text>
              <Muted>Preview – submit to save your official score.</Muted>
            </View>
            <ScoreBar label="Yield" value={preview.breakdown.yield} weight={SCORE_WEIGHTS.yield} />
            <ScoreBar label="Irrigation" value={preview.breakdown.irrigation} weight={SCORE_WEIGHTS.irrigation} />
            <ScoreBar label="Soil & nutrients" value={preview.breakdown.soil} weight={SCORE_WEIGHTS.soil} />
            <ScoreBar label="Pest management" value={preview.breakdown.pest} weight={SCORE_WEIGHTS.pest} />
            <ScoreBar label="Profit" value={preview.breakdown.profit} weight={SCORE_WEIGHTS.profit} />
            {submit.error && <Banner tone="error" text={errorMessage(submit.error)} />}
            <Button title="Submit results" icon="cloud-upload-outline" onPress={onSubmit} loading={submit.isPending} />
            <Button title="Undo last week" variant="ghost" onPress={undo} disabled={submit.isPending} />
          </Card>
        )
      )}
    </Screen>
  );
}

function Gauge({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <View style={s.gauge}>
      <Text style={[s.gaugeValue, { color }]}>{value}</Text>
      <Text style={s.gaugeLabel}>{label}</Text>
      {sub && <Text style={s.gaugeSub}>{sub}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary },
  gauges: { flexDirection: 'row', flexWrap: 'wrap' },
  gauge: { width: '50%', paddingVertical: spacing.sm, alignItems: 'center' },
  gaugeValue: { fontSize: 22, fontWeight: '800' },
  gaugeLabel: { fontSize: 12, color: colors.textMuted },
  gaugeSub: { fontSize: 11, color: colors.textMuted },
  eventsTitle: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  event: { fontSize: 14, color: colors.text, marginBottom: 2, lineHeight: 20 },
  forecast: { fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  projection: { fontSize: 13, color: colors.water, marginTop: -4, marginBottom: spacing.md },
  grade: { fontSize: 56, fontWeight: '900' },
  total: { fontSize: 20, fontWeight: '700', color: colors.text },
});
