/**
 * Types for the iPhone backup service
 * Used for extracting messages and contacts from iPhone via idevicebackup2
 */

/**
 * Progress information during backup operations
 */
export interface BackupProgress {
  /** Current phase of the backup operation */
  phase: 'preparing' | 'transferring' | 'finishing' | 'extracting';
  /** Overall percentage complete (0-100) */
  percentComplete: number;
  /** Current file being processed, if available */
  currentFile: string | null;
  /** Number of files transferred so far */
  filesTransferred: number;
  /** Total number of files to transfer, if known */
  totalFiles: number | null;
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total bytes to transfer, if known */
  totalBytes: number | null;
  /** Estimated time remaining in seconds, if calculable */
  estimatedTimeRemaining: number | null;
}

/**
 * Result of a backup operation
 */
export interface BackupResult {
  /** Whether the backup completed successfully */
  success: boolean;
  /** Path to the backup directory, null if failed */
  backupPath: string | null;
  /** Error message if backup failed */
  error: string | null;
  /** Duration of the backup in milliseconds */
  duration: number;
  /** UDID of the device that was backed up */
  deviceUdid: string;
  /** Whether this was an incremental backup (vs full) */
  isIncremental: boolean;
  /** Size of the backup in bytes */
  backupSize: number;
}

/**
 * Options for starting a backup
 */
export interface BackupOptions {
  /** UDID of the device to backup */
  udid: string;
  /** Output directory for backup. Default: app's userData/Backups folder */
  outputDir?: string;
  /** Force a full backup even if incremental is available. Default: false */
  forceFullBackup?: boolean;
  /** Skip application data to reduce backup size. Default: true */
  skipApps?: boolean;
}

/**
 * Capabilities of the backup system
 */
export interface BackupCapabilities {
  /** Whether domain filtering is supported (currently always false) */
  supportsDomainFiltering: boolean;
  /** Whether incremental backups are supported */
  supportsIncremental: boolean;
  /** Whether --skip-apps is supported */
  supportsSkipApps: boolean;
  /** Whether backup encryption is supported */
  supportsEncryption: boolean;
  /** List of available domains in backups */
  availableDomains: string[];
}

/**
 * Information about an existing backup
 */
export interface BackupInfo {
  /** Path to the backup directory */
  path: string;
  /** UDID of the device the backup is from */
  deviceUdid: string;
  /** When the backup was created */
  createdAt: Date;
  /** Size of the backup in bytes */
  size: number;
  /** Whether the backup is encrypted */
  isEncrypted: boolean;
  /** iOS version the backup was created from */
  iosVersion: string | null;
  /** Device name at time of backup */
  deviceName: string | null;
}

/**
 * Status of the backup service
 */
export interface BackupStatus {
  /** Whether a backup is currently in progress */
  isRunning: boolean;
  /** UDID of device being backed up, if any */
  currentDeviceUdid: string | null;
  /** Current progress, if backup is running */
  progress: BackupProgress | null;
}
