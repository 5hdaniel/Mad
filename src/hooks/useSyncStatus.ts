/**
 * useSyncStatus Hook
 *
 * Manages global sync status for emails, messages, and contacts.
 * Provides state and methods for tracking background sync operations.
 *
 * @module hooks/useSyncStatus
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePlatform } from "../contexts/PlatformContext";

// Module-level flag to track if onboarding import just completed
// This is more reliable than localStorage across component remounts
let skipNextMessagesSync = false;

/**
 * Mark that onboarding import just completed - skip the next messages sync
 */
export function markOnboardingImportComplete(): void {
  console.log("[useSyncStatus] Marking onboarding import complete - will skip next messages sync");
  skipNextMessagesSync = true;
}

/**
 * Check if we should skip the next messages sync
 * Does NOT clear the flag - only runAutoSync clears it
 */
export function shouldSkipMessagesSync(): boolean {
  console.log("[useSyncStatus] shouldSkipMessagesSync:", skipNextMessagesSync);
  return skipNextMessagesSync;
}

/**
 * Individual sync operation status
 */
export interface SyncOperation {
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Progress percentage (0-100), null if indeterminate */
  progress: number | null;
  /** Status message to display */
  message: string;
  /** Error message if sync failed */
  error: string | null;
}

/**
 * Combined sync status for all operations
 */
export interface SyncStatus {
  emails: SyncOperation;
  messages: SyncOperation;
  contacts: SyncOperation;
}

/**
 * Return type for useSyncStatus hook
 */
export interface UseSyncStatusReturn {
  /** Current sync status for all operations */
  status: SyncStatus;
  /** Whether any sync operation is in progress */
  isAnySyncing: boolean;
  /** Overall status message to display */
  currentMessage: string | null;
  /** Start email sync */
  startEmailSync: (userId: string) => Promise<void>;
  /** Start messages sync (macOS only) */
  startMessagesSync: (userId: string) => Promise<void>;
  /** Start contacts sync */
  startContactsSync: (userId: string) => Promise<void>;
  /** Run all applicable syncs in sequence */
  runAutoSync: (userId: string, hasEmailConnected: boolean) => Promise<void>;
  /** Reset all sync states */
  reset: () => void;
}

const initialSyncOperation: SyncOperation = {
  isSyncing: false,
  progress: null,
  message: "",
  error: null,
};

const initialSyncStatus: SyncStatus = {
  emails: { ...initialSyncOperation },
  messages: { ...initialSyncOperation },
  contacts: { ...initialSyncOperation },
};

/**
 * Hook for managing global sync status across the application.
 *
 * Tracks sync progress for:
 * - Email scanning (all platforms)
 * - Messages import (macOS only)
 * - Contacts sync (future)
 *
 * Provides auto-sync functionality that runs appropriate syncs
 * based on platform and configuration.
 */
export function useSyncStatus(): UseSyncStatusReturn {
  const { isMacOS } = usePlatform();
  const [status, setStatus] = useState<SyncStatus>(initialSyncStatus);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Subscribe to message import progress
  // Shows progress from any import (including onboarding import started in PermissionsStep)
  useEffect(() => {
    const cleanup = window.api.messages.onImportProgress((progress) => {
      // When progress reaches 100%, mark as complete after a brief delay
      // This handles imports started outside this hook (e.g., onboarding)
      if (progress.percent >= 100) {
        setStatus((prev) => ({
          ...prev,
          messages: {
            isSyncing: true,
            progress: 100,
            message: `Importing messages... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
            error: null,
          },
        }));
        // Brief delay then mark complete
        setTimeout(() => {
          setStatus((prev) => ({
            ...prev,
            messages: {
              isSyncing: false,
              progress: 100,
              message: "Messages imported",
              error: null,
            },
          }));
        }, 500);
      } else {
        setStatus((prev) => ({
          ...prev,
          messages: {
            isSyncing: true,
            progress: progress.percent,
            message: `Importing messages... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
            error: null,
          },
        }));
      }
    });

    return cleanup;
  }, []);

  // Subscribe to contacts import progress
  // Shows progress from contacts import (including onboarding import started in PermissionsStep)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactsApi = window.api.contacts as any;
    if (!contactsApi?.onImportProgress) return;

    const cleanup = contactsApi.onImportProgress((progress: { current: number; total: number; percent: number }) => {
      // When progress reaches 100%, mark as complete after a brief delay
      if (progress.percent >= 100) {
        setStatus((prev) => ({
          ...prev,
          contacts: {
            isSyncing: true,
            progress: 100,
            message: `Importing contacts... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
            error: null,
          },
        }));
        // Brief delay then mark complete
        setTimeout(() => {
          setStatus((prev) => ({
            ...prev,
            contacts: {
              isSyncing: false,
              progress: 100,
              message: "Contacts imported",
              error: null,
            },
          }));
        }, 500);
      } else {
        setStatus((prev) => ({
          ...prev,
          contacts: {
            isSyncing: true,
            progress: progress.percent,
            message: `Importing contacts... ${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`,
            error: null,
          },
        }));
      }
    });

    return cleanup;
  }, []);

  /**
   * Start email sync (scan for real estate emails)
   */
  const startEmailSync = useCallback(async (userId: string): Promise<void> => {
    setStatus((prev) => ({
      ...prev,
      emails: {
        isSyncing: true,
        progress: null, // Indeterminate
        message: "Syncing emails...",
        error: null,
      },
    }));

    try {
      const result = await window.api.transactions.scan(userId);

      setStatus((prev) => ({
        ...prev,
        emails: {
          isSyncing: false,
          progress: 100,
          message: result.success
            ? `Email sync complete`
            : "Email sync failed",
          error: result.error || null,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        emails: {
          isSyncing: false,
          progress: null,
          message: "Email sync failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  }, []);

  /**
   * Start messages sync (macOS Messages app)
   */
  const startMessagesSync = useCallback(async (userId: string): Promise<void> => {
    if (!isMacOS) return;

    setStatus((prev) => ({
      ...prev,
      messages: {
        isSyncing: true,
        progress: null, // Will be updated via IPC listener
        message: "Importing messages...",
        error: null,
      },
    }));

    try {
      const result = await window.api.messages.importMacOSMessages(userId);

      setStatus((prev) => ({
        ...prev,
        messages: {
          isSyncing: false,
          progress: 100,
          message: result.success
            ? result.messagesImported > 0
              ? `Imported ${result.messagesImported.toLocaleString()} messages`
              : "Messages up to date"
            : "Message import failed",
          error: result.error || null,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        messages: {
          isSyncing: false,
          progress: null,
          message: "Message import failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  }, [isMacOS]);

  /**
   * Start contacts sync
   * Note: Currently a placeholder - contacts are synced with email
   */
  const startContactsSync = useCallback(async (userId: string): Promise<void> => {
    setStatus((prev) => ({
      ...prev,
      contacts: {
        isSyncing: true,
        progress: null,
        message: "Syncing contacts...",
        error: null,
      },
    }));

    try {
      // Contacts are synced automatically with email scan
      // This is a quick check to ensure contacts are up to date
      await window.api.contacts.getAll(userId);

      setStatus((prev) => ({
        ...prev,
        contacts: {
          isSyncing: false,
          progress: 100,
          message: "Contacts synced",
          error: null,
        },
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        contacts: {
          isSyncing: false,
          progress: null,
          message: "Contact sync failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
    }
  }, []);

  /**
   * Run auto-sync sequence after login
   *
   * Sequence:
   * 1. Email sync (if email connected)
   * 2. Messages sync (macOS only)
   * 3. Contacts sync
   */
  const runAutoSync = useCallback(async (
    userId: string,
    hasEmailConnected: boolean
  ): Promise<void> => {
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Email sync (if email is connected)
      if (hasEmailConnected) {
        await startEmailSync(userId);
      }

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) return;

      // Step 2: Messages sync (macOS only)
      // Skip if we just imported during onboarding (avoid redundant "Importing messages..." UI)
      console.log("[useSyncStatus] Checking skipNextMessagesSync flag:", skipNextMessagesSync);
      if (isMacOS && !skipNextMessagesSync) {
        console.log("[useSyncStatus] Starting messages sync");
        await startMessagesSync(userId);
      } else if (skipNextMessagesSync) {
        // Clear the flag so future syncs work normally
        console.log("[useSyncStatus] Skipping messages sync - just did onboarding import");
        skipNextMessagesSync = false;
      }

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) return;

      // Step 3: Contacts sync
      if (hasEmailConnected) {
        await startContactsSync(userId);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [isMacOS, startEmailSync, startMessagesSync, startContactsSync]);

  /**
   * Reset all sync states
   */
  const reset = useCallback(() => {
    // Abort any ongoing sync
    abortControllerRef.current?.abort();
    setStatus(initialSyncStatus);
  }, []);

  /**
   * Check if any sync is in progress
   */
  const isAnySyncing = useMemo(() => {
    return status.emails.isSyncing ||
           status.messages.isSyncing ||
           status.contacts.isSyncing;
  }, [status]);

  /**
   * Get current status message to display
   * Prioritizes active syncs
   */
  const currentMessage = useMemo(() => {
    if (status.emails.isSyncing) return status.emails.message;
    if (status.messages.isSyncing) return status.messages.message;
    if (status.contacts.isSyncing) return status.contacts.message;
    return null;
  }, [status]);

  return {
    status,
    isAnySyncing,
    currentMessage,
    startEmailSync,
    startMessagesSync,
    startContactsSync,
    runAutoSync,
    reset,
  };
}

export default useSyncStatus;
