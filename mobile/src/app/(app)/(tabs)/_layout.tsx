import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer';
  return (
    <Tabs
      screenOptions={{
        // Each tab draws its own large title (PageHeader), so no navigation bar here.
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border, height: 62, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isTrainer ? 'My Scenarios' : 'Scenarios',
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="farm"
        options={{ title: 'Farm', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: isTrainer ? 'Learner Scores' : 'My Scores',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{ title: 'Crop Guide', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
