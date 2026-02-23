/**
 * OfflineBanner Component
 *
 * Displays a notification banner when the application is offline.
 * Provides retry and help options for the user.
 */

import React from "react";

interface OfflineBannerProps {
  isOnline: boolean;
  isChecking: boolean;
  onRetry: () => void;
}

export function OfflineBanner({
  isOnline,
  isChecking,
  onRetry,
}: OfflineBannerProps) {
  if (isOnline) return null;

  return (
    <div className="flex-shrink-0 bg-yellow-50 border-b border-yellow-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              You're offline
            </p>
            <p className="text-xs text-yellow-700">
              Some features may be limited. Your local data is still accessible.
            </p>
          </div>
        </div>
        <button
          onClick={onRetry}
          disabled={isChecking}
          className="px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-200 hover:bg-yellow-300 rounded-md transition-colors disabled:opacity-50"
        >
          {isChecking ? "Checking..." : "Retry"}
        </button>
      </div>
    </div>
  );
}
