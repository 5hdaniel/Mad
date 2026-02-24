/**
 * Offline Fallback Component
 * Displays a user-friendly message when network services are unavailable.
 *
 * Features:
 * - Shows offline status with helpful message
 * - Provides retry functionality
 * - Includes contact support option
 * - Allows access to cached/local data when available
 */

import React, { useState, useEffect } from "react";
import logger from '../utils/logger';

const SUPPORT_EMAIL = "support@keeprcompliance.com";

interface OfflineFallbackProps {
  /** Whether the app is currently offline */
  isOffline: boolean;
  /** Whether a network operation is in progress */
  isRetrying?: boolean;
  /** Error message if any */
  error?: string | null;
  /** Callback when user clicks retry */
  onRetry?: () => Promise<void>;
  /** Whether to show as full screen overlay or inline banner */
  mode?: "fullscreen" | "banner";
  /** Children to show when online (for banner mode) */
  children?: React.ReactNode;
}

function OfflineFallback({
  isOffline,
  isRetrying = false,
  error,
  onRetry,
  mode = "fullscreen",
  children,
}: OfflineFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [localRetrying, setLocalRetrying] = useState(false);

  // Sync retrying state
  useEffect(() => {
    if (!isRetrying) {
      setLocalRetrying(false);
    }
  }, [isRetrying]);

  const handleRetry = async () => {
    if (onRetry) {
      setLocalRetrying(true);
      try {
        await onRetry();
      } finally {
        setLocalRetrying(false);
      }
    } else {
      // Default retry: refresh the page
      window.location.reload();
    }
  };

  const handleContactSupport = async () => {
    try {
      // Try to get diagnostic info
      let diagnostics = "";
      if (window.api?.system?.getDiagnostics) {
        try {
          const result = await window.api.system.getDiagnostics();
          if (result.success && result.diagnostics) {
            diagnostics = `\n\nSystem Info:\n${result.diagnostics}`;
          }
        } catch {
          // Ignore diagnostics error
        }
      }

      const errorDetails = `Connection Issue: ${error || "Network unavailable"}${diagnostics}`;

      if (window.api?.system?.contactSupport) {
        await window.api.system.contactSupport(errorDetails);
      } else if (window.api?.shell?.openExternal) {
        const subject = encodeURIComponent("Connection Issue Report");
        const body = encodeURIComponent(
          `Hi,\n\nI'm experiencing connection issues with the Keepr app.\n\n${errorDetails}\n\nPlease help me resolve this issue.\n\nThank you.`,
        );
        await window.api.shell.openExternal(
          `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
        );
      } else {
        // Fallback: copy support email to clipboard
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
        alert(`Support email copied to clipboard: ${SUPPORT_EMAIL}`);
      }
    } catch (err) {
      logger.error("[OfflineFallback] Failed to open support email:", err);
    }
  };

  const retrying = isRetrying || localRetrying;

  // Banner mode - show a dismissible banner at top
  if (mode === "banner") {
    if (!isOffline) {
      return <>{children}</>;
    }

    return (
      <>
        {/* Offline Banner */}
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              {/* Offline Icon */}
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
                  Some features may be limited. Your data is safe.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-200 hover:bg-yellow-300 rounded-md transition-colors disabled:opacity-50"
              >
                {retrying ? "Checking..." : "Retry"}
              </button>
            </div>
          </div>
        </div>
        {children}
      </>
    );
  }

  // Fullscreen mode - show when completely offline
  if (!isOffline) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Offline Icon */}
        <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You're Offline
        </h1>

        {/* Description */}
        <p className="text-gray-600 mb-6">
          It looks like you've lost your internet connection. Please check your
          network settings and try again.
        </p>

        {/* Error Details */}
        {error && (
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
            >
              <span>{showDetails ? "Hide" : "Show"} details</span>
              <svg
                className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showDetails && (
              <div className="mt-2 p-3 bg-red-50 rounded-lg text-left">
                <p className="text-sm text-red-700 font-mono">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Checking...
              </>
            ) : (
              <>
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
                Try Again
              </>
            )}
          </button>
          <button
            onClick={handleContactSupport}
            className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Contact Support
          </button>
        </div>

        {/* Support Info */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Need immediate help?</p>
          <div className="flex flex-col items-center gap-2 text-sm">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-blue-600 hover:underline flex items-center gap-1"
              onClick={(e) => {
                e.preventDefault();
                handleContactSupport();
              }}
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OfflineFallback;
