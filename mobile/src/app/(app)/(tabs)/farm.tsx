import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFarms } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import type { FarmField } from '@/api/types';
import { Badge, Card, EmptyState, ErrorView, Loading, PageHeader, Screen } from '@/components/ui';
import { SensorFeed } from '@/components/SensorFeed';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, radius, spacing } from '@/theme';

/** The virtual farm: farms → fields → scenarios, each with its synthetic sensor feed. */
export default function FarmScreen() {
  const query = useFarms();
  if (query.isLoading) return <Loading />;
  if (!query.data) return <ErrorView message={errorMessage(query.error)} onRetry={query.refetch} />;
  const farms = query.data;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={query.refetch} edges={['top']}>
      <PageHeader title="Virtual farm" subtitle="Every scenario is played on a field. Sensors log soil moisture, rain and temperature each week." />
      <OfflineBanner error={query.error} hasData />
      <View style={s.synthetic}>
        <Ionicons name="hardware-chip-outline" size={14} color={colors.water} />
        <Text style={s.syntheticText}>Synthetic sensor data – generated for teaching, not measured.</Text>
      </View>

      {farms.length === 0 && (
        <EmptyState icon="map-outline" title="No fields yet" message="Fields appear here once scenarios are published." />
      )}

      {farms.map((farm) => (
        <View key={farm.id} style={{ marginTop: spacing.lg }}>
          <View style={s.farmHead}>
            <View style={s.farmIcon}>
              <Text style={{ fontSize: 20 }}>🏡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.farmName}>{farm.name}</Text>
              <Text style={s.farmMeta}>
                {farm.region} · {farm.fields.length} field{farm.fields.length === 1 ? '' : 's'}
              </Text>
            </View>
            {farm.isMine && <Badge label="Your farm" />}
          </View>
          {farm.fields.map((f) => (
            <FieldCard key={f.id} field={f} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function FieldCard({ field }: { field: FarmField }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={s.fieldHead}>
        <Text style={s.fieldName}>{field.name}</Text>
        <Text style={s.fieldMeta}>
          {field.soilName} soil · {field.areaHa} ha
        </Text>
      </View>
      {field.scenarios.map((sc) => (
        <View key={sc.id} style={s.scenario}>
          <View style={s.scenarioRow}>
            <Text style={s.scenarioTitle} numberOfLines={1} onPress={() => router.push(`/scenario/${sc.id}`)}>
              {sc.cropEmoji} {sc.title}
            </Text>
            {!sc.isPublished && <Badge label="Draft" color={colors.warning} bg={colors.warningLight} />}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} onPress={() => router.push(`/scenario/${sc.id}`)} />
          </View>
          <Text style={s.feedLabel}>Sensor feed · {sc.readings.length} weekly readings (baseline plan)</Text>
          <SensorFeed readings={sc.readings} optimal={sc.optimalMoisture} />
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  synthetic: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.waterLight, padding: spacing.sm, borderRadius: radius.sm },
  syntheticText: { fontSize: 12, color: colors.water, fontWeight: '600', flex: 1 },
  farmHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  farmIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  farmName: { fontSize: 17, fontWeight: '800', color: colors.text },
  farmMeta: { fontSize: 12, color: colors.textMuted },
  fieldHead: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  fieldName: { fontSize: 15, fontWeight: '700', color: colors.primaryDark },
  fieldMeta: { fontSize: 12, color: colors.primary },
  scenario: { padding: spacing.lg },
  scenarioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  scenarioTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  feedLabel: { fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
});
