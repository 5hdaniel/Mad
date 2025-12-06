/**
 * Unit tests for RateLimitService
 * Tests brute-force protection and account lockout functionality
 */

// Mock logService before importing rateLimitService
const mockLogService = {
  info: jest.fn().mockResolvedValue(undefined),
  warn: jest.fn().mockResolvedValue(undefined),
  error: jest.fn().mockResolvedValue(undefined),
  debug: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../logService', () => mockLogService);

import { rateLimitService } from '../rateLimitService';

describe('RateLimitService', () => {
  const testEmail = 'test@example.com';

  beforeEach(async () => {
    // Clear all entries before each test
    await rateLimitService.clearAll();
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests under the limit', async () => {
      const result = await rateLimitService.checkRateLimit(testEmail);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should track remaining attempts correctly', async () => {
      // Record 3 failed attempts
      await rateLimitService.recordAttempt(testEmail, false);
      await rateLimitService.recordAttempt(testEmail, false);
      await rateLimitService.recordAttempt(testEmail, false);

      const result = await rateLimitService.checkRateLimit(testEmail);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(2);
    });

    it('should block after 5 failed attempts', async () => {
      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await rateLimitService.recordAttempt(testEmail, false);
      }

      const result = await rateLimitService.checkRateLimit(testEmail);

      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(result.lockedUntil).toBeDefined();
    });

    it('should provide retry time when locked', async () => {
      // Record 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await rateLimitService.recordAttempt(testEmail, false);
      }

      const result = await rateLimitService.checkRateLimit(testEmail);

      expect(result.retryAfterSeconds).toBeDefined();
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('recordAttempt', () => {
    it('should reset attempts on successful login', async () => {
      // Record some failed attempts
      await rateLimitService.recordAttempt(testEmail, false);
      await rateLimitService.recordAttempt(testEmail, false);

      // Record successful attempt
      await rateLimitService.recordAttempt(testEmail, true);

      // Check that attempts are cleared
      const result = await rateLimitService.checkRateLimit(testEmail);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should increment attempt count on failed login', async () => {
      await rateLimitService.recordAttempt(testEmail, false);

      const result = await rateLimitService.checkRateLimit(testEmail);

      expect(result.remainingAttempts).toBe(4);
    });

    it('should lock account after max failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimitService.recordAttempt(testEmail, false);
      }

      const isLocked = await rateLimitService.isLocked(testEmail);

      expect(isLocked).toBe(true);
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return max attempts for new identifier', async () => {
      const remaining = await rateLimitService.getRemainingAttempts('new@example.com');

      expect(remaining).toBe(5);
    });

    it('should return correct remaining after failed attempts', async () => {
      await rateLimitService.recordAttempt(testEmail, false);
      await rateLimitService.recordAttempt(testEmail, false);

      const remaining = await rateLimitService.getRemainingAttempts(testEmail);

      expect(remaining).toBe(3);
    });
  });

  describe('isLocked', () => {
    it('should return false for new identifier', async () => {
      const isLocked = await rateLimitService.isLocked(testEmail);

      expect(isLocked).toBe(false);
    });

    it('should return true after max failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimitService.recordAttempt(testEmail, false);
      }

      const isLocked = await rateLimitService.isLocked(testEmail);

      expect(isLocked).toBe(true);
    });

    it('should return false after successful login clears lockout', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await rateLimitService.recordAttempt(testEmail, false);
      }

      // Manually unlock
      await rateLimitService.unlock(testEmail);

      const isLocked = await rateLimitService.isLocked(testEmail);

      expect(isLocked).toBe(false);
    });
  });

  describe('unlock', () => {
    it('should manually unlock a locked account', async () => {
      // Lock the account
      for (let i = 0; i < 5; i++) {
        await rateLimitService.recordAttempt(testEmail, false);
      }

      expect(await rateLimitService.isLocked(testEmail)).toBe(true);

      await rateLimitService.unlock(testEmail);

      expect(await rateLimitService.isLocked(testEmail)).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all rate limit entries', async () => {
      // Add some entries
      await rateLimitService.recordAttempt('user1@example.com', false);
      await rateLimitService.recordAttempt('user2@example.com', false);

      await rateLimitService.clearAll();

      const result1 = await rateLimitService.checkRateLimit('user1@example.com');
      const result2 = await rateLimitService.checkRateLimit('user2@example.com');

      expect(result1.remainingAttempts).toBe(5);
      expect(result2.remainingAttempts).toBe(5);
    });
  });

  describe('getConfig', () => {
    it('should return configuration values', () => {
      const config = rateLimitService.getConfig();

      expect(config.maxAttempts).toBe(5);
      expect(config.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.lockoutMs).toBe(30 * 60 * 1000); // 30 minutes
    });
  });

  describe('case insensitivity', () => {
    it('should treat emails case-insensitively', async () => {
      await rateLimitService.recordAttempt('Test@Example.com', false);
      await rateLimitService.recordAttempt('test@example.com', false);

      const result = await rateLimitService.checkRateLimit('TEST@EXAMPLE.COM');

      // Both attempts should count against the same identifier
      expect(result.remainingAttempts).toBe(3);
    });
  });
});
