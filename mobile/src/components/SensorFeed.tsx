import { StyleSheet, Text, View } from 'react-native';
import type { SensorReading } from '@/api/types';
import { WILTING_POINT_PCT } from '@/simulation/crops';
import { colors, radius, spacing } from '@/theme';

const H = 72;

/** Compact chart of a field's synthetic weekly sensor feed: soil-moisture probe bars and rain gauge. */
export function SensorFeed({ readings, optimal }: { readings: SensorReading[]; optimal: [number, number] }) {
  if (!readings.length) return null;
  const maxRain = Math.max(10, ...readings.map((r) => r.rainfallMm));
  const totalRain = readings.reduce((a, r) => a + r.rainfallMm, 0);
  const avgTemp = readings.reduce((a, r) => a + r.temperatureC, 0) / readings.length;
  const dryWeeks = readings.filter((r) => r.soilMoisturePct < optimal[0]).length;

  return (
    <View>
      <View style={s.chart} accessibilityLabel={`Soil moisture probe readings for ${readings.length} weeks`}>
        <View style={[s.band, { bottom: (optimal[0] / 100) * H, height: ((optimal[1] - optimal[0]) / 100) * H }]} />
        <View style={[s.wilt, { bottom: (WILTING_POINT_PCT / 100) * H }]} />
        <View style={s.bars}>
          {readings.map((r) => {
            const pct = r.soilMoisturePct;
            const c = pct < WILTING_POINT_PCT ? colors.danger : pct < optimal[0] || pct > optimal[1] ? colors.accent : colors.water;
            return (
              <View key={r.week} style={s.col}>
                <View style={[s.rain, { height: (r.rainfallMm / maxRain) * 16 }]} />
                <View style={{ flex: 1 }} />
                <View style={[s.bar, { height: Math.max(2, (pct / 100) * H), backgroundColor: c }]} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={s.stats}>
        <Mini label="Rain gauge" value={`${Math.round(totalRain)} mm`} />
        <Mini label="Avg air temp" value={`${avgTemp.toFixed(0)}°C`} />
        <Mini label="Probe below ideal" value={`${dryWeeks} wk`} />
      </View>
    </View>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chart: { height: H + 18, backgroundColor: '#FAFCF9', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(47,107,47,0.10)' },
  wilt: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: colors.danger, opacity: 0.6 },
  bars: { flexDirection: 'row', flex: 1, paddingHorizontal: 2 },
  col: { flex: 1, paddingHorizontal: 1, alignItems: 'stretch' },
  rain: { backgroundColor: colors.water, opacity: 0.35, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  bar: { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  stats: { flexDirection: 'row', marginTop: spacing.sm },
  value: { fontSize: 14, fontWeight: '700', color: colors.text },
  label: { fontSize: 11, color: colors.textMuted },
});
