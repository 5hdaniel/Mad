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
  onOpenSettings?: (scrollTarget?: string) => void;
  onDismiss?: () => void;
}

const ERROR_CONFIGS: Record<
  LLMErrorType,
  {
    title: string;
    description: string;
    showRetry: boolean;
    showSettings: boolean;
    icon: string;
  }
> = {
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
        <p className="llm-error-description">{message ?? config.description}</p>
      </div>
      <div className="llm-error-actions">
        {config.showRetry && onRetry && (
          <button className="llm-error-btn llm-error-btn-primary" onClick={onRetry}>
            Try Again
          </button>
        )}
        {config.showSettings && onOpenSettings && (
          <button className="llm-error-btn llm-error-btn-secondary" onClick={() => onOpenSettings?.()}>
            Open Settings
          </button>
        )}
        {onDismiss && (
          <button className="llm-error-btn llm-error-btn-ghost" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default LLMErrorDisplay;
