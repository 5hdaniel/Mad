/**
 * Token bucket rate limiter for LLM API calls.
 * Prevents hitting provider rate limits.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  /**
   * @param requestsPerMinute - Maximum requests allowed per minute
   */
  constructor(requestsPerMinute: number = 60) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000; // per ms
    this.lastRefill = Date.now();
  }

  /**
   * Attempt to acquire a token for making a request.
   * Returns true if allowed, false if rate limited.
   */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token is available.
   * Returns the wait time in ms (0 if immediately available).
   */
  async acquire(): Promise<number> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }

    // Calculate wait time
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await this.sleep(waitMs);
    this.refill();
    this.tokens -= 1;
    return waitMs;
  }

  /**
   * Get time until next token available (ms).
   */
  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }

  /**
   * Get current available tokens.
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Reset the rate limiter to full capacity.
   * Useful for testing or when rate limit window resets.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
