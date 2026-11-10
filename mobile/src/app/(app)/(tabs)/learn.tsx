import { StyleSheet, Text, View } from 'react-native';
import { Card, H2, Muted, PageHeader, Screen } from '@/components/ui';
import { CROP_LIST, SOILS, WILTING_POINT_PCT, WATERLOGGING_PCT } from '@/simulation/crops';
import { SCORE_WEIGHTS } from '@/simulation/engine';
import { colors, spacing } from '@/theme';
import { formatRand } from '@/utils/format';
import { ModelNotice } from '@/components/ModelNotice';

export default function LearnScreen() {
  return (
    <Screen edges={['top']}>
      <PageHeader title="Crop guide" subtitle="How the farm model works, how you're scored, and the crops and soils you'll meet." />
      <ModelNotice />
      <Card style={{ backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }}>
        <H2>How you are scored</H2>
        {(
          [
            ['🌾 Yield', SCORE_WEIGHTS.yield],
            ['💧 Irrigation', SCORE_WEIGHTS.irrigation],
            ['🪱 Soil & nutrients', SCORE_WEIGHTS.soil],
            ['🐛 Pest management', SCORE_WEIGHTS.pest],
            ['💰 Profit', SCORE_WEIGHTS.profit],
          ] as const
        ).map(([label, weight]) => (
          <View key={label} style={s.weightRow}>
            <Text style={[s.line, { width: 150, marginBottom: 0 }]}>{label}</Text>
            <View style={s.weightTrack}>
              <View style={[s.weightFill, { width: `${(weight / 35) * 100}%` }]} />
            </View>
            <Text style={s.weightPct}>{weight}%</Text>
          </View>
        ))}
        <Muted>
          Irrigation is 20% of your score: keep soil moisture inside each crop&apos;s ideal band, avoid runoff, and stay within the
          water allowance.
        </Muted>
      </Card>

      <Card>
        <H2>Key soil-moisture levels</H2>
        <Text style={s.line}>🔴 Below {WILTING_POINT_PCT}% – wilting point. Plants are badly damaged.</Text>
        <Text style={s.line}>🟢 Inside the crop&apos;s ideal band – best growth.</Text>
        <Text style={s.line}>🔵 Above {WATERLOGGING_PCT}% – waterlogged. Roots can&apos;t breathe.</Text>
      </Card>

      <H2 style={{ marginTop: spacing.sm }}>Crops</H2>
      {CROP_LIST.map((c) => (
        <Card key={c.id}>
          <Text style={s.cropTitle}>
            {c.emoji} {c.name}
          </Text>
          <Muted>{c.description}</Muted>
          <View style={s.facts}>
            <Fact label="Season" value={`${c.seasonWeeks} weeks`} />
            <Fact label="Ideal moisture" value={`${c.optimalMoisture[0]}–${c.optimalMoisture[1]}%`} />
            <Fact label="Top yield" value={`${c.potentialYield} t/ha`} />
            <Fact label="Price" value={`${formatRand(c.pricePerTon)}/t`} />
          </View>
          {c.tips.map((t) => (
            <Text key={t} style={s.tip}>
              💡 {t}
            </Text>
          ))}
        </Card>
      ))}

      <H2 style={{ marginTop: spacing.sm }}>Soils</H2>
      {Object.values(SOILS).map((soil) => (
        <Card key={soil.id}>
          <Text style={s.cropTitle}>{soil.name}</Text>
          <Muted>{soil.description}</Muted>
          <Text style={s.tip}>Holds up to {soil.capacityMm} mm of plant-available water.</Text>
        </Card>
      ))}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factValue}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  weightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  weightTrack: { flex: 1, height: 8, backgroundColor: colors.white, borderRadius: 4, marginHorizontal: spacing.sm, overflow: 'hidden' },
  weightFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  weightPct: { width: 40, textAlign: 'right', fontWeight: '700', color: colors.primary },
  line: { fontSize: 14, color: colors.text, marginBottom: 6, lineHeight: 20 },
  cropTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: spacing.sm },
  fact: { width: '50%', paddingVertical: 6 },
  factValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  factLabel: { fontSize: 12, color: colors.textMuted },
  tip: { fontSize: 13, color: colors.text, marginTop: 4 },
});
