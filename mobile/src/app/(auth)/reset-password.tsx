import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Banner, Button, H1, Muted, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage, fieldErrors } from '@/api/client';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { resetPassword, forgotPassword } = useAuth();
  const email = params.email ?? '';
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit() {
    setError(null);
    setFields({});
    if (password !== confirm) {
      setFields({ confirm: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
    } catch (e) {
      setError(errorMessage(e));
      setFields(fieldErrors(e));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      await forgotPassword(email);
      setInfo('A new code has been sent.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <H1>Set a new password</H1>
      <Muted>If an account exists for {email}, we sent it a 6-digit code. Check your spam folder too.</Muted>
      <View style={{ height: 20 }} />
      {error && <Banner tone="error" text={error} />}
      {info && <Banner tone="success" text={info} />}
      <TextField
        label="Reset code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        error={fields.code}
      />
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number"
        error={fields.newPassword}
      />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secure error={fields.confirm} />
      <Button title="Reset password & sign in" onPress={onSubmit} loading={loading} disabled={code.length !== 6 || !password || !confirm} />
      <Button title="Send a new code" variant="ghost" onPress={onResend} />
    </Screen>
  );
}
