import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthContext';
import { useScenarios } from '@/api/hooks';
import type { Scenario } from '@/api/types';
import { errorMessage } from '@/api/client';
import { Badge, Button, Card, Chip, EmptyState, ErrorView, Loading, Muted, PageHeader, Screen } from '@/components/ui';
import { CROP_LIST, SOILS, type CropId } from '@/simulation/crops';
import { capitalize } from '@/utils/format';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, spacing } from '@/theme';

export default function ScenariosScreen() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer';
  const [crop, setCrop] = useState<CropId | undefined>();
  const [showMine, setShowMine] = useState(true);
  const query = useScenarios({ crop, mine: isTrainer && showMine });

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={query.isRefetching} onRefresh={query.refetch} edges={['top']}>
        <PageHeader
          title={`Hi ${user?.name.split(' ')[0] ?? ''} 👋`}
          subtitle={isTrainer ? 'Create and manage farming scenarios for your learners.' : 'Pick a scenario and run your farm for a season.'}
        />

        {isTrainer && (
          <View style={[s.filters, { marginTop: spacing.md }]}>
            <Chip label="My scenarios" selected={showMine} onPress={() => setShowMine(true)} />
            <Chip label="All published" selected={!showMine} onPress={() => setShowMine(false)} />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.md }} contentContainerStyle={s.filters}>
          <Chip label="All crops" selected={!crop} onPress={() => setCrop(undefined)} />
          {CROP_LIST.map((c) => (
            <Chip key={c.id} label={`${c.emoji} ${c.name}`} selected={crop === c.id} onPress={() => setCrop(c.id)} />
          ))}
        </ScrollView>

        <OfflineBanner error={query.error} hasData={!!query.data} />
        {query.isLoading ? (
          <Loading />
        ) : query.error && !query.data ? (
          <ErrorView message={errorMessage(query.error)} onRetry={query.refetch} />
        ) : query.data?.length === 0 ? (
          <EmptyState
            icon="leaf-outline"
            title="No scenarios yet"
            message={isTrainer ? 'Create your first scenario for learners.' : 'Your trainers have not published scenarios for this crop yet.'}
            action={isTrainer ? <Button title="Create scenario" icon="add" onPress={() => router.push('/trainer/scenario-form')} /> : undefined}
          />
        ) : (
          query.data?.map((sc) => <ScenarioCard key={sc.id} scenario={sc} showStatus={isTrainer} />)
        )}
        <View style={{ height: 70 }} />
      </Screen>
      {isTrainer && (
        <Pressable style={s.fab} onPress={() => router.push('/trainer/scenario-form')} accessibilityLabel="Create scenario">
          <Ionicons name="add" size={30} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}

const difficultyTone = {
  beginner: { color: colors.success, bg: colors.primaryLight },
  intermediate: { color: colors.warning, bg: colors.warningLight },
  advanced: { color: colors.danger, bg: colors.dangerLight },
};

function ScenarioCard({ scenario, showStatus }: { scenario: Scenario; showStatus: boolean }) {
  const tone = difficultyTone[scenario.difficulty];
  return (
    <Card onPress={() => router.push(`/scenario/${scenario.id}`)} style={{ padding: 0, overflow: 'hidden' }}>
      {scenario.imageUrl ? (
        <Image source={{ uri: scenario.imageUrl }} style={s.image} contentFit="cover" transition={200} />
      ) : (
        <View style={[s.image, s.placeholder]}>
          <Text style={{ fontSize: 48 }}>{scenario.cropEmoji}</Text>
        </View>
      )}
      <View style={{ padding: spacing.lg }}>
        <View style={[s.filters, { marginBottom: spacing.sm }]}>
          <Badge label={capitalize(scenario.difficulty)} color={tone.color} bg={tone.bg} />
          <Badge label={`${scenario.cropEmoji} ${scenario.cropName}`} />
          <Badge label={`${SOILS[scenario.soil].name} soil`} color={colors.textMuted} bg={colors.background} />
          {showStatus && !scenario.isPublished && <Badge label="Draft" color={colors.warning} bg={colors.warningLight} />}
        </View>
        <Text style={s.cardTitle}>{scenario.title}</Text>
        <Muted>{scenario.description.length > 120 ? `${scenario.description.slice(0, 120)}…` : scenario.description}</Muted>
        <Text style={s.meta}>
          {scenario.weeks} weeks · {capitalize(scenario.climate)} season · by {scenario.trainerName}
        </Text>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  hello: { fontSize: 24, fontWeight: '800', color: colors.text },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  image: { width: '100%', height: 112 },
  placeholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
