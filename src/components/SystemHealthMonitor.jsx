import React, { useState, useEffect } from 'react';

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
function SystemHealthMonitor({ userId, provider }) {
  const [issues, setIssues] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkSystemHealth();

    // Check every 2 minutes
    const interval = setInterval(checkSystemHealth, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, provider]);

  // Listen for Microsoft login completion events
  useEffect(() => {
    if (window.api?.onMicrosoftLoginComplete) {
      const handleLoginComplete = (result) => {
        console.log('[SystemHealthMonitor] Microsoft login complete:', result);
        if (result.success) {
          // Re-check health after successful authentication
          checkSystemHealth();
        }
      };

      window.api.onMicrosoftLoginComplete(handleLoginComplete);
    }
  }, [checkSystemHealth]);

  const checkSystemHealth = async () => {
    if (checking) return;

    setChecking(true);
    try {
      // Pass provider so we only check the relevant OAuth connection
      console.log('[SystemHealthMonitor] Checking health with provider:', provider);
      const result = await window.api.system.healthCheck(userId, provider);

      console.log('[SystemHealthMonitor] Health check result:', result);
      if (result.success && result.issues) {
        setIssues(result.issues);
      }
    } catch (error) {
      console.error('System health check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleDismiss = (issueIndex) => {
    setDismissed((prev) => new Set([...prev, issueIndex]));
  };

  const handleAction = async (issue, issueIndex) => {
    switch (issue.actionHandler) {
      case 'open-system-settings':
        if (window.api?.system?.openPrivacyPane) {
          await window.api.system.openPrivacyPane('fullDiskAccess');
        }
        break;

      case 'connect-google':
      case 'reconnect-google':
        // Trigger Google OAuth re-authentication
        try {
          const result = await window.api.auth.googleLogin();
          if (result.success) {
            // Re-check health after successful auth
            await checkSystemHealth();
            handleDismiss(issueIndex);
          }
        } catch (error) {
          console.error('Google re-authentication failed:', error);
        }
        break;

      case 'connect-microsoft':
      case 'reconnect-microsoft':
        // Trigger Microsoft OAuth re-authentication
        try {
          const result = await window.api.auth.microsoftLogin();
          if (result.success && result.authUrl) {
            // Open auth URL in browser
            if (window.api?.shell?.openExternal) {
              await window.api.shell.openExternal(result.authUrl);
            }
            // Don't dismiss immediately - wait for login-complete event
            // The event listener will re-check health when authentication completes
          } else {
            console.error('Microsoft login failed:', result.error);
          }
        } catch (error) {
          console.error('Microsoft re-authentication failed:', error);
        }
        break;

      case 'retry':
        await checkSystemHealth();
        handleDismiss(issueIndex);
        break;

      default:
        console.warn('Unknown action handler:', issue.actionHandler);
    }
  };

  const visibleIssues = issues.filter((_, index) => !dismissed.has(index));

  if (visibleIssues.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3" style={{ maxWidth: '420px' }}>
      {visibleIssues.map((issue, index) => {
        const originalIndex = issues.findIndex((i, idx) => i === issue && !dismissed.has(idx));
        const severity = issue.severity || 'warning';

        // Severity styling
        const severityClasses = {
          error: 'bg-red-50 border-red-200',
          warning: 'bg-yellow-50 border-yellow-200',
          info: 'bg-blue-50 border-blue-200',
        };

        const iconClasses = {
          error: 'text-red-600',
          warning: 'text-yellow-600',
          info: 'text-blue-600',
        };

        const buttonClasses = {
          error: 'bg-red-600 hover:bg-red-700',
          warning: 'bg-yellow-600 hover:bg-yellow-700',
          info: 'bg-blue-600 hover:bg-blue-700',
        };

        return (
          <div
            key={originalIndex}
            className={`rounded-lg shadow-lg border-2 p-4 ${severityClasses[severity]} animate-slide-in-right`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 ${iconClasses[severity]}`}>
                {severity === 'error' && (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {severity === 'warning' && (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
                {severity === 'info' && (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <summary className="cursor-pointer hover:text-gray-800">Technical details</summary>
                    <p className="mt-1 font-mono bg-gray-100 p-2 rounded">{issue.details}</p>
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
