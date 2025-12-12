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

  // Progress tracking for accurate overall progress
  private filesCompleted: number = 0;
  private totalFilesEstimate: number = 0;
  private bytesTransferred: number = 0;
  private currentFileProgress: number = 0;
  private lastFileSize: number = 0;

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
            log.info("[BackupService] Device encryption status:", {
              willEncrypt,
              rawOutput: output.trim(),
            });
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

      // Reset progress tracking
      this.filesCompleted = 0;
      this.totalFilesEstimate = 0;
      this.bytesTransferred = 0;
      this.currentFileProgress = 0;
      this.lastFileSize = 0;

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

        // Only log non-progress-bar output (progress bars are very spammy)
        // Progress bars look like: [====] XX% (X.X MB/Y.Y MB)
        const isProgressBar = /\[=*\s*\]\s*\d+%/.test(output);
        if (!isProgressBar && output.trim()) {
          log.debug("[BackupService] stdout:", output.trim());
        }

        const progress = this.parseProgress(output);
        if (progress) {
          this.lastProgress = progress;
          this.emit("progress", progress);
        }
      });

      this.currentProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;

        // Only log non-progress-bar output (progress bars are very spammy)
        const isProgressBar = /\[=*\s*\]\s*\d+%/.test(output);
        if (!isProgressBar && output.trim()) {
          log.warn("[BackupService] stderr:", output.trim());
        }
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

          // Check ACTUAL encryption status from backup on disk (not just device setting)
          // The device's WillEncrypt flag may not reflect existing backup encryption
          const actuallyEncrypted = await backupDecryptionService.isBackupEncrypted(deviceBackupPath);
          log.info("[BackupService] Backup encryption check:", {
            deviceWillEncrypt: encryptionInfo.isEncrypted,
            backupActuallyEncrypted: actuallyEncrypted,
          });

          // Update encryption info to reflect actual backup state
          if (actuallyEncrypted !== encryptionInfo.isEncrypted) {
            log.warn("[BackupService] Encryption mismatch - backup on disk differs from device setting");
            encryptionInfo.isEncrypted = actuallyEncrypted;
            encryptionInfo.needsPassword = actuallyEncrypted;
          }

          // Handle encrypted backup - need password to proceed
          if (actuallyEncrypted && !options.password) {
            // Backup is encrypted but no password provided - need to ask user
            log.info("[BackupService] Backup is encrypted but no password provided, requesting password");
            this.emit("password-required", { udid: options.udid });

            const result: BackupResult = {
              success: false,
              backupPath: deviceBackupPath,
              error: "Backup password required",
              errorCode: "PASSWORD_REQUIRED" as BackupErrorCode,
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

          // Handle encrypted backup decryption (TASK-007)
          if (actuallyEncrypted && options.password) {
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

        // Convert error code to user-friendly message
        let errorMessage: string | null = null;
        if (!success) {
          errorMessage = this.getErrorMessage(code, stderrBuffer);
        }

        const result: BackupResult = {
          success,
          backupPath: success ? finalBackupPath : null,
          error: errorMessage,
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
   * - "[====================                              ]  39% (18.8 MB/48.3 MB)"
   * - "Receiving files"
   * - "Received 100 files"
   *
   * Note: The percentage shown is per-file, not overall. Each file goes 0-100%.
   * We track cumulative bytes transferred to show accurate overall progress.
   */
  private parseProgress(output: string): BackupProgress | null {
    // Parse progress bar format: "[====...] XX% (X.X MB/Y.Y MB)"
    // This gives us per-file progress with current/total bytes for that file
    const progressMatch = output.match(
      /\[[\s=]+\]\s*(\d+)%\s*\((\d+(?:\.\d+)?)\s*(MB|KB|GB)\/(\d+(?:\.\d+)?)\s*(MB|KB|GB)\)/
    );

    if (progressMatch) {
      const filePercent = parseInt(progressMatch[1], 10);
      const currentBytes = this.parseBytes(
        parseFloat(progressMatch[2]),
        progressMatch[3]
      );
      const totalFileBytes = this.parseBytes(
        parseFloat(progressMatch[4]),
        progressMatch[5]
      );

      // Track when a file completes (goes from high % to low %)
      if (filePercent < this.currentFileProgress - 50 && this.currentFileProgress > 90) {
        // Previous file completed, add its size to our total
        this.bytesTransferred += this.lastFileSize;
        this.filesCompleted++;
        log.debug(
          `[BackupService] File completed. Total transferred: ${this.bytesTransferred}, Files: ${this.filesCompleted}`
        );
      }

      this.currentFileProgress = filePercent;
      this.lastFileSize = totalFileBytes;

      // Calculate overall progress based on cumulative bytes
      // We add the current file's progress to previously completed files
      const totalTransferred = this.bytesTransferred + currentBytes;

      // Estimate total based on time elapsed and transfer rate
      // For display, we show the current file's context
      const overallPercent = this.calculateOverallPercent(totalTransferred);

      return {
        phase: "transferring",
        percentComplete: overallPercent,
        currentFile: null,
        filesTransferred: this.filesCompleted,
        totalFiles: null,
        bytesTransferred: totalTransferred,
        totalBytes: null, // We don't know total until complete
        estimatedTimeRemaining: this.estimateTimeRemaining(overallPercent),
      };
    }

    // Check for file count pattern (end of backup)
    const filesMatch = output.match(/Received (\d+) files/);
    if (filesMatch) {
      const filesTransferred = parseInt(filesMatch[1], 10);
      this.totalFilesEstimate = filesTransferred;
      return {
        phase: "finishing",
        percentComplete: 95,
        currentFile: null,
        filesTransferred,
        totalFiles: filesTransferred,
        bytesTransferred: this.bytesTransferred,
        totalBytes: this.bytesTransferred,
        estimatedTimeRemaining: 30,
      };
    }

    // Check for phase indicators - early initialization phases
    if (output.includes("Requesting backup") || output.includes("Starting backup")) {
      return {
        phase: "preparing",
        percentComplete: 0,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null,
      };
    }

    // Waiting for device to respond (can take a few minutes after trust/passcode)
    if (output.includes("Waiting") || output.includes("Starting data")) {
      return {
        phase: "preparing",
        percentComplete: 0,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null,
      };
    }

    if (output.includes("Receiving files")) {
      return {
        phase: "transferring",
        percentComplete: 1,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null,
      };
    }

    if (output.includes("Finishing") || output.includes("Backup Successful")) {
      return {
        phase: "finishing",
        percentComplete: 98,
        currentFile: null,
        filesTransferred: this.filesCompleted,
        totalFiles: this.filesCompleted,
        bytesTransferred: this.bytesTransferred,
        totalBytes: this.bytesTransferred,
        estimatedTimeRemaining: 10,
      };
    }

    return null;
  }

  /**
   * Convert exit code to user-friendly error message
   */
  private getErrorMessage(code: number | null, stderr: string): string {
    // Convert unsigned 32-bit to signed (Windows wraps negative codes)
    const signedCode = code !== null && code > 2147483647 ? code - 4294967296 : code;

    // Check stderr for specific error messages first
    const stderrLower = stderr.toLowerCase();

    if (stderrLower.includes("password") || stderrLower.includes("incorrect")) {
      return "Incorrect backup password. Please try again with the correct password.";
    }

    if (stderrLower.includes("locked") || stderrLower.includes("passcode")) {
      return "iPhone is locked. Please unlock your iPhone and try again.";
    }

    if (stderrLower.includes("trust") || stderrLower.includes("pair")) {
      return "iPhone trust not established. Please disconnect and reconnect your iPhone, then tap 'Trust' when prompted.";
    }

    if (stderrLower.includes("no device") || stderrLower.includes("not found")) {
      return "iPhone disconnected. Please reconnect your iPhone and try again.";
    }

    if (stderrLower.includes("disk") || stderrLower.includes("space") || stderrLower.includes("storage")) {
      return "Not enough disk space to complete the backup. Please free up space and try again.";
    }

    // Check by exit code
    switch (signedCode) {
      case -208:
      case -207:
        // Connection lost / device disconnected
        return "Connection to iPhone was lost. Please make sure your iPhone stays connected and unlocked during the sync.";

      case -1:
        return "Backup was cancelled.";

      case 1:
        return "Backup failed. Please make sure your iPhone is unlocked and connected.";

      case 2:
        return "Invalid backup configuration. Please try again.";

      default:
        // Generic error with code
        if (stderr.trim()) {
          return `Backup failed: ${stderr.trim().substring(0, 200)}`;
        }
        return `Backup failed with error code ${code}. Please try again.`;
    }
  }

  /**
   * Parse bytes from value and unit
   */
  private parseBytes(value: number, unit: string): number {
    switch (unit.toUpperCase()) {
      case "KB":
        return value * 1024;
      case "MB":
        return value * 1024 * 1024;
      case "GB":
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  /**
   * Calculate overall progress percentage
   * Uses time-based estimation since we don't know total size upfront
   */
  private calculateOverallPercent(bytesTransferred: number): number {
    // For first sync, we use a time-based approach
    // Typical first sync: 30-60 minutes for ~5-20GB
    // Subsequent syncs: 1-5 minutes

    const elapsedMs = Date.now() - this.startTime;
    const elapsedMinutes = elapsedMs / 1000 / 60;

    // Calculate transfer rate (bytes per minute)
    const transferRate = bytesTransferred / Math.max(elapsedMinutes, 0.1);

    // Estimate total time based on typical backup sizes
    // We use a heuristic: if we've been going > 5 min, assume it's a larger backup
    let estimatedTotalMinutes: number;

    if (elapsedMinutes < 2) {
      // Early phase - assume 10 minutes total (will adjust as we go)
      estimatedTotalMinutes = 10;
    } else if (elapsedMinutes < 10) {
      // Getting data - estimate based on rate
      // Assume we're roughly 1/3 through at 10 min mark
      estimatedTotalMinutes = Math.max(elapsedMinutes * 3, 15);
    } else {
      // Long backup - use logarithmic scaling to avoid stalling at high %
      estimatedTotalMinutes = elapsedMinutes * 1.5;
    }

    // Calculate percentage, capped at 94% until we get completion signal
    const percent = Math.min((elapsedMinutes / estimatedTotalMinutes) * 100, 94);

    // Blend with file completion estimate if we have it
    if (this.filesCompleted > 10) {
      // Once we have enough files, use a weighted average
      // This helps smooth out the progress
      const fileBasedPercent = Math.min(
        (this.bytesTransferred / (this.bytesTransferred + this.lastFileSize * 5)) * 100,
        94
      );
      return Math.max(percent, fileBasedPercent);
    }

    return Math.max(percent, 1); // Never show 0%
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
   * Check if a backup for a device exists and its status
   * @param udid Device UDID
   * @returns Backup status info or null if no backup exists
   */
  async checkBackupStatus(udid: string): Promise<{
    exists: boolean;
    isComplete: boolean;
    isCorrupted: boolean;
    lastModified: Date | null;
    sizeBytes: number;
  } | null> {
    const backupPath = this.getDefaultBackupPath();
    const deviceBackupPath = path.join(backupPath, udid);

    try {
      if (!(await this.pathExists(deviceBackupPath))) {
        return null;
      }

      const stats = await fs.stat(deviceBackupPath);
      const size = await this.calculateBackupSize(deviceBackupPath);

      // Check for key files that indicate backup completeness
      const manifestPath = path.join(deviceBackupPath, "Manifest.db");
      const infoPlistPath = path.join(deviceBackupPath, "Info.plist");
      const statusPlistPath = path.join(deviceBackupPath, "Status.plist");

      const hasManifest = await this.pathExists(manifestPath);
      const hasInfoPlist = await this.pathExists(infoPlistPath);
      const hasStatusPlist = await this.pathExists(statusPlistPath);

      // A complete backup should have Manifest.db and Info.plist
      // Status.plist contains backup state info
      const isComplete = hasManifest && hasInfoPlist;

      // Check for corruption indicators
      let isCorrupted = false;
      if (hasStatusPlist) {
        try {
          const statusContent = await fs.readFile(statusPlistPath, "utf8");
          // If Status.plist indicates backup was in progress, it was interrupted
          if (statusContent.includes("BackupState") && statusContent.includes("InProgress")) {
            isCorrupted = true;
          }
        } catch {
          // Can't read status, assume potentially corrupted
          isCorrupted = !isComplete;
        }
      }

      log.info(`[BackupService] Backup status for ${udid}:`, {
        exists: true,
        isComplete,
        isCorrupted,
        hasManifest,
        hasInfoPlist,
        hasStatusPlist,
        sizeBytes: size,
      });

      return {
        exists: true,
        isComplete,
        isCorrupted,
        lastModified: stats.mtime,
        sizeBytes: size,
      };
    } catch (error) {
      log.error("[BackupService] Error checking backup status:", error);
      return null;
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
