import React, { useState, useEffect, useCallback, useRef } from "react";

import type { OAuthProvider } from "../../electron/types/models";

interface SystemHealthMonitorProps {
  userId: string;
  provider: OAuthProvider;
  hidden?: boolean;
  /** Callback to open Settings modal - used for reconnect actions */
  onOpenSettings?: () => void;
}

interface SystemIssue {
  severity?: "error" | "warning" | "info";
  title?: string;
  message?: string;
  userMessage?: string;
  details?: string;
  action?: string;
  actionHandler?: string;
}

/**
 * System Health Monitor
 * Displays warnings and errors for lost permissions and connections
 *
 * Features:
 * - Monitors Full Disk Access permission
 * - Monitors Contacts permission
 * - Monitors Google/Microsoft OAuth connections
 * - Shows dismissible notifications
 * - Provides action buttons to fix issues
 */
function SystemHealthMonitor({
  userId,
  provider,
  hidden = false,
  onOpenSettings,
}: SystemHealthMonitorProps) {
  const [issues, setIssues] = useState<SystemIssue[]>([]);
  const [dismissed, setDismissed] = useState(new Set<number>());
  const checkingRef = useRef(false);

  const checkSystemHealth = useCallback(async () => {
    if (checkingRef.current) return;

    checkingRef.current = true;

    try {
      // Pass provider so we only check the relevant OAuth connection
      const result = await window.api.system.healthCheck(userId, provider);

      if (!result.healthy && result.issues && Array.isArray(result.issues)) {
        setIssues(result.issues as SystemIssue[]);
      }
    } catch (error) {
      console.error("[SystemHealthMonitor] System health check failed:", error);
    } finally {
      checkingRef.current = false;
    }
  }, [userId, provider]);

  useEffect(() => {
    // Delay initial check by 3 seconds to allow OutlookService to initialize
    // This prevents the "not connected" warning from flashing on startup
    const initialTimeout = setTimeout(() => {
      checkSystemHealth();
    }, 3000);

    // Check every 2 minutes after the initial check
    const interval = setInterval(checkSystemHealth, 2 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkSystemHealth]);

  const handleDismiss = (issueIndex: number) => {
    setDismissed((prev) => new Set([...prev, issueIndex]));
  };

  const handleAction = async (issue: SystemIssue, issueIndex: number) => {
    switch (issue.actionHandler) {
      case "open-system-settings":
        if (window.api?.system?.openPrivacyPane) {
          await window.api.system.openPrivacyPane("fullDiskAccess");
        }
        break;

      case "connect-google":
      case "reconnect-google":
      case "connect-microsoft":
      case "reconnect-microsoft":
        // Navigate to Settings and scroll to Email Connections section
        // This is more reliable than triggering OAuth directly from the notification
        if (onOpenSettings) {
          onOpenSettings();
          // Scroll to email connections section after modal opens
          setTimeout(() => {
            const emailSection = document.getElementById("email-connections");
            if (emailSection) {
              emailSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 100);
          handleDismiss(issueIndex);
        } else {
          // Fallback: Try OAuth directly if Settings callback not available
          try {
            const isGoogle = issue.actionHandler === "connect-google" || issue.actionHandler === "reconnect-google";
            const result = isGoogle
              ? await window.api.auth.googleConnectMailbox(userId)
              : await window.api.auth.microsoftConnectMailbox(userId);
            if (result.success) {
              const cleanup = isGoogle
                ? window.api.onGoogleMailboxConnected(async (connectionResult) => {
                    if (connectionResult.success) {
                      await checkSystemHealth();
                    }
                    if (cleanup) cleanup();
                  })
                : window.api.onMicrosoftMailboxConnected((connectionResult) => {
                    if (connectionResult.success) {
                      checkSystemHealth();
                      handleDismiss(issueIndex);
                    }
                    cleanup();
                  });
            }
          } catch (error) {
            console.error(
              `[SystemHealthMonitor] ${issue.actionHandler} failed:`,
              error,
            );
          }
        }
        break;

      case "retry":
        await checkSystemHealth();
        handleDismiss(issueIndex);
        break;

      default:
        console.warn(
          "[SystemHealthMonitor] Unknown action handler:",
          issue.actionHandler,
        );
    }
  };

  const visibleIssues = issues.filter((_, index) => !dismissed.has(index));

  // Hide during onboarding tour or when no issues
  if (hidden || visibleIssues.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-16 right-4 z-50 space-y-3"
      style={{ maxWidth: "420px" }}
    >
      {visibleIssues.map((issue, _index) => {
        const originalIndex = issues.findIndex(
          (i, idx) => i === issue && !dismissed.has(idx),
        );
        const severity: "error" | "warning" | "info" =
          issue.severity || "warning";

        // Severity styling
        const severityClasses: Record<"error" | "warning" | "info", string> = {
          error: "bg-red-50 border-red-200",
          warning: "bg-yellow-50 border-yellow-200",
          info: "bg-blue-50 border-blue-200",
        };

        const iconClasses: Record<"error" | "warning" | "info", string> = {
          error: "text-red-600",
          warning: "text-yellow-600",
          info: "text-blue-600",
        };

        const buttonClasses: Record<"error" | "warning" | "info", string> = {
          error: "bg-red-600 hover:bg-red-700",
          warning: "bg-yellow-600 hover:bg-yellow-700",
          info: "bg-blue-600 hover:bg-blue-700",
        };

        return (
          <div
            key={originalIndex}
            className={`rounded-lg shadow-lg border-2 p-4 ${severityClasses[severity]} animate-slide-in-right`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 ${iconClasses[severity]}`}>
                {severity === "error" && (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {severity === "warning" && (
                  <svg
                    className="w-6 h-6"
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
                )}
                {severity === "info" && (
                  <svg
                    className="w-6 h-6"
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
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {issue.title || issue.userMessage}
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  {issue.message || issue.userMessage}
                </p>
                {issue.details && (
                  <details className="text-xs text-gray-600 mb-2">
                    <summary className="cursor-pointer hover:text-gray-800">
                      Technical details
                    </summary>
                    <p className="mt-1 font-mono bg-gray-100 p-2 rounded">
                      {issue.details}
                    </p>
                  </details>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  {issue.action && (
                    <button
                      onClick={() => handleAction(issue, originalIndex)}
                      className={`px-3 py-1.5 text-xs font-medium text-white rounded-md shadow-sm transition-colors ${buttonClasses[severity]}`}
                    >
                      {issue.action}
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(originalIndex)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => handleDismiss(originalIndex)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
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
          </div>
        );
      })}

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default SystemHealthMonitor;
