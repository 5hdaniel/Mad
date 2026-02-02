/**
 * PermissionsStep - macOS Full Disk Access permissions screen
 *
 * This step guides macOS users through granting Full Disk Access permission,
 * which is required to read the Messages database.
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
import { setMessagesImportTriggered } from "../../../hooks/useMacOSMessagesImport";
import { syncQueue } from "../../../services/SyncQueueService";

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
 * Checkmark icon for completed steps
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
 * Back arrow icon
 */
function BackArrowIcon({ className }: { className?: string }) {
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
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

/**
 * Instruction step component for the guided walkthrough
 */
interface InstructionStepProps {
  stepNumber: number;
  title: string;
  description: React.ReactNode;
  isComplete: boolean;
  isActive: boolean;
  onComplete: () => void;
  onBack?: () => void;
  actionButton?: React.ReactNode;
  tip?: string;
}

function InstructionStep({
  stepNumber,
  title,
  description,
  isComplete,
  isActive,
  onComplete,
  onBack,
  actionButton,
  tip,
}: InstructionStepProps) {
  if (!isActive && !isComplete) {
    return null;
  }

  return (
    <div
      className={`border-2 rounded-lg p-4 mb-3 transition-all ${
        isComplete
          ? "bg-green-50 border-green-300"
          : "bg-yellow-50 border-yellow-300"
      }`}
    >
      <div className="flex items-start mb-4">
        {isComplete ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
            <CheckIcon className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white font-bold text-sm">
            {stepNumber}
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          {!isComplete && (
            <div className="text-sm text-gray-700">{description}</div>
          )}
        </div>
      </div>

      {!isComplete && (
        <>
          {actionButton}
          {tip && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">{tip}</p>
            </div>
          )}
          <div className="flex gap-3 mt-3">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <BackArrowIcon className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={onComplete}
              className="flex-1 bg-blue-500 text-white py-2.5 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * PermissionsStep content component
 *
 * Guides macOS users through the Full Disk Access permission flow:
 * 1. Opens System Settings
 * 2. Navigate to Privacy & Security
 * 3. Find Full Disk Access
 * 4. Add the application
 * 5. Restart the app
 */
function PermissionsStepContent({ context, onAction }: OnboardingStepContentProps) {
  const [currentInstructionStep, setCurrentInstructionStep] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Messages import state
  const [isImportingMessages, setIsImportingMessages] = useState(false);
  const [messagesProgress, setMessagesProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [messagesResult, setMessagesResult] = useState<{
    success: boolean;
    messagesImported: number;
    error?: string;
  } | null>(null);

  // Contacts import state
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [contactsProgress, setContactsProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [contactsResult, setContactsResult] = useState<{
    success: boolean;
    contactsImported: number;
    error?: string;
  } | null>(null);

  const hasStartedImportRef = useRef(false);

  // Subscribe to import progress updates for both messages and contacts
  useEffect(() => {
    const cleanupMessages = window.api.messages.onImportProgress((progress) => {
      setMessagesProgress(progress);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanupContacts = (window.api.contacts as any).onImportProgress?.((progress: { current: number; total: number; percent: number }) => {
      setContactsProgress(progress);
    });
    return () => {
      cleanupMessages();
      cleanupContacts?.();
    };
  }, []);

  // Trigger import after permissions are granted
  const triggerImport = useCallback(async () => {
    if (hasStartedImportRef.current) {
      return;
    }

    // Get user ID from context - if not available, skip import and continue
    const userId = context.userId;
    const isDatabaseInitialized = context.isDatabaseInitialized;

    if (!isDatabaseInitialized) {
      // Database not ready yet, just continue to next step (import will happen on dashboard)
      onAction({ type: "PERMISSION_GRANTED" });
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

    // Mark that we're doing the onboarding import - prevents duplicate imports on dashboard
    // This sets the module-level flag in useMacOSMessagesImport that useAutoRefresh checks
    setMessagesImportTriggered();

    // Reset and queue syncs for SyncQueueService tracking
    syncQueue.reset();
    syncQueue.queue('contacts');
    syncQueue.queue('messages');

    // Start both imports in parallel
    setIsImportingMessages(true);
    setIsImportingContacts(true);
    setMessagesProgress(null);
    setContactsProgress(null);
    setMessagesResult(null);
    setContactsResult(null);

    // Import messages - track with SyncQueue
    syncQueue.start('messages');
    const messagesPromise = window.api.messages.importMacOSMessages(userId)
      .then((result) => {
        setMessagesResult({
          success: result.success,
          messagesImported: result.messagesImported,
          error: result.error,
        });
        if (result.success) {
          syncQueue.complete('messages');
        } else {
          syncQueue.error('messages', result.error || 'Import failed');
        }
      })
      .catch((error) => {
        console.error("Error importing messages:", error);
        setMessagesResult({ success: false, messagesImported: 0, error: String(error) });
        syncQueue.error('messages', String(error));
      })
      .finally(() => setIsImportingMessages(false));

    // Import contacts (get available, then import all) - track with SyncQueue
    syncQueue.start('contacts');
    const contactsPromise = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const availableResult = await (window.api.contacts as any).getAvailable(userId);
        if (!availableResult.success || !availableResult.contacts?.length) {
          setContactsResult({ success: availableResult.success !== false, contactsImported: 0, error: availableResult.error });
          if (availableResult.success !== false) {
            syncQueue.complete('contacts');
          } else {
            syncQueue.error('contacts', availableResult.error || 'No contacts available');
          }
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importResult = await (window.api.contacts as any).import(userId, availableResult.contacts);
        setContactsResult({
          success: importResult.success,
          contactsImported: importResult.contacts?.length || 0,
          error: importResult.error,
        });
        if (importResult.success) {
          syncQueue.complete('contacts');
        } else {
          syncQueue.error('contacts', importResult.error || 'Contact import failed');
        }
      } catch (error) {
        console.error("[PermissionsStep] Error importing contacts:", error);
        setContactsResult({ success: false, contactsImported: 0, error: String(error) });
        syncQueue.error('contacts', String(error));
      } finally {
        setIsImportingContacts(false);
      }
    })();

    // Don't wait for imports - let them continue in background
    // User will see progress on the dashboard via SyncStatusIndicator

    // Brief delay to show "setting up" message, then transition
    setTimeout(() => {
      onAction({ type: "PERMISSION_GRANTED" });
    }, 500);
  }, [onAction]);

  // Auto-check permissions on mount and periodically after user starts the flow
  const checkPermissions = useCallback(async () => {
    try {
      const result = await window.api.system.checkPermissions();
      if (result.hasPermission) {
        // Permissions granted - trigger import first, then continue
        triggerImport();
      }
      return result.hasPermission;
    } catch (error) {
      console.error("Error checking permissions:", error);
      return false;
    }
  }, [triggerImport]);

  // Initial permission check
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Periodic check once user has completed the flow
  useEffect(() => {
    if (completedSteps.has(5)) {
      const interval = setInterval(checkPermissions, 2000);
      const timeout = setTimeout(() => clearInterval(interval), 60000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [completedSteps, checkPermissions]);

  const handleOpenSystemSettings = async () => {
    try {
      await window.api.system.openSystemSettings();
      markStepComplete(1);
    } catch (error) {
      console.error("Error opening system settings:", error);
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    await checkPermissions();
    setIsChecking(false);
  };

  const markStepComplete = (step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
    setCurrentInstructionStep(step);
  };

  const goBackToStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      // Remove all steps >= step
      for (let i = step; i <= 5; i++) {
        next.delete(i);
      }
      return next;
    });
    setCurrentInstructionStep(step - 1);
  };

  // Welcome/intro view (step 0)
  if (currentInstructionStep === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-4">
            <ShieldLockIcon className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Full Disk Access Required
          </h1>
          <p className="text-sm text-gray-600">
            To read your Messages database, macOS requires Full Disk Access
            permission
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">
            Why is this needed?
          </h2>
          <div className="flex items-start text-sm text-gray-700">
            <svg
              className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              <strong>Full Disk Access</strong> allows the app to read your
              iMessage database. This is a macOS security requirement - we
              cannot access messages without it.
            </span>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5">
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

        <button
          onClick={async () => {
            // Trigger Full Disk Access attempt to make app appear in System Settings
            try {
              await window.api.system.triggerFullDiskAccess();
            } catch (error) {
              console.error("Error triggering full disk access:", error);
            }
            setCurrentInstructionStep(1);
          }}
          className="w-full bg-primary text-white py-2.5 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
        >
          Grant Permission
        </button>
      </div>
    );
  }

  // Check if we're importing - show simple "Setting up" view
  // Progress will be shown on the dashboard via SyncStatusIndicator
  const isImporting = isImportingMessages || isImportingContacts;

  if (isImporting) {
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

  // Guided instruction flow
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
          <svg
            className="w-6 h-6 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Grant Full Disk Access
        </h1>
        <p className="text-sm text-gray-600">Follow these steps to grant permission</p>
      </div>

      {/* Step 1: Open System Settings */}
      <InstructionStep
        stepNumber={1}
        title={
          completedSteps.has(1)
            ? "System Settings Opened"
            : "Open System Settings"
        }
        description="Click the button below to open System Settings"
        isComplete={completedSteps.has(1)}
        isActive={currentInstructionStep >= 1}
        onComplete={() => markStepComplete(1)}
        actionButton={
          <div className="space-y-2">
            <button
              onClick={handleOpenSystemSettings}
              className="w-full bg-primary text-white py-2.5 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Open System Settings
            </button>
            <button
              onClick={() => markStepComplete(1)}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              I've Opened Settings Manually
            </button>
          </div>
        }
      />

      {/* Step 2: Find Privacy & Security */}
      <InstructionStep
        stepNumber={2}
        title={
          completedSteps.has(2)
            ? "Privacy & Security Found"
            : "Find Privacy & Security"
        }
        description={
          <p>
            In the System Settings window, look in the{" "}
            <strong>left sidebar</strong> for{" "}
            <strong>"Privacy & Security"</strong> and click on it
          </p>
        }
        isComplete={completedSteps.has(2)}
        isActive={completedSteps.has(1) && currentInstructionStep >= 1}
        onComplete={() => markStepComplete(2)}
        onBack={() => goBackToStep(1)}
      />

      {/* Step 3: Find Full Disk Access */}
      <InstructionStep
        stepNumber={3}
        title={
          completedSteps.has(3)
            ? "Full Disk Access Found"
            : "Find Full Disk Access"
        }
        description={
          <p>
            In the Privacy & Security section, scroll down and click on{" "}
            <strong>"Full Disk Access"</strong>
          </p>
        }
        isComplete={completedSteps.has(3)}
        isActive={completedSteps.has(2) && currentInstructionStep >= 2}
        onComplete={() => markStepComplete(3)}
        onBack={() => goBackToStep(2)}
      />

      {/* Step 4: Click Plus Button */}
      <InstructionStep
        stepNumber={4}
        title={
          completedSteps.has(4) ? "Plus Button Clicked" : "Click the + Button"
        }
        description={
          <p>
            Click the <strong>+ (plus)</strong> button to add a new application
            to the Full Disk Access list
          </p>
        }
        isComplete={completedSteps.has(4)}
        isActive={completedSteps.has(3) && currentInstructionStep >= 3}
        onComplete={() => markStepComplete(4)}
        onBack={() => goBackToStep(3)}
      />

      {/* Step 5: Select App */}
      <InstructionStep
        stepNumber={5}
        title={
          completedSteps.has(5)
            ? "App Selected"
            : "Select Real Estate Archive"
        }
        description={
          <p>
            In the file selector, navigate to <strong>Applications</strong> and
            select <strong>Real Estate Archive.app</strong>
          </p>
        }
        isComplete={completedSteps.has(5)}
        isActive={completedSteps.has(4) && currentInstructionStep >= 4}
        onComplete={() => markStepComplete(5)}
        onBack={() => goBackToStep(4)}
        tip="If you can't find Real Estate Archive in the Applications folder, you may need to copy it from the DMG file first."
      />

      {/* Final: All steps complete */}
      {completedSteps.has(5) && !isImportingMessages && !isImportingContacts && !messagesResult && !contactsResult && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-3">
            <CheckIcon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Almost Done!
          </h3>
          <p className="text-sm text-gray-700 mb-2">
            macOS will prompt you to <strong>"Quit & Reopen"</strong> the app.
          </p>
          <p className="text-xs text-gray-600 mb-3">
            Click "Quit & Reopen" when prompted, or restart the app manually.
            We're checking for permissions automatically.
          </p>
          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isChecking ? "Checking..." : "Check Permissions"}
          </button>
        </div>
      )}

      <p className="text-center text-xs text-gray-500 mt-6">
        All data is stored locally on your device.
      </p>
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
    // Only show if permissions not yet granted (returning users with FDA skip this)
    shouldShow: (context) => !context.permissionsGranted,
  },
  Content: PermissionsStepContent,
};

export default permissionsStep;
