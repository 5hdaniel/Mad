import { Tabs } from 'expo-router';

export default function TabLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerStyle: { backgroundColor: '#f8fafc' },
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pairing',
          tabBarLabel: 'Pairing',
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarLabel: 'Status',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
