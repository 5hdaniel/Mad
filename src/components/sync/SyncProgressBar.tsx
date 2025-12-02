import React from 'react';

interface SyncProgressBarProps {
  percent: number;          // 0-100
  phase: string;           // e.g., "Preparing", "Transferring", "Processing"
  animated?: boolean;
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({
  percent,
  phase,
  animated = true
}) => {
  // Clamp percent between 0 and 100
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="sync-progress w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{phase}</span>
        <span className="text-sm text-gray-500">{Math.round(clampedPercent)}%</span>
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
};
