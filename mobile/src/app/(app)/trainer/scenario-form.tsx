import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadScenarioImage, useSaveScenario, useScenario } from '@/api/hooks';
import { errorMessage, fieldErrors } from '@/api/client';
import type { Difficulty, ScenarioInput } from '@/api/types';
import { Banner, Button, Card, ChipGroup, H2, Loading, Muted, Screen, TextField } from '@/components/ui';
import { CROP_LIST, CROPS, SOILS, type Climate, type CropId, type SoilType } from '@/simulation/crops';
import { colors, radius, spacing } from '@/theme';

const DEFAULTS: ScenarioInput = {
  title: '',
  description: '',
  learningGoals: '',
  crop: 'maize',
  soil: 'loam',
  climate: 'normal',
  difficulty: 'beginner',
  avgTemperatureC: 24,
  startMoisturePct: 55,
  budget: 30000,
  waterAllowanceMm: 300,
  pestWeeks: [],
  imageUrl: null,
  imagePublicId: null,
  agrilearnModuleCode: '',
  isPublished: false,
};

export default function ScenarioForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useScenario(id);
  const save = useSaveScenario(id);
  const [form, setForm] = useState<ScenarioInput>(DEFAULTS);
  const [numbers, setNumbers] = useState({ avgTemperatureC: '24', startMoisturePct: '55', budget: '30000', waterAllowanceMm: '300' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    const sc = existing.data;
    if (!sc) return;
    setForm({
      title: sc.title,
      description: sc.description,
      learningGoals: sc.learningGoals,
      crop: sc.crop,
      soil: sc.soil,
      climate: sc.climate,
      difficulty: sc.difficulty,
      avgTemperatureC: sc.avgTemperatureC,
      startMoisturePct: sc.startMoisturePct,
      budget: sc.budget,
      waterAllowanceMm: sc.waterAllowanceMm,
      pestWeeks: sc.pestWeeks,
      imageUrl: sc.imageUrl,
      imagePublicId: sc.imagePublicId,
      agrilearnModuleCode: sc.agrilearnModuleCode ?? '',
      isPublished: sc.isPublished,
    });
    setNumbers({
      avgTemperatureC: String(sc.avgTemperatureC),
      startMoisturePct: String(sc.startMoisturePct),
      budget: String(sc.budget),
      waterAllowanceMm: String(sc.waterAllowanceMm),
    });
  }, [existing.data]);

  if (id && existing.isLoading) return <Loading />;

  const weeks = CROPS[form.crop].seasonWeeks;
  const set = <K extends keyof ScenarioInput>(k: K, v: ScenarioInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function setCrop(crop: CropId) {
    // Drop pest weeks that no longer fit in the new season length.
    setForm((f) => ({ ...f, crop, pestWeeks: f.pestWeeks.filter((w) => w <= CROPS[crop].seasonWeeks) }));
  }

  function togglePestWeek(w: number) {
    set('pestWeeks', form.pestWeeks.includes(w) ? form.pestWeeks.filter((x) => x !== w) : [...form.pestWeeks, w].sort((a, b) => a - b));
  }

  async function pickImage() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Allow photo access to add an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      const asset = res.assets[0];
      const up = await uploadScenarioImage(asset.uri, asset.mimeType ?? 'image/jpeg');
      setForm((f) => ({ ...f, imageUrl: up.url, imagePublicId: up.publicId }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function onSave(publish: boolean) {
    setError(null);
    setFields({});
    const parsed = {
      avgTemperatureC: Number(numbers.avgTemperatureC),
      startMoisturePct: Number(numbers.startMoisturePct),
      budget: Number(numbers.budget),
      waterAllowanceMm: Number(numbers.waterAllowanceMm),
    };
    const bad = Object.entries(parsed).filter(([, v]) => !Number.isFinite(v));
    if (bad.length) {
      setFields(Object.fromEntries(bad.map(([k]) => [k, 'Enter a number'])));
      return;
    }
    save.mutate(
      { ...form, ...parsed, isPublished: publish },
      {
        onSuccess: (sc) => router.replace(`/scenario/${sc.id}`),
        onError: (e) => {
          setError(errorMessage(e));
          setFields(fieldErrors(e));
        },
      },
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Edit scenario' : 'New scenario' }} />
      {error && <Banner tone="error" text={error} />}

      <Card>
        <H2>About</H2>
        <TextField label="Title" value={form.title} onChangeText={(t) => set('title', t)} placeholder="e.g. Maize in a dry summer" error={fields.title} />
        <TextField
          label="Description"
          value={form.description}
          onChangeText={(t) => set('description', t)}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }}
          placeholder="Describe the situation the learner is in"
          error={fields.description}
        />
        <TextField label="Learning goals (optional)" value={form.learningGoals} onChangeText={(t) => set('learningGoals', t)} placeholder="e.g. Irrigation timing, drought stress" />
        <TextField
          label="AgriLearn module code (optional)"
          value={form.agrilearnModuleCode}
          onChangeText={(t) => set('agrilearnModuleCode', t.trim())}
          placeholder="e.g. AGR-IRR-101"
          autoCapitalize="characters"
          hint="Links this scenario's microcredential to an AgriLearn module."
          error={fields.agrilearnModuleCode}
        />
        <ChipGroup<Difficulty>
          label="Difficulty"
          value={form.difficulty}
          onChange={(v) => set('difficulty', v)}
          options={[
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ]}
        />
        <Text style={s.label}>Cover image (optional)</Text>
        <Pressable onPress={pickImage} style={s.imageBox} disabled={uploading}>
          {form.imageUrl ? (
            <Image source={{ uri: form.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={{ color: colors.textMuted }}>{uploading ? 'Uploading…' : '📷 Tap to add a photo'}</Text>
          )}
        </Pressable>
        {form.imageUrl && <Button title="Remove image" variant="ghost" onPress={() => setForm((f) => ({ ...f, imageUrl: null, imagePublicId: null }))} />}
      </Card>

      <Card>
        <H2>Farm setup</H2>
        <ChipGroup<CropId> label="Crop" value={form.crop} onChange={setCrop} options={CROP_LIST.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))} />
        <Muted>
          {CROPS[form.crop].name}: {weeks}-week season, ideal moisture {CROPS[form.crop].optimalMoisture.join('–')}%.
        </Muted>
        <View style={{ height: spacing.md }} />
        <ChipGroup<SoilType>
          label="Soil"
          value={form.soil}
          onChange={(v) => set('soil', v)}
          options={Object.values(SOILS).map((soil) => ({ value: soil.id, label: soil.name }))}
        />
        <ChipGroup<Climate>
          label="Season weather"
          value={form.climate}
          onChange={(v) => set('climate', v)}
          options={[
            { value: 'dry', label: '☀️ Dry' },
            { value: 'normal', label: '⛅ Normal' },
            { value: 'wet', label: '🌧️ Wet' },
          ]}
        />
        <Muted>Weekly rainfall and temperatures are generated from this choice when you save.</Muted>
        <View style={{ height: spacing.md }} />
        <TextField
          label="Average temperature (°C)"
          value={numbers.avgTemperatureC}
          onChangeText={(t) => setNumbers((n) => ({ ...n, avgTemperatureC: t }))}
          keyboardType="decimal-pad"
          error={fields.avgTemperatureC}
        />
        <TextField
          label="Starting soil moisture (%)"
          value={numbers.startMoisturePct}
          onChangeText={(t) => setNumbers((n) => ({ ...n, startMoisturePct: t }))}
          keyboardType="number-pad"
          hint="20% is the wilting point"
          error={fields.startMoisturePct}
        />
      </Card>

      <Card>
        <H2>Challenge rules</H2>
        <TextField
          label="Budget (Rand per hectare)"
          value={numbers.budget}
          onChangeText={(t) => setNumbers((n) => ({ ...n, budget: t }))}
          keyboardType="number-pad"
          error={fields.budget}
        />
        <TextField
          label="Irrigation water allowance (mm for the season)"
          value={numbers.waterAllowanceMm}
          onChangeText={(t) => setNumbers((n) => ({ ...n, waterAllowanceMm: t }))}
          keyboardType="number-pad"
          error={fields.waterAllowanceMm}
        />
        <Text style={s.label}>Pest outbreak weeks</Text>
        <View style={s.weeks}>
          {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
            const on = form.pestWeeks.includes(w);
            return (
              <Pressable key={w} onPress={() => togglePestWeek(w)} style={[s.week, on && s.weekOn]} accessibilityLabel={`Week ${w} pest outbreak ${on ? 'on' : 'off'}`}>
                <Text style={[s.weekText, on && { color: colors.white }]}>{w}</Text>
              </Pressable>
            );
          })}
        </View>
        {fields.pestWeeks && <Text style={{ color: colors.danger }}>{fields.pestWeeks}</Text>}
      </Card>

      <Button title="Save & publish" icon="megaphone-outline" onPress={() => onSave(true)} loading={save.isPending} disabled={uploading} />
      <Button title="Save as draft" variant="secondary" onPress={() => onSave(false)} loading={save.isPending} disabled={uploading} />
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  imageBox: {
    height: 150,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  weeks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  week: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  weekOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekText: { fontWeight: '700', color: colors.text },
});
