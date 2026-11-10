import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Banner, Button, H1, Muted, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage } from '@/api/client';

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string; from?: string }>();
  const fromLogin = params.from === 'login';
  const { verifyEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyEmail(email.trim(), code.trim());
      // Root layout switches to the app automatically once signed in.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setResending(true);
    try {
      await resendVerification(email.trim());
      setInfo('A new code is on its way. Check your inbox and spam folder.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen>
      <H1>Check your email 📬</H1>
      <Muted>
        {fromLogin
          ? `Your email isn't verified yet. Enter the 6-digit code we sent to ${email || 'your email'} when you signed up, or tap "Send a new code" if it has expired.`
          : `We sent a 6-digit code to ${email || 'your email'}. It expires in 15 minutes.`}
      </Muted>
      <View style={{ height: 20 }} />
      {error && <Banner tone="error" text={error} />}
      {info && <Banner tone="success" text={info} />}
      {!params.email && (
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      )}
      <TextField
        label="Verification code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        placeholder="123456"
      />
      <Button title="Verify email" onPress={onVerify} loading={loading} disabled={code.length !== 6 || !email} />
      <Button title="Send a new code" variant="ghost" onPress={onResend} loading={resending} disabled={!email} />
    </Screen>
  );
}
