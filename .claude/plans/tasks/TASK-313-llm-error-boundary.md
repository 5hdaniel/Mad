# Task TASK-313: LLM Error Boundary Component

## Goal

Create a React error boundary component that handles LLM API failures gracefully, displaying user-friendly messages and providing recovery options.

## Non-Goals

- Do NOT implement full LLM settings UI (BACKLOG-078)
- Do NOT add retry logic (that's in the service layer)
- Do NOT handle non-LLM errors

## Deliverables

1. New file: `src/components/LLMErrorBoundary.tsx` - Error boundary component
2. New file: `src/components/LLMErrorDisplay.tsx` - Error display component

## Acceptance Criteria

- [ ] Catches LLM-related errors in child components
- [ ] Displays user-friendly error messages
- [ ] Provides appropriate action buttons (retry, settings, dismiss)
- [ ] Different displays for different error types
- [ ] npm run type-check passes
- [ ] npm run lint passes

## Implementation Notes

### Error Display Component

Create `src/components/LLMErrorDisplay.tsx`:

```tsx
import React from 'react';

export type LLMErrorType =
  | 'rate_limit'
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'context_length'
  | 'content_filter'
  | 'network'
  | 'timeout'
  | 'consent_required'
  | 'unknown';

interface LLMErrorDisplayProps {
  errorType: LLMErrorType;
  message?: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
  onDismiss?: () => void;
}

const ERROR_CONFIGS: Record<LLMErrorType, {
  title: string;
  description: string;
  showRetry: boolean;
  showSettings: boolean;
  icon: string;
}> = {
  rate_limit: {
    title: 'Too Many Requests',
    description: 'Please wait a moment before trying again.',
    showRetry: true,
    showSettings: false,
    icon: '⏱️',
  },
  invalid_api_key: {
    title: 'Invalid API Key',
    description: 'Your API key appears to be invalid. Please check your settings.',
    showRetry: false,
    showSettings: true,
    icon: '🔑',
  },
  quota_exceeded: {
    title: 'Usage Limit Reached',
    description: 'You have reached your monthly usage limit.',
    showRetry: false,
    showSettings: true,
    icon: '📊',
  },
  context_length: {
    title: 'Content Too Long',
    description: 'The content is too long to process. Try with fewer emails.',
    showRetry: false,
    showSettings: false,
    icon: '📏',
  },
  content_filter: {
    title: 'Content Filtered',
    description: 'Some content was filtered by the AI provider.',
    showRetry: false,
    showSettings: false,
    icon: '🚫',
  },
  network: {
    title: 'Connection Error',
    description: 'Could not connect to the AI service. Check your internet connection.',
    showRetry: true,
    showSettings: false,
    icon: '🌐',
  },
  timeout: {
    title: 'Request Timeout',
    description: 'The request took too long. Please try again.',
    showRetry: true,
    showSettings: false,
    icon: '⏰',
  },
  consent_required: {
    title: 'Consent Required',
    description: 'Please enable AI features in settings to continue.',
    showRetry: false,
    showSettings: true,
    icon: '✅',
  },
  unknown: {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Please try again.',
    showRetry: true,
    showSettings: false,
    icon: '❓',
  },
};

export const LLMErrorDisplay: React.FC<LLMErrorDisplayProps> = ({
  errorType,
  message,
  onRetry,
  onOpenSettings,
  onDismiss,
}) => {
  const config = ERROR_CONFIGS[errorType] ?? ERROR_CONFIGS.unknown;

  return (
    <div className="llm-error-display">
      <div className="llm-error-icon">{config.icon}</div>
      <div className="llm-error-content">
        <h4 className="llm-error-title">{config.title}</h4>
        <p className="llm-error-description">
          {message ?? config.description}
        </p>
      </div>
      <div className="llm-error-actions">
        {config.showRetry && onRetry && (
          <button
            className="llm-error-btn llm-error-btn-primary"
            onClick={onRetry}
          >
            Try Again
          </button>
        )}
        {config.showSettings && onOpenSettings && (
          <button
            className="llm-error-btn llm-error-btn-secondary"
            onClick={onOpenSettings}
          >
            Open Settings
          </button>
        )}
        {onDismiss && (
          <button
            className="llm-error-btn llm-error-btn-ghost"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

// Styles (add to component or CSS file)
export const llmErrorStyles = `
.llm-error-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: var(--bg-warning, #FEF3C7);
  border: 1px solid var(--border-warning, #F59E0B);
  border-radius: 8px;
  text-align: center;
  max-width: 400px;
  margin: 16px auto;
}

.llm-error-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.llm-error-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.llm-error-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

.llm-error-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.llm-error-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
}

.llm-error-btn-primary {
  background: var(--btn-primary, #3B82F6);
  color: white;
}

.llm-error-btn-secondary {
  background: var(--btn-secondary, #E5E7EB);
  color: var(--text-primary);
}

.llm-error-btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
`;
```

### Error Boundary Component

Create `src/components/LLMErrorBoundary.tsx`:

```tsx
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

export class LLMErrorBoundary extends Component<
  LLMErrorBoundaryProps,
  LLMErrorBoundaryState
> {
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
    if ('type' in error && typeof (error as any).type === 'string') {
      return (error as any).type as LLMErrorType;
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
```

### Usage Example

```tsx
// In a component that uses LLM features
import { LLMErrorBoundary } from './LLMErrorBoundary';
import { useNavigate } from 'react-router-dom';

function TransactionAnalysis() {
  const navigate = useNavigate();

  return (
    <LLMErrorBoundary
      onRetry={() => window.location.reload()}
      onOpenSettings={() => navigate('/settings/llm')}
    >
      <AnalysisContent />
    </LLMErrorBoundary>
  );
}
```

## Integration Notes

- Imports from: React
- Exports to: Components using LLM features
- Used by: Future BACKLOG-078 UI components
- Depends on: TASK-306 (types)

## Do / Don't

### Do:
- Provide clear, actionable error messages
- Offer appropriate recovery options per error type
- Log errors for debugging
- Allow dismissal for non-critical errors

### Don't:
- Don't show technical error details to users
- Don't catch non-LLM errors
- Don't auto-retry without user action

## When to Stop and Ask

- If error messages need localization
- If design system components should be used
- If additional error types needed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Error boundary catches errors
  - Correct error type extraction
  - Action buttons work

### Coverage

- Coverage impact: >70%

### CI Requirements

- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-313-llm-error-boundary`
- **Title**: `feat(ui): add LLM error boundary component`
- **Labels**: `ui`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-306

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] src/components/LLMErrorBoundary.tsx
- [ ] src/components/LLMErrorDisplay.tsx
- [ ] src/components/__tests__/LLMErrorBoundary.test.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Reviewer notes:**
