/**
 * macOS Messages Import Service - Types
 * Type definitions and constants used across the import service sub-modules.
 * Extracted from macOSMessagesImportService.ts for maintainability.
 */

// ============================================
// EXPORTED TYPES (public API)
// ============================================

/**
 * Filter options for message import (TASK-1952)
 * Controls which messages are imported based on date range and count cap
 */
export interface MessageImportFilters {
  lookbackMonths?: number | null; // null = all time
  maxMessages?: number | null; // null = unlimited
}

/**
 * Result of importing macOS messages
 */
export interface MacOSImportResult {
  success: boolean;
  messagesImported: number;
  messagesSkipped: number;
  attachmentsImported: number;
  attachmentsUpdated: number; // TASK-1122: Count of attachments with updated message_id after re-sync
  attachmentsSkipped: number;
  duration: number;
  error?: string;
  /** Total messages available for the date range (before cap) */
  totalAvailable?: number;
  /** True when maxMessages cap truncated results */
  wasCapped?: boolean;
}

/**
 * Progress callback for import operations
 */
export type ImportProgressCallback = (progress: {
  phase: "querying" | "deleting" | "importing" | "attachments";
  current: number;
  total: number;
  percent: number;
}) => void;

/**
 * Attachment info returned from database (TASK-1012)
 */
export interface MessageAttachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}

// ============================================
// INTERNAL TYPES (used by import service)
// ============================================

/**
 * Raw message from macOS Messages database
 */
export interface RawMacMessage {
  id: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  date: number; // Mac timestamp (nanoseconds since 2001-01-01)
  is_from_me: number;
  handle_id: string | null;
  service: string | null;
  chat_id: number;
  cache_has_attachments: number;
}

/**
 * Chat member info from chat_handle_join
 */
export interface ChatMemberRow {
  chat_id: number;
  handle_id: string;
}

/**
 * Chat account info - maps chat to user's identifier (phone/Apple ID)
 */
export interface ChatAccountRow {
  chat_id: number;
  account_login: string | null;
}

/**
 * Raw attachment from macOS Messages database (TASK-1012)
 */
export interface RawMacAttachment {
  attachment_id: number;
  message_id: number;
  message_guid: string;
  guid: string;
  filename: string | null;
  mime_type: string | null;
  transfer_name: string | null;
  total_bytes: number;
  is_outgoing: number;
}

// ============================================
// CONSTANTS
// ============================================

// Input validation constants
export const MAX_MESSAGE_TEXT_LENGTH = 100000; // 100KB - truncate extremely long messages
export const MAX_HANDLE_LENGTH = 500; // Phone numbers, emails, etc.
export const MAX_GUID_LENGTH = 100; // Message GUID format
export const BATCH_SIZE = 100; // Messages per batch - small batches yield frequently for UI responsiveness
export const DELETE_BATCH_SIZE = 5000; // Messages per delete batch (larger for efficiency)
export const YIELD_INTERVAL = 1; // Yield every batch for UI responsiveness
export const MIN_QUERY_BATCH_SIZE = 10000; // Minimum query batch size

// Attachment constants (TASK-1012, expanded TASK-1122 to include videos)
export const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".heic", ".webp", ".bmp", ".tiff", ".tif"];
export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"];
export const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".caf"]; // caf = Core Audio Format (iOS voice messages)
export const SUPPORTED_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf"];
export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
];
export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB max per attachment (increased for videos)
export const ATTACHMENTS_DIR = "message-attachments"; // Directory name in app data
