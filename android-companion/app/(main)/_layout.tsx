import { Stack } from 'expo-router';

/**
 * Main stack layout for authenticated screens.
 * Auth gate is in the root _layout.tsx — only authenticated + onboarded
 * users reach these screens.
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
