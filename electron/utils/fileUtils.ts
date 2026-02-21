/**
 * File Utilities
 * Handles file path sanitization and manipulation
 */

import { REGEX_PATTERNS } from "../constants";

/**
 * Sanitize filename by removing special characters
 * @param filename - Filename to sanitize
 * @param preserveSpaces - Whether to preserve spaces (default: false)
 * @returns Sanitized filename
 */
export function sanitizeFilename(
  filename: string | null | undefined,
  preserveSpaces: boolean = false,
): string {
  if (!filename) return "unnamed";

  const pattern = preserveSpaces
    ? REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
    : REGEX_PATTERNS.FILE_SANITIZE;

  return filename.replace(pattern, "_").toLowerCase();
}

/**
 * Sanitize filename and preserve original casing
 * @param filename - Filename to sanitize
 * @param preserveSpaces - Whether to preserve spaces (default: true)
 * @returns Sanitized filename with original casing
 */
export function sanitizeFilenamePreserveCase(
  filename: string | null | undefined,
  preserveSpaces: boolean = true,
): string {
  if (!filename) return "unnamed";

  const pattern = preserveSpaces
    ? REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
    : REGEX_PATTERNS.FILE_SANITIZE;

  return filename.replace(pattern, "_");
}

/**
 * Create a unique filename with timestamp
 * @param baseName - Base name for the file
 * @param extension - File extension (without dot)
 * @returns Filename with timestamp
 */
export function createTimestampedFilename(
  baseName: string,
  extension: string,
): string {
  const safeName = sanitizeFilename(baseName);
  const timestamp = Date.now();
  return `${safeName}_${timestamp}.${extension}`;
}

/**
 * Sanitize a filename or folder name for safe filesystem use.
 *
 * Combines security protections (path traversal prevention, null byte removal,
 * leading dot removal) with a strict allowlist approach (only alphanumeric,
 * underscore, hyphen, dot). Collapses consecutive underscores and truncates
 * to 200 characters.
 *
 * Preserves case and file extensions unlike sanitizeFilename/sanitizeFilenamePreserveCase.
 *
 * Unified from duplicated implementations in emailAttachmentService and
 * enhancedExportService (TASK-2031).
 *
 * @param name - The raw filename or folder name to sanitize
 * @param fallback - Fallback name if sanitization produces an empty string (default: "file")
 * @returns A filesystem-safe name, truncated to 200 characters
 */
export function sanitizeFileSystemName(
  name: string,
  fallback = "file",
): string {
  let sanitized = name
    // Remove directory traversal sequences first
    .replace(/\.\./g, "_")
    // Keep only safe characters: alphanumeric, underscore, hyphen, dot
    .replace(/[^a-z0-9_\-\.]/gi, "_")
    // Collapse consecutive underscores
    .replace(/_+/g, "_")
    // Remove leading dots to prevent hidden files
    .replace(/^\.+/, "");

  // Truncate to 200 characters
  sanitized = sanitized.substring(0, 200);

  // Ensure we have a valid name
  if (!sanitized || sanitized.length === 0) {
    sanitized = fallback;
  }

  return sanitized;
}

/**
 * Ensure filename is unique by appending number if needed
 * @param baseName - Base name for the file
 * @param extension - File extension (without dot)
 * @param checkExists - Function that checks if file exists (async)
 * @returns Unique filename
 */
export async function ensureUniqueFilename(
  baseName: string,
  extension: string,
  checkExists: (filename: string) => Promise<boolean>,
): Promise<string> {
  const safeName = sanitizeFilename(baseName);
  let filename = `${safeName}.${extension}`;
  let counter = 1;

  while (await checkExists(filename)) {
    filename = `${safeName}_${counter}.${extension}`;
    counter++;
  }

  return filename;
}
