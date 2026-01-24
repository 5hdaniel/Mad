/**
 * BackgroundServices Component
 *
 * Renders background services and monitors that run alongside the main app.
 * These components don't render visible UI but perform background tasks.
 */

import React from "react";
import UpdateNotification from "../components/UpdateNotification";
import { useMacOSMessagesImport } from "../hooks/useMacOSMessagesImport";
import type { AppStateMachine } from "./state/types";

interface BackgroundServicesProps {
  app: AppStateMachine;
}

export function BackgroundServices({ app }: BackgroundServicesProps) {
  const {
    currentUser,
    currentStep,
    hasPermissions,
    isDatabaseInitialized,
  } = app;

  // Determine if we're in onboarding flow
  const isOnboarding = currentStep !== "dashboard";

  // macOS Messages auto-import on startup
  // Runs in background when:
  // - Platform is macOS
  // - User is authenticated
  // - Full Disk Access granted
  // - Database initialized
  // - Not in onboarding
  useMacOSMessagesImport({
    userId: currentUser?.id ?? null,
    hasPermissions,
    isDatabaseInitialized,
    isOnboarding,
  });

  return (
    <>
      {/* Update Notification */}
      <UpdateNotification />
    </>
  );
}
