import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMyCredentials, useTrainerCredentials } from '@/api/hooks';
import { Badge, Card, H2, Muted } from '@/components/ui';
import { formatDate } from '@/utils/format';
import { colors, radius, spacing } from '@/theme';

const STATUS = {
  sent: { label: '✓ In AgriLearn Passport', color: colors.success, bg: colors.primaryLight },
  pending: { label: 'Waiting to send', color: colors.warning, bg: colors.warningLight },
  failed: { label: 'Retrying', color: colors.warning, bg: colors.warningLight },
} as const;

/** Learner: the microcredentials they have earned. */
export function MyCredentials() {
  const q = useMyCredentials();
  const list = q.data ?? [];
  return (
    <Card>
      <H2>🎓 My microcredentials</H2>
      {list.length === 0 ? (
        <Muted>Score 70 or more on a scenario and answer the reflection prompts to earn its microcredential for your AgriLearn Passport.</Muted>
      ) : (
        list.map((c) => (
          <View key={c.id} style={s.item}>
            <View style={s.medal}>
              <Text style={{ fontSize: 20 }}>{c.cropEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} onPress={() => router.push(`/attempt/${c.attemptId}`)}>
                {c.scenarioTitle}
              </Text>
              <Text style={s.meta}>
                {c.code} · score {c.score.toFixed(0)} · {formatDate(c.createdAt)}
              </Text>
              <Badge label={STATUS[c.status].label} color={STATUS[c.status].color} bg={STATUS[c.status].bg} />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

/** Trainer: microcredentials earned on their scenarios, and whether AgriLearn received them. */
export function TrainerCredentials() {
  const q = useTrainerCredentials();
  if (!q.data) return null;
  const { agrilearnConnected, credentials } = q.data;
  const sent = credentials.filter((c) => c.status === 'sent').length;
  return (
    <Card>
      <H2>🎓 Microcredentials</H2>
      <Muted>
        {credentials.length} earned · {sent} delivered to AgriLearn
        {agrilearnConnected ? '' : ' · AgriLearn is not connected yet, so events are queued on the server.'}
      </Muted>
      {credentials.slice(0, 5).map((c) => (
        <View key={c.id} style={s.row}>
          <Text style={s.rowText} numberOfLines={1}>
            {c.cropEmoji} {c.learnerName} – {c.scenarioTitle}
          </Text>
          <Badge label={STATUS[c.status].label} color={STATUS[c.status].color} bg={STATUS[c.status].bg} />
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  item: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  medal: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginVertical: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  rowText: { flex: 1, fontSize: 13, color: colors.text },
});
