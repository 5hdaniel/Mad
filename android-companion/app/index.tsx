/**
 * Root index — renders nothing.
 *
 * The auth gate in _layout.tsx handles all routing:
 * - No session -> login screen
 * - Session, not onboarded -> onboarding flow
 * - Session + onboarded -> main app
 */
export default function Index(): React.JSX.Element | null {
  return null;
}
