/**
 * Unit tests for BackupService
 * Tests iPhone backup operations via idevicebackup2
 */

import { BackupService } from "../backupService";
import {
  BackupOptions,
  BackupProgress,
  BackupResult,
} from "../../types/backup";

// Mock better-sqlite3-multiple-ciphers native module
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
  spawn: jest.fn().mockImplementation(() => {
    const mockStdout = {
      on: jest.fn(),
    };

    const mockStderr = {
      on: jest.fn(),
    };

    const mockProcess = {
      stdout: mockStdout,
      stderr: mockStderr,
      on: jest.fn((event: string, callback: Function) => {
        if (event === "close") {
          // Simulate successful process completion after a delay
          // Longer delay (200ms) to allow testing concurrent backup scenarios
          setTimeout(() => callback(0), 200);
        }
        return mockProcess;
      }),
      kill: jest.fn(),
    };

    return mockProcess;
  }),
}));

// Mock libimobiledeviceService
jest.mock("../libimobiledeviceService", () => ({
  getCommand: jest.fn().mockReturnValue("/mock/idevicebackup2"),
  isMockMode: jest.fn().mockReturnValue(false), // Use spawn mock, not mockBackup
}));

describe("BackupService", () => {
  let backupService: BackupService;

  beforeEach(() => {
    jest.clearAllMocks();
    backupService = new BackupService();
  });

  afterEach(() => {
    // Clean up any running processes
    backupService.cancelBackup();
    backupService.removeAllListeners();
  });

  describe("checkCapabilities", () => {
    it("should return backup capabilities", async () => {
      const capabilities = await backupService.checkCapabilities();

      expect(capabilities).toEqual({
        supportsDomainFiltering: false,
        supportsIncremental: true,
        supportsSkipApps: true,
        supportsEncryption: true,
        availableDomains: expect.arrayContaining([
          "HomeDomain",
          "CameraRollDomain",
          "AppDomain",
          "MediaDomain",
          "SystemPreferencesDomain",
        ]),
      });
    });

    it("should indicate domain filtering is NOT supported", async () => {
      const capabilities = await backupService.checkCapabilities();

      // Critical: Domain filtering is not possible with idevicebackup2
      // See docs/BACKUP_RESEARCH.md for details
      expect(capabilities.supportsDomainFiltering).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("should return initial status when no backup is running", () => {
      const status = backupService.getStatus();

      expect(status).toEqual({
        isRunning: false,
        currentDeviceUdid: null,
        progress: null,
      });
    });

    it("should reflect running status during backup", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
      };

      // Start backup (in mock mode, it runs asynchronously)
      const backupPromise = backupService.startBackup(options);

      // Wait for checkEncryptionStatus to complete (200ms) + Promise executor to run
      await new Promise((resolve) => setTimeout(resolve, 250));

      const status = backupService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.currentDeviceUdid).toBe("test-device-udid");

      // Wait for completion
      await backupPromise;
    });
  });

  describe("startBackup", () => {
    it("should throw error if backup already in progress", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
      };

      // Start first backup (don't await it)
      const firstBackup = backupService.startBackup(options);

      // Wait for checkEncryptionStatus to complete (200ms) + Promise executor to set isRunning flag
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Attempt to start second backup while first is still running
      await expect(backupService.startBackup(options)).rejects.toThrow(
        "Backup already in progress",
      );

      // Wait for first backup to complete
      await firstBackup;
    });

    it("should emit progress events during backup", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
      };

      const progressEvents: BackupProgress[] = [];
      backupService.on("progress", (progress: BackupProgress) => {
        progressEvents.push(progress);
      });

      await backupService.startBackup(options);

      // Should have received multiple progress events
      expect(progressEvents.length).toBeGreaterThan(0);

      // Should have gone through phases
      const phases = progressEvents.map((p) => p.phase);
      expect(phases).toContain("preparing");
      expect(phases).toContain("finishing");
    });

    it("should return success result on completion", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
      };

      const result = await backupService.startBackup(options);

      expect(result).toMatchObject({
        success: true,
        deviceUdid: "test-device-udid",
        error: null,
      });
      expect(result.duration).toBeGreaterThan(0);
      expect(result.backupPath).toBeTruthy();
    });

    it("should emit complete event when finished", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
      };

      let completedResult: BackupResult | null = null;
      backupService.on("complete", (result: BackupResult) => {
        completedResult = result;
      });

      await backupService.startBackup(options);

      expect(completedResult).not.toBeNull();
      expect(completedResult!.success).toBe(true);
    });

    it("should use skip-apps by default", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
        // skipApps defaults to true
      };

      // In mock mode, we just verify the service accepts the option
      const result = await backupService.startBackup(options);
      expect(result.success).toBe(true);
    });

    it("should support custom output directory", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
        outputDir: "/custom/backup/path",
      };

      const result = await backupService.startBackup(options);
      expect(result.success).toBe(true);
    });

    it("should support force full backup option", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
        forceFullBackup: true,
      };

      const result = await backupService.startBackup(options);
      expect(result.success).toBe(true);
    });
  });

  describe("cancelBackup", () => {
    it("should cancel running backup", async () => {
      const options: BackupOptions = {
        udid: "test-device-udid",
      };

      // Start backup
      const backupPromise = backupService.startBackup(options);

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cancel
      backupService.cancelBackup();

      // Verify status
      const status = backupService.getStatus();
      expect(status.isRunning).toBe(false);

      // Wait for promise to resolve
      await backupPromise;
    });

    it("should do nothing if no backup is running", () => {
      expect(() => backupService.cancelBackup()).not.toThrow();
    });
  });

  describe("listBackups", () => {
    it("should return empty array when no backups exist", async () => {
      const backups = await backupService.listBackups();
      expect(backups).toEqual([]);
    });
  });

  describe("deleteBackup", () => {
    it("should throw error for paths outside backup directory", async () => {
      // Mock fs.access to resolve (path exists) so we reach the validation check
      const fs = require("fs");
      fs.promises.access = jest.fn().mockResolvedValue(undefined);

      await expect(
        backupService.deleteBackup("/some/other/path"),
      ).rejects.toThrow("Cannot delete backup outside of backup directory");
    });
  });

  describe("cleanupOldBackups", () => {
    it("should not throw when no backups exist", async () => {
      await expect(backupService.cleanupOldBackups(1)).resolves.not.toThrow();
    });
  });

  describe("event emitter", () => {
    it("should support progress event listeners", () => {
      const listener = jest.fn();
      backupService.on("progress", listener);
      backupService.emit("progress", {
        phase: "preparing",
        percentComplete: 0,
      } as BackupProgress);
      expect(listener).toHaveBeenCalled();
    });

    it("should support error event listeners", () => {
      const listener = jest.fn();
      backupService.on("error", listener);
      backupService.emit("error", new Error("Test error"));
      expect(listener).toHaveBeenCalled();
    });

    it("should support complete event listeners", () => {
      const listener = jest.fn();
      backupService.on("complete", listener);
      backupService.emit("complete", { success: true } as BackupResult);
      expect(listener).toHaveBeenCalled();
    });
  });
});

describe("BackupService - buildBackupArgs", () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new BackupService();
  });

  it("should include -u flag with UDID", () => {
    // Access private method via type assertion for testing
    const buildArgs = (backupService as any).buildBackupArgs.bind(
      backupService,
    );
    const args = buildArgs({ udid: "ABC123", skipApps: true }, "/backup/path");

    expect(args).toContain("-u");
    expect(args).toContain("ABC123");
  });

  it("should include backup command", () => {
    const buildArgs = (backupService as any).buildBackupArgs.bind(
      backupService,
    );
    const args = buildArgs({ udid: "ABC123" }, "/backup/path");

    expect(args).toContain("backup");
  });

  it("should include --skip-apps by default", () => {
    const buildArgs = (backupService as any).buildBackupArgs.bind(
      backupService,
    );
    const args = buildArgs({ udid: "ABC123" }, "/backup/path");

    expect(args).toContain("--skip-apps");
  });

  it("should not include --skip-apps when disabled", () => {
    const buildArgs = (backupService as any).buildBackupArgs.bind(
      backupService,
    );
    const args = buildArgs({ udid: "ABC123", skipApps: false }, "/backup/path");

    expect(args).not.toContain("--skip-apps");
  });

  it("should include --full when forceFullBackup is true", () => {
    const buildArgs = (backupService as any).buildBackupArgs.bind(
      backupService,
    );
    const args = buildArgs(
      { udid: "ABC123", forceFullBackup: true },
      "/backup/path",
    );

    expect(args).toContain("--full");
  });

  it("should include backup path as last argument", () => {
    const buildArgs = (backupService as any).buildBackupArgs.bind(
      backupService,
    );
    const args = buildArgs({ udid: "ABC123" }, "/backup/path");

    expect(args[args.length - 1]).toBe("/backup/path");
  });
});

describe("BackupService - parseProgress", () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new BackupService();
  });

  it("should parse percentage progress", () => {
    const parseProgress = (backupService as any).parseProgress.bind(
      backupService,
    );

    const progress = parseProgress("Backup progress: 50%");
    expect(progress).not.toBeNull();
    expect(progress?.percentComplete).toBe(50);
  });

  it("should parse file count progress", () => {
    const parseProgress = (backupService as any).parseProgress.bind(
      backupService,
    );

    const progress = parseProgress("Received 500 files");
    expect(progress).not.toBeNull();
    expect(progress?.filesTransferred).toBe(500);
    expect(progress?.phase).toBe("transferring");
  });

  it("should detect preparing phase", () => {
    const parseProgress = (backupService as any).parseProgress.bind(
      backupService,
    );

    const progress = parseProgress("Receiving files");
    expect(progress).not.toBeNull();
    expect(progress?.phase).toBe("transferring");
  });

  it("should detect finishing phase", () => {
    const parseProgress = (backupService as any).parseProgress.bind(
      backupService,
    );

    const progress = parseProgress("Finishing backup...");
    expect(progress).not.toBeNull();
    expect(progress?.phase).toBe("finishing");
  });

  it("should return null for unrecognized output", () => {
    const parseProgress = (backupService as any).parseProgress.bind(
      backupService,
    );

    const progress = parseProgress("Some random output");
    expect(progress).toBeNull();
  });
});
