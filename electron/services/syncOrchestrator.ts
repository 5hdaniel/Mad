/**
 * Sync Orchestrator Service
 *
 * Orchestrates the complete iPhone sync flow on Windows:
 * 1. Device detection
 * 2. iPhone backup creation
 * 3. Backup decryption (if encrypted)
 * 4. Messages and contacts extraction
 * 5. Contact name resolution
 * 6. Cleanup
 *
 * This is the main integration point for all iPhone-related services.
 */

import { EventEmitter } from "events";
import log from "electron-log";
import checkDiskSpace from "check-disk-space";
import { app } from "electron";
import path from "path";
import {
  DeviceDetectionService,
  deviceDetectionService,
} from "./deviceDetectionService";
import { BackupService } from "./backupService";
import { BackupDecryptionService } from "./backupDecryptionService";
import { iOSMessagesParser } from "./iosMessagesParser";
import { iOSContactsParser } from "./iosContactsParser";
import type { iOSDevice } from "../types/device";
import type { iOSMessage, iOSConversation } from "../types/iosMessages";
import type { iOSContact } from "../types/iosContacts";
import type { BackupProgress } from "../types/backup";

/**
 * Sync phases for progress tracking
 */
export type SyncPhase =
  | "idle"
  | "backup"
  | "decrypting"
  | "parsing-contacts"
  | "parsing-messages"
  | "resolving"
  | "cleanup"
  | "complete"
  | "error";

/**
 * Result of a complete sync operation
 */
export interface SyncResult {
  success: boolean;
  messages: iOSMessage[];
  contacts: iOSContact[];
  conversations: iOSConversation[];
  error: string | null;
  duration: number;
}

/**
 * Options for starting a sync operation
 */
export interface SyncOptions {
  /** Device UDID to sync */
  udid: string;
  /** Password for encrypted backups */
  password?: string;
  /** Force full backup (no incremental) */
  forceFullBackup?: boolean;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  phase: SyncPhase;
  phaseProgress: number;
  overallProgress: number;
  message: string;
  backupProgress?: BackupProgress;
  /** Estimated total backup size in bytes (for progress calculation) */
  estimatedTotalBytes?: number;
}

/**
 * SyncOrchestrator - Main integration service for iPhone sync on Windows
 *
 * Events:
 * - 'progress': SyncProgress - Progress updates during sync
 * - 'phase': SyncPhase - Phase changes
 * - 'device-connected': iOSDevice - Device connected
 * - 'device-disconnected': iOSDevice - Device disconnected
 * - 'password-required': void - Encrypted backup needs password
 * - 'error': Error - Error during sync
 * - 'complete': SyncResult - Sync completed
 *
 * @example
 * ```typescript
 * const orchestrator = new SyncOrchestrator();
 * orchestrator.on('progress', (progress) => console.log(progress));
 * const result = await orchestrator.sync({ udid: '...' });
 * ```
 */
export class SyncOrchestrator extends EventEmitter {
  private deviceService: DeviceDetectionService;
  private backupService: BackupService;
  private decryptionService: BackupDecryptionService;
  private messagesParser: iOSMessagesParser;
  private contactsParser: iOSContactsParser;

  private isRunning: boolean = false;
  private isCancelled: boolean = false;
  private currentPhase: SyncPhase = "idle";
  private estimatedBackupSize: number = 0;
  private startTime: number = 0;

  constructor() {
    super();
    this.deviceService = deviceDetectionService;
    this.backupService = new BackupService();
    this.decryptionService = new BackupDecryptionService();
    this.messagesParser = new iOSMessagesParser();
    this.contactsParser = new iOSContactsParser();

    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from child services
   */
  private setupEventForwarding(): void {
    // Forward backup progress events
    this.backupService.on("progress", (progress: BackupProgress) => {
      // Calculate progress based on bytes transferred if we have estimated size
      let calculatedProgress = progress.percentComplete;
      if (this.estimatedBackupSize > 0 && progress.bytesTransferred > 0) {
        // Calculate based on actual bytes vs estimated total
        calculatedProgress = Math.min(
          (progress.bytesTransferred / this.estimatedBackupSize) * 100,
          99 // Cap at 99% until we get completion signal
        );
      }

      this.emitProgress({
        phase: "backup",
        phaseProgress: calculatedProgress,
        overallProgress: this.calculateOverallProgress(
          "backup",
          calculatedProgress,
        ),
        message: this.getBackupProgressMessage(progress),
        backupProgress: progress,
        estimatedTotalBytes: this.estimatedBackupSize > 0 ? this.estimatedBackupSize : undefined,
      });
    });

    // Forward password required events
    this.backupService.on("password-required", () => {
      this.emit("password-required");
    });

    // Forward passcode waiting events (user needs to enter passcode on iPhone)
    this.backupService.on("waiting-for-passcode", () => {
      log.info("[SyncOrchestrator] Waiting for user to enter passcode on iPhone");
      this.emit("waiting-for-passcode");
    });

    this.backupService.on("passcode-entered", () => {
      log.info("[SyncOrchestrator] User entered passcode, backup starting");
      this.emit("passcode-entered");
    });

    // Forward device events
    this.deviceService.on("device-connected", (device: iOSDevice) => {
      this.emit("device-connected", device);
    });

    this.deviceService.on("device-disconnected", (device: iOSDevice) => {
      this.emit("device-disconnected", device);
    });
  }

  /**
   * Start the sync process
   */
  async sync(options: SyncOptions): Promise<SyncResult> {
    if (this.isRunning) {
      return this.errorResult("Sync already in progress");
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.startTime = Date.now();
    this.estimatedBackupSize = 0;

    log.info("[SyncOrchestrator] Starting sync", { udid: options.udid });

    try {
      // Step 0: Check for existing/interrupted backups
      this.emitProgress({
        phase: "backup",
        phaseProgress: 0,
        overallProgress: 0,
        message: "Initializing sync...",
      });

      // Check if there's an existing backup (could be complete or interrupted)
      const backupStatus = await this.backupService.checkBackupStatus(options.udid);
      let existingBackupSize = 0;

      if (backupStatus) {
        existingBackupSize = backupStatus.sizeBytes;
        const sizeGB = (backupStatus.sizeBytes / 1024 / 1024 / 1024).toFixed(1);

        if (backupStatus.isCorrupted) {
          log.warn("[SyncOrchestrator] Previous backup was interrupted, will attempt to resume");
          this.emitProgress({
            phase: "backup",
            phaseProgress: 0,
            overallProgress: 0,
            message: `Found interrupted backup (${sizeGB} GB). Resuming...`,
          });
        } else if (backupStatus.isComplete) {
          const lastSync = backupStatus.lastModified;
          const timeSinceLastSync = lastSync ? Math.round((Date.now() - lastSync.getTime()) / 1000 / 60) : null;
          log.info(`[SyncOrchestrator] Previous backup exists (${sizeGB} GB), last modified ${timeSinceLastSync} minutes ago`);

          // Format time since last sync for user
          let timeAgoStr = "";
          if (timeSinceLastSync !== null) {
            if (timeSinceLastSync < 60) {
              timeAgoStr = `${timeSinceLastSync} minutes ago`;
            } else if (timeSinceLastSync < 1440) {
              timeAgoStr = `${Math.round(timeSinceLastSync / 60)} hours ago`;
            } else {
              timeAgoStr = `${Math.round(timeSinceLastSync / 1440)} days ago`;
            }
          }

          this.emitProgress({
            phase: "backup",
            phaseProgress: 0,
            overallProgress: 0,
            message: `Found previous backup (${sizeGB} GB, synced ${timeAgoStr})`,
          });

          // Brief pause to let user see this message
          await new Promise(resolve => setTimeout(resolve, 1500));

          this.emitProgress({
            phase: "backup",
            phaseProgress: 0,
            overallProgress: 0,
            message: "Comparing with iPhone to find new data...",
          });
        }
      } else {
        // No previous backup - first sync
        this.emitProgress({
          phase: "backup",
          phaseProgress: 0,
          overallProgress: 0,
          message: "Preparing first sync (this may take a while)...",
        });
      }

      // Step 1: Get device storage info to estimate backup size
      const storageInfo = await this.deviceService.getDeviceStorageInfo(options.udid);
      if (storageInfo) {
        // If we have an existing backup, use its size (most accurate)
        // Otherwise fall back to the storage-based estimate (less accurate)
        if (existingBackupSize > 0) {
          this.estimatedBackupSize = existingBackupSize;
          log.info(`[SyncOrchestrator] Using existing backup size for estimate: ${Math.round(this.estimatedBackupSize / 1024 / 1024 / 1024)} GB`);
        } else {
          this.estimatedBackupSize = storageInfo.estimatedBackupSize;
          log.info(`[SyncOrchestrator] Estimated backup size from storage: ${Math.round(this.estimatedBackupSize / 1024 / 1024)} MB (used space: ${Math.round(storageInfo.usedSpace / 1024 / 1024 / 1024)} GB)`);
        }

        this.emitProgress({
          phase: "backup",
          phaseProgress: 0,
          overallProgress: 0,
          message: "Checking available disk space...",
          estimatedTotalBytes: this.estimatedBackupSize,
        });

        // Check if computer has enough disk space
        // We need extra headroom (2x estimated) for safety since estimate may be low
        const requiredSpace = this.estimatedBackupSize * 2;
        const diskSpaceCheck = await this.checkAvailableDiskSpace(requiredSpace);

        if (!diskSpaceCheck.hasEnoughSpace) {
          const requiredGB = (requiredSpace / 1024 / 1024 / 1024).toFixed(1);
          const availableGB = (diskSpaceCheck.availableSpace / 1024 / 1024 / 1024).toFixed(1);
          return this.errorResult(
            `Not enough disk space. Need approximately ${requiredGB} GB free, but only ${availableGB} GB available. Please free up some space and try again.`
          );
        }

        log.info(`[SyncOrchestrator] Disk space check passed: ${Math.round(diskSpaceCheck.availableSpace / 1024 / 1024 / 1024)} GB available`);

        this.emitProgress({
          phase: "backup",
          phaseProgress: 0,
          overallProgress: 0,
          message: "Estimating backup size...",
          estimatedTotalBytes: this.estimatedBackupSize,
        });
      } else {
        log.warn("[SyncOrchestrator] Could not get storage info, progress will be estimated");

        // Even without device storage info, check we have at least 10GB free
        const minRequiredSpace = 10 * 1024 * 1024 * 1024; // 10 GB minimum
        const diskSpaceCheck = await this.checkAvailableDiskSpace(minRequiredSpace);

        if (!diskSpaceCheck.hasEnoughSpace) {
          const availableGB = (diskSpaceCheck.availableSpace / 1024 / 1024 / 1024).toFixed(1);
          return this.errorResult(
            `Not enough disk space. Need at least 10 GB free for backup, but only ${availableGB} GB available. Please free up some space and try again.`
          );
        }
      }

      // Step 1: Create backup
      this.setPhase("backup");
      const backupResult = await this.backupService.startBackup({
        udid: options.udid,
        password: options.password,
        forceFullBackup: options.forceFullBackup,
        skipApps: true, // Always skip apps to reduce backup size
      });

      if (this.isCancelled) {
        return this.errorResult("Sync cancelled by user");
      }

      if (!backupResult.success || !backupResult.backupPath) {
        return this.errorResult(backupResult.error || "Backup failed");
      }

      let backupPath = backupResult.backupPath;

      // Step 2: Decrypt if needed
      if (backupResult.isEncrypted) {
        if (!options.password) {
          this.emit("password-required");
          return this.errorResult("Password required for encrypted backup");
        }

        this.setPhase("decrypting");
        this.emitProgress({
          phase: "decrypting",
          phaseProgress: 0,
          overallProgress: this.calculateOverallProgress("decrypting", 0),
          message: "Decrypting backup...",
        });

        const decryptResult = await this.decryptionService.decryptBackup(
          backupPath,
          options.password,
        );

        if (this.isCancelled) {
          return this.errorResult("Sync cancelled by user");
        }

        if (!decryptResult.success || !decryptResult.decryptedPath) {
          return this.errorResult(decryptResult.error || "Decryption failed");
        }

        backupPath = decryptResult.decryptedPath;
      }

      // Step 3: Parse contacts
      this.setPhase("parsing-contacts");
      this.emitProgress({
        phase: "parsing-contacts",
        phaseProgress: 0,
        overallProgress: this.calculateOverallProgress("parsing-contacts", 0),
        message: "Reading contacts...",
      });

      this.contactsParser.open(backupPath);
      const contacts = this.contactsParser.getAllContacts();

      this.emitProgress({
        phase: "parsing-contacts",
        phaseProgress: 100,
        overallProgress: this.calculateOverallProgress("parsing-contacts", 100),
        message: `Found ${contacts.length} contacts`,
      });

      if (this.isCancelled) {
        this.contactsParser.close();
        return this.errorResult("Sync cancelled by user");
      }

      // Step 4: Parse messages
      this.setPhase("parsing-messages");
      this.emitProgress({
        phase: "parsing-messages",
        phaseProgress: 0,
        overallProgress: this.calculateOverallProgress("parsing-messages", 0),
        message: "Reading messages...",
      });

      this.messagesParser.open(backupPath);
      const conversations = this.messagesParser.getConversations();

      // Load messages for each conversation
      let loadedCount = 0;
      for (const conv of conversations) {
        if (this.isCancelled) {
          break;
        }

        conv.messages = this.messagesParser.getMessages(conv.chatId);
        loadedCount++;

        if (loadedCount % 10 === 0) {
          const progress = (loadedCount / conversations.length) * 100;
          this.emitProgress({
            phase: "parsing-messages",
            phaseProgress: progress,
            overallProgress: this.calculateOverallProgress(
              "parsing-messages",
              progress,
            ),
            message: `Loading conversations: ${loadedCount}/${conversations.length}`,
          });
        }
      }

      if (this.isCancelled) {
        this.messagesParser.close();
        this.contactsParser.close();
        return this.errorResult("Sync cancelled by user");
      }

      // Step 5: Resolve contact names
      this.setPhase("resolving");
      this.emitProgress({
        phase: "resolving",
        phaseProgress: 0,
        overallProgress: this.calculateOverallProgress("resolving", 0),
        message: "Resolving contact names...",
      });

      const resolvedConversations = this.resolveContactNames(
        conversations,
        contacts,
      );

      // Step 6: Cleanup
      this.setPhase("cleanup");
      this.emitProgress({
        phase: "cleanup",
        phaseProgress: 0,
        overallProgress: this.calculateOverallProgress("cleanup", 0),
        message: "Cleaning up...",
      });

      this.messagesParser.close();
      this.contactsParser.close();

      // Cleanup decrypted files if we decrypted
      if (backupResult.isEncrypted && backupPath !== backupResult.backupPath) {
        await this.decryptionService.cleanup(backupPath);
      }

      // Calculate all messages from conversations
      const allMessages = resolvedConversations.flatMap((c) => c.messages);

      const duration = Date.now() - this.startTime;
      this.isRunning = false;
      this.setPhase("complete");

      log.info("[SyncOrchestrator] Sync complete", {
        conversations: resolvedConversations.length,
        messages: allMessages.length,
        contacts: contacts.length,
        duration,
      });

      const result: SyncResult = {
        success: true,
        messages: allMessages,
        contacts,
        conversations: resolvedConversations,
        error: null,
        duration,
      };

      this.emit("complete", result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("[SyncOrchestrator] Sync failed", { error: errorMessage });

      // Cleanup on error
      try {
        this.messagesParser.close();
        this.contactsParser.close();
      } catch {
        // Ignore cleanup errors
      }

      this.isRunning = false;
      this.setPhase("error");
      this.emit("error", error);

      return this.errorResult(errorMessage);
    }
  }

  /**
   * Cancel the current sync operation
   */
  cancel(): void {
    if (!this.isRunning) {
      return;
    }

    log.info("[SyncOrchestrator] Cancelling sync");
    this.isCancelled = true;
    this.isRunning = false;
    this.backupService.cancelBackup();
    this.setPhase("idle");
  }

  /**
   * Get current sync status
   */
  getStatus(): { isRunning: boolean; phase: SyncPhase } {
    return {
      isRunning: this.isRunning,
      phase: this.currentPhase,
    };
  }

  /**
   * Force reset sync state (use when sync gets stuck)
   */
  forceReset(): void {
    log.warn("[SyncOrchestrator] Force resetting sync state");
    this.isRunning = false;
    this.isCancelled = false;
    this.currentPhase = "idle";
    this.estimatedBackupSize = 0;
  }

  /**
   * Get connected devices
   */
  getConnectedDevices(): iOSDevice[] {
    return this.deviceService.getConnectedDevices();
  }

  /**
   * Start device detection polling
   */
  startDeviceDetection(intervalMs: number = 2000): void {
    this.deviceService.start(intervalMs);
  }

  /**
   * Stop device detection polling
   */
  stopDeviceDetection(): void {
    this.deviceService.stop();
  }

  /**
   * Resolve contact names in conversations
   */
  private resolveContactNames(
    conversations: iOSConversation[],
    _contacts: iOSContact[],
  ): iOSConversation[] {
    return conversations.map((conv) => {
      // Resolve participants to display names
      const resolvedParticipants = conv.participants.map((handle) => {
        const lookup = this.contactsParser.lookupByHandle(handle);
        return lookup.contact?.displayName || handle;
      });

      // Update conversation with resolved names
      return {
        ...conv,
        participants: resolvedParticipants,
        // Optionally resolve sender names in messages
        messages: conv.messages.map((msg) => {
          if (!msg.isFromMe && msg.handle) {
            const lookup = this.contactsParser.lookupByHandle(msg.handle);
            // We don't modify the message handle, but the UI can use contacts for display
          }
          return msg;
        }),
      };
    });
  }

  /**
   * Set the current phase and emit event
   */
  private setPhase(phase: SyncPhase): void {
    this.currentPhase = phase;
    this.emit("phase", phase);
  }

  /**
   * Emit a progress event
   */
  private emitProgress(progress: SyncProgress): void {
    this.emit("progress", progress);
  }

  /**
   * Calculate overall progress based on phase weights
   */
  private calculateOverallProgress(
    phase: SyncPhase,
    phaseProgress: number,
  ): number {
    const phaseWeights: Record<SyncPhase, { start: number; weight: number }> = {
      idle: { start: 0, weight: 0 },
      backup: { start: 0, weight: 60 }, // Backup is the longest phase
      decrypting: { start: 60, weight: 10 },
      "parsing-contacts": { start: 70, weight: 5 },
      "parsing-messages": { start: 75, weight: 15 },
      resolving: { start: 90, weight: 5 },
      cleanup: { start: 95, weight: 5 },
      complete: { start: 100, weight: 0 },
      error: { start: 0, weight: 0 },
    };

    const config = phaseWeights[phase];
    return config.start + (phaseProgress / 100) * config.weight;
  }

  /**
   * Get a human-readable backup progress message
   * Note: We avoid showing per-file percentages as they can be confusing
   * (each file goes 0-100%, not overall progress)
   */
  private getBackupProgressMessage(progress: BackupProgress): string {
    switch (progress.phase) {
      case "preparing":
        // This phase can take several minutes while device:
        // 1. Verifies backup password (if encrypted)
        // 2. Compares existing backup with current device state
        // 3. Builds list of files that need to be transferred
        return "iPhone is preparing backup... This may take several minutes.";
      case "transferring":
        // Show descriptive message based on progress
        if (progress.filesTransferred && progress.filesTransferred > 0) {
          return "Receiving files from iPhone...";
        }
        return "Starting file transfer...";
      case "finishing":
        return "Finalizing backup...";
      case "extracting":
        return "Extracting messages and contacts...";
      case "decrypting":
        return "Decrypting backup data...";
      default:
        return "Processing...";
    }
  }

  /**
   * Check if computer has enough disk space for backup
   * @param requiredBytes Minimum bytes needed
   * @returns Object with hasEnoughSpace and availableSpace
   */
  private async checkAvailableDiskSpace(requiredBytes: number): Promise<{
    hasEnoughSpace: boolean;
    availableSpace: number;
  }> {
    try {
      // Check disk space on the drive where app data is stored
      const appDataPath = app.getPath("userData");
      const diskInfo = await checkDiskSpace(path.parse(appDataPath).root);

      log.info(`[SyncOrchestrator] Disk space: ${Math.round(diskInfo.free / 1024 / 1024 / 1024)} GB free on ${diskInfo.diskPath}`);

      return {
        hasEnoughSpace: diskInfo.free >= requiredBytes,
        availableSpace: diskInfo.free,
      };
    } catch (err) {
      log.error("[SyncOrchestrator] Failed to check disk space:", err);
      // If we can't check, assume we have enough space and let backup fail naturally if not
      return {
        hasEnoughSpace: true,
        availableSpace: 0,
      };
    }
  }

  /**
   * Process an existing backup without running a new backup
   * Useful for testing and debugging the extraction/storage pipeline
   */
  async processExistingBackup(udid: string, password?: string): Promise<SyncResult> {
    if (this.isRunning) {
      return this.errorResult("Sync already in progress");
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.startTime = Date.now();

    try {
      // Get backup path - construct from app's userData folder
      const { app } = await import("electron");
      const path = await import("path");
      const backupPath = path.join(app.getPath("userData"), "Backups", udid);
      log.info("[SyncOrchestrator] Processing existing backup", { udid, backupPath });

      // Check if backup exists
      const backupStatus = await this.backupService.checkBackupStatus(udid);
      if (!backupStatus || !backupStatus.exists) {
        this.isRunning = false;
        return this.errorResult("No existing backup found for this device");
      }

      if (!backupStatus.isComplete) {
        this.isRunning = false;
        return this.errorResult("Backup is incomplete or corrupted");
      }

      log.info("[SyncOrchestrator] Backup status", {
        exists: backupStatus.exists,
        isComplete: backupStatus.isComplete,
        sizeBytes: backupStatus.sizeBytes,
      });

      // Check if backup is encrypted and decrypt if needed
      let extractionPath = backupPath;
      const isEncrypted = await this.decryptionService.isBackupEncrypted(backupPath);

      if (isEncrypted) {
        if (!password) {
          this.isRunning = false;
          this.emit("password-required", {});
          return this.errorResult("Password required for encrypted backup");
        }

        this.setPhase("decrypting");
        this.emitProgress({
          phase: "decrypting",
          phaseProgress: 0,
          overallProgress: 10,
          message: "Decrypting backup...",
        });

        const decryptResult = await this.decryptionService.decryptBackup(
          backupPath,
          password
        );

        if (!decryptResult.success || !decryptResult.decryptedPath) {
          this.isRunning = false;
          return this.errorResult(decryptResult.error || "Decryption failed");
        }

        extractionPath = decryptResult.decryptedPath;
      }

      // Parse contacts
      this.setPhase("parsing-contacts");
      this.emitProgress({
        phase: "parsing-contacts",
        phaseProgress: 0,
        overallProgress: 30,
        message: "Reading contacts...",
      });

      this.contactsParser.open(extractionPath);
      const contacts = this.contactsParser.getAllContacts();

      this.emitProgress({
        phase: "parsing-contacts",
        phaseProgress: 100,
        overallProgress: 40,
        message: `Found ${contacts.length} contacts`,
      });

      // Parse messages
      this.setPhase("parsing-messages");
      this.emitProgress({
        phase: "parsing-messages",
        phaseProgress: 0,
        overallProgress: 40,
        message: "Reading messages...",
      });

      this.messagesParser.open(extractionPath);
      const conversations = this.messagesParser.getConversations();

      // Load messages for each conversation
      let loadedCount = 0;
      for (const conv of conversations) {
        if (this.isCancelled) {
          break;
        }

        conv.messages = this.messagesParser.getMessages(conv.chatId);
        loadedCount++;

        if (loadedCount % 10 === 0) {
          const progress = (loadedCount / conversations.length) * 100;
          this.emitProgress({
            phase: "parsing-messages",
            phaseProgress: progress,
            overallProgress: 40 + (progress * 0.5),
            message: `Loading conversations: ${loadedCount}/${conversations.length}`,
          });
        }
      }

      if (this.isCancelled) {
        this.messagesParser.close();
        this.contactsParser.close();
        return this.errorResult("Processing cancelled by user");
      }

      // Resolve contact names
      this.setPhase("resolving");
      this.emitProgress({
        phase: "resolving",
        phaseProgress: 0,
        overallProgress: 90,
        message: "Resolving contact names...",
      });

      const resolvedConversations = this.resolveContactNames(conversations, contacts);

      // Cleanup
      this.setPhase("cleanup");
      this.messagesParser.close();
      this.contactsParser.close();

      // Cleanup decrypted files if we decrypted
      if (isEncrypted && extractionPath !== backupPath) {
        await this.decryptionService.cleanup(extractionPath);
      }

      // Calculate all messages from conversations
      const allMessages = resolvedConversations.flatMap((c) => c.messages);

      const duration = Date.now() - this.startTime;
      this.isRunning = false;
      this.setPhase("complete");

      log.info("[SyncOrchestrator] Processing complete", {
        conversations: resolvedConversations.length,
        messages: allMessages.length,
        contacts: contacts.length,
        duration,
      });

      const result: SyncResult = {
        success: true,
        messages: allMessages,
        contacts,
        conversations: resolvedConversations,
        error: null,
        duration,
      };

      this.emit("complete", result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("[SyncOrchestrator] Processing failed", { error: errorMessage });

      try {
        this.messagesParser.close();
        this.contactsParser.close();
      } catch {
        // Ignore cleanup errors
      }

      this.isRunning = false;
      this.setPhase("error");
      this.emit("error", error);

      return this.errorResult(errorMessage);
    }
  }

  /**
   * Create an error result
   */
  private errorResult(error: string): SyncResult {
    return {
      success: false,
      messages: [],
      contacts: [],
      conversations: [],
      error,
      duration: Date.now() - this.startTime,
    };
  }
}

// Export singleton instance
export const syncOrchestrator = new SyncOrchestrator();
export default syncOrchestrator;
