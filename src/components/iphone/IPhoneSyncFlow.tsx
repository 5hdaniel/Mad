import React from "react";
import { useIPhoneSync } from "../../hooks/useIPhoneSync";
import { ConnectionStatus } from "./ConnectionStatus";
import { SyncProgress } from "./SyncProgress";
import { BackupPasswordModal } from "./BackupPasswordModal";
import { SyncLockBanner } from "../sync/SyncLockBanner";

interface IPhoneSyncFlowProps {
  /** Callback when sync is complete and user clicks Continue */
  onClose?: () => void;
}

/**
 * IPhoneSyncFlow Container Component
 *
 * Orchestrates the complete iPhone sync flow:
 * 1. Device connection status
 * 2. Sync initiation
 * 3. Progress tracking
 * 4. Password handling for encrypted backups
 * 5. Success/Error states
 *
 * This component ties together the useIPhoneSync hook with
 * the individual UI components for a complete user experience.
 */
export const IPhoneSyncFlow: React.FC<IPhoneSyncFlowProps> = ({ onClose }) => {
  const {
    isConnected,
    device,
    syncStatus,
    progress,
    error,
    needsPassword,
    lastSyncTime,
    isWaitingForPasscode,
    syncLocked,
    lockReason,
    startSync,
    submitPassword,
    cancelSync,
    checkSyncStatus,
  } = useIPhoneSync();

  // Determine if we're actively syncing
  const isSyncing = syncStatus === "syncing";
  const isComplete = syncStatus === "complete";
  const isError = syncStatus === "error";

  return (
    <div className="iphone-sync-flow">
      {/* TASK-910: Sync Lock Banner - Shown when another sync is in progress */}
      {syncLocked && !isSyncing && (
        <SyncLockBanner
          operationName={lockReason || "Another sync operation"}
          onRetry={checkSyncStatus}
        />
      )}

      {/* Connection Status - Shown when idle (not syncing, not complete, not error) */}
      {!isSyncing && !isComplete && !isError && (
        <ConnectionStatus
          isConnected={isConnected}
          device={device}
          onSyncClick={startSync}
          lastSyncTime={lastSyncTime}
        />
      )}

      {/* Sync Progress - Shown during sync */}
      {isSyncing && progress && (
        <SyncProgress
          progress={progress}
          onCancel={cancelSync}
          isWaitingForPasscode={isWaitingForPasscode}
        />
      )}

      {/* Success State */}
      {isComplete && progress && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-500"
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
          </div>
          <h3 className="text-xl font-semibold text-gray-800">Sync Complete!</h3>
          {progress?.message && (
            <p className="text-gray-500 mt-2">{progress.message}</p>
          )}

          {/* TASK-1796: iCloud attachment limitation info */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left max-w-sm">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
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
              <div>
                <p className="text-sm font-medium text-blue-800">About iPhone Attachments</p>
                <p className="text-xs text-blue-700 mt-1">
                  Photos and videos stored in iCloud are not included in local backups.
                  To include more attachments, disable iCloud Photos on your iPhone,
                  wait for media to download, then sync again.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            Continue
          </button>
        </div>
      )}

      {/* Error State */}
      {isError && !needsPassword && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800">Sync Failed</h3>
          {error && (
            <p className="text-red-500 mt-2 max-w-sm">{error}</p>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={cancelSync}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            {isConnected && (
              <button
                onClick={startSync}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Password Modal - Shown when encrypted backup detected */}
      <BackupPasswordModal
        isOpen={needsPassword}
        deviceName={device?.name || "iPhone"}
        onSubmit={submitPassword}
        onCancel={cancelSync}
        error={error || undefined}
        isLoading={isSyncing && !needsPassword}
      />
    </div>
  );
};

export default IPhoneSyncFlow;
