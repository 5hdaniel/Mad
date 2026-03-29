import { Stack } from 'expo-router';

/**
 * Main stack layout for authenticated screens.
 * Auth gate will be added in BACKLOG-1462.
 */
export default function MainLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="account" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
