/**
 * Type definitions for Sync Progress UI components
 */

export type SyncPhase = "preparing" | "transferring" | "finishing";

export interface BackupProgress {
  phase: SyncPhase;
  percentComplete: number;
  currentFile?: string;
  filesTransferred?: number;
  totalFiles?: number;
  bytesTransferred?: number;
  totalBytes?: number;
}

export interface SyncResult {
  messagesCount: number;
  contactsCount: number;
  duration: number;
}

export type SyncErrorCode =
  | "DEVICE_DISCONNECTED"
  | "DEVICE_LOCKED"
  | "BACKUP_FAILED"
  | "PASSWORD_INCORRECT";
