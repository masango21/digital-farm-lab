import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useShareAttempt } from '@/api/hooks';
import { API_URL, errorMessage } from '@/api/client';
import type { Attempt } from '@/api/types';
import { Banner, Button } from '@/components/ui';
import { describeParams } from '@/utils/experiment';
import { colors, spacing } from '@/theme';

/** Share a result as a public, read-only link (first name only), and turn it off again. */
export function ShareResult({ attempt }: { attempt: Attempt }) {
  const share = useShareAttempt(attempt.id);
  const [note, setNote] = useState<string | null>(null);
  const shared = !!attempt.shareToken;

  async function onShare() {
    setNote(null);
    const r = await share.mutateAsync(true).catch(() => null);
    if (!r) return;
    const message = `My Digital Farm Lab result: ${attempt.result.grade} (${attempt.result.totalScore.toFixed(0)}/100) on "${attempt.scenarioTitle}" – ${describeParams(
      attempt.mode === 'experiment' ? attempt.params : null,
    )}.`;
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) await nav.share({ title: 'Digital Farm Lab result', text: message, url: r.url });
        else {
          await nav?.clipboard?.writeText(r.url);
          setNote('Link copied to the clipboard.');
        }
      } else {
        await Share.share({ message: `${message}\n${r.url}`, url: r.url });
      }
    } catch {
      setNote(`Share this link: ${r.url}`);
    }
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      {share.error && <Banner tone="error" text={errorMessage(share.error)} />}
      {note && <Banner tone="success" text={note} />}
      <Button title={shared ? 'Share again' : 'Share result'} icon="share-social-outline" variant="secondary" onPress={onShare} loading={share.isPending} />
      {shared && (
        <>
          <Text style={s.link} selectable>
            {`${API_URL}/share/${attempt.shareToken}`}
          </Text>
          <Button title="Stop sharing" variant="ghost" icon="eye-off-outline" onPress={() => share.mutate(false)} disabled={share.isPending} />
        </>
      )}
      <Text style={s.hint}>Anyone with the link sees your first name, grade and comparison – never your email.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  link: { fontSize: 12, color: colors.water, textAlign: 'center', marginTop: spacing.xs },
  hint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
