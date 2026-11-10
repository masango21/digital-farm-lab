import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeekLog } from '@/simulation/engine';
import { WILTING_POINT_PCT, type CropProfile } from '@/simulation/crops';
import { MoistureChart } from '@/components/MoistureChart';
import { capitalize } from '@/utils/format';
import { colors, radius, spacing } from '@/theme';

const STAGE_ICON = { initial: '🌱', development: '🌿' } as const;

/**
 * Time-lapse of a season: plays the weekly log back so learners can watch soil moisture,
 * crop health and events change. Stretch goal from the spec.
 */
export function SeasonTimelapse({ logs, crop }: { logs: WeekLog[]; crop: CropProfile }) {
  const [week, setWeek] = useState(logs.length); // start on the full season
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setWeek((w) => {
        if (w >= logs.length) {
          setPlaying(false);
          return w;
        }
        return w + 1;
      });
    }, 650);
    return () => clearInterval(t);
  }, [playing, logs.length]);

  const log = logs[Math.max(0, week - 1)];
  if (!log) return null;
  const icon = STAGE_ICON[log.stage as keyof typeof STAGE_ICON] ?? crop.emoji;
  const health = log.cropHealthPct;
  const moistureTone =
    log.moisturePct < WILTING_POINT_PCT
      ? colors.danger
      : log.moisturePct < crop.optimalMoisture[0] || log.moisturePct > crop.optimalMoisture[1]
        ? colors.accent
        : colors.water;

  function play() {
    if (week >= logs.length) setWeek(1);
    setPlaying((p) => !p);
  }

  return (
    <View>
      <View style={s.scene} accessibilityLabel={`Week ${log.week}: moisture ${Math.round(log.moisturePct)} percent, crop health ${Math.round(health)} percent`}>
        <View style={{ flex: 1 }}>
          <Text style={s.week}>Week {log.week}</Text>
          <Text style={s.stage}>{capitalize(log.stage)} stage</Text>
          <View style={s.weather}>
            <Text style={s.weatherText}>{log.rainMm > 0 ? `🌧️ ${log.rainMm} mm` : '☀️ Dry'}</Text>
            <Text style={s.weatherText}>🌡️ {log.temperatureC}°C</Text>
            {log.irrigationMm > 0 && <Text style={s.weatherText}>💧 {log.irrigationMm} mm</Text>}
          </View>
        </View>
        <View style={s.plot}>
          <Text style={[s.plant, { opacity: 0.35 + (health / 100) * 0.65, transform: [{ scale: 0.7 + (log.week / logs.length) * 0.6 }] }]}>{icon}</Text>
          {log.pestOutbreak && <Text style={s.pest}>🐛</Text>}
        </View>
        <View style={s.meters}>
          <Meter label="Soil" pct={log.moisturePct} color={moistureTone} />
          <Meter label="Health" pct={health} color={health > 80 ? colors.success : health > 50 ? colors.accent : colors.danger} />
        </View>
      </View>

      <Text style={s.event} numberOfLines={2}>
        {log.events[0] ?? 'A calm week on the farm.'}
      </Text>

      <MoistureChart logs={logs.slice(0, week)} optimal={crop.optimalMoisture} totalWeeks={logs.length} />

      <View style={s.controls}>
        <Ctrl icon="play-skip-back" label="First week" onPress={() => { setPlaying(false); setWeek(1); }} />
        <Ctrl icon="chevron-back" label="Previous week" onPress={() => { setPlaying(false); setWeek((w) => Math.max(1, w - 1)); }} />
        <Pressable onPress={play} style={s.play} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play season'}>
          <Ionicons name={playing ? 'pause' : 'play'} size={22} color={colors.white} />
        </Pressable>
        <Ctrl icon="chevron-forward" label="Next week" onPress={() => { setPlaying(false); setWeek((w) => Math.min(logs.length, w + 1)); }} />
        <Ctrl icon="play-skip-forward" label="Last week" onPress={() => { setPlaying(false); setWeek(logs.length); }} />
      </View>
    </View>
  );
}

function Meter({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={s.meter}>
      <View style={s.meterTrack}>
        <View style={[s.meterFill, { height: `${Math.max(3, Math.min(100, pct))}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.meterValue}>{Math.round(pct)}%</Text>
      <Text style={s.meterLabel}>{label}</Text>
    </View>
  );
}

function Ctrl({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.ctrl} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  scene: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F7EC', borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  week: { fontSize: 22, fontWeight: '800', color: colors.text },
  stage: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  weather: { gap: 2 },
  weatherText: { fontSize: 12, color: colors.text },
  plot: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E3D3B8', alignItems: 'center', justifyContent: 'center' },
  plant: { fontSize: 40 },
  pest: { position: 'absolute', right: 4, top: 4, fontSize: 18 },
  meters: { flexDirection: 'row', gap: spacing.sm },
  meter: { alignItems: 'center', width: 38 },
  meterTrack: { width: 12, height: 64, borderRadius: 6, backgroundColor: colors.white, overflow: 'hidden', justifyContent: 'flex-end' },
  meterFill: { width: '100%', borderRadius: 6 },
  meterValue: { fontSize: 11, fontWeight: '700', color: colors.text, marginTop: 2 },
  meterLabel: { fontSize: 10, color: colors.textMuted },
  event: { fontSize: 13, color: colors.text, marginVertical: spacing.sm, minHeight: 36, lineHeight: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md },
  ctrl: { padding: 6 },
  play: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
