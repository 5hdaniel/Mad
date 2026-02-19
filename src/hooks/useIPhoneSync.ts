import { useState, useEffect, useCallback, useRef } from "react";
import type {
  iOSDevice,
  BackupProgress,
  SyncStatus,
  UseIPhoneSyncReturn,
} from "../types/iphone";
import logger from '../utils/logger';

/**
 * useIPhoneSync Hook
 * Manages iPhone device detection, connection state, and sync operations
 *
 * This hook provides:
 * - Device connection monitoring via sync API
 * - Full sync flow (backup → decrypt → parse)
 * - Password prompt handling for encrypted backups
 * - Progress tracking across all phases
 * - Error state management
 *
 * Uses the sync API which orchestrates:
 * 1. Device backup via idevicebackup2
 * 2. Backup decryption (if encrypted)
 * 3. Message and contact extraction
 */
export function useIPhoneSync(): UseIPhoneSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<iOSDevice | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isWaitingForPasscode, setIsWaitingForPasscode] = useState(false);
  // TASK-910: Sync lock state
  const [syncLocked, setSyncLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // Track cleanup functions
  const cleanupRef = useRef<(() => void)[]>([]);
  // Track current progress phase for disconnect handler (avoids stale closure)
  const progressPhaseRef = useRef<BackupProgress["phase"] | null>(null);

  /**
   * Check unified sync status to detect if another operation is running
   * TASK-910: Prevents users from triggering concurrent syncs
   */
  const checkSyncStatus = useCallback(async () => {
    try {
      // Use type assertion to access getUnifiedStatus
      // Type is defined in window.d.ts but TypeScript infers narrower type from deviceBridge.ts
      type SyncApiWithUnifiedStatus = {
        getUnifiedStatus?: () => Promise<{
          isAnyOperationRunning: boolean;
          currentOperation: string | null;
        }>;
      };
      const syncApi = window.api?.sync as SyncApiWithUnifiedStatus | undefined;
      if (!syncApi?.getUnifiedStatus) {
        logger.warn("[useIPhoneSync] getUnifiedStatus not available");
        return;
      }

      const status = await syncApi.getUnifiedStatus();
      setSyncLocked(status.isAnyOperationRunning);
      setLockReason(status.currentOperation);
    } catch (err) {
      logger.error("[useIPhoneSync] Failed to check sync status:", err);
    }
  }, []);

  // Set up device detection and event listeners
  useEffect(() => {
    // Check if the sync API is available
    const syncApi = window.api?.sync;
    const deviceApi = window.api?.device;

    if (!syncApi && !deviceApi) {
      logger.warn("[useIPhoneSync] Neither sync nor device API available");
      return;
    }

    const cleanups: (() => void)[] = [];

    // Helper to handle device connection
    const handleDeviceConnected = async (device: unknown) => {
      const connectedDevice = device as iOSDevice;
      const mappedDevice: iOSDevice = {
        udid: connectedDevice.udid,
        name: connectedDevice.name,
        productType: connectedDevice.productType,
        productVersion: connectedDevice.productVersion,
        serialNumber: connectedDevice.serialNumber,
        isConnected: true,
      };
      setIsConnected(true);
      setDevice(mappedDevice);
      setError(null);
      logger.debug("[useIPhoneSync] Device connected:", mappedDevice.name);

      // Fetch last sync time for this device
      try {
        // Use type assertion to access checkStatus which may not be in older type definitions
        const backupApi = window.api?.backup as {
          checkStatus?: (udid: string) => Promise<{
            success: boolean;
            lastSyncTime?: string | null;
          }>;
        } | undefined;
        if (backupApi?.checkStatus) {
          const status = await backupApi.checkStatus(connectedDevice.udid);
          if (status?.success && status.lastSyncTime) {
            setLastSyncTime(new Date(status.lastSyncTime));
            logger.info("[useIPhoneSync] Last sync time:", status.lastSyncTime);
          } else {
            setLastSyncTime(null);
          }
        }
      } catch (err) {
        logger.warn("[useIPhoneSync] Failed to fetch backup status:", err);
        setLastSyncTime(null);
      }
    };

    // === SET UP EVENT LISTENERS FIRST (before starting detection) ===
    if (syncApi) {
      // Device connected via sync API
      if (syncApi.onDeviceConnected) {
        const unsub = syncApi.onDeviceConnected(handleDeviceConnected);
        cleanups.push(unsub);
      }

      // Device disconnected via sync API
      if (syncApi.onDeviceDisconnected) {
        const unsub = syncApi.onDeviceDisconnected(() => {
          logger.debug("[useIPhoneSync] Device disconnected");
          setIsConnected(false);
          setDevice(null);
          // Only show error if sync is in a phase that requires the device
          // Phases that require device: preparing, backing_up
          // Phases safe to disconnect: extracting, storing, complete
          setSyncStatus((current) => {
            if (current === "syncing") {
              const currentPhase = progressPhaseRef.current;
              // Only show error if still in backup phase (device required)
              if (currentPhase === "backing_up" || currentPhase === "preparing") {
                setError("Device disconnected during sync");
                return "error";
              }
              // In extracting/storing phases, disconnect is fine - just log it
              logger.debug("[useIPhoneSync] Device disconnected but in safe phase:", currentPhase);
            }
            return current;
          });
        });
        cleanups.push(unsub);
      }

      // Sync progress updates
      if (syncApi.onProgress) {
        const unsub = syncApi.onProgress((syncProgress) => {
          // Map sync progress to BackupProgress format
          let phase: BackupProgress["phase"] = "backing_up";
          if (syncProgress.phase === "backup") {
            phase = "backing_up";
          } else if (syncProgress.phase === "decrypting") {
            phase = "extracting";
          } else if (
            syncProgress.phase === "parsing_messages" ||
            syncProgress.phase === "parsing_contacts" ||
            syncProgress.phase === "resolving"
          ) {
            phase = "extracting";
          } else if (syncProgress.phase === "complete") {
            phase = "complete";
          }

          // Extract bytes/files info from backupProgress if available
          // The backupProgress field contains detailed backup stats from idevicebackup2
          const progressWithBackup = syncProgress as {
            phase: string;
            overallProgress: number;
            message?: string;
            estimatedTotalBytes?: number;
            backupProgress?: {
              bytesTransferred?: number;
              filesTransferred?: number;
            };
          };

          // Update ref for disconnect handler (avoids stale closure)
          progressPhaseRef.current = phase;
          setProgress({
            phase,
            percent: syncProgress.overallProgress ?? 0,
            message: syncProgress.message,
            bytesProcessed: progressWithBackup.backupProgress?.bytesTransferred,
            processedFiles: progressWithBackup.backupProgress?.filesTransferred,
            estimatedTotalBytes: progressWithBackup.estimatedTotalBytes,
          });
        });
        cleanups.push(unsub);
      }

      // Password required event
      if (syncApi.onPasswordRequired) {
        const unsub = syncApi.onPasswordRequired(() => {
          logger.debug("[useIPhoneSync] Password required for encrypted backup");
          setNeedsPassword(true);
        });
        cleanups.push(unsub);
      }

      // Passcode waiting event (user needs to enter passcode on iPhone)
      if (syncApi.onWaitingForPasscode) {
        const unsub = syncApi.onWaitingForPasscode(() => {
          logger.debug("[useIPhoneSync] Waiting for user to enter passcode on iPhone");
          setIsWaitingForPasscode(true);
          setProgress((prev) => ({
            phase: "backing_up",
            percent: prev?.percent ?? 0,
            message: "Waiting for passcode input on your iPhone...",
          }));
        });
        cleanups.push(unsub);
      }

      // Passcode entered event (user entered passcode, backup starting)
      if (syncApi.onPasscodeEntered) {
        const unsub = syncApi.onPasscodeEntered(() => {
          logger.info("[useIPhoneSync] User entered passcode, backup starting");
          setIsWaitingForPasscode(false);
          setProgress((prev) => ({
            phase: "backing_up",
            percent: prev?.percent ?? 0,
            message: "Passcode accepted! iPhone is preparing backup...",
          }));
        });
        cleanups.push(unsub);
      }

      // Sync error events
      if (syncApi.onError) {
        const unsub = syncApi.onError((err) => {
          logger.error("[useIPhoneSync] Sync error:", err.message);
          setSyncStatus("error");
          setError(err.message);
        });
        cleanups.push(unsub);
      }

      // Sync complete event (extraction done, now storing to DB)
      if (syncApi.onComplete) {
        interface SyncResultType {
          success: boolean;
          messageCount?: number;
          contactCount?: number;
          conversationCount?: number;
          error?: string;
        }
        const unsub = syncApi.onComplete((data: unknown) => {
          const result = data as SyncResultType;
          logger.info("[useIPhoneSync] Sync extraction complete:", {
            messages: result.messageCount ?? 0,
            contacts: result.contactCount ?? 0,
            conversations: result.conversationCount ?? 0,
          });

          if (result.success) {
            // Extraction complete, now storing to DB (status will update via onStorageComplete)
            setSyncStatus("syncing");
            setProgress({
              phase: "storing",
              percent: 0,
              message: `Saving ${(result.messageCount ?? 0).toLocaleString()} messages to database...`,
            });
          } else {
            setSyncStatus("error");
            setError(result.error || "Sync failed");
          }
          setNeedsPassword(false);
        });
        cleanups.push(unsub);
      }

      // Storage complete event (messages saved to DB)
      // Use type assertion since window.d.ts may not have this method yet
      const syncApiWithStorage = syncApi as typeof syncApi & {
        onStorageComplete?: (
          callback: (result: {
            messagesStored: number;
            contactsStored: number;
            duration: number;
          }) => void
        ) => () => void;
        onStorageError?: (callback: (err: { error: string }) => void) => () => void;
      };

      if (syncApiWithStorage.onStorageComplete) {
        const unsub = syncApiWithStorage.onStorageComplete((result) => {
          logger.info("[useIPhoneSync] Storage complete:", {
            messagesStored: result.messagesStored,
            contactsStored: result.contactsStored,
            duration: result.duration,
          });

          setSyncStatus("complete");
          setLastSyncTime(new Date());
          setProgress({
            phase: "complete",
            percent: 100,
            message: `Saved ${result.messagesStored.toLocaleString()} messages and ${result.contactsStored} contacts`,
          });
        });
        cleanups.push(unsub);
      }

      // Storage error event
      if (syncApiWithStorage.onStorageError) {
        const unsub = syncApiWithStorage.onStorageError((err) => {
          logger.error("[useIPhoneSync] Storage error:", err.error);
          // Still mark as complete since extraction succeeded, just storage failed
          setSyncStatus("complete");
          setProgress({
            phase: "complete",
            percent: 100,
            message: "Messages extracted but failed to save to database",
          });
        });
        cleanups.push(unsub);
      }
    }

    // === FALLBACK: DEVICE API EVENT LISTENERS ===
    if (!syncApi && deviceApi) {
      // Device connected via device API
      if (deviceApi.onConnected) {
        const unsub = deviceApi.onConnected((connectedDevice) => {
          const mappedDevice: iOSDevice = {
            udid: connectedDevice.udid,
            name: connectedDevice.name,
            productType: connectedDevice.productType,
            productVersion: connectedDevice.productVersion,
            serialNumber: connectedDevice.serialNumber,
            isConnected: connectedDevice.isConnected,
          };
          setIsConnected(true);
          setDevice(mappedDevice);
          setError(null);
        });
        cleanups.push(unsub);
      }

      // Device disconnected via device API
      if (deviceApi.onDisconnected) {
        const unsub = deviceApi.onDisconnected(() => {
          setIsConnected(false);
          setDevice(null);
          // Only show error if sync is in a phase that requires the device
          setSyncStatus((current) => {
            if (current === "syncing") {
              const currentPhase = progressPhaseRef.current;
              // Only show error if still in backup phase (device required)
              if (currentPhase === "backing_up" || currentPhase === "preparing") {
                setError("Device disconnected during sync");
                return "error";
              }
              // In extracting/storing phases, disconnect is fine
              logger.debug("[useIPhoneSync] Device disconnected but in safe phase:", currentPhase);
            }
            return current;
          });
        });
        cleanups.push(unsub);
      }
    }

    // === NOW START DEVICE DETECTION (after all listeners are set up) ===
    // This order ensures we don't miss any events
    logger.info("[useIPhoneSync] Starting device detection...");
    if (syncApi?.startDetection) {
      syncApi.startDetection();
    } else if (deviceApi?.startDetection) {
      deviceApi.startDetection();
    }

    // Store cleanups for later
    cleanupRef.current = cleanups;

    // Cleanup on unmount
    return () => {
      if (syncApi?.stopDetection) {
        syncApi.stopDetection();
      } else if (deviceApi?.stopDetection) {
        deviceApi.stopDetection();
      }
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  // TASK-910: Check sync status on mount and poll while component is mounted
  useEffect(() => {
    checkSyncStatus();
    // Poll every 5 seconds while component is mounted
    const interval = setInterval(checkSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [checkSyncStatus]);

  // Start sync operation
  const startSync = useCallback(async () => {
    if (!device) {
      logger.error("[useIPhoneSync] Cannot start sync: No device connected");
      setError("No device connected");
      return;
    }

    const syncApi = window.api?.sync;
    if (!syncApi?.start) {
      logger.error("[useIPhoneSync] Sync API not available");
      setError("Sync service not available");
      return;
    }

    // TASK-910: Check if another sync is running before starting
    type SyncApiWithUnifiedStatus = {
      getUnifiedStatus?: () => Promise<{
        isAnyOperationRunning: boolean;
        currentOperation: string | null;
      }>;
    };
    const syncApiTyped = window.api?.sync as SyncApiWithUnifiedStatus | undefined;
    if (syncApiTyped?.getUnifiedStatus) {
      try {
        const status = await syncApiTyped.getUnifiedStatus();
        if (status.isAnyOperationRunning) {
          logger.warn("[useIPhoneSync] Sync blocked - another operation running:", status.currentOperation);
          setSyncLocked(true);
          setLockReason(status.currentOperation);
          return;
        }
      } catch (err) {
        logger.error("[useIPhoneSync] Failed to check sync status:", err);
        // Continue with sync attempt if status check fails
      }
    }

    setSyncStatus("syncing");
    setError(null);
    setNeedsPassword(false);
    setProgress({
      phase: "preparing",
      percent: 0,
      message: "Preparing to sync...",
    });

    try {
      logger.info("[useIPhoneSync] Starting sync for device:", device.udid);

      // If we have a pending password, include it
      const result = await syncApi.start({
        udid: device.udid,
        password: pendingPassword ?? undefined,
        forceFullBackup: false,
      });

      // Clear pending password after use
      setPendingPassword(null);

      if (!result) {
        logger.error("[useIPhoneSync] Sync returned null result");
        setSyncStatus("error");
        setError("Sync service returned no result");
        return;
      }

      // Result handling is done via onComplete callback
      // But we handle immediate errors here
      if (!result.success && result.error) {
        logger.error("[useIPhoneSync] Sync failed:", result.error);
        setSyncStatus("error");
        setError(result.error);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      logger.error("[useIPhoneSync] Sync error:", errorMessage);
      setSyncStatus("error");
      setError(errorMessage);
    }
  }, [device, pendingPassword]);

  // Submit password for encrypted backups
  const submitPassword = useCallback(
    async (password: string) => {
      if (!device) {
        logger.error(
          "[useIPhoneSync] Cannot submit password: No device connected"
        );
        setError("No device connected");
        return;
      }

      logger.info("[useIPhoneSync] Password submitted, retrying sync");
      setError(null);
      setPendingPassword(password);
      setNeedsPassword(false);

      // Retry sync with password
      const syncApi = window.api?.sync;
      if (!syncApi?.start) {
        setError("Sync service not available");
        return;
      }

      setProgress({
        phase: "preparing",
        percent: 0,
        message: "Verifying password...",
      });

      try {
        const result = await syncApi.start({
          udid: device.udid,
          password: password,
        });

        // Clear pending password
        setPendingPassword(null);

        if (!result?.success && result?.error) {
          if (
            result.error.includes("password") ||
            result.error.includes("decrypt")
          ) {
            setNeedsPassword(true);
            setError("Incorrect password. Please try again.");
          } else {
            setSyncStatus("error");
            setError(result.error);
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred";
        logger.error("[useIPhoneSync] Password submit error:", errorMessage);
        setNeedsPassword(true);
        setError(errorMessage);
        setPendingPassword(null);
      }
    },
    [device]
  );

  // Cancel ongoing sync
  const cancelSync = useCallback(async () => {
    logger.info("[useIPhoneSync] Cancelling sync");

    try {
      const syncApi = window.api?.sync;
      if (syncApi?.cancel) {
        await syncApi.cancel();
      }
    } catch (err) {
      logger.warn("[useIPhoneSync] Cancel error (ignored):", err);
    }

    setSyncStatus("idle");
    setProgress(null);
    setNeedsPassword(false);
    setError(null);
    setPendingPassword(null);
  }, []);

  return {
    isConnected,
    device,
    syncStatus,
    progress,
    error,
    needsPassword,
    lastSyncTime,
    isWaitingForPasscode,
    // TASK-910: Sync lock state
    syncLocked,
    lockReason,
    startSync,
    submitPassword,
    cancelSync,
    checkSyncStatus,
  };
}

export default useIPhoneSync;
