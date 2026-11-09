import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage, fieldErrors, API_URL } from '@/api/client';
import { Badge, Banner, Button, Card, H2, Muted, Screen, TextField } from '@/components/ui';
import { capitalize, formatDate } from '@/utils/format';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const { user, updateName, changePassword, signOut } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<'name' | 'password' | null>(null);

  if (!user) return null;

  async function saveName() {
    setSaving('name');
    setMsg(null);
    try {
      await updateName(name.trim());
      setMsg({ tone: 'success', text: 'Name updated' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setSaving(null);
    }
  }

  async function savePassword() {
    setSaving('password');
    setMsg(null);
    setFields({});
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setMsg({ tone: 'success', text: 'Password changed. Other devices have been signed out.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
      setFields(fieldErrors(e));
    } finally {
      setSaving(null);
    }
  }

  function confirmSignOut() {
    if (Platform.OS === 'web') {
      void signOut();
      return;
    }
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      <Card>
        <View style={{ alignItems: 'center' }}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{user.name}</Text>
          <Muted>{user.email}</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
            <Badge label={capitalize(user.role)} />
            <Badge label="✓ Email verified" color={colors.success} bg={colors.primaryLight} />
          </View>
          <Text style={s.since}>Member since {formatDate(user.createdAt)}</Text>
        </View>
      </Card>

      {msg && <Banner tone={msg.tone} text={msg.text} />}

      <Card>
        <H2>Display name</H2>
        <TextField label="Name" value={name} onChangeText={setName} />
        <Button title="Save name" variant="secondary" onPress={saveName} loading={saving === 'name'} disabled={name.trim().length < 2 || name === user.name} />
      </Card>

      <Card>
        <H2>Change password</H2>
        <TextField label="Current password" value={current} onChangeText={setCurrent} secure error={fields.currentPassword} />
        <TextField
          label="New password"
          value={next}
          onChangeText={setNext}
          secure
          hint="At least 8 characters, with a letter and a number"
          error={fields.newPassword}
        />
        <Button title="Change password" variant="secondary" onPress={savePassword} loading={saving === 'password'} disabled={!current || !next} />
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} />
      <Text style={s.server}>Server: {API_URL}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarText: { color: colors.white, fontSize: 30, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  since: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  server: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
