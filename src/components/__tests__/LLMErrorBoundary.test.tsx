import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LLMErrorBoundary, useLLMErrorHandler } from '../LLMErrorBoundary';
import { LLMErrorDisplay, LLMErrorType } from '../LLMErrorDisplay';

// Component that throws an error
const ThrowError: React.FC<{ error?: Error }> = ({ error }) => {
  if (error) {
    throw error;
  }
  return <div>Content loaded</div>;
};

describe('LLMErrorDisplay', () => {
  describe('error type display', () => {
    const errorTypes: LLMErrorType[] = [
      'rate_limit',
      'invalid_api_key',
      'quota_exceeded',
      'context_length',
      'content_filter',
      'network',
      'timeout',
      'consent_required',
      'unknown',
    ];

    it.each(errorTypes)('should render correctly for %s error type', (errorType) => {
      render(<LLMErrorDisplay errorType={errorType} />);
      // Should render without crashing
      expect(document.querySelector('.llm-error-display')).toBeInTheDocument();
    });

    it('should display custom message when provided', () => {
      render(<LLMErrorDisplay errorType="unknown" message="Custom error message" />);
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should show retry button for rate_limit error', () => {
      const onRetry = jest.fn();
      render(<LLMErrorDisplay errorType="rate_limit" onRetry={onRetry} />);
      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    it('should show settings button for invalid_api_key error', () => {
      const onOpenSettings = jest.fn();
      render(<LLMErrorDisplay errorType="invalid_api_key" onOpenSettings={onOpenSettings} />);
      const settingsButton = screen.getByText('Open Settings');
      expect(settingsButton).toBeInTheDocument();
      fireEvent.click(settingsButton);
      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('should show dismiss button when onDismiss provided', () => {
      const onDismiss = jest.fn();
      render(<LLMErrorDisplay errorType="unknown" onDismiss={onDismiss} />);
      const dismissButton = screen.getByText('Dismiss');
      expect(dismissButton).toBeInTheDocument();
      fireEvent.click(dismissButton);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should not show retry button when onRetry not provided', () => {
      render(<LLMErrorDisplay errorType="rate_limit" />);
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
  });
});

describe('LLMErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  describe('error catching', () => {
    it('should render children when no error', () => {
      render(
        <LLMErrorBoundary>
          <div>Test content</div>
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch errors and display error UI', () => {
      const error = new Error('Test error');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(document.querySelector('.llm-error-display')).toBeInTheDocument();
    });

    it('should use custom fallback when provided', () => {
      const error = new Error('Test error');
      render(
        <LLMErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    });
  });

  describe('error type extraction', () => {
    it('should extract type from LLMError-like object', () => {
      const error = new Error('API error') as Error & { type: string };
      error.type = 'rate_limit';
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Too Many Requests')).toBeInTheDocument();
    });

    it('should infer invalid_api_key from message', () => {
      const error = new Error('Invalid API key provided');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Invalid API Key')).toBeInTheDocument();
    });

    it('should infer rate_limit from message', () => {
      const error = new Error('Rate limit exceeded');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Too Many Requests')).toBeInTheDocument();
    });

    it('should infer quota_exceeded from message', () => {
      const error = new Error('Budget quota exceeded');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Usage Limit Reached')).toBeInTheDocument();
    });

    it('should infer consent_required from message', () => {
      const error = new Error('User consent required');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Consent Required')).toBeInTheDocument();
    });

    it('should infer timeout from message', () => {
      const error = new Error('Request timeout');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Request Timeout')).toBeInTheDocument();
    });

    it('should infer network from message', () => {
      const error = new Error('Network connection failed');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });

    it('should default to unknown for unrecognized errors', () => {
      const error = new Error('Some random error');
      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );
      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    });
  });

  describe('recovery actions', () => {
    it('should call onRetry when retry button clicked', () => {
      const onRetry = jest.fn();
      const error = new Error('Network error');

      render(
        <LLMErrorBoundary onRetry={onRetry}>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    it('should call onOpenSettings when settings button clicked', () => {
      const onOpenSettings = jest.fn();
      const error = new Error('Invalid API key');

      render(
        <LLMErrorBoundary onOpenSettings={onOpenSettings}>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );

      const settingsButton = screen.getByText('Open Settings');
      fireEvent.click(settingsButton);
      expect(onOpenSettings).toHaveBeenCalled();
    });

    it('should have dismiss button available', () => {
      const error = new Error('Some error');

      render(
        <LLMErrorBoundary>
          <ThrowError error={error} />
        </LLMErrorBoundary>
      );

      const dismissButton = screen.getByText('Dismiss');
      expect(dismissButton).toBeInTheDocument();
      // Click dismiss - this resets internal state
      fireEvent.click(dismissButton);
    });
  });
});

describe('useLLMErrorHandler', () => {
  const TestComponent: React.FC = () => {
    const { error, handleError, clearError } = useLLMErrorHandler();

    return (
      <div>
        {error ? (
          <div>
            <span data-testid="error-type">{error.type}</span>
            <span data-testid="error-message">{error.message}</span>
            <button onClick={clearError}>Clear</button>
          </div>
        ) : (
          <button onClick={() => handleError(new Error('Test error'))}>Trigger Error</button>
        )}
      </div>
    );
  };

  it('should handle errors programmatically', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Trigger Error'));
    expect(screen.getByTestId('error-type')).toHaveTextContent('unknown');
    expect(screen.getByTestId('error-message')).toHaveTextContent('Test error');
  });

  it('should clear errors', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Trigger Error'));
    expect(screen.getByTestId('error-type')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear'));
    expect(screen.queryByTestId('error-type')).not.toBeInTheDocument();
  });

  it('should extract error type from Error objects', () => {
    const TestWithType: React.FC = () => {
      const { error, handleError } = useLLMErrorHandler();
      return (
        <div>
          {error ? (
            <span data-testid="error-type">{error.type}</span>
          ) : (
            <button onClick={() => handleError(new Error('Rate limit exceeded'))}>
              Trigger
            </button>
          )}
        </div>
      );
    };

    render(<TestWithType />);
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByTestId('error-type')).toHaveTextContent('rate_limit');
  });

  it('should handle non-Error objects', () => {
    const TestNonError: React.FC = () => {
      const { error, handleError } = useLLMErrorHandler();
      return (
        <div>
          {error ? (
            <span data-testid="error-message">{error.message}</span>
          ) : (
            <button onClick={() => handleError('String error')}>Trigger</button>
          )}
        </div>
      );
    };

    render(<TestNonError />);
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByTestId('error-message')).toHaveTextContent('String error');
  });
});
