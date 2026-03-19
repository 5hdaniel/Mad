/**
 * Tests for disk space diagnostic utility (TASK-2270)
 *
 * Tests cover:
 * - Sufficient space scenario
 * - Insufficient space (warning level: < threshold but >= 100MB)
 * - Insufficient space (critical level: < 100MB)
 * - Warning state (< 1GB but above threshold)
 * - Custom minimum MB override
 * - Sentry breadcrumb on every check
 * - Sentry captureMessage on insufficient space
 * - Sentry captureException on check-disk-space failure
 * - Graceful degradation when check-disk-space throws
 */

// Mock electron
const mockGetPath = jest.fn(() => "/mock/user/data");
jest.mock("electron", () => ({
  app: {
    getPath: mockGetPath,
  },
}));

// Mock Sentry
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
const mockAddBreadcrumb = jest.fn();
jest.mock("@sentry/electron/main", () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  addBreadcrumb: mockAddBreadcrumb,
}));

// Mock check-disk-space
const mockCheckDiskSpace = jest.fn();
jest.mock("check-disk-space", () => ({
  __esModule: true,
  default: mockCheckDiskSpace,
}));

// Mock electron-log
const mockLogWarn = jest.fn();
const mockLogError = jest.fn();
jest.mock("electron-log", () => ({
  __esModule: true,
  default: {
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
}));

import {
  checkDiskSpaceForOperation,
  DISK_SPACE_THRESHOLDS,
} from "../diagnostics/diskSpaceDiagnostics";

describe("diskSpaceDiagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DISK_SPACE_THRESHOLDS", () => {
    it("should define correct thresholds", () => {
      expect(DISK_SPACE_THRESHOLDS.sync).toBe(2048);
      expect(DISK_SPACE_THRESHOLDS.update).toBe(1024);
      expect(DISK_SPACE_THRESHOLDS.emailImport).toBe(512);
      expect(DISK_SPACE_THRESHOLDS.general).toBe(100);
    });
  });

  describe("checkDiskSpaceForOperation", () => {
    it("should return sufficient=true when plenty of space available", async () => {
      // 10GB free
      mockCheckDiskSpace.mockResolvedValue({
        free: 10 * 1024 * 1024 * 1024,
      });

      const result = await checkDiskSpaceForOperation("sync");

      expect(result.sufficient).toBe(true);
      expect(result.availableMB).toBe(10240);
      expect(result.requiredMB).toBe(2048);
      expect(result.path).toBe("/mock/user/data");
      expect(result.warning).toBe(false);
    });

    it("should return sufficient=false when space is below threshold", async () => {
      // 500MB free, sync requires 2048MB
      mockCheckDiskSpace.mockResolvedValue({
        free: 500 * 1024 * 1024,
      });

      const result = await checkDiskSpaceForOperation("sync");

      expect(result.sufficient).toBe(false);
      expect(result.availableMB).toBe(500);
      expect(result.requiredMB).toBe(2048);
    });

    it("should set warning=true when space < 1GB but above threshold", async () => {
      // 800MB free, general requires 100MB
      mockCheckDiskSpace.mockResolvedValue({
        free: 800 * 1024 * 1024,
      });

      const result = await checkDiskSpaceForOperation("general");

      expect(result.sufficient).toBe(true);
      expect(result.warning).toBe(true);
      expect(result.availableMB).toBe(800);
    });

    it("should set warning=false when space >= 1GB", async () => {
      // 2GB free, general requires 100MB
      mockCheckDiskSpace.mockResolvedValue({
        free: 2 * 1024 * 1024 * 1024,
      });

      const result = await checkDiskSpaceForOperation("general");

      expect(result.sufficient).toBe(true);
      expect(result.warning).toBe(false);
    });

    it("should use custom minimum MB when provided", async () => {
      // 200MB free, custom min = 300MB
      mockCheckDiskSpace.mockResolvedValue({
        free: 200 * 1024 * 1024,
      });

      const result = await checkDiskSpaceForOperation("general", 300);

      expect(result.sufficient).toBe(false);
      expect(result.requiredMB).toBe(300);
    });

    it("should use operation threshold when no custom min provided", async () => {
      mockCheckDiskSpace.mockResolvedValue({
        free: 3 * 1024 * 1024 * 1024,
      });

      const result = await checkDiskSpaceForOperation("emailImport");

      expect(result.requiredMB).toBe(512);
    });

    describe("Sentry reporting", () => {
      it("should add breadcrumb on every check with info level when sufficient", async () => {
        mockCheckDiskSpace.mockResolvedValue({
          free: 10 * 1024 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockAddBreadcrumb).toHaveBeenCalledWith({
          category: "diagnostics.disk",
          message: "Disk check for sync: 10240MB available, 2048MB required",
          level: "info",
          data: {
            operation: "sync",
            availableMB: 10240,
            requiredMB: 2048,
            sufficient: true,
          },
        });
      });

      it("should add breadcrumb with warning level when insufficient", async () => {
        mockCheckDiskSpace.mockResolvedValue({
          free: 500 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockAddBreadcrumb).toHaveBeenCalledWith(
          expect.objectContaining({
            level: "warning",
            data: expect.objectContaining({ sufficient: false }),
          })
        );
      });

      it("should call captureMessage with warning level when insufficient but >= 100MB", async () => {
        // 500MB free, sync requires 2048MB
        mockCheckDiskSpace.mockResolvedValue({
          free: 500 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockCaptureMessage).toHaveBeenCalledWith(
          "Insufficient disk space for sync",
          {
            level: "warning",
            tags: {
              operation: "sync",
              platform: process.platform,
            },
            extra: {
              availableMB: 500,
              requiredMB: 2048,
              path: "/mock/user/data",
            },
          }
        );
      });

      it("should call captureMessage with error level when critically low (< 100MB)", async () => {
        // 50MB free, sync requires 2048MB
        mockCheckDiskSpace.mockResolvedValue({
          free: 50 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockCaptureMessage).toHaveBeenCalledWith(
          "Insufficient disk space for sync",
          expect.objectContaining({
            level: "error",
          })
        );
      });

      it("should NOT call captureMessage when space is sufficient", async () => {
        mockCheckDiskSpace.mockResolvedValue({
          free: 10 * 1024 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockCaptureMessage).not.toHaveBeenCalled();
      });

      it("should call captureException when check-disk-space throws", async () => {
        const error = new Error("Permission denied");
        mockCheckDiskSpace.mockRejectedValue(error);

        await checkDiskSpaceForOperation("update");

        expect(mockCaptureException).toHaveBeenCalledWith(error, {
          tags: { operation: "update", check: "disk_space" },
        });
      });
    });

    describe("graceful degradation", () => {
      it("should return sufficient=true when check-disk-space throws", async () => {
        mockCheckDiskSpace.mockRejectedValue(new Error("EACCES"));

        const result = await checkDiskSpaceForOperation("sync");

        expect(result.sufficient).toBe(true);
        expect(result.availableMB).toBe(-1);
        expect(result.warning).toBe(true);
        expect(result.requiredMB).toBe(2048);
        expect(result.path).toBe("/mock/user/data");
      });

      it("should log error when check fails", async () => {
        const error = new Error("disk check failed");
        mockCheckDiskSpace.mockRejectedValue(error);

        await checkDiskSpaceForOperation("general");

        expect(mockLogError).toHaveBeenCalledWith(
          "[DiskDiagnostics] Failed to check disk space:",
          error
        );
      });
    });

    describe("logging", () => {
      it("should log warning when space is insufficient", async () => {
        mockCheckDiskSpace.mockResolvedValue({
          free: 500 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockLogWarn).toHaveBeenCalledWith(
          "[DiskDiagnostics] Insufficient space for sync: 500MB < 2048MB"
        );
      });

      it("should NOT log when space is sufficient", async () => {
        mockCheckDiskSpace.mockResolvedValue({
          free: 10 * 1024 * 1024 * 1024,
        });

        await checkDiskSpaceForOperation("sync");

        expect(mockLogWarn).not.toHaveBeenCalled();
      });
    });
  });
});
