/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI instead of crashing the app.
 *
 * Features:
 * - Catches JavaScript errors in child component tree
 * - Displays user-friendly error message
 * - Provides retry and contact support options
 * - Includes diagnostic data for support
 * - View and copy error report functionality
 * - Logs errors for debugging
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import logger from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  diagnostics: string | null;
  copiedToClipboard: boolean;
  showFullReport: boolean;
}

const SUPPORT_EMAIL = "magicauditwa@gmail.com";

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      diagnostics: null,
      copiedToClipboard: false,
      showFullReport: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo): Promise<void> {
    logger.error("[ErrorBoundary] Caught error:", error);
    logger.error("[ErrorBoundary] Error info:", errorInfo);

    this.setState({ errorInfo });

    // Fetch diagnostic information
    try {
      if (window.api?.system?.getDiagnostics) {
        const result = await window.api.system.getDiagnostics();
        if (result.success && result.diagnostics) {
          this.setState({ diagnostics: result.diagnostics });
        }
      }
    } catch (diagError) {
      logger.error("[ErrorBoundary] Failed to get diagnostics:", diagError);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      diagnostics: null,
      copiedToClipboard: false,
      showFullReport: false,
    });
  };

  getErrorReport = (): string => {
    const { error, errorInfo, diagnostics } = this.state;

    let report = `=== MAGIC AUDIT ERROR REPORT ===\n\n`;
    report += `TIMESTAMP: ${new Date().toISOString()}\n\n`;
    report += `ERROR:\n${error?.message || "Unknown error"}\n\n`;

    if (error?.stack) {
      report += `STACK TRACE:\n${error.stack}\n\n`;
    }

    if (errorInfo?.componentStack) {
      report += `COMPONENT STACK:\n${errorInfo.componentStack}\n\n`;
    }

    if (diagnostics) {
      report += `SYSTEM DIAGNOSTICS:\n${diagnostics}\n`;
    }

    return report;
  };

  handleCopyErrorReport = async (): Promise<void> => {
    try {
      const report = this.getErrorReport();
      await navigator.clipboard.writeText(report);
      this.setState({ copiedToClipboard: true });
      setTimeout(() => this.setState({ copiedToClipboard: false }), 3000);
    } catch (err) {
      logger.error("[ErrorBoundary] Failed to copy error report:", err);
    }
  };

  handleToggleFullReport = (): void => {
    this.setState((prev) => ({ showFullReport: !prev.showFullReport }));
  };

  handleContactSupport = async (): Promise<void> => {
    try {
      const { error, diagnostics } = this.state;

      // Build error details for email
      let errorDetails = `Error: ${error?.message || "Unknown error"}`;
      if (diagnostics) {
        // Include a shorter version in the email body
        errorDetails += `\n\nSystem Info:\n${diagnostics}`;
      }

      if (window.api?.system?.contactSupport) {
        await window.api.system.contactSupport(errorDetails);
      } else if (window.api?.shell?.openExternal) {
        const subject = encodeURIComponent("App Crash Report");
        const body = encodeURIComponent(
          `Hi,\n\nI encountered an error in the Magic Audit app.\n\n${errorDetails}\n\nPlease help me resolve this issue.\n\nThank you.`,
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
      logger.error("[ErrorBoundary] Failed to open support email:", err);
    }
  };

  renderFullReportModal(): ReactNode {
    const { showFullReport, copiedToClipboard } = this.state;

    if (!showFullReport) return null;

    const report = this.getErrorReport();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Error Report
            </h2>
            <button
              onClick={this.handleToggleFullReport}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 overflow-auto">
              {report}
            </pre>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={this.handleCopyErrorReport}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
            >
              {copiedToClipboard ? (
                <>
                  <svg
                    className="w-4 h-4 text-green-600"
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
                  Copied!
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              onClick={this.handleContactSupport}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
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
              Send to Support
            </button>
          </div>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { copiedToClipboard } = this.state;

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-red-600"
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

            {/* Error Title */}
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>

            {/* Error Description */}
            <p className="text-gray-600 mb-6">
              We encountered an unexpected error. Don't worry, your data is
              safe. You can try again or contact support if the problem
              persists.
            </p>

            {/* Error Details (collapsible) */}
            {this.state.error && (
              <details className="text-left mb-6 bg-gray-50 rounded-lg p-4">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                  Technical Details
                </summary>
                <div className="mt-2 text-xs font-mono text-gray-600 overflow-auto max-h-32">
                  <p className="font-semibold text-red-600 mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.diagnostics && (
                    <>
                      <p className="font-semibold text-gray-700 mt-3 mb-1">
                        System Info:
                      </p>
                      <pre className="whitespace-pre-wrap text-gray-500 text-[10px]">
                        {this.state.diagnostics}
                      </pre>
                    </>
                  )}
                </div>
                {/* View/Copy Buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={this.handleToggleFullReport}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors flex items-center justify-center gap-2"
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View Full Report
                  </button>
                  <button
                    onClick={this.handleCopyErrorReport}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    {copiedToClipboard ? (
                      <>
                        <svg
                          className="w-4 h-4 text-green-600"
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
                        Copied!
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleContactSupport}
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
            <p className="mt-6 text-xs text-gray-500">
              Need help? Email us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-blue-600 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>

          {/* Full Report Modal */}
          {this.renderFullReportModal()}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
