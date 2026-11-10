import { StyleSheet, Text, View } from 'react-native';
import type { RunSummary } from '@/simulation/engine';
import { formatRand } from '@/utils/format';
import { colors, radius, spacing } from '@/theme';

/** money rows show the rand difference: a % of a near-zero profit is meaningless. */
type Row = { label: string; key: keyof RunSummary; fmt: (n: number) => string; lowerIsBetter?: boolean; money?: boolean };

const ROWS: Row[] = [
  { label: 'Score', key: 'totalScore', fmt: (n) => n.toFixed(0) },
  { label: 'Yield', key: 'yieldTonsPerHa', fmt: (n) => `${n.toFixed(1)} t/ha` },
  { label: 'Water used', key: 'waterUsedMm', fmt: (n) => `${Math.round(n)} mm`, lowerIsBetter: true },
  { label: 'Cost', key: 'totalCost', fmt: formatRand, lowerIsBetter: true, money: true },
  { label: 'Profit', key: 'profit', fmt: formatRand, money: true },
];

/** "R 6.5k" style, short enough for the change pill. */
const shortRand = (v: number) => {
  const n = Math.abs(v);
  return `R ${n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : Math.round(n)}`;
};

function change(base: number, run: number) {
  const diff = run - base;
  const pct = base !== 0 ? (diff / Math.abs(base)) * 100 : run === 0 ? 0 : 100;
  return { diff, pct };
}

/** Side-by-side table of a run against the scenario's baseline, with % change per row. */
export function BaselineComparison({ baseline, run, runLabel = 'Your run' }: { baseline: RunSummary; run: RunSummary; runLabel?: string }) {
  return (
    <View accessibilityLabel="Comparison with baseline">
      <View style={[s.tr, s.head]}>
        <Text style={[s.label, s.headText]} />
        <Text style={[s.cell, s.headText]}>Baseline</Text>
        <Text style={[s.cell, s.headText]}>{runLabel}</Text>
        <Text style={[s.delta, s.headText]}>Change</Text>
      </View>
      {ROWS.map((r) => {
        const { diff, pct } = change(baseline[r.key], run[r.key]);
        const same = r.money ? Math.abs(diff) < 1 : Math.abs(pct) < 0.5;
        const amount = r.money ? shortRand(diff) : `${Math.abs(pct) >= 1000 ? '>999' : Math.abs(pct).toFixed(0)}%`;
        const good = r.lowerIsBetter ? diff < 0 : diff > 0;
        const tone = same ? colors.textMuted : good ? colors.success : colors.danger;
        return (
          <View key={r.key} style={s.tr}>
            <Text style={s.label}>{r.label}</Text>
            <Text style={s.cell}>{r.fmt(baseline[r.key])}</Text>
            <Text style={[s.cell, s.bold]}>{r.fmt(run[r.key])}</Text>
            <View style={s.delta}>
              <Text style={[s.pill, { color: tone, backgroundColor: same ? colors.background : good ? colors.primaryLight : colors.dangerLight }]}>
                {same ? '=' : `${diff > 0 ? '▲' : '▼'} ${amount}`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** One plain-language sentence about the biggest effect, for learners. */
export function headline(baseline: RunSummary, run: RunSummary): string {
  const w = change(baseline.waterUsedMm, run.waterUsedMm).pct;
  const y = change(baseline.yieldTonsPerHa, run.yieldTonsPerHa).pct;
  const p = change(baseline.profit, run.profit).diff;
  if (Math.abs(w) < 0.5 && Math.abs(y) < 0.5 && Math.abs(p) < 1) return 'Same result as the baseline.';
  const parts: string[] = [];
  if (Math.abs(w) >= 0.5) parts.push(`${Math.abs(w).toFixed(0)}% ${w < 0 ? 'less' : 'more'} water`);
  if (Math.abs(y) >= 0.5) parts.push(`${Math.abs(y).toFixed(0)}% ${y < 0 ? 'lower' : 'higher'} yield`);
  parts.push(`profit ${p >= 0 ? 'up' : 'down'} ${formatRand(Math.abs(p))}`);
  return `${parts.join(', ')} compared with the baseline.`.replace(/^./, (c) => c.toUpperCase());
}

const s = StyleSheet.create({
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  head: { paddingTop: 0 },
  headText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' },
  label: { flex: 1, fontSize: 14, color: colors.textMuted, textAlign: 'left' },
  cell: { flex: 1.35, fontSize: 14, color: colors.text, textAlign: 'right', paddingLeft: spacing.xs },
  bold: { fontWeight: '700' },
  delta: { flex: 1, alignItems: 'flex-end', paddingLeft: spacing.sm },
  pill: { fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
});
