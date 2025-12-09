/**
 * BackgroundServices Component
 *
 * Renders background services and monitors that run alongside the main app.
 * These components don't render visible UI but perform background tasks.
 */

import React from "react";
import UpdateNotification from "../components/UpdateNotification";
import SystemHealthMonitor from "../components/SystemHealthMonitor";
import type { AppStep } from "./state/types";

// OAuthProvider type to match SystemHealthMonitor expectations
type OAuthProvider = "google" | "microsoft";

interface BackgroundServicesProps {
  // Auth state
  isAuthenticated: boolean;
  currentUser: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
  authProvider: string | null;

  // Navigation state
  currentStep: AppStep;

  // Permissions state
  hasPermissions: boolean;

  // Email state
  hasEmailConnected: boolean;

  // UI state
  isTourActive: boolean;
  needsTermsAcceptance: boolean;
}

export function BackgroundServices({
  isAuthenticated,
  currentUser,
  authProvider,
  currentStep,
  hasPermissions,
  hasEmailConnected,
  isTourActive,
  needsTermsAcceptance,
}: BackgroundServicesProps) {
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
