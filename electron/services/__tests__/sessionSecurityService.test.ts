/**
 * Unit tests for SessionSecurityService
 * Tests session validity, idle timeout, and absolute timeout functionality
 */

// Mock logService before importing sessionSecurityService
const mockLogService = {
  info: jest.fn().mockResolvedValue(undefined),
  warn: jest.fn().mockResolvedValue(undefined),
  error: jest.fn().mockResolvedValue(undefined),
  debug: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../logService', () => mockLogService);

import { sessionSecurityService } from '../sessionSecurityService';

describe('SessionSecurityService', () => {
  const testSessionToken = 'test-session-token-123';

  beforeEach(() => {
    // Clear all activity tracking before each test
    sessionSecurityService.clearAllActivity();
    jest.clearAllMocks();
  });

  describe('checkSessionValidity', () => {
    it('should return valid for a fresh session', async () => {
      const session = {
        created_at: new Date().toISOString(),
      };

      const result = await sessionSecurityService.checkSessionValidity(session, testSessionToken);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should expire session after 24 hours', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const session = {
        created_at: twentyFiveHoursAgo.toISOString(),
      };

      const result = await sessionSecurityService.checkSessionValidity(session, testSessionToken);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });

    it('should be valid just before 24 hour expiration', async () => {
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
      const session = {
        created_at: twentyThreeHoursAgo.toISOString(),
      };

      // Record recent activity so idle timeout doesn't trigger
      sessionSecurityService.recordActivity(testSessionToken);

      const result = await sessionSecurityService.checkSessionValidity(session, testSessionToken);

      expect(result.valid).toBe(true);
    });

    it('should expire session after 30 minutes idle', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const session = {
        created_at: oneHourAgo.toISOString(),
        last_accessed_at: oneHourAgo.toISOString(),
      };

      // First call initializes activity tracking from last_accessed_at
      // Since last_accessed_at is 1 hour ago, it should be considered idle
      const result = await sessionSecurityService.checkSessionValidity(session, testSessionToken);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('idle');
    });

    it('should be valid within idle timeout', async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const session = {
        created_at: fifteenMinutesAgo.toISOString(),
      };

      // Record recent activity
      sessionSecurityService.recordActivity(testSessionToken);

      const result = await sessionSecurityService.checkSessionValidity(session, testSessionToken);

      expect(result.valid).toBe(true);
    });
  });

  describe('recordActivity', () => {
    it('should track activity for a session', () => {
      sessionSecurityService.recordActivity(testSessionToken);

      const lastActivity = sessionSecurityService.getLastActivity(testSessionToken);

      expect(lastActivity).not.toBeNull();
      expect(lastActivity).toBeGreaterThan(Date.now() - 1000);
    });

    it('should update activity time on subsequent calls', async () => {
      sessionSecurityService.recordActivity(testSessionToken);
      const firstActivity = sessionSecurityService.getLastActivity(testSessionToken);

      // Wait a small amount
      await new Promise((resolve) => setTimeout(resolve, 10));

      sessionSecurityService.recordActivity(testSessionToken);
      const secondActivity = sessionSecurityService.getLastActivity(testSessionToken);

      expect(secondActivity).toBeGreaterThanOrEqual(firstActivity!);
    });
  });

  describe('getLastActivity', () => {
    it('should return null for untracked session', () => {
      const lastActivity = sessionSecurityService.getLastActivity('unknown-session');

      expect(lastActivity).toBeNull();
    });

    it('should return timestamp for tracked session', () => {
      sessionSecurityService.recordActivity(testSessionToken);

      const lastActivity = sessionSecurityService.getLastActivity(testSessionToken);

      expect(lastActivity).not.toBeNull();
      expect(typeof lastActivity).toBe('number');
    });
  });

  describe('cleanupSession', () => {
    it('should remove session from activity tracking', () => {
      sessionSecurityService.recordActivity(testSessionToken);
      expect(sessionSecurityService.getLastActivity(testSessionToken)).not.toBeNull();

      sessionSecurityService.cleanupSession(testSessionToken);

      expect(sessionSecurityService.getLastActivity(testSessionToken)).toBeNull();
    });
  });

  describe('getRemainingSessionTime', () => {
    it('should return positive time for valid session', () => {
      const session = {
        created_at: new Date().toISOString(),
      };

      const remainingTime = sessionSecurityService.getRemainingSessionTime(session);

      expect(remainingTime).toBeGreaterThan(0);
      // Should be close to 24 hours (86400 seconds)
      expect(remainingTime).toBeLessThanOrEqual(24 * 60 * 60);
    });

    it('should return 0 for expired session', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const session = {
        created_at: twentyFiveHoursAgo.toISOString(),
      };

      const remainingTime = sessionSecurityService.getRemainingSessionTime(session);

      expect(remainingTime).toBe(0);
    });
  });

  describe('getRemainingIdleTime', () => {
    it('should return full idle time for untracked session', () => {
      const remainingTime = sessionSecurityService.getRemainingIdleTime('unknown-session');

      // Should be close to 30 minutes (1800 seconds)
      expect(remainingTime).toBe(30 * 60);
    });

    it('should return remaining idle time for tracked session', () => {
      sessionSecurityService.recordActivity(testSessionToken);

      const remainingTime = sessionSecurityService.getRemainingIdleTime(testSessionToken);

      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(30 * 60);
    });
  });

  describe('getConfig', () => {
    it('should return configuration values', () => {
      const config = sessionSecurityService.getConfig();

      expect(config.idleTimeoutMs).toBe(30 * 60 * 1000); // 30 minutes
      expect(config.sessionTimeoutMs).toBe(24 * 60 * 60 * 1000); // 24 hours
    });
  });

  describe('clearAllActivity', () => {
    it('should clear all activity tracking', () => {
      sessionSecurityService.recordActivity('session1');
      sessionSecurityService.recordActivity('session2');
      sessionSecurityService.recordActivity('session3');

      sessionSecurityService.clearAllActivity();

      expect(sessionSecurityService.getLastActivity('session1')).toBeNull();
      expect(sessionSecurityService.getLastActivity('session2')).toBeNull();
      expect(sessionSecurityService.getLastActivity('session3')).toBeNull();
    });
  });
});
