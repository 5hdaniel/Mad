import React from "react";

interface AIStatusCardProps {
  pendingCount: number;
  onViewPending: () => void;
  isLoading?: boolean;
}

/**
 * AIStatusCard Component
 *
 * Displays the AI detection status on the dashboard, showing the count
 * of pending auto-detected transactions awaiting user review.
 *
 * - Shows pending count with "Review Now" button when items exist
 * - Shows "All Caught Up" message when no pending items
 * - Handles loading state gracefully
 */
export function AIStatusCard({
  pendingCount,
  onViewPending,
  isLoading = false,
}: AIStatusCardProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        className="bg-gray-50 border border-gray-200 rounded-xl p-4"
        data-testid="ai-status-card-loading"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Zero state - All caught up
  if (pendingCount === 0) {
    return (
      <div
        className="bg-gray-50 border border-gray-200 rounded-xl p-4"
        data-testid="ai-status-card-empty"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">
              All Caught Up
            </h3>
            <p className="text-xs text-gray-500">
              No transactions awaiting review. We&apos;ll notify you when new
              ones are detected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pending items state
  return (
    <div
      className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 shadow-md"
      data-testid="ai-status-card-pending"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Magic wand / sparkles icon */}
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              AI Transaction Detection
            </h3>
            <p className="text-xs text-indigo-700">
              {pendingCount} transaction{pendingCount !== 1 ? "s" : ""} awaiting
              review
            </p>
          </div>
        </div>
        <button
          onClick={onViewPending}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          data-testid="ai-status-review-button"
        >
          Review Now
        </button>
      </div>
    </div>
  );
}

export default AIStatusCard;
