import '../services/cryptoPolyfill';
import { Stack } from 'expo-router';

/**
 * Root stack layout.
 * Auth gate will be added in BACKLOG-1462.
 */
export default function RootLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
