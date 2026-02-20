/**
 * @jest-environment node
 */

/**
 * Unit tests for SubmissionSyncService
 * TASK-2016: Guard sync race condition at startup
 *
 * Tests that sync operations gracefully skip when the database
 * is not initialized, preventing race conditions at startup.
 */

// Mock dependencies before importing
jest.mock("../supabaseService");
jest.mock("../databaseService");
jest.mock("../logService");
jest.mock("electron", () => ({
  BrowserWindow: jest.fn(),
}));

import { submissionSyncService } from "../submissionSyncService";
import databaseService from "../databaseService";
import logService from "../logService";

describe("SubmissionSyncService", () => {
  let mockPrepare: jest.Mock;
  let mockAll: jest.Mock;
  let mockGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAll = jest.fn().mockReturnValue([]);
    mockGet = jest.fn().mockReturnValue(null);
    mockPrepare = jest.fn().mockReturnValue({
      all: mockAll,
      get: mockGet,
      run: jest.fn().mockReturnValue({ changes: 1 }),
    });

    // Default: database IS initialized
    (databaseService.isInitialized as jest.Mock).mockReturnValue(true);
    (databaseService.getRawDatabase as jest.Mock).mockReturnValue({
      prepare: mockPrepare,
    });
  });

  afterEach(() => {
    submissionSyncService.stopPeriodicSync();
    jest.useRealTimers();
  });

  describe("database initialization guard", () => {
    it("should not throw when startPeriodicSync is called before DB is ready", () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      // Should not throw
      expect(() => {
        submissionSyncService.startPeriodicSync(10000);
      }).not.toThrow();
    });

    it("should skip initial sync when DB is not ready", () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      submissionSyncService.startPeriodicSync(10000);

      // Should log that initial sync was skipped
      expect(logService.debug).toHaveBeenCalledWith(
        "[SyncService] Skipping initial sync - database not initialized, will retry on next interval",
        "SubmissionSyncService"
      );

      // getRawDatabase should NOT have been called
      expect(databaseService.getRawDatabase).not.toHaveBeenCalled();
    });

    it("should skip periodic sync tick when DB is not ready", () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      submissionSyncService.startPeriodicSync(10000);

      // Advance timer to trigger interval
      jest.advanceTimersByTime(10000);

      // Should log that periodic tick was skipped
      expect(logService.debug).toHaveBeenCalledWith(
        "[SyncService] Skipping periodic sync tick - database not initialized",
        "SubmissionSyncService"
      );
    });

    it("should run sync on interval tick once DB becomes ready", async () => {
      // Start with DB not ready
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      submissionSyncService.startPeriodicSync(10000);

      // First tick: DB still not ready
      jest.advanceTimersByTime(10000);
      expect(databaseService.getRawDatabase).not.toHaveBeenCalled();

      // Now DB becomes ready
      (databaseService.isInitialized as jest.Mock).mockReturnValue(true);

      // Second tick: DB is ready, sync should run
      jest.advanceTimersByTime(10000);

      // getRawDatabase should now be called (via getLocalSubmittedTransactions)
      expect(databaseService.getRawDatabase).toHaveBeenCalled();
    });

    it("should run initial sync immediately when DB is ready", () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(true);

      submissionSyncService.startPeriodicSync(10000);

      // Should NOT log the skip message
      expect(logService.debug).not.toHaveBeenCalledWith(
        "[SyncService] Skipping initial sync - database not initialized, will retry on next interval",
        "SubmissionSyncService"
      );

      // getRawDatabase should have been called (for the immediate sync)
      expect(databaseService.getRawDatabase).toHaveBeenCalled();
    });

    it("should still set up the interval timer even when DB is not ready", () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      submissionSyncService.startPeriodicSync(10000);

      // The service should report as running (interval was set)
      expect(submissionSyncService.isRunning()).toBe(true);
    });
  });

  describe("syncAllSubmissions guard", () => {
    it("should return empty result when DB is not initialized", async () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      const result = await submissionSyncService.syncAllSubmissions();

      expect(result).toEqual({ updated: 0, failed: 0, details: [] });
      expect(logService.debug).toHaveBeenCalledWith(
        "[SyncService] Skipping sync - database not initialized",
        "SubmissionSyncService"
      );
      expect(databaseService.getRawDatabase).not.toHaveBeenCalled();
    });

    it("should proceed with sync when DB is initialized", async () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(true);

      const result = await submissionSyncService.syncAllSubmissions();

      expect(result).toEqual({ updated: 0, failed: 0, details: [] });
      expect(databaseService.getRawDatabase).toHaveBeenCalled();
    });
  });

  describe("syncSubmission guard", () => {
    it("should return false when DB is not initialized", async () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      const result = await submissionSyncService.syncSubmission("test-id");

      expect(result).toBe(false);
      expect(logService.debug).toHaveBeenCalledWith(
        "[SyncService] Skipping single submission sync - database not initialized",
        "SubmissionSyncService"
      );
      expect(databaseService.getRawDatabase).not.toHaveBeenCalled();
    });
  });

  describe("manualSync guard", () => {
    it("should return empty result via syncAllSubmissions when DB is not initialized", async () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      const result = await submissionSyncService.manualSync();

      expect(result).toEqual({ updated: 0, failed: 0, details: [] });
    });
  });

  describe("no regression when DB is ready", () => {
    it("should not call isInitialized check when sync is not running", () => {
      expect(submissionSyncService.isRunning()).toBe(false);
    });

    it("stopPeriodicSync should work regardless of DB state", () => {
      (databaseService.isInitialized as jest.Mock).mockReturnValue(false);

      submissionSyncService.startPeriodicSync(10000);
      expect(submissionSyncService.isRunning()).toBe(true);

      submissionSyncService.stopPeriodicSync();
      expect(submissionSyncService.isRunning()).toBe(false);
    });
  });
});
