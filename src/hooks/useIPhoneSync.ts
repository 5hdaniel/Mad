import { useState, useEffect, useCallback } from 'react';
import type {
  iOSDevice,
  BackupProgress,
  SyncStatus,
  UseIPhoneSyncReturn,
} from '../types/iphone';

/**
 * useIPhoneSync Hook
 * Manages iPhone device detection, connection state, and backup sync
 *
 * This hook provides:
 * - Device connection monitoring
 * - Backup sync initiation and progress tracking
 * - Password prompt handling for encrypted backups
 * - Error state management
 */
export function useIPhoneSync(): UseIPhoneSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<iOSDevice | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  // Set up device detection and event listeners
  useEffect(() => {
    // Check if the device API is available (Windows only)
    if (!window.electron?.device) {
      return;
    }

    // Start device detection
    window.electron.device.startDetection?.();

    // Subscribe to device connected events
    const unsubscribeConnected = window.electron.device.onConnected?.(
      (connectedDevice: iOSDevice) => {
        setIsConnected(true);
        setDevice(connectedDevice);
        setError(null);
      }
    );

    // Subscribe to device disconnected events
    const unsubscribeDisconnected = window.electron.device.onDisconnected?.(
      () => {
        setIsConnected(false);
        setDevice(null);
        // Reset sync state on disconnect
        if (syncStatus === 'syncing') {
          setSyncStatus('error');
          setError('Device disconnected during sync');
        }
      }
    );

    // Subscribe to backup progress events
    const unsubscribeProgress = window.electron.backup?.onProgress?.(
      (backupProgress: BackupProgress) => {
        setProgress(backupProgress);
        if (backupProgress.phase === 'complete') {
          setSyncStatus('complete');
          setNeedsPassword(false);
        } else if (backupProgress.phase === 'error') {
          setSyncStatus('error');
          setError(backupProgress.message || 'Backup failed');
        }
      }
    );

    // Cleanup on unmount
    return () => {
      window.electron.device.stopDetection?.();
      unsubscribeConnected?.();
      unsubscribeDisconnected?.();
      unsubscribeProgress?.();
    };
  }, [syncStatus]);

  // Start backup sync
  const startSync = useCallback(async () => {
    if (!device) {
      setError('No device connected');
      return;
    }

    setSyncStatus('syncing');
    setError(null);
    setProgress({
      phase: 'preparing',
      percent: 0,
    });

    try {
      const result = await window.electron.backup?.start?.({ udid: device.udid });

      if (!result) {
        setSyncStatus('error');
        setError('Backup service not available');
        return;
      }

      if (result.error === 'PASSWORD_REQUIRED') {
        setNeedsPassword(true);
        return;
      }

      if (result.success) {
        setSyncStatus('complete');
      } else {
        setSyncStatus('error');
        setError(result.error || 'Backup failed');
      }
    } catch (err) {
      setSyncStatus('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [device]);

  // Submit backup password for encrypted backups
  const submitPassword = useCallback(
    async (password: string) => {
      if (!device) {
        setError('No device connected');
        return;
      }

      setError(null);

      try {
        const result = await window.electron.backup?.submitPassword?.({
          udid: device.udid,
          password,
        });

        if (!result) {
          setError('Backup service not available');
          return;
        }

        if (result.success) {
          setNeedsPassword(false);
          // Progress updates will come through the onProgress callback
        } else if (result.error === 'INVALID_PASSWORD') {
          setError('Incorrect password. Please try again.');
        } else {
          setError(result.error || 'Failed to verify password');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    },
    [device]
  );

  // Cancel ongoing sync
  const cancelSync = useCallback(async () => {
    try {
      await window.electron.backup?.cancel?.();
    } catch {
      // Ignore cancel errors
    }
    setSyncStatus('idle');
    setProgress(null);
    setNeedsPassword(false);
    setError(null);
  }, []);

  return {
    isConnected,
    device,
    syncStatus,
    progress,
    error,
    needsPassword,
    startSync,
    submitPassword,
    cancelSync,
  };
}

export default useIPhoneSync;
