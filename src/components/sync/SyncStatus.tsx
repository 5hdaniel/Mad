import React from 'react';
import { SyncProgressBar } from './SyncProgressBar';
import type { BackupProgress, SyncPhase } from './types';

interface SyncStatusProps {
  progress: BackupProgress;
  onCancel: () => void;
}

const phaseLabels: Record<SyncPhase, string> = {
  preparing: 'Preparing sync...',
  transferring: 'Transferring data...',
  finishing: 'Almost done...'
};

export const SyncStatus: React.FC<SyncStatusProps> = ({ progress, onCancel }) => {
  return (
    <div className="sync-status">
      <div className="sync-icon-container mb-4">
        <svg
          className="w-12 h-12 text-blue-500 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
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

      <h3 className="text-lg font-medium mb-2">
        Syncing Your iPhone
      </h3>

      <div className="w-full max-w-xs mb-4">
        <SyncProgressBar
          percent={progress.percentComplete}
          phase={phaseLabels[progress.phase]}
        />
      </div>

      {progress.currentFile && (
        <p className="text-sm text-gray-500 mt-2 truncate max-w-xs">
          {progress.currentFile}
        </p>
      )}

      {progress.filesTransferred !== null && progress.totalFiles !== null && (
        <p className="text-sm text-gray-500">
          {progress.filesTransferred} of {progress.totalFiles} files
        </p>
      )}

      <button
        onClick={onCancel}
        className="btn-secondary mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Cancel Sync
      </button>

      <p className="text-xs text-gray-400 mt-4">
        Keep your iPhone connected and unlocked
      </p>
    </div>
  );
};
