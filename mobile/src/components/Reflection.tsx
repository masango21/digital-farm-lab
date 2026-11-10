import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSaveReflection } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import type { Attempt } from '@/api/types';
import { Badge, Banner, Button, Card, H2, Muted } from '@/components/ui';
import { reflectionPrompts } from '@/utils/experiment';
import { formatDateTime } from '@/utils/format';
import { colors, radius, spacing } from '@/theme';

/**
 * Reflection prompts after a run. The learner who made the run can answer and edit;
 * anyone else (the trainer) sees the saved answers read-only.
 */
export function ReflectionCard({ attempt, canEdit }: { attempt: Attempt; canEdit: boolean }) {
  const saved = attempt.reflection;
  const prompts = saved?.map((r) => r.prompt) ?? reflectionPrompts(attempt.mode, attempt.params);
  const [editing, setEditing] = useState(!saved);
  const [earned, setEarned] = useState(false);
  const [answers, setAnswers] = useState<string[]>(() => prompts.map((p, i) => saved?.[i]?.answer ?? ''));
  const save = useSaveReflection(attempt.id);

  if (!canEdit && !saved) return null;

  const ready = answers.every((a) => a.trim().length >= 3);

  return (
    <Card>
      <View style={s.head}>
        <H2>📝 Reflect</H2>
        {saved && <Badge label="✓ Done" color={colors.success} bg={colors.primaryLight} />}
      </View>
      {canEdit && editing && (
        <Muted>Short answers are fine. Your trainer can read them. Score 70+ and reflect to earn this scenario's microcredential.</Muted>
      )}
      {prompts.map((p, i) => (
        <View key={p} style={s.item}>
          <Text style={s.prompt}>
            {i + 1}. {p}
          </Text>
          {canEdit && editing ? (
            <TextInput
              value={answers[i]}
              onChangeText={(t) => setAnswers((cur) => cur.map((a, j) => (j === i ? t : a)))}
              multiline
              placeholder="Your answer…"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              accessibilityLabel={`Answer ${i + 1}`}
              maxLength={2000}
            />
          ) : (
            <Text style={s.answer}>{saved?.[i]?.answer}</Text>
          )}
        </View>
      ))}
      {save.error && <Banner tone="error" text={errorMessage(save.error)} />}
      {earned && (
        <Banner tone="success" text="🎓 Microcredential earned! It's on your Profile and queued for your AgriLearn Passport." />
      )}
      {canEdit && editing && (
        <Button
          title="Save reflection"
          icon="checkmark"
          disabled={!ready}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              prompts.map((prompt, i) => ({ prompt, answer: answers[i].trim() })),
              {
                onSuccess: (r) => {
                  setEditing(false);
                  setEarned(r.credentialEarned);
                },
              },
            )
          }
        />
      )}
      {canEdit && !editing && <Button title="Edit answers" variant="ghost" icon="create-outline" onPress={() => setEditing(true)} />}
      {attempt.reflectedAt && !editing && <Text style={s.when}>Saved {formatDateTime(attempt.reflectedAt)}</Text>}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: { marginTop: spacing.md },
  prompt: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20, marginBottom: 6 },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
  },
  answer: { fontSize: 14, color: colors.text, lineHeight: 20, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  when: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
