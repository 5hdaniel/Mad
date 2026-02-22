/**
 * Generic retry utility with exponential backoff
 * TASK-2044: Used for login auth retry; designed to be reusable for TASK-2045
 *
 * Features:
 * - Configurable max retries, base delay, and max delay
 * - Exponential backoff with jitter
 * - Error classification (retryable vs non-retryable)
 * - onRetry callback for progress reporting
 * - Abortable via AbortSignal
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth, default: 10000) */
  maxDelayMs: number;
  /** Error codes/types that should trigger a retry */
  retryableErrors: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR", "UNKNOWN_ERROR"],
};

/**
 * Determines if an error is retryable based on the configured error codes.
 *
 * Checks the error against retryable patterns:
 * - Error code property (e.g., { code: 'TIMEOUT' })
 * - Error message substring match
 * - HTTP status codes: 408 (timeout), 429 (rate limited), 5xx (server errors)
 *
 * @param error - The error to classify
 * @param retryableErrors - List of retryable error codes/patterns
 * @returns true if the error should trigger a retry
 */
export function isRetryableError(
  error: unknown,
  retryableErrors: string[] = DEFAULT_RETRY_CONFIG.retryableErrors
): boolean {
  if (!error) return false;

  // Extract error properties
  const errorCode =
    (error as { code?: string }).code ??
    (error as { errorCode?: string }).errorCode ??
    "";
  const errorMessage =
    error instanceof Error
      ? error.message
      : (error as { message?: string }).message ?? String(error);
  const statusCode = (error as { status?: number }).status ?? 0;

  // Check error code against retryable list
  if (errorCode && retryableErrors.includes(errorCode)) {
    return true;
  }

  // Check error message for retryable patterns
  const lowerMessage = errorMessage.toLowerCase();
  for (const retryable of retryableErrors) {
    if (lowerMessage.includes(retryable.toLowerCase())) {
      return true;
    }
  }

  // HTTP status code classification
  if (statusCode === 408 || statusCode === 429) return true; // Timeout, Rate limited
  if (statusCode >= 500 && statusCode < 600) return true; // Server errors

  return false;
}

/**
 * Calculates delay with exponential backoff and jitter.
 *
 * Formula: min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
 * Jitter adds up to 20% randomness to prevent thundering herd.
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  // Add jitter: up to 20% of the calculated delay
  const jitter = Math.random() * exponentialDelay * 0.2;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Executes an async operation with retry logic and exponential backoff.
 *
 * The operation is attempted once initially, then retried up to maxRetries
 * times if a retryable error occurs. Non-retryable errors are thrown
 * immediately without consuming retry attempts.
 *
 * @param operation - Async function to execute
 * @param config - Retry configuration (uses defaults if not provided)
 * @param onRetry - Optional callback invoked before each retry with attempt number and error
 * @param signal - Optional AbortSignal to cancel retries
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted or a non-retryable error occurs
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000, retryableErrors: ['TIMEOUT'] },
 *   (attempt, error) => console.log(`Retry ${attempt}: ${error.message}`)
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error) => void,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    // Check for abort before each attempt
    if (signal?.aborted) {
      throw new Error("Retry aborted");
    }

    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt or the error is not retryable, throw immediately
      if (
        attempt > config.maxRetries ||
        !isRetryableError(error, config.retryableErrors)
      ) {
        throw lastError;
      }

      // Notify caller about the retry
      onRetry?.(attempt, lastError);

      // Wait with exponential backoff before retrying
      const delay = calculateBackoffDelay(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs
      );

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);

        // If signal is provided, listen for abort during delay
        if (signal) {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error("Retry aborted"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
          // Clean up listener when timer completes
          const originalResolve = resolve;
          // eslint-disable-next-line no-param-reassign
          resolve = () => {
            signal.removeEventListener("abort", onAbort);
            originalResolve();
          };
        }
      });
    }
  }

  // TypeScript requires this, though it should be unreachable
  throw lastError!;
}
