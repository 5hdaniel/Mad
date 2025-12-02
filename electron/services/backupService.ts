/**
 * Backup Service
 *
 * Handles iPhone backup operations using idevicebackup2 CLI tool.
 * Extracts messages and contacts from iPhone backups.
 *
 * IMPORTANT: Domain filtering is NOT supported by idevicebackup2 at backup time.
 * See docs/BACKUP_RESEARCH.md for full research findings.
 *
 * OPTIMIZATION: After backup completes, we extract only HomeDomain files
 * (messages, contacts) and delete the rest (CameraRoll, etc.) to save space.
 * This reduces final storage from 20-60 GB to ~1-2 GB.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { app } from 'electron';
import { promises as fs } from 'fs';
import log from 'electron-log';
import { getCommand, isMockMode } from './libimobiledeviceService';
import {
  BackupProgress,
  BackupResult,
  BackupOptions,
  BackupCapabilities,
  BackupInfo,
  BackupStatus
} from '../types/backup';

/**
 * Service for managing iPhone backups via idevicebackup2
 *
 * Emits events:
 * - 'progress': BackupProgress - Progress updates during backup
 * - 'error': Error - Error events
 * - 'complete': BackupResult - When backup completes
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
        'HomeDomain',
        'CameraRollDomain',
        'AppDomain',
        'MediaDomain',
        'SystemPreferencesDomain'
      ]
    };
  }

  /**
   * Get current backup status
   */
  getStatus(): BackupStatus {
    return {
      isRunning: this.isRunning,
      currentDeviceUdid: this.currentDeviceUdid,
      progress: this.lastProgress
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
      throw new Error('Backup already in progress');
    }

    // Use mock mode for development
    if (isMockMode()) {
      return this.mockBackup(options);
    }

    const backupPath = options.outputDir || this.getDefaultBackupPath();
    const idevicebackup2 = getCommand('idevicebackup2');

    // Ensure backup directory exists
    await fs.mkdir(backupPath, { recursive: true });

    // Check if previous backup exists (for incremental detection)
    const deviceBackupPath = path.join(backupPath, options.udid);
    const previousBackupExists = await this.pathExists(deviceBackupPath);

    // Build command arguments
    const args = this.buildBackupArgs(options, backupPath);

    log.info('[BackupService] Starting backup with args:', args);
    log.info('[BackupService] Backup path:', backupPath);

    return new Promise((resolve) => {
      this.isRunning = true;
      this.currentDeviceUdid = options.udid;
      this.startTime = Date.now();
      this.lastProgress = {
        phase: 'preparing',
        percentComplete: 0,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null
      };
      this.emit('progress', this.lastProgress);

      this.currentProcess = spawn(idevicebackup2, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdoutBuffer = '';
      let stderrBuffer = '';

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        stdoutBuffer += output;
        log.debug('[BackupService] stdout:', output);

        const progress = this.parseProgress(output);
        if (progress) {
          this.lastProgress = progress;
          this.emit('progress', progress);
        }
      });

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        stderrBuffer += output;
        log.warn('[BackupService] stderr:', output);
      });

      this.currentProcess.on('error', (error: Error) => {
        log.error('[BackupService] Process error:', error);
        this.emit('error', error);
      });

      this.currentProcess.on('close', async (code: number | null) => {
        const duration = Date.now() - this.startTime;
        this.isRunning = false;
        this.currentProcess = null;
        this.currentDeviceUdid = null;

        const success = code === 0;
        let backupSize = 0;

        if (success) {
          backupSize = await this.calculateBackupSize(deviceBackupPath);
          log.info(`[BackupService] Backup completed successfully in ${duration}ms, size: ${backupSize} bytes`);
        } else {
          log.error(`[BackupService] Backup failed with code ${code}`);
          log.error('[BackupService] stderr:', stderrBuffer);
        }

        const result: BackupResult = {
          success,
          backupPath: success ? deviceBackupPath : null,
          error: success ? null : `Backup failed with code ${code}: ${stderrBuffer}`,
          duration,
          deviceUdid: options.udid,
          isIncremental: previousBackupExists && !options.forceFullBackup,
          backupSize
        };

        this.lastProgress = {
          phase: 'finishing',
          percentComplete: success ? 100 : 0,
          currentFile: null,
          filesTransferred: 0,
          totalFiles: null,
          bytesTransferred: backupSize,
          totalBytes: backupSize,
          estimatedTimeRemaining: 0
        };
        this.emit('progress', this.lastProgress);
        this.emit('complete', result);

        resolve(result);
      });
    });
  }

  /**
   * Cancel an in-progress backup
   */
  cancelBackup(): void {
    if (this.currentProcess) {
      log.info('[BackupService] Cancelling backup');
      this.currentProcess.kill('SIGTERM');

      // Give it a moment, then force kill if needed
      setTimeout(() => {
        if (this.currentProcess) {
          this.currentProcess.kill('SIGKILL');
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
  private buildBackupArgs(options: BackupOptions, backupPath: string): string[] {
    const args: string[] = [];

    // Target device by UDID
    args.push('-u', options.udid);

    // Command: backup
    args.push('backup');

    // Skip apps to reduce backup size (recommended for our use case)
    // This removes AppDomain which can be 10-30 GB
    if (options.skipApps !== false) {
      args.push('--skip-apps');
    }

    // Force full backup if requested (otherwise incremental)
    if (options.forceFullBackup) {
      args.push('--full');
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
        phase: 'transferring',
        percentComplete: Math.min(filesTransferred / 100, 99), // Estimate
        currentFile: null,
        filesTransferred,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null
      };
    }

    // Check for percentage pattern
    const percentMatch = output.match(/(\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1]);
      return {
        phase: 'transferring',
        percentComplete: percent,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: this.estimateTimeRemaining(percent)
      };
    }

    // Check for phase indicators
    if (output.includes('Receiving files')) {
      return {
        phase: 'transferring',
        percentComplete: 5,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: null
      };
    }

    if (output.includes('Finishing')) {
      return {
        phase: 'finishing',
        percentComplete: 95,
        currentFile: null,
        filesTransferred: 0,
        totalFiles: null,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: 30
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
    return path.join(app.getPath('userData'), 'Backups');
  }

  /**
   * Calculate the total size of a backup directory
   */
  private async calculateBackupSize(backupPath: string): Promise<number> {
    try {
      if (!await this.pathExists(backupPath)) {
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
      log.error('[BackupService] Error calculating backup size:', error);
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
      if (!await this.pathExists(backupPath)) {
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
      log.error('[BackupService] Error listing backups:', error);
    }

    return backups;
  }

  /**
   * Get information about a specific backup
   */
  private async getBackupInfo(backupPath: string, udid: string): Promise<BackupInfo | null> {
    try {
      const stats = await fs.stat(backupPath);
      const size = await this.calculateBackupSize(backupPath);

      // Try to read Info.plist for device info
      let deviceName: string | null = null;
      let iosVersion: string | null = null;
      let isEncrypted = false;

      const infoPlistPath = path.join(backupPath, 'Info.plist');
      if (await this.pathExists(infoPlistPath)) {
        // Basic parsing - in production, use a proper plist parser
        const content = await fs.readFile(infoPlistPath, 'utf8');
        const deviceNameMatch = content.match(/<key>Device Name<\/key>\s*<string>([^<]+)<\/string>/);
        const versionMatch = content.match(/<key>Product Version<\/key>\s*<string>([^<]+)<\/string>/);
        const encryptedMatch = content.match(/<key>IsEncrypted<\/key>\s*<(true|false)/);

        if (deviceNameMatch) deviceName = deviceNameMatch[1];
        if (versionMatch) iosVersion = versionMatch[1];
        if (encryptedMatch) isEncrypted = encryptedMatch[1] === 'true';
      }

      return {
        path: backupPath,
        deviceUdid: udid,
        createdAt: stats.mtime,
        size,
        isEncrypted,
        iosVersion,
        deviceName
      };
    } catch (error) {
      log.error('[BackupService] Error getting backup info:', error);
      return null;
    }
  }

  /**
   * Delete a backup for a specific device
   */
  async deleteBackup(backupPath: string): Promise<void> {
    log.info('[BackupService] Deleting backup:', backupPath);

    if (!await this.pathExists(backupPath)) {
      log.warn('[BackupService] Backup path does not exist:', backupPath);
      return;
    }

    // Validate path is within our backup directory for safety
    const defaultPath = this.getDefaultBackupPath();
    if (!backupPath.startsWith(defaultPath)) {
      throw new Error('Cannot delete backup outside of backup directory');
    }

    await fs.rm(backupPath, { recursive: true, force: true });
    log.info('[BackupService] Backup deleted successfully');
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
      deviceBackups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Delete older backups
      for (let i = keepCount; i < deviceBackups.length; i++) {
        log.info(`[BackupService] Cleaning up old backup for device ${udid}:`, deviceBackups[i].path);
        await this.deleteBackup(deviceBackups[i].path);
      }
    }
  }

  /**
   * Extract only HomeDomain files from a backup and delete the rest.
   * This significantly reduces storage from 20-60 GB to ~1-2 GB.
   *
   * HomeDomain contains:
   * - Messages (Library/SMS/sms.db)
   * - Contacts (Library/AddressBook/AddressBook.sqlitedb)
   * - Call history, voicemail, notes, etc.
   *
   * @param backupPath Path to the backup directory
   * @returns Object with extraction results
   */
  async extractHomeDomainOnly(backupPath: string): Promise<{
    success: boolean;
    filesKept: number;
    filesDeleted: number;
    spaceFreed: number;
    error: string | null;
  }> {
    log.info('[BackupService] Extracting HomeDomain files from backup:', backupPath);

    this.lastProgress = {
      phase: 'extracting',
      percentComplete: 0,
      currentFile: 'Parsing Manifest.db...',
      filesTransferred: 0,
      totalFiles: null,
      bytesTransferred: 0,
      totalBytes: null,
      estimatedTimeRemaining: null
    };
    this.emit('progress', this.lastProgress);

    try {
      const manifestDbPath = path.join(backupPath, 'Manifest.db');
      if (!await this.pathExists(manifestDbPath)) {
        throw new Error('Manifest.db not found in backup');
      }

      // Get HomeDomain file IDs from Manifest.db
      const homeDomainFileIds = await this.getHomeDomainFileIds(manifestDbPath);
      log.info(`[BackupService] Found ${homeDomainFileIds.size} HomeDomain files`);

      // Essential metadata files to keep (not in Manifest.db)
      const essentialFiles = new Set([
        'Manifest.db',
        'Manifest.plist',
        'Info.plist',
        'Status.plist'
      ]);

      // Get all files in backup and delete non-HomeDomain ones
      let filesKept = 0;
      let filesDeleted = 0;
      let spaceFreed = 0;

      const entries = await fs.readdir(backupPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(backupPath, entry.name);

        if (entry.isDirectory()) {
          // This is a hash prefix directory (00-ff)
          // Contains actual backup files named by their SHA1 hash
          const subEntries = await fs.readdir(entryPath, { withFileTypes: true });

          for (const subEntry of subEntries) {
            if (subEntry.isFile()) {
              const fileId = subEntry.name;
              const filePath = path.join(entryPath, fileId);

              if (homeDomainFileIds.has(fileId)) {
                filesKept++;
              } else {
                // Delete non-HomeDomain file
                const stats = await fs.stat(filePath);
                spaceFreed += stats.size;
                await fs.unlink(filePath);
                filesDeleted++;
              }
            }
          }

          // Remove empty directories
          const remainingFiles = await fs.readdir(entryPath);
          if (remainingFiles.length === 0) {
            await fs.rmdir(entryPath);
          }
        } else if (entry.isFile()) {
          // Root-level file - keep if essential
          if (!essentialFiles.has(entry.name)) {
            const stats = await fs.stat(entryPath);
            spaceFreed += stats.size;
            await fs.unlink(entryPath);
            filesDeleted++;
          } else {
            filesKept++;
          }
        }
      }

      log.info(`[BackupService] Extraction complete: kept ${filesKept} files, deleted ${filesDeleted} files, freed ${this.formatBytes(spaceFreed)}`);

      this.lastProgress = {
        phase: 'extracting',
        percentComplete: 100,
        currentFile: null,
        filesTransferred: filesKept,
        totalFiles: filesKept + filesDeleted,
        bytesTransferred: 0,
        totalBytes: null,
        estimatedTimeRemaining: 0
      };
      this.emit('progress', this.lastProgress);

      return {
        success: true,
        filesKept,
        filesDeleted,
        spaceFreed,
        error: null
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      log.error('[BackupService] Extraction failed:', errorMsg);
      return {
        success: false,
        filesKept: 0,
        filesDeleted: 0,
        spaceFreed: 0,
        error: errorMsg
      };
    }
  }

  /**
   * Get file IDs (SHA1 hashes) for HomeDomain files from Manifest.db
   *
   * Manifest.db schema:
   * - Files table with columns: fileID, domain, relativePath, flags, file
   * - fileID is the SHA1 hash used as the filename in backup
   * - domain is like "HomeDomain", "CameraRollDomain", etc.
   */
  private async getHomeDomainFileIds(manifestDbPath: string): Promise<Set<string>> {
    return new Promise((resolve, reject) => {
      // Use sqlite3 module (already a dependency in the project)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqlite3 = require('sqlite3').verbose();
      const db = new sqlite3.Database(manifestDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to open Manifest.db: ${err.message}`));
          return;
        }
      });

      const fileIds = new Set<string>();

      // Query for HomeDomain files only
      // Also include related domains that contain essential data
      const query = `
        SELECT fileID FROM Files
        WHERE domain IN ('HomeDomain', 'WirelessDomain', 'SystemPreferencesDomain')
      `;

      db.each(
        query,
        (err: Error | null, row: { fileID: string }) => {
          if (err) {
            log.warn('[BackupService] Error reading row:', err);
            return;
          }
          if (row.fileID) {
            fileIds.add(row.fileID);
          }
        },
        (err: Error | null, count: number) => {
          db.close();
          if (err) {
            reject(new Error(`Failed to query Manifest.db: ${err.message}`));
          } else {
            log.debug(`[BackupService] Queried ${count} HomeDomain files from Manifest.db`);
            resolve(fileIds);
          }
        }
      );
    });
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Mock backup for development without actual device
   */
  private async mockBackup(options: BackupOptions): Promise<BackupResult> {
    log.info('[BackupService] Running mock backup');

    this.isRunning = true;
    this.currentDeviceUdid = options.udid;
    this.startTime = Date.now();

    // Simulate progress
    const phases: Array<{ phase: BackupProgress['phase']; percent: number; delay: number }> = [
      { phase: 'preparing', percent: 0, delay: 500 },
      { phase: 'transferring', percent: 10, delay: 500 },
      { phase: 'transferring', percent: 30, delay: 500 },
      { phase: 'transferring', percent: 50, delay: 500 },
      { phase: 'transferring', percent: 70, delay: 500 },
      { phase: 'transferring', percent: 90, delay: 500 },
      { phase: 'finishing', percent: 100, delay: 500 }
    ];

    for (const step of phases) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      this.lastProgress = {
        phase: step.phase,
        percentComplete: step.percent,
        currentFile: step.phase === 'transferring' ? 'mock_file.dat' : null,
        filesTransferred: Math.floor(step.percent * 10),
        totalFiles: 1000,
        bytesTransferred: step.percent * 1024 * 1024,
        totalBytes: 100 * 1024 * 1024,
        estimatedTimeRemaining: Math.max(0, (100 - step.percent) / 10)
      };
      this.emit('progress', this.lastProgress);
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
      backupSize: 100 * 1024 * 1024 // 100 MB mock
    };

    this.emit('complete', result);
    return result;
  }
}

// Export singleton instance
export const backupService = new BackupService();
