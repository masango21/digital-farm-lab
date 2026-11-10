import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { CACHE_MAX_AGE, persister, queryClient, shouldPersist } from '@/api/queryClient';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync().catch(() => {});
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // PWA: cache the app shell so the web app opens offline (production builds only).
    if (Platform.OS === 'web' && !__DEV__ && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: CACHE_MAX_AGE,
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && shouldPersist(q.queryKey) },
        }}
      >
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
