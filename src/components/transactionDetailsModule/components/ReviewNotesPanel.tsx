/**
 * Review Notes Panel Component
 *
 * Displays broker feedback when status is 'needs_changes'.
 * Part of BACKLOG-391: Submit for Review UI.
 */
import React from "react";

interface ReviewNotesPanelProps {
  reviewNotes: string;
  reviewedAt?: Date | string;
  onResubmit?: () => void;
}

export function ReviewNotesPanel({
  reviewNotes,
  reviewedAt,
  onResubmit,
}: ReviewNotesPanelProps): React.ReactElement {
  const formattedDate = reviewedAt
    ? new Date(reviewedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        {/* Warning Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-orange-800 mb-1">
            Changes Requested by Broker
          </h4>
          <p className="text-sm text-orange-700 whitespace-pre-wrap mb-2">
            {reviewNotes}
          </p>
          {formattedDate && (
            <p className="text-xs text-orange-600">
              Reviewed on {formattedDate}
            </p>
          )}

          {/* Resubmit Button */}
          {onResubmit && (
            <button
              onClick={onResubmit}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Resubmit for Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewNotesPanel;
