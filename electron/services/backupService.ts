/**
 * Backup Service
 *
 * Handles iPhone backup operations using idevicebackup2 CLI tool.
 * Extracts messages and contacts from iPhone backups.
 * Supports encrypted backup decryption (TASK-007).
 *
 * IMPORTANT: Domain filtering is NOT supported by idevicebackup2.
 * See docs/BACKUP_RESEARCH.md for full research findings.
 * This service uses --skip-apps to reduce backup size by ~40%.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import { app } from "electron";
import { promises as fs } from "fs";
import log from "electron-log";
import { getCommand, isMockMode } from "./libimobiledeviceService";
import { backupDecryptionService } from "./backupDecryptionService";
import {
  BackupProgress,
  BackupResult,
  BackupOptions,
  BackupCapabilities,
  BackupInfo,
  BackupStatus,
  BackupEncryptionInfo,
  BackupErrorCode,
} from "../types/backup";

/**
 * Service for managing iPhone backups via idevicebackup2
 *
 * Emits events:
 * - 'progress': BackupProgress - Progress updates during backup
 * - 'error': Error - Error events
 * - 'complete': BackupResult - When backup completes
 * - 'password-required': { udid: string } - When encrypted backup needs password (TASK-007)
 */
export class BackupService extends EventEmitter {
  private currentProcess: ChildProcess | null = null;
  private isRunning: boolean = false;
  private currentDeviceUdid: string | null = null;
  private startTime: number = 0;
  private lastProgress: BackupProgress | null = null;

  constructor() {
    super();
  }

  /**
   * Check what backup capabilities are available
   * IMPORTANT: Domain filtering is NOT supported - see docs/BACKUP_RESEARCH.md
   */
  async checkCapabilities(): Promise<BackupCapabilities> {
    // Domain filtering is NOT supported by idevicebackup2
    // This is documented in docs/BACKUP_RESEARCH.md
    return {
      supportsDomainFiltering: false,
      supportsIncremental: true,
      supportsSkipApps: true,
      supportsEncryption: true,
      availableDomains: [
        "HomeDomain",
        "CameraRollDomain",
        "AppDomain",
        "MediaDomain",
        "SystemPreferencesDomain",
      ],
    };
  }

  /**
   * Check if a device requires encrypted backup (TASK-007)
   * @param udid Device UDID
   * @returns Encryption info
   */
  async checkEncryptionStatus(udid: string): Promise<BackupEncryptionInfo> {
    try {
      const ideviceinfo = getCommand("ideviceinfo");

      return new Promise((resolve) => {
        const proc = spawn(ideviceinfo, ["-u", udid, "-k", "WillEncrypt"]);
        let output = "";
        let errorOutput = "";

        proc.stdout?.on("data", (data) => {
          output += data.toString();
        });

        proc.stderr?.on("data", (data) => {
          errorOutput += data.toString();
        });

        proc.on("close", (code) => {
          if (code === 0) {
            const willEncrypt = output.trim().toLowerCase() === "true";
            resolve({
              isEncrypted: willEncrypt,
              needsPassword: willEncrypt,
            });
          } else {
            log.warn(
              "[BackupService] Could not determine encryption status:",
              errorOutput,
            );
            resolve({
              isEncrypted: false,
              needsPassword: false,
            });
          }
        });

        proc.on("error", (error) => {
          log.error("[BackupService] Error checking encryption status:", error);
          resolve({
            isEncrypted: false,
            needsPassword: false,
          });
        });
      });
    } catch (error) {
      log.error("[BackupService] Exception checking encryption status:", error);
      return {
        isEncrypted: false,
        needsPassword: false,
      };
    }
  }

  /**
   * Get current backup status
   */
  getStatus(): BackupStatus {
    return {
      isRunning: this.isRunning,
      currentDeviceUdid: this.currentDeviceUdid,
      progress: this.lastProgress,
    };
  }

  /**
   * Start a backup operation
   *
   * Note: Due to iOS backup protocol limitations, this creates a full backup
   * (minus app data if skipApps is true). Domain-specific backups are not possible.
   *
   * @param options Backup options
   * @returns Promise resolving to backup result
   */
  async startBackup(options: BackupOptions): Promise<BackupResult> {
    if (this.isRunning) {
      throw new Error("Backup already in progress");
    }

    // Check encryption status (TASK-007)
    const encryptionInfo = await this.checkEncryptionStatus(options.udid);

    if (encryptionInfo.isEncrypted && !options.password) {
      // Emit event to signal UI should prompt for password
      this.emit("password-required", { udid: options.udid });

      return {
        success: false,
        backupPath: null,
        error: "Backup password required",
        errorCode: "PASSWORD_REQUIRED" as BackupErrorCode,
        duration: 0,
        deviceUdid: options.udid,
        isIncremental: false,
        backupSize: 0,
        isEncrypted: true,
      };
    }

    // Use mock mode for development
    if (isMockMode()) {
      return this.mockBackup(options);
    }

    const backupPath = options.outputDir || this.getDefaultBackupPath();
    const idevicebackup2 = getCommand("idevicebackup2");

    // Ensure backup directory exists
    await fs.mkdir(backupPath, { recursive: true });

    // Check if previous backup exists (for incremental detection)
    const deviceBackupPath = path.join(backupPath, options.udid);
    const previousBackupExists = await this.pathExists(deviceBackupPath);

    // Build command arguments
    const args = this.buildBackupArgs(options, backupPath);

    log.info("[BackupService] Starting backup with args:", args);
    log.info("[BackupService] Backup path:", backupPath);

    return new Promise((resolve) => {
      this.isRunning = true;
      this.currentDeviceUdid = options.udid;
      this.startTime = Date.now();
      this.lastProgress = {
        phase: "preparing",
        percentComplete: 0,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null,
      };
      this.emit("progress", this.lastProgress);

      this.currentProcess = spawn(idevicebackup2, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdoutBuffer = "";
      let stderrBuffer = "";

      this.currentProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        stdoutBuffer += output;
        log.debug("[BackupService] stdout:", output);

        const progress = this.parseProgress(output);
        if (progress) {
          this.lastProgress = progress;
          this.emit("progress", progress);
        }
      });

      this.currentProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;
        log.warn("[BackupService] stderr:", output);
      });

      this.currentProcess.on("error", (error: Error) => {
        log.error("[BackupService] Process error:", error);
        this.emit("error", error);
      });

      this.currentProcess.on("close", async (code: number | null) => {
        const duration = Date.now() - this.startTime;
        this.isRunning = false;
        this.currentProcess = null;
        this.currentDeviceUdid = null;

        const success = code === 0;
        let backupSize = 0;
        let finalBackupPath = deviceBackupPath;

        if (success) {
          backupSize = await this.calculateBackupSize(deviceBackupPath);
          log.info(
            `[BackupService] Backup completed successfully in ${duration}ms, size: ${backupSize} bytes`,
          );

          // Handle encrypted backup decryption (TASK-007)
          if (encryptionInfo.isEncrypted && options.password) {
            this.lastProgress = {
              phase: "decrypting",
              percentComplete: 95,
              currentFile: null,
              filesTransferred: 0,
              totalFiles: null,
              bytesTransferred: backupSize,
              totalBytes: backupSize,
              estimatedTimeRemaining: 30,
            };
            this.emit("progress", this.lastProgress);

            const decryptionResult =
              await backupDecryptionService.decryptBackup(
                deviceBackupPath,
                options.password,
              );

            if (!decryptionResult.success) {
              const result: BackupResult = {
                success: false,
                backupPath: deviceBackupPath,
                error: decryptionResult.error || "Decryption failed",
                errorCode:
                  decryptionResult.error === "Incorrect password"
                    ? ("INCORRECT_PASSWORD" as BackupErrorCode)
                    : ("DECRYPTION_FAILED" as BackupErrorCode),
                duration: Date.now() - this.startTime,
                deviceUdid: options.udid,
                isIncremental: previousBackupExists && !options.forceFullBackup,
                backupSize,
                isEncrypted: true,
              };
              this.emit("complete", result);
              resolve(result);
              return;
            }

            // Update path to decrypted location
            finalBackupPath = decryptionResult.decryptedPath!;
          }
        } else {
          log.error(`[BackupService] Backup failed with code ${code}`);
          log.error("[BackupService] stderr:", stderrBuffer);
        }

        const result: BackupResult = {
          success,
          backupPath: success ? finalBackupPath : null,
          error: success
            ? null
            : `Backup failed with code ${code}: ${stderrBuffer}`,
          duration: Date.now() - this.startTime,
          deviceUdid: options.udid,
          isIncremental: previousBackupExists && !options.forceFullBackup,
          backupSize,
          isEncrypted: encryptionInfo.isEncrypted,
        };

        this.lastProgress = {
          phase: "finishing",
          percentComplete: success ? 100 : 0,
          currentFile: null,
          filesTransferred: 0,
          totalFiles: null,
          bytesTransferred: backupSize,
          totalBytes: backupSize,
          estimatedTimeRemaining: 0,
        };
        this.emit("progress", this.lastProgress);
        this.emit("complete", result);

        resolve(result);
      });
    });
  }

  /**
   * Cancel an in-progress backup
   */
  cancelBackup(): void {
    if (this.currentProcess) {
      log.info("[BackupService] Cancelling backup");
      this.currentProcess.kill("SIGTERM");

      // Give it a moment, then force kill if needed
      setTimeout(() => {
        if (this.currentProcess) {
          this.currentProcess.kill("SIGKILL");
        }
      }, 5000);

      this.isRunning = false;
    }
  }

  /**
   * Build backup command arguments
   *
   * Note: We use --skip-apps to reduce backup size since we only need
   * messages and contacts which are in HomeDomain.
   */
  private buildBackupArgs(
    options: BackupOptions,
    backupPath: string,
  ): string[] {
    const args: string[] = [];

    // Target device by UDID
    args.push("-u", options.udid);

    // Command: backup
    args.push("backup");

    // Skip apps to reduce backup size (recommended for our use case)
    // This removes AppDomain which can be 10-30 GB
    if (options.skipApps !== false) {
      args.push("--skip-apps");
    }

    // Force full backup if requested (otherwise incremental)
    if (options.forceFullBackup) {
      args.push("--full");
    }

    // Backup destination path
    args.push(backupPath);

    return args;
  }

  /**
   * Parse idevicebackup2 output for progress information
   *
   * Example output patterns:
   * - "Receiving files"
   * - "Received 100 files"
   * - Progress percentage updates
   */
  private parseProgress(output: string): BackupProgress | null {
    // Check for file count pattern
    const filesMatch = output.match(/Received (\d+) files/);
    if (filesMatch) {
      const filesTransferred = parseInt(filesMatch[1], 10);
      return {
        phase: "transferring",
        percentComplete: Math.min(filesTransferred / 100, 99), // Estimate
        currentFile: null,
        filesTransferred,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null,
      };
    }

    // Check for percentage pattern
    const percentMatch = output.match(/(\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      return {
        phase: "transferring",
        percentComplete: percent,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: this.estimateTimeRemaining(percent),
      };
    }

    // Check for phase indicators
    if (output.includes("Receiving files")) {
      return {
        phase: "transferring",
        percentComplete: 5,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null,
      };
    }

    if (output.includes("Finishing")) {
      return {
        phase: "finishing",
        percentComplete: 95,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: 30,
      };
    }

    return null;
  }

  /**
   * Estimate remaining time based on progress and elapsed time
   */
  private estimateTimeRemaining(percentComplete: number): number | null {
    if (percentComplete <= 0 || this.startTime === 0) {
      return null;
    }

    const elapsed = (Date.now() - this.startTime) / 1000; // seconds
    const estimatedTotal = elapsed / (percentComplete / 100);
    const remaining = estimatedTotal - elapsed;

    return Math.max(0, Math.round(remaining));
  }

  /**
   * Get the default backup path in app's userData folder
   */
  private getDefaultBackupPath(): string {
    return path.join(app.getPath("userData"), "Backups");
  }

  /**
   * Calculate the total size of a backup directory
   */
  private async calculateBackupSize(backupPath: string): Promise<number> {
    try {
      if (!(await this.pathExists(backupPath))) {
        return 0;
      }

      let totalSize = 0;
      const files = await fs.readdir(backupPath, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(backupPath, file.name);
        if (file.isDirectory()) {
          totalSize += await this.calculateBackupSize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      log.error("[BackupService] Error calculating backup size:", error);
      return 0;
    }
  }

  /**
   * Check if a path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List existing backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const backupPath = this.getDefaultBackupPath();
    const backups: BackupInfo[] = [];

    try {
      if (!(await this.pathExists(backupPath))) {
        return backups;
      }

      const entries = await fs.readdir(backupPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const deviceBackupPath = path.join(backupPath, entry.name);
          const info = await this.getBackupInfo(deviceBackupPath, entry.name);
          if (info) {
            backups.push(info);
          }
        }
      }
    } catch (error) {
      log.error("[BackupService] Error listing backups:", error);
    }

    return backups;
  }

  /**
   * Get information about a specific backup
   */
  private async getBackupInfo(
    backupPath: string,
    udid: string,
  ): Promise<BackupInfo | null> {
    try {
      const stats = await fs.stat(backupPath);
      const size = await this.calculateBackupSize(backupPath);

      // Try to read Info.plist for device info
      let deviceName: string | null = null;
      let iosVersion: string | null = null;
      let isEncrypted = false;

      const infoPlistPath = path.join(backupPath, "Info.plist");
      if (await this.pathExists(infoPlistPath)) {
        // Basic parsing - in production, use a proper plist parser
        const content = await fs.readFile(infoPlistPath, "utf8");
        const deviceNameMatch = content.match(
          /<key>Device Name<\/key>\s*<string>([^<]+)<\/string>/,
        );
        const versionMatch = content.match(
          /<key>Product Version<\/key>\s*<string>([^<]+)<\/string>/,
        );
        const encryptedMatch = content.match(
          /<key>IsEncrypted<\/key>\s*<(true|false)/,
        );

        if (deviceNameMatch) deviceName = deviceNameMatch[1];
        if (versionMatch) iosVersion = versionMatch[1];
        if (encryptedMatch) isEncrypted = encryptedMatch[1] === "true";
      }

      return {
        path: backupPath,
        deviceUdid: udid,
        createdAt: stats.mtime,
        size,
        isEncrypted,
        iosVersion,
        deviceName,
      };
    } catch (error) {
      log.error("[BackupService] Error getting backup info:", error);
      return null;
    }
  }

  /**
   * Delete a backup for a specific device
   */
  async deleteBackup(backupPath: string): Promise<void> {
    log.info("[BackupService] Deleting backup:", backupPath);

    if (!(await this.pathExists(backupPath))) {
      log.warn("[BackupService] Backup path does not exist:", backupPath);
      return;
    }

    // Validate path is within our backup directory for safety
    const defaultPath = this.getDefaultBackupPath();
    if (!backupPath.startsWith(defaultPath)) {
      throw new Error("Cannot delete backup outside of backup directory");
    }

    await fs.rm(backupPath, { recursive: true, force: true });
    log.info("[BackupService] Backup deleted successfully");
  }

  /**
   * Clean up old backups, keeping only the most recent
   * @param keepCount Number of backups to keep per device (default: 1)
   */
  async cleanupOldBackups(keepCount: number = 1): Promise<void> {
    const backups = await this.listBackups();

    // Group by device UDID
    const byDevice = new Map<string, BackupInfo[]>();
    for (const backup of backups) {
      const existing = byDevice.get(backup.deviceUdid) || [];
      existing.push(backup);
      byDevice.set(backup.deviceUdid, existing);
    }

    // For each device, keep only the most recent backups
    for (const [udid, deviceBackups] of byDevice) {
      // Sort by date, newest first
      deviceBackups.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      // Delete older backups
      for (let i = keepCount; i < deviceBackups.length; i++) {
        log.info(
          `[BackupService] Cleaning up old backup for device ${udid}:`,
          deviceBackups[i].path,
        );
        await this.deleteBackup(deviceBackups[i].path);
      }
    }
  }

  /**
   * Clean up decrypted files after extraction (TASK-007)
   * @param backupPath Path to the backup
   */
  async cleanupDecryptedFiles(backupPath: string): Promise<void> {
    const decryptedPath = path.join(backupPath, "decrypted");
    await backupDecryptionService.cleanup(decryptedPath);
  }

  /**
   * Verify a backup password without performing full backup (TASK-007)
   */
  async verifyBackupPassword(
    backupPath: string,
    password: string,
  ): Promise<boolean> {
    return backupDecryptionService.verifyPassword(backupPath, password);
  }

  /**
   * Mock backup for development without actual device
   */
  private async mockBackup(options: BackupOptions): Promise<BackupResult> {
    log.info("[BackupService] Running mock backup");

    this.isRunning = true;
    this.currentDeviceUdid = options.udid;
    this.startTime = Date.now();

    // Simulate progress
    const phases: Array<{
      phase: BackupProgress["phase"];
      percent: number;
      delay: number;
    }> = [
      { phase: "preparing", percent: 0, delay: 500 },
      { phase: "transferring", percent: 10, delay: 500 },
      { phase: "transferring", percent: 30, delay: 500 },
      { phase: "transferring", percent: 50, delay: 500 },
      { phase: "transferring", percent: 70, delay: 500 },
      { phase: "transferring", percent: 90, delay: 500 },
      { phase: "finishing", percent: 100, delay: 500 },
    ];

    for (const step of phases) {
      await new Promise((resolve) => setTimeout(resolve, step.delay));
      this.lastProgress = {
        phase: step.phase,
        percentComplete: step.percent,
        currentFile: step.phase === "transferring" ? "mock_file.dat" : null,
        filesTransferred: Math.floor(step.percent * 10),
        totalFiles: 1000,
        bytesTransferred: step.percent * 1024 * 1024,
        totalBytes: 100 * 1024 * 1024,
        estimatedTimeRemaining: Math.max(0, (100 - step.percent) / 10),
      };
      this.emit("progress", this.lastProgress);
    }

    this.isRunning = false;
    this.currentDeviceUdid = null;

    const result: BackupResult = {
      success: true,
      backupPath: path.join(this.getDefaultBackupPath(), options.udid),
      error: null,
      duration: Date.now() - this.startTime,
      deviceUdid: options.udid,
      isIncremental: false,
      backupSize: 100 * 1024 * 1024, // 100 MB mock
    };

    this.emit("complete", result);
    return result;
  }
}

// Export singleton instance
export const backupService = new BackupService();
