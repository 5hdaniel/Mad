/**
 * App.tsx - Main Application Component
 *
 * This is the root component that composes the application from modular pieces:
 * - NotificationProvider: Unified notification system (toasts)
 * - LicenseProvider: License type, AI addon state, and validation (SPRINT-062)
 * - LicenseGate: Blocks app when license invalid (SPRINT-062)
 * - AppShell: Layout structure (title bar, offline banner, version info)
 * - TrialStatusBanner: Shows trial days remaining (SPRINT-062)
 * - AppRouter: Screen routing based on current step
 * - AppModals: Modal dialogs (profile, settings, etc.)
 * - BackgroundServices: Background monitors and notifications
 *
 * All state management is handled by useAppStateMachine hook.
 * The app state machine is passed as a single prop to child components,
 * eliminating prop drilling and providing semantic methods instead of raw setters.
 */

import {
  AppShell,
  AppRouter,
  AppModals,
  BackgroundServices,
  useAppStateMachine,
} from "./appCore";
import { NotificationProvider } from "./contexts/NotificationContext";
import { LicenseProvider } from "./contexts/LicenseContext";
import { LicenseGate, TrialStatusBanner } from "./components/license";

function App() {
  const app = useAppStateMachine();

  return (
    <NotificationProvider>
      <LicenseProvider userId={app.currentUser?.id ?? null}>
        <LicenseGate>
          <AppShell app={app}>
            <TrialStatusBanner />
            <AppRouter app={app} />
            <BackgroundServices />
            <AppModals app={app} />
          </AppShell>
        </LicenseGate>
      </LicenseProvider>
    </NotificationProvider>
  );
}

export default App;
