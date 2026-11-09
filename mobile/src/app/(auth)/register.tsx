import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Banner, Button, ChipGroup, H1, Muted, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage, fieldErrors } from '@/api/client';
import type { Role } from '@/api/types';

const PASSWORD_HINT = 'At least 8 characters, with a letter and a number';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('learner');
  const [trainerCode, setTrainerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const res = await register({ name: name.trim(), email: email.trim(), password, role, trainerCode: role === 'trainer' ? trainerCode.trim() : undefined });
      router.replace({ pathname: '/verify-email', params: { email: res.email } });
    } catch (e) {
      setError(errorMessage(e));
      setFields(fieldErrors(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <H1>Create your account</H1>
      <Muted>Use a real email address – we&apos;ll send you a code to confirm it.</Muted>
      <View style={{ height: 20 }} />
      {error && <Banner tone="error" text={error} />}
      <ChipGroup
        label="I am a…"
        value={role}
        onChange={setRole}
        options={[
          { value: 'learner', label: '🎓 Learner' },
          { value: 'trainer', label: '🧑‍🏫 Trainer' },
        ]}
      />
      <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={fields.name} />
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
        autoComplete="new-password"
        textContentType="newPassword"
        hint={PASSWORD_HINT}
        error={fields.password}
      />
      <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" error={fields.confirm} />
      {role === 'trainer' && (
        <TextField
          label="Trainer invite code"
          value={trainerCode}
          onChangeText={setTrainerCode}
          autoCapitalize="characters"
          hint="Ask your institution's administrator for this code"
          error={fields.trainerCode}
        />
      )}
      <Button
        title="Create account"
        onPress={onSubmit}
        loading={loading}
        disabled={!name || !email || !password || !confirm || (role === 'trainer' && !trainerCode)}
      />
      <Button title="Already have an account? Sign in" variant="ghost" onPress={() => router.replace('/login')} />
    </Screen>
  );
}
