import {
  LLMConfig,
  LLMResponse,
  LLMMessage,
  LLMError,
  LLMErrorType,
  LLMProvider,
} from './types';

/**
 * Abstract base class for LLM provider implementations.
 * Provides common functionality and defines the contract for specific providers.
 */
export abstract class BaseLLMService {
  protected readonly provider: LLMProvider;
  protected readonly defaultTimeout = 30000; // 30 seconds

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * Complete a chat conversation with the LLM.
   * Must be implemented by provider-specific classes.
   */
  abstract complete(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse>;

  /**
   * Validate an API key by making a minimal API call.
   * Must be implemented by provider-specific classes.
   */
  abstract validateApiKey(apiKey: string): Promise<boolean>;

  /**
   * Get the provider name for this service.
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Create a standardized error from provider-specific errors.
   * Subclasses should call this to create consistent error objects.
   */
  protected createError(
    message: string,
    type: LLMErrorType,
    statusCode?: number,
    retryable: boolean = false,
    retryAfterMs?: number
  ): LLMError {
    return new LLMError(
      message,
      type,
      this.provider,
      statusCode,
      retryable,
      retryAfterMs
    );
  }

  /**
   * Map HTTP status codes to error types.
   */
  protected mapStatusToErrorType(status: number): LLMErrorType {
    switch (status) {
      case 401:
        return 'invalid_api_key';
      case 429:
        return 'rate_limit';
      case 402:
      case 403:
        return 'quota_exceeded';
      case 400:
        return 'context_length'; // Often indicates token limit
      default:
        return 'unknown';
    }
  }

  /**
   * Check if an error is retryable.
   */
  protected isRetryableError(type: LLMErrorType): boolean {
    return ['rate_limit', 'network', 'timeout'].includes(type);
  }

  /**
   * Log LLM operation (for debugging/monitoring).
   * Override in subclasses for custom logging.
   */
  protected log(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void {
    const logMessage = `[LLM:${this.provider}] ${message}`;
    switch (level) {
      case 'info':
        console.log(logMessage, data ?? '');
        break;
      case 'warn':
        console.warn(logMessage, data ?? '');
        break;
      case 'error':
        console.error(logMessage, data ?? '');
        break;
    }
  }

  /**
   * Build a simple completion prompt from a single user message.
   * Convenience method for simple use cases.
   */
  protected buildSimplePrompt(
    systemPrompt: string,
    userMessage: string
  ): LLMMessage[] {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
  }
}
