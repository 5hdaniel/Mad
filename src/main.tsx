import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider, NetworkProvider, PlatformProvider } from "./contexts";
import ErrorBoundary from "./components/ErrorBoundary";
import {
  FeatureFlaggedProvider,
  LoadingOrchestrator,
} from "./appCore/state/machine";
import "./index.css";

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
            <FeatureFlaggedProvider>
              <LoadingOrchestrator>
                <App />
              </LoadingOrchestrator>
            </FeatureFlaggedProvider>
          </AuthProvider>
        </NetworkProvider>
      </PlatformProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
