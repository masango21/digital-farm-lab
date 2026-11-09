import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Banner, Button, H1, Muted, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage, fieldErrors } from '@/api/client';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit() {
    setError(null);
    setFields({});
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      router.push({ pathname: '/reset-password', params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setError(errorMessage(e));
      setFields(fieldErrors(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <H1>Recover your account</H1>
      <Muted>Enter the email you signed up with. We&apos;ll send a code so you can set a new password.</Muted>
      <View style={{ height: 20 }} />
      {error && <Banner tone="error" text={error} />}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={fields.email}
      />
      <Button title="Send reset code" onPress={onSubmit} loading={loading} disabled={!email} />
    </Screen>
  );
}
