/**
 * File size formatting utilities.
 * Extracted from AttachmentCard, EmailViewModal, AttachmentPreviewModal, EmailThreadViewModal.
 * TASK-2029: Renderer-side utility deduplication.
 */

/**
 * Format file size in human-readable format.
 * Handles null input for cases where file size is unknown.
 *
 * @param bytes - File size in bytes, or null if unknown
 * @returns Human-readable string like "1.2 MB", "0 B", or "" if null
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
