import { View } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Banner, Button, H1, Muted, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError, errorMessage, fieldErrors } from '@/api/client';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit() {
    setError(null);
    setFields({});
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
        router.push({ pathname: '/verify-email', params: { email: email.trim().toLowerCase(), from: 'login' } });
        return;
      }
      setError(errorMessage(e));
      setFields(fieldErrors(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <H1>Welcome back</H1>
      <Muted>Sign in to continue your farm training.</Muted>
      <View style={{ height: 20 }} />
      {error && <Banner tone="error" text={error} />}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={fields.email}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="password"
        error={fields.password}
        returnKeyType="go"
        onSubmitEditing={() => email && password && !loading && onSubmit()}
      />
      <Button title="Sign in" onPress={onSubmit} loading={loading} disabled={!email || !password} />
      <Button title="Forgot password?" variant="ghost" onPress={() => router.push({ pathname: '/forgot-password', params: { email } })} />
      <Button title="New here? Create an account" variant="ghost" onPress={() => router.replace('/register')} />
    </Screen>
  );
}
