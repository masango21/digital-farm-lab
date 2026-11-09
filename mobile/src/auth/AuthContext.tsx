import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import type { AuthResponse, Role, User } from '@/api/types';
import { tokenStorage } from './storage';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  trainerCode?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const applySession = useCallback(async (res: AuthResponse) => {
    setAuthToken(res.token);
    await tokenStorage.set(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await tokenStorage.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Restore saved session on app start.
  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      try {
        const token = await tokenStorage.get();
        if (token) {
          setAuthToken(token);
          const res = await api<{ user: User }>('/api/auth/me');
          setUser(res.user);
        }
      } catch {
        // Offline or expired token. 401 is handled by signOut.
      } finally {
        setIsLoading(false);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signOut,
      async signIn(email, password) {
        await applySession(await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }));
      },
      async register(input) {
        return api<{ email: string }>('/api/auth/register', { method: 'POST', body: input, auth: false });
      },
      async verifyEmail(email, code) {
        await applySession(await api<AuthResponse>('/api/auth/verify-email', { method: 'POST', body: { email, code }, auth: false }));
      },
      async resendVerification(email) {
        await api('/api/auth/resend-verification', { method: 'POST', body: { email }, auth: false });
      },
      async forgotPassword(email) {
        await api('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
      },
      async resetPassword(email, code, newPassword) {
        await applySession(
          await api<AuthResponse>('/api/auth/reset-password', { method: 'POST', body: { email, code, newPassword }, auth: false }),
        );
      },
      async changePassword(currentPassword, newPassword) {
        await applySession(await api<AuthResponse>('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }));
      },
      async updateName(name) {
        const res = await api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: { name } });
        setUser(res.user);
      },
    }),
    [user, isLoading, signOut, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
