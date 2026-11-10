import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scenario/[id]" options={{ title: 'Scenario' }} />
      <Stack.Screen name="simulate/[id]" options={{ title: 'Simulation', gestureEnabled: false }} />
      <Stack.Screen name="experiment/[id]" options={{ title: 'Quick experiment' }} />
      <Stack.Screen name="attempt/[id]" options={{ title: 'Results' }} />
      <Stack.Screen name="compare" options={{ title: 'Compare scores' }} />
      <Stack.Screen name="trainer/scenario-form" options={{ title: 'Scenario' }} />
      <Stack.Screen name="trainer/scores" options={{ title: 'Learner scores' }} />
    </Stack>
  );
}
