import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider, NetworkProvider, PlatformProvider, useAuth, LicenseProvider } from "./contexts";
import ErrorBoundary from "./components/ErrorBoundary";
import {
  FeatureFlaggedProvider,
  LoadingOrchestrator,
} from "./appCore/state/machine";
import "./index.css";

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
