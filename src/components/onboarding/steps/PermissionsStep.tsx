/**
 * PermissionsStep - macOS Full Disk Access permissions screen
 *
 * Single-screen checklist layout that guides macOS users through granting
 * Full Disk Access permission. Shows permission status with auto-detection
 * and provides a button to open System Settings directly.
 *
 * After permission is granted, automatically imports messages from macOS
 * Messages app before continuing to the next onboarding step.
 *
 * @module onboarding/steps/PermissionsStep
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import type {
  OnboardingStep,
  OnboardingStepContentProps,
} from "../types";
import { setMessagesImportTriggered } from "../../../utils/syncFlags";
import { useSyncOrchestrator } from "../../../hooks/useSyncOrchestrator";
import logger from '../../../utils/logger';

/**
 * Shield icon with lock - represents security/permissions
 */
function ShieldLockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

/**
 * Checkmark icon for completed items
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Circle icon for pending items
 */
function CircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth={2}
      />
    </svg>
  );
}

/**
 * Checklist item for a single permission requirement
 */
interface ChecklistItemProps {
  label: string;
  description: string;
  isGranted: boolean;
}

function ChecklistItem({ label, description, isGranted }: ChecklistItemProps) {
  return (
    <div
      className={`flex items-start p-3 rounded-lg border-2 transition-all ${
        isGranted
          ? "bg-green-50 border-green-300"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex-shrink-0 mt-0.5 mr-3">
        {isGranted ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <CheckIcon className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-6 h-6 text-gray-400">
            <CircleIcon className="w-6 h-6" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <p className={`font-semibold text-sm ${isGranted ? "text-green-800" : "text-gray-900"}`}>
          {label}
        </p>
        <p className={`text-xs mt-0.5 ${isGranted ? "text-green-700" : "text-gray-600"}`}>
          {description}
        </p>
      </div>
    </div>
  );
}

/**
 * PermissionsStep content component
 *
 * Single-screen layout with a checklist of permissions and auto-detection.
 * Users can open System Settings, grant permissions, and see the checklist
 * update in real-time without navigating between steps.
 */
function PermissionsStepContent({ context, onAction }: OnboardingStepContentProps) {
  const [hasFullDiskAccess, setHasFullDiskAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasTriggeredFDA, setHasTriggeredFDA] = useState(false);

  // Track if we're waiting for DB to be ready before importing
  const [waitingForDb, setWaitingForDb] = useState(false);

  // Track if import has started to prevent duplicate triggers
  const hasStartedImportRef = useRef(false);

  // Get orchestrator actions - progress tracked centrally by SyncOrchestratorService
  const { requestSync, isRunning } = useSyncOrchestrator();

  // Trigger import after permissions are granted
  const triggerImport = useCallback(async () => {
    if (hasStartedImportRef.current) {
      return;
    }

    // Get user ID from context - if not available, skip import and continue
    const userId = context.userId;
    const isDatabaseInitialized = context.isDatabaseInitialized;

    if (!isDatabaseInitialized) {
      // Database not ready yet - wait for it instead of skipping
      setWaitingForDb(true);
      return;
    }

    if (!userId) {
      // No user yet, just continue to next step
      onAction({ type: "PERMISSION_GRANTED" });
      return;
    }

    // Check if import has already been done for this user (persists across navigation)
    const importKey = `onboarding_import_done_${userId}`;
    if (localStorage.getItem(importKey)) {
      onAction({ type: "PERMISSION_GRANTED" });
      return;
    }

    hasStartedImportRef.current = true;
    setWaitingForDb(false);

    // Mark that we're doing the onboarding import - prevents duplicate imports on dashboard
    // This sets the module-level flag in syncFlags that useAutoRefresh checks
    setMessagesImportTriggered();

    // Request sync from orchestrator - runs contacts then messages sequentially
    // Progress is tracked centrally by SyncOrchestratorService
    requestSync(['contacts', 'messages'], userId);

    // Don't wait for imports - let them continue in background
    // User will see progress on the dashboard via SyncStatusIndicator

    // Brief delay to show "setting up" message, then transition
    setTimeout(() => {
      onAction({ type: "PERMISSION_GRANTED" });
    }, 500);
  }, [context.isDatabaseInitialized, context.userId, onAction, requestSync]);

  // Check permissions
  const checkPermissions = useCallback(async () => {
    logger.debug('[PermissionsStep] checkPermissions called');
    try {
      const result = await window.api.system.checkPermissions();
      logger.debug('[PermissionsStep] checkPermissions result:', result);
      if (result.hasPermission) {
        setHasFullDiskAccess(true);
        logger.debug('[PermissionsStep] Permissions granted, calling triggerImport');
        triggerImport();
      }
      return result.hasPermission;
    } catch (error) {
      logger.error("[PermissionsStep] Error checking permissions:", error);
      return false;
    }
  }, [triggerImport]);

  // Initial permission check on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Auto-detect permission grants by polling every 2 seconds
  // Starts after user has triggered FDA (opened System Settings)
  useEffect(() => {
    if (hasTriggeredFDA && !hasFullDiskAccess) {
      const interval = setInterval(checkPermissions, 2000);
      // Stop polling after 5 minutes to avoid indefinite CPU usage
      const timeout = setTimeout(() => clearInterval(interval), 300000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [hasTriggeredFDA, hasFullDiskAccess, checkPermissions]);

  // When waiting for DB and it becomes ready, trigger the import
  useEffect(() => {
    if (waitingForDb && context.isDatabaseInitialized && context.userId) {
      triggerImport();
    }
  }, [waitingForDb, context.isDatabaseInitialized, context.userId, triggerImport]);

  const handleOpenSystemSettings = async () => {
    try {
      // Trigger FDA attempt so the app appears in System Settings > Full Disk Access
      if (!hasTriggeredFDA) {
        await window.api.system.triggerFullDiskAccess();
        setHasTriggeredFDA(true);
      }
      await window.api.system.openSystemSettings();
    } catch (error) {
      logger.error("Error opening system settings:", error);
    }
  };

  const handleManualCheck = async () => {
    logger.debug('[PermissionsStep] Check Permissions button clicked');
    setIsChecking(true);
    try {
      await checkPermissions();
    } catch (error) {
      logger.error('[PermissionsStep] checkPermissions error:', error);
    }
    setIsChecking(false);
  };

  // Show "Setting up" view while import is running
  if (isRunning) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
            <svg
              className="w-6 h-6 text-primary animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Setting Up Your Account
          </h1>
          <p className="text-sm text-gray-600">
            Please wait while we prepare your dashboard...
          </p>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          All data is stored locally on your device.
        </p>
      </div>
    );
  }

  // Single-screen checklist layout
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-4">
          <ShieldLockIcon className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Permissions Required
        </h1>
        <p className="text-sm text-gray-600">
          Keepr needs the following macOS permission to work properly.
          Grant it in System Settings, then come back here.
        </p>
      </div>

      {/* Permission Checklist */}
      <div className="space-y-3 mb-5">
        <ChecklistItem
          label="Full Disk Access"
          description={
            hasFullDiskAccess
              ? "Granted -- Keepr can read your Messages database"
              : "Required to read your iMessage database for auditing"
          }
          isGranted={hasFullDiskAccess}
        />
      </div>

      {/* Action Area */}
      {!hasFullDiskAccess ? (
        <div className="space-y-3">
          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">How to grant permission:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Click "Open System Settings" below</li>
                  <li>Click the <strong>+</strong> button and add <strong>Keepr</strong> from Applications</li>
                  <li>If Keepr is already listed, toggle it on</li>
                  <li>macOS will ask you to quit and reopen the app</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Primary action button */}
          <button
            onClick={handleOpenSystemSettings}
            className="w-full bg-primary text-white py-2.5 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Open System Settings
          </button>

          {/* Manual check button */}
          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isChecking ? "Checking..." : "Check Permissions"}
          </button>

          {hasTriggeredFDA && (
            <p className="text-center text-xs text-gray-500">
              We are checking for permission changes automatically.
            </p>
          )}
        </div>
      ) : (
        /* Permission granted state */
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-3">
            <CheckIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Permission Granted
          </h3>
          <p className="text-sm text-gray-700">
            Full Disk Access is enabled. Setting up your account...
          </p>
        </div>
      )}

      {/* Privacy note */}
      <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-gray-600">
            <strong>Your privacy matters.</strong> All data stays on your
            device. We never upload or share your messages.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * PermissionsStep definition
 */
const permissionsStep: OnboardingStep = {
  meta: {
    id: "permissions",
    progressLabel: "Permissions",
    platforms: ["macos"],
    navigation: {
      showBack: true,
      hideContinue: false,
    },
    // Disable Continue button - step auto-proceeds after import completes
    canProceed: () => false,
    // Step is never "complete" via button - it auto-proceeds via PERMISSION_GRANTED action
    isStepComplete: () => false,
    // Only show if permissions not yet granted (or unknown during loading)
    // Using !== true means: show if false OR undefined (unknown state)
    shouldShow: (context) => context.permissionsGranted !== true,
    // Queue predicates
    isApplicable: () => true, // Platform filtering via flow array (macOS only)
    isComplete: (context) => context.permissionsGranted === true,
  },
  Content: PermissionsStepContent,
};

export default permissionsStep;
