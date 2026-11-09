import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { WILTING_POINT_PCT } from '@/simulation/crops';
import type { WeekLog } from '@/simulation/engine';

const HEIGHT = 140;

/**
 * Dependency-free bar chart of weekly soil moisture, with the optimal band
 * shaded green and the 20% wilting point drawn as a red line.
 */
export function MoistureChart({ logs, optimal, totalWeeks }: { logs: WeekLog[]; optimal: [number, number]; totalWeeks: number }) {
  const barWidth = `${100 / Math.max(totalWeeks, 1)}%` as const;
  return (
    <View accessibilityLabel={`Soil moisture chart for ${logs.length} weeks`}>
      <View style={styles.chart}>
        <View style={[styles.band, { bottom: (optimal[0] / 100) * HEIGHT, height: ((optimal[1] - optimal[0]) / 100) * HEIGHT }]} />
        <View style={[styles.wilt, { bottom: (WILTING_POINT_PCT / 100) * HEIGHT }]} />
        <View style={styles.bars}>
          {Array.from({ length: totalWeeks }).map((_, i) => {
            const log = logs[i];
            const pct = log?.moisturePct ?? 0;
            const color =
              !log ? 'transparent' : pct < WILTING_POINT_PCT ? colors.danger : pct < optimal[0] || pct > optimal[1] ? colors.accent : colors.water;
            return (
              <View key={i} style={{ width: barWidth, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 }}>
                {log && log.irrigationMm > 0 && <Text style={styles.drop}>💧</Text>}
                <View style={{ height: (pct / 100) * HEIGHT, backgroundColor: color, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.legend}>
        <Legend color={colors.water} label="Ideal" />
        <Legend color={colors.accent} label="Too dry/wet" />
        <Legend color={colors.danger} label="Below 20% (wilting)" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md }}>
      <View style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2, marginRight: 4 }} />
      <Text style={{ fontSize: 11, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: HEIGHT, backgroundColor: '#FAFCF9', borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(47,107,47,0.10)' },
  wilt: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger, opacity: 0.7 },
  bars: { flexDirection: 'row', height: '100%', alignItems: 'flex-end' },
  drop: { fontSize: 8, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
});
