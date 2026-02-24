/**
 * Custom hook for managing email scan functionality
 * Handles start/stop scan, progress tracking, and IPC listener cleanup
 */
import { useState, useEffect, useCallback } from "react";
import logger from '../../../utils/logger';

/**
 * Scan progress state
 */
export interface ScanProgress {
  step: string;
  message: string;
}

/**
 * Return type for useTransactionScan hook
 */
export interface UseTransactionScanResult {
  scanning: boolean;
  scanProgress: ScanProgress | null;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
}

/**
 * Custom hook for managing transaction email scanning
 * @param userId - User ID to scan for
 * @param onScanComplete - Callback when scan completes successfully (to refresh transactions)
 * @param onError - Callback to report errors
 * @returns Scan state and control functions
 */
export function useTransactionScan(
  userId: string,
  onScanComplete: () => Promise<void>,
  onError: (error: string | null) => void
): UseTransactionScanResult {
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  /**
   * Handle scan progress updates from IPC
   */
  const handleScanProgress = useCallback((progress: unknown): void => {
    const scanProgressData = progress as ScanProgress;
    setScanProgress(scanProgressData);
  }, []);

  /**
   * Set up IPC listener for scan progress
   */
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (window.api?.onTransactionScanProgress) {
      cleanup = window.api.onTransactionScanProgress(handleScanProgress);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [handleScanProgress]);

  /**
   * Start email scan
   */
  const startScan = useCallback(async (): Promise<void> => {
    try {
      setScanning(true);
      onError(null);
      setScanProgress({ step: "starting", message: "Starting scan..." });

      const result = await window.api.transactions.scan(userId, {
        // provider omitted - backend auto-detects all connected mailboxes
        // startDate and maxEmails are read from user preferences in the backend
      });

      if (result.success) {
        setScanProgress({
          step: "complete",
          message: `Found ${result.transactionsFound} transactions from ${result.emailsScanned} emails!`,
        });

        // Reload transactions
        await onScanComplete();
      } else {
        onError(result.error || "Scan failed");
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      // Don't show error if it was a cancellation
      if (!errorMessage.includes("cancelled")) {
        onError(errorMessage);
      }
    } finally {
      setScanning(false);
      setTimeout(() => setScanProgress(null), 3000);
    }
  }, [userId, onScanComplete, onError]);

  /**
   * Stop/cancel current scan
   */
  const stopScan = useCallback(async (): Promise<void> => {
    try {
      await window.api.transactions.cancelScan(userId);
      // Clear scan progress immediately without showing a message
      setScanProgress(null);
    } catch (err) {
      logger.error("Failed to stop scan:", err);
    }
  }, [userId]);

  return {
    scanning,
    scanProgress,
    startScan,
    stopScan,
  };
}

export default useTransactionScan;
