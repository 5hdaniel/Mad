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
    if (!window.api?.device) {
      return;
    }

    // Start device detection
    window.api.device.startDetection?.();

    // Subscribe to device connected events
    const unsubscribeConnected = window.api.device.onConnected?.(
      (connectedDevice) => {
        // Map iOSDeviceInfo to iOSDevice
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
      }
    );

    // Subscribe to device disconnected events
    const unsubscribeDisconnected = window.api.device.onDisconnected?.(
      () => {
        setIsConnected(false);
        setDevice(null);
        // Reset sync state on disconnect
        if (syncStatus === 'syncing') {
          console.error('[useIPhoneSync] Device disconnected during sync');
          setSyncStatus('error');
          setError('Device disconnected during sync');
        }
      }
    );

    // Subscribe to backup progress events
    const unsubscribeProgress = window.api.backup?.onProgress?.(
      (backupProgress) => {
        // Map API phase to hook phase format
        let mappedPhase: BackupProgress['phase'];
        switch (backupProgress.phase) {
          case 'preparing':
            mappedPhase = 'preparing';
            break;
          case 'transferring':
          case 'finishing':
            mappedPhase = 'backing_up';
            break;
          case 'extracting':
            mappedPhase = 'extracting';
            break;
          default:
            mappedPhase = 'backing_up';
        }

        const mappedProgress: BackupProgress = {
          phase: mappedPhase,
          percent: backupProgress.percentComplete,
          message: backupProgress.currentFile || undefined,
        };
        setProgress(mappedProgress);

        if (backupProgress.percentComplete >= 100) {
          setSyncStatus('complete');
          setNeedsPassword(false);
        }
      }
    );

    // Subscribe to backup error events
    const unsubscribeError = window.api.backup?.onError?.((err) => {
      console.error('[useIPhoneSync] Backup error:', err.message);
      setSyncStatus('error');
      setError(err.message);
    });

    // Cleanup on unmount
    return () => {
      window.api?.device?.stopDetection?.();
      unsubscribeConnected?.();
      unsubscribeDisconnected?.();
      unsubscribeProgress?.();
      unsubscribeError?.();
    };
  }, [syncStatus]);

  // Start backup sync
  const startSync = useCallback(async () => {
    if (!device) {
      console.error('[useIPhoneSync] Cannot start sync: No device connected');
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
      const result = await window.api?.backup?.start?.({
        udid: device.udid,
        skipApps: true, // Always skip apps to reduce backup size
      });

      if (!result) {
        console.error('[useIPhoneSync] Backup service not available');
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
        console.error('[useIPhoneSync] Backup failed:', result.error);
        setSyncStatus('error');
        setError(result.error || 'Backup failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[useIPhoneSync] Unexpected error during backup:', errorMessage);
      setSyncStatus('error');
      setError(errorMessage);
    }
  }, [device]);

  // Submit backup password for encrypted backups
  const submitPassword = useCallback(
    async (password: string) => {
      if (!device) {
        console.error('[useIPhoneSync] Cannot submit password: No device connected');
        setError('No device connected');
        return;
      }

      setError(null);

      try {
        // Use startWithPassword for encrypted backups
        const result = await window.api?.backup?.startWithPassword?.({
          udid: device.udid,
          password,
        });

        if (!result) {
          console.error('[useIPhoneSync] Backup service not available');
          setError('Backup service not available');
          return;
        }

        if (result.success) {
          setNeedsPassword(false);
          // Progress updates will come through the onProgress callback
        } else if (result.errorCode === 'INVALID_PASSWORD') {
          console.warn('[useIPhoneSync] Invalid backup password provided');
          setError('Incorrect password. Please try again.');
        } else {
          console.error('[useIPhoneSync] Password verification failed:', result.error);
          setError(result.error || 'Failed to verify password');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('[useIPhoneSync] Unexpected error during password verification:', errorMessage);
        setError(errorMessage);
      }
    },
    [device]
  );

  // Cancel ongoing sync
  const cancelSync = useCallback(async () => {
    try {
      await window.api?.backup?.cancel?.();
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
