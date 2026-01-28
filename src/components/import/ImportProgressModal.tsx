/**
 * Import Progress Modal (TASK-1710)
 *
 * Displays import progress with:
 * - Current phase (querying, deleting, importing, attachments)
 * - Progress bar with percentage
 * - Messages count: X / Y
 * - Elapsed time
 * - Estimated time remaining (ETA)
 * - Cancel button for graceful cancellation
 *
 * @module import/ImportProgressModal
 */

import React, { useMemo } from "react";

/**
 * Progress state from the import service
 */
export interface ImportProgressState {
  phase: "querying" | "deleting" | "importing" | "attachments";
  current: number;
  total: number;
  percent: number;
  elapsedMs: number;
}

interface ImportProgressModalProps {
  isOpen: boolean;
  progress: ImportProgressState | null;
  onCancel: () => void;
}

/**
 * Format milliseconds to human-readable time string
 * @param ms - Milliseconds
 * @returns Formatted time string (e.g., "1:23" or "45s")
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

/**
 * Calculate estimated time remaining based on progress
 * @param current - Current item count
 * @param total - Total item count
 * @param elapsedMs - Elapsed time in milliseconds
 * @returns Formatted ETA string
 */
function calculateETA(
  current: number,
  total: number,
  elapsedMs: number
): string {
  if (current === 0 || total === 0) return "--";
  if (current >= total) return "0s";

  const msPerItem = elapsedMs / current;
  const remainingItems = total - current;
  const remainingMs = msPerItem * remainingItems;

  return `~${formatTime(remainingMs)}`;
}

/**
 * Get human-readable phase name
 */
function getPhaseName(
  phase: "querying" | "deleting" | "importing" | "attachments"
): string {
  switch (phase) {
    case "querying":
      return "Querying messages";
    case "deleting":
      return "Clearing existing messages";
    case "importing":
      return "Importing messages";
    case "attachments":
      return "Processing attachments";
  }
}

/**
 * Get phase-specific item label
 */
function getItemLabel(
  phase: "querying" | "deleting" | "importing" | "attachments"
): string {
  switch (phase) {
    case "querying":
      return "messages queried";
    case "deleting":
      return "messages deleted";
    case "importing":
      return "messages imported";
    case "attachments":
      return "attachments processed";
  }
}

/**
 * Get phase-specific progress bar color
 */
function getPhaseColor(
  phase: "querying" | "deleting" | "importing" | "attachments"
): string {
  switch (phase) {
    case "querying":
      return "bg-purple-500";
    case "deleting":
      return "bg-orange-500";
    case "importing":
      return "bg-blue-500";
    case "attachments":
      return "bg-green-500";
  }
}

/**
 * Import Progress Modal
 * Displays detailed import progress with ETA and cancel support
 */
export function ImportProgressModal({
  isOpen,
  progress,
  onCancel,
}: ImportProgressModalProps) {
  // Memoize ETA calculation to avoid recalculating on every render
  const eta = useMemo(() => {
    if (!progress) return "--";
    return calculateETA(progress.current, progress.total, progress.elapsedMs);
  }, [progress?.current, progress?.total, progress?.elapsedMs]);

  if (!isOpen) {
    return null;
  }

  // Show preparing state when no progress yet
  const isPreparing = !progress;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Importing Messages
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Cancel import"
          >
            <svg
              className="w-5 h-5"
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
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {isPreparing ? (
            // Preparing state
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Preparing...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-gray-400 h-full w-full animate-pulse" />
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center">
                Connecting to macOS Messages database...
              </p>
            </div>
          ) : (
            // Progress state
            <div>
              {/* Phase name */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">
                  {getPhaseName(progress.phase)}
                </span>
                <span className="text-gray-900 font-semibold">
                  {progress.percent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getPhaseColor(progress.phase)}`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {/* Count */}
              <p className="text-sm text-gray-600 mt-3">
                {progress.current.toLocaleString()} /{" "}
                {progress.total.toLocaleString()} {getItemLabel(progress.phase)}
              </p>

              {/* Time info */}
              <div className="flex justify-between text-sm text-gray-500 mt-2">
                <span>Elapsed: {formatTime(progress.elapsedMs)}</span>
                <span>ETA: {eta}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancel Import
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportProgressModal;
