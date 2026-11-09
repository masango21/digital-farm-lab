import { Platform } from 'react-native';

const RAW_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
export const API_URL = RAW_URL.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

export async function api<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(
      0,
      Platform.OS === 'web'
        ? 'Cannot reach the server. Check your connection.'
        : 'Cannot reach the server. Check your internet connection (the free server may take ~1 minute to wake up).',
      'NETWORK_ERROR',
    );
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    if (res.status === 401 && auth && err.code !== 'INVALID_CREDENTIALS') onUnauthorized?.();
    const fields = err.details && typeof err.details === 'object' ? (err.details as Record<string, string>) : undefined;
    throw new ApiError(res.status, err.message ?? 'Something went wrong', err.code ?? 'ERROR', fields);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
export const fieldErrors = (e: unknown) => (e instanceof ApiError ? (e.fields ?? {}) : {});
