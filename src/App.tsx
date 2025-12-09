/**
 * App.tsx - Main Application Component
 *
 * This is the root component that composes the application from modular pieces:
 * - AppShell: Layout structure (title bar, offline banner, version info)
 * - AppRouter: Screen routing based on current step
 * - AppModals: Modal dialogs (profile, settings, etc.)
 * - BackgroundServices: Background monitors and notifications
 *
 * All state management is handled by useAppStateMachine hook.
 * The app state machine is passed as a single prop to child components,
 * eliminating prop drilling and providing semantic methods instead of raw setters.
 */

import { AppShell, AppRouter, AppModals, BackgroundServices, useAppStateMachine } from "./appCore";

function App() {
  const app = useAppStateMachine();

  return (
    <AppShell app={app}>
      <AppRouter app={app} />
      <BackgroundServices app={app} />
      <AppModals app={app} />
    </AppShell>
  );
}

export default App;
