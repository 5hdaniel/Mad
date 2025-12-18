import React, { Component, ReactNode } from 'react';
import { LLMErrorDisplay, LLMErrorType } from './LLMErrorDisplay';

interface LLMErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  fallback?: ReactNode;
}

interface LLMErrorBoundaryState {
  hasError: boolean;
  errorType: LLMErrorType;
  errorMessage?: string;
}

export class LLMErrorBoundary extends Component<LLMErrorBoundaryProps, LLMErrorBoundaryState> {
  constructor(props: LLMErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorType: 'unknown',
    };
  }

  static getDerivedStateFromError(error: Error): LLMErrorBoundaryState {
    // Check if this is an LLM error
    const errorType = LLMErrorBoundary.extractErrorType(error);
    return {
      hasError: true,
      errorType,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('[LLMErrorBoundary] Caught error:', error, errorInfo);
  }

  static extractErrorType(error: Error): LLMErrorType {
    // Check for LLMError type property
    if ('type' in error && typeof (error as { type: unknown }).type === 'string') {
      return (error as { type: string }).type as LLMErrorType;
    }

    // Infer from message
    const message = error.message.toLowerCase();
    if (message.includes('api key') || message.includes('authentication')) {
      return 'invalid_api_key';
    }
    if (message.includes('rate limit')) {
      return 'rate_limit';
    }
    if (message.includes('quota') || message.includes('budget')) {
      return 'quota_exceeded';
    }
    if (message.includes('consent')) {
      return 'consent_required';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }

    return 'unknown';
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorType: 'unknown', errorMessage: undefined });
    this.props.onRetry?.();
  };

  handleDismiss = (): void => {
    this.setState({ hasError: false, errorType: 'unknown', errorMessage: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <LLMErrorDisplay
          errorType={this.state.errorType}
          message={this.state.errorMessage}
          onRetry={this.handleRetry}
          onOpenSettings={this.props.onOpenSettings}
          onDismiss={this.handleDismiss}
        />
      );
    }

    return this.props.children;
  }
}

// Hook for programmatic error handling (not boundary)
export function useLLMErrorHandler() {
  const [error, setError] = React.useState<{
    type: LLMErrorType;
    message?: string;
  } | null>(null);

  const handleError = React.useCallback((err: unknown) => {
    if (err instanceof Error) {
      const type = LLMErrorBoundary.extractErrorType(err);
      setError({ type, message: err.message });
    } else {
      setError({ type: 'unknown', message: String(err) });
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}

export default LLMErrorBoundary;
