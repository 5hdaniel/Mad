import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/electron/renderer";
import App from "./App";
import { AuthProvider, NetworkProvider, PlatformProvider, useAuth, LicenseProvider } from "./contexts";
import ErrorBoundary from "./components/ErrorBoundary";
import {
  FeatureFlaggedProvider,
  LoadingOrchestrator,
} from "./appCore/state/machine";
import "./index.css";

// Initialize Sentry in the renderer process (TASK-1967)
// Renderer inherits DSN and configuration from the main process via IPC
Sentry.init({});

/**
 * Wrapper component that provides LicenseProvider with userId from AuthContext.
 * Must be rendered inside AuthProvider.
 */
function LicenseProviderWithAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  return (
    <LicenseProvider userId={currentUser?.id ?? null}>
      {children}
    </LicenseProvider>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PlatformProvider>
        <NetworkProvider>
          <AuthProvider>
            <LicenseProviderWithAuth>
              <FeatureFlaggedProvider>
                <LoadingOrchestrator>
                  <App />
                </LoadingOrchestrator>
              </FeatureFlaggedProvider>
            </LicenseProviderWithAuth>
          </AuthProvider>
        </NetworkProvider>
      </PlatformProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
