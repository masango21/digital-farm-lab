import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ApiError } from './client';

/** How long saved (offline) data is kept on the device. */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE,
      // Keep showing saved data when the network is down instead of pausing forever.
      networkMode: 'offlineFirst',
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/** AsyncStorage = device storage on phones, localStorage on web. */
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'dfl-query-cache', throttleTime: 2000 });

/** Data worth having offline: scenarios, the farm view and the learner's own results. */
const OFFLINE_KEYS = new Set(['scenarios', 'scenario', 'farms', 'my-attempts', 'attempt', 'scenario-stats']);
export const shouldPersist = (key: readonly unknown[]) => OFFLINE_KEYS.has(String(key[0]));

/** Wipes in-memory and saved data, e.g. on sign-out so the next user on this device sees nothing. */
export async function clearCache() {
  queryClient.clear();
  await persister.removeClient();
}
