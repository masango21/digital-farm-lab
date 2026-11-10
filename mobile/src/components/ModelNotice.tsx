import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MODEL_SIMPLIFICATIONS } from '@/simulation/crops';
import { colors, radius, spacing } from '@/theme';

/**
 * Honest statement of what the model is and isn't. "compact" is a one-line notice
 * that expands to the full list; otherwise the full list is shown.
 */
export function ModelNotice({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  return (
    <View style={s.box} accessibilityRole="summary">
      <Pressable onPress={() => compact && setOpen((o) => !o)} style={s.head} accessibilityRole={compact ? 'button' : undefined}>
        <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
        <Text style={s.title}>Teaching model – not agronomic advice</Text>
        {compact && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />}
      </Pressable>
      {open && (
        <>
          <Text style={s.text}>
            Digital Farm Lab is a simplified simulation for learning. Use it to understand trade-offs, not to plan a real crop. Its main
            simplifications:
          </Text>
          {MODEL_SIMPLIFICATIONS.map((m) => (
            <Text key={m} style={s.item}>
              • {m}
            </Text>
          ))}
          <Text style={s.text}>For real decisions, speak to an extension officer or agronomist and use local soil tests and weather data.</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.warning },
  text: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: spacing.sm },
  item: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 2 },
});
