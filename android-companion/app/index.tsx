import { Redirect } from 'expo-router';

/**
 * Root index redirects to the main home screen.
 */
export default function Index(): React.JSX.Element {
  return <Redirect href="/(main)/home" />;
}
