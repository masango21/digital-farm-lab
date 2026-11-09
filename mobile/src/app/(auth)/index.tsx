import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen } from '@/components/ui';
import { CROP_LIST } from '@/simulation/crops';
import { colors, spacing } from '@/theme';

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <Text style={s.logo}>🌱</Text>
        <Text style={s.title}>Digital Farm Lab</Text>
        <Text style={s.tag}>Learn to farm smarter. Run real-world simulations, make decisions, and see the results.</Text>
        <Text style={s.crops}>{CROP_LIST.map((c) => c.emoji).join('  ')}</Text>
      </View>
      <Button title="Create an account" onPress={() => router.push('/register')} />
      <Button title="Sign in" variant="secondary" onPress={() => router.push('/login')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  logo: { fontSize: 72 },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginTop: spacing.sm },
  tag: { fontSize: 16, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  crops: { fontSize: 30, marginTop: spacing.xl },
});
