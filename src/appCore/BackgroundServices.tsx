/**
 * BackgroundServices Component
 *
 * Renders background services and monitors that run alongside the main app.
 * These components don't render visible UI but perform background tasks.
 */

import React from "react";
import UpdateNotification from "../components/UpdateNotification";
import SystemHealthMonitor from "../components/SystemHealthMonitor";
import type { AppStateMachine } from "./state/types";

// OAuthProvider type to match SystemHealthMonitor expectations
type OAuthProvider = "google" | "microsoft";

interface BackgroundServicesProps {
  app: AppStateMachine;
}

export function BackgroundServices({ app }: BackgroundServicesProps) {
  const {
    isAuthenticated,
    currentUser,
    authProvider,
    currentStep,
    hasPermissions,
    hasEmailConnected,
    isTourActive,
    needsTermsAcceptance,
  } = app;
  return (
    <>
      {/* Update Notification */}
      <UpdateNotification />

      {/* System Health Monitor - Show permission/connection errors (only on dashboard after permissions granted) */}
      {/* Key forces re-mount when email connection status changes, triggering fresh health check */}
      {/* IMPORTANT: Don't run health checks until user has completed permissions setup, otherwise
          it tries to access contacts database before Full Disk Access is granted */}
      {/* Only show when email is connected - if not connected, Dashboard shows setup prompt instead */}
      {isAuthenticated &&
        currentUser &&
        authProvider &&
        hasPermissions &&
        currentStep === "dashboard" &&
        hasEmailConnected && (
          <SystemHealthMonitor
            key={`health-monitor-${hasEmailConnected}`}
            userId={currentUser.id}
            provider={authProvider as OAuthProvider}
            hidden={isTourActive || needsTermsAcceptance}
          />
        )}
    </>
  );
}
