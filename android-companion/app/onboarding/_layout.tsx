import { Stack } from 'expo-router';

/**
 * Onboarding stack layout.
 * Three-step flow: pair device -> permissions -> first sync.
 */
export default function OnboardingLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="pair-device" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="first-sync" />
    </Stack>
  );
}
