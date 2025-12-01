/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI instead of crashing the app.
 *
 * Features:
 * - Catches JavaScript errors in child component tree
 * - Displays user-friendly error message
 * - Provides retry and contact support options
 * - Logs errors for debugging
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    this.setState({ errorInfo });

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
    });
  };

  handleContactSupport = async (): Promise<void> => {
    try {
      // Open support email
      const supportEmail = 'support@magicaudit.com';
      const subject = encodeURIComponent('App Error Report');
      const body = encodeURIComponent(
        `Hi,\n\nI encountered an error in the Magic Audit app.\n\n` +
        `Error: ${this.state.error?.message || 'Unknown error'}\n\n` +
        `Please help me resolve this issue.\n\n` +
        `Thank you.`
      );

      if (window.api?.shell?.openExternal) {
        await window.api.shell.openExternal(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
      } else {
        // Fallback: copy support email to clipboard
        await navigator.clipboard.writeText(supportEmail);
        alert(`Support email copied to clipboard: ${supportEmail}`);
      }
    } catch (err) {
      console.error('[ErrorBoundary] Failed to open support email:', err);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
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
              We encountered an unexpected error. Don't worry, your data is safe.
              You can try again or contact support if the problem persists.
            </p>

            {/* Error Details (collapsible) */}
            {this.state.error && (
              <details className="text-left mb-6 bg-gray-50 rounded-lg p-4">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                  Technical Details
                </summary>
                <div className="mt-2 text-xs font-mono text-gray-600 overflow-auto max-h-32">
                  <p className="font-semibold text-red-600">{this.state.error.message}</p>
                  {this.state.error.stack && (
                    <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
                  )}
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
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg shadow-sm transition-colors"
              >
                Contact Support
              </button>
            </div>

            {/* Support Info */}
            <p className="mt-6 text-xs text-gray-500">
              Need help? Email us at{' '}
              <a
                href="mailto:support@magicaudit.com"
                className="text-blue-600 hover:underline"
              >
                support@magicaudit.com
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
