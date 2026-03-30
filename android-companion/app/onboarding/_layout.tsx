import { Stack } from 'expo-router';

/**
 * Onboarding stack layout.
 * Three-step flow: permissions -> pair device -> first sync.
 *
 * BACKLOG-1473: Reordered so permissions are granted before pairing,
 * allowing auto-first-sync to run immediately after pairing succeeds.
 */
export default function OnboardingLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="permissions" />
      <Stack.Screen name="pair-device" />
      <Stack.Screen name="first-sync" />
    </Stack>
  );
}
