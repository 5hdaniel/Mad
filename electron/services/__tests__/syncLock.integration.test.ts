/**
 * Integration Tests for Sync Lock Mechanism (SPRINT-014)
 *
 * Tests the interaction between:
 * - SyncStatusService (TASK-904)
 * - SyncOrchestrator (TASK-910)
 * - BackupService
 *
 * Verifies that the system correctly:
 * - Reports sync status when operations are running
 * - Blocks concurrent sync operations
 * - Allows new sync after previous completes
 */

// Mock better-sqlite3-multiple-ciphers native module (required by backupService chain)
jest.mock("better-sqlite3-multiple-ciphers", () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      get: jest.fn().mockReturnValue(null),
      run: jest.fn(),
    }),
    close: jest.fn(),
    exec: jest.fn(),
  }));
});

// Mock electron modules
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn().mockReturnValue("/mock/userData"),
    isPackaged: false,
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock electron-log
jest.mock("electron-log", () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock fs/promises
jest.mock("fs", () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error("Not found")),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ size: 1024, mtime: new Date() }),
    rm: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue("<plist></plist>"),
  },
}));

// Mock child_process
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

// Mock check-disk-space (used by syncOrchestrator)
jest.mock("check-disk-space", () => ({
  default: jest.fn().mockResolvedValue({ free: 10 * 1024 * 1024 * 1024 }),
}));

// Controllable mock status for backupService
const mockBackupStatus = {
  isRunning: false,
  currentDeviceUdid: null as string | null,
  progress: null as { phase: string; percent: number } | null,
};

jest.mock("../backupService", () => ({
  backupService: {
    getStatus: jest.fn(() => ({ ...mockBackupStatus })),
  },
}));

// Controllable mock status for syncOrchestrator
const mockOrchestratorStatus = {
  isRunning: false,
  phase: "idle" as string,
};

jest.mock("../syncOrchestrator", () => ({
  syncOrchestrator: {
    getStatus: jest.fn(() => ({ ...mockOrchestratorStatus })),
  },
}));

// Import after mocks are set up
import { syncStatusService } from "../syncStatusService";

describe("Sync Lock Integration (SPRINT-014)", () => {
  beforeEach(() => {
    // Reset mock status before each test
    mockBackupStatus.isRunning = false;
    mockBackupStatus.currentDeviceUdid = null;
    mockBackupStatus.progress = null;
    mockOrchestratorStatus.isRunning = false;
    mockOrchestratorStatus.phase = "idle";
  });

  describe("Status Reporting", () => {
    it("should report idle state when nothing is running", () => {
      const status = syncStatusService.getStatus();

      expect(status.isAnyOperationRunning).toBe(false);
      expect(status.backupInProgress).toBe(false);
      expect(status.emailSyncInProgress).toBe(false);
      expect(status.currentOperation).toBeNull();
      expect(status.syncPhase).toBe("idle");
    });

    it("should report sync status accurately when backup is running", () => {
      // Arrange: Simulate backup running
      mockBackupStatus.isRunning = true;
      mockBackupStatus.currentDeviceUdid = "test-device-udid";

      // Act: Check status
      const status = syncStatusService.getStatus();

      // Assert
      expect(status.isAnyOperationRunning).toBe(true);
      expect(status.backupInProgress).toBe(true);
      expect(status.emailSyncInProgress).toBe(false);
      expect(status.currentOperation).toBe("iPhone backup in progress");
    });

    it("should report sync status accurately when orchestrator is running", () => {
      // Arrange: Simulate orchestrator running
      mockOrchestratorStatus.isRunning = true;
      mockOrchestratorStatus.phase = "parsing-messages";

      // Act: Check status
      const status = syncStatusService.getStatus();

      // Assert
      expect(status.isAnyOperationRunning).toBe(true);
      expect(status.backupInProgress).toBe(false);
      expect(status.emailSyncInProgress).toBe(true);
      expect(status.currentOperation).toBe("Parsing messages");
      expect(status.syncPhase).toBe("parsing-messages");
    });

    it("should prioritize backup status when both are running", () => {
      // Arrange: Both backup and orchestrator running
      mockBackupStatus.isRunning = true;
      mockBackupStatus.currentDeviceUdid = "test-udid";
      mockOrchestratorStatus.isRunning = true;
      mockOrchestratorStatus.phase = "backup";

      // Act: Check status
      const status = syncStatusService.getStatus();

      // Assert: Backup takes precedence
      expect(status.isAnyOperationRunning).toBe(true);
      expect(status.backupInProgress).toBe(true);
      expect(status.emailSyncInProgress).toBe(false);
      expect(status.currentOperation).toBe("iPhone backup in progress");
    });
  });

  describe("Concurrent Operation Blocking", () => {
    it("should indicate blocking when backup is in progress", () => {
      // Arrange: Backup is running
      mockBackupStatus.isRunning = true;

      // Act: Check if new operation can start
      const status = syncStatusService.getStatus();

      // Assert: System reports operation running (UI should block new sync)
      expect(status.isAnyOperationRunning).toBe(true);
    });

    it("should indicate blocking when orchestrator is in progress", () => {
      // Arrange: Orchestrator is running
      mockOrchestratorStatus.isRunning = true;
      mockOrchestratorStatus.phase = "decrypting";

      // Act: Check if new operation can start
      const status = syncStatusService.getStatus();

      // Assert: System reports operation running
      expect(status.isAnyOperationRunning).toBe(true);
    });
  });

  describe("Operation Completion", () => {
    it("should allow sync after backup completes", () => {
      // Arrange: Backup was running
      mockBackupStatus.isRunning = true;

      // Verify it's blocked
      let status = syncStatusService.getStatus();
      expect(status.isAnyOperationRunning).toBe(true);

      // Act: Backup completes
      mockBackupStatus.isRunning = false;
      mockBackupStatus.currentDeviceUdid = null;

      // Assert: New operation can start
      status = syncStatusService.getStatus();
      expect(status.isAnyOperationRunning).toBe(false);
      expect(status.backupInProgress).toBe(false);
    });

    it("should allow sync after orchestrator completes", () => {
      // Arrange: Orchestrator was running
      mockOrchestratorStatus.isRunning = true;
      mockOrchestratorStatus.phase = "parsing-contacts";

      // Verify it's blocked
      let status = syncStatusService.getStatus();
      expect(status.isAnyOperationRunning).toBe(true);

      // Act: Orchestrator completes
      mockOrchestratorStatus.isRunning = false;
      mockOrchestratorStatus.phase = "complete";

      // Assert: New operation can start
      status = syncStatusService.getStatus();
      expect(status.isAnyOperationRunning).toBe(false);
    });

    it("should return null operation for complete phase", () => {
      // Arrange: Orchestrator completed
      mockOrchestratorStatus.isRunning = true;
      mockOrchestratorStatus.phase = "complete";

      // Act
      const status = syncStatusService.getStatus();

      // Assert: No current operation label
      expect(status.currentOperation).toBeNull();
    });

    it("should return null operation for error phase", () => {
      // Arrange: Orchestrator errored
      mockOrchestratorStatus.isRunning = true;
      mockOrchestratorStatus.phase = "error";

      // Act
      const status = syncStatusService.getStatus();

      // Assert: No current operation label (let UI handle error display)
      expect(status.currentOperation).toBeNull();
    });
  });

  describe("Phase Labels", () => {
    const phaseLabels: Record<string, string> = {
      backup: "iPhone backup in progress",
      decrypting: "Decrypting backup data",
      "parsing-contacts": "Parsing contacts",
      "parsing-messages": "Parsing messages",
      resolving: "Resolving contact names",
      cleanup: "Cleaning up",
    };

    it.each(Object.entries(phaseLabels))(
      "should return correct label for %s phase",
      (phase, expectedLabel) => {
        // Arrange
        mockOrchestratorStatus.isRunning = true;
        mockOrchestratorStatus.phase = phase;

        // Act
        const status = syncStatusService.getStatus();

        // Assert
        expect(status.currentOperation).toBe(expectedLabel);
      }
    );
  });
});
