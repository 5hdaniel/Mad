/**
 * iPhone/iOS Device Types for Windows PC connectivity
 * Used for USB-based device detection and backup sync
 */

// ============================================
// iOS DEVICE TYPES
// ============================================

export interface iOSDevice {
  udid: string;
  name: string;
  productType: string;
  productVersion: string;
  serialNumber: string;
  isConnected: boolean;
}

// ============================================
// BACKUP TYPES
// ============================================

export interface BackupProgress {
  phase: "preparing" | "backing_up" | "extracting" | "storing" | "complete" | "error";
  percent: number;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
  bytesProcessed?: number;
  totalBytes?: number;
  message?: string;
  /** Estimated total backup size in bytes (based on device storage) */
  estimatedTotalBytes?: number;
}

export interface BackupResult {
  success: boolean;
  error?: string;
  messagesCount?: number;
  contactsCount?: number;
}

// ============================================
// SYNC STATUS TYPES
// ============================================

export type SyncStatus = "idle" | "syncing" | "complete" | "error";

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface ConnectionStatusProps {
  isConnected: boolean;
  device: iOSDevice | null;
  onSyncClick: () => void;
  /** Last sync timestamp (from backup status) */
  lastSyncTime?: Date | null;
}

export interface DeviceInfoProps {
  device: iOSDevice;
}

export interface BackupPasswordModalProps {
  isOpen: boolean;
  deviceName: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  error?: string;
  isLoading?: boolean;
}

export interface SyncProgressProps {
  progress: BackupProgress;
  onCancel?: () => void;
  /** Whether the sync is waiting for the user to enter their iPhone passcode */
  isWaitingForPasscode?: boolean;
}

// ============================================
// HOOK RETURN TYPES
// ============================================

export interface UseIPhoneSyncReturn {
  isConnected: boolean;
  device: iOSDevice | null;
  syncStatus: SyncStatus;
  progress: BackupProgress | null;
  error: string | null;
  needsPassword: boolean;
  /** Last sync time for this device (from backup status) */
  lastSyncTime: Date | null;
  /** Whether the sync is waiting for the user to enter their iPhone passcode */
  isWaitingForPasscode: boolean;
  startSync: () => void;
  submitPassword: (password: string) => void;
  cancelSync: () => void;
}
