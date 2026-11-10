import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import { colors, radius, spacing } from '@/theme';

/** Shown when a request failed for lack of connection but saved data is on screen. */
export function OfflineBanner({ error, hasData }: { error: unknown; hasData: boolean }) {
  if (!hasData || !(error instanceof ApiError) || error.status !== 0) return null;
  return (
    <View style={s.box} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
      <Text style={s.text}>You're offline – showing saved data. Previews still work; saving a score needs a connection.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.md },
  text: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.warning },
});
