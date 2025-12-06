/**
 * File Utilities
 * Handles file path sanitization and manipulation
 */

import { REGEX_PATTERNS } from '../constants';

/**
 * Sanitize filename by removing special characters
 * @param filename - Filename to sanitize
 * @param preserveSpaces - Whether to preserve spaces (default: false)
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string | null | undefined, preserveSpaces: boolean = false): string {
  if (!filename) return 'unnamed';

  const pattern = preserveSpaces
    ? REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
    : REGEX_PATTERNS.FILE_SANITIZE;

  return filename.replace(pattern, '_').toLowerCase();
}

/**
 * Sanitize filename and preserve original casing
 * @param filename - Filename to sanitize
 * @param preserveSpaces - Whether to preserve spaces (default: true)
 * @returns Sanitized filename with original casing
 */
export function sanitizeFilenamePreserveCase(filename: string | null | undefined, preserveSpaces: boolean = true): string {
  if (!filename) return 'unnamed';

  const pattern = preserveSpaces
    ? REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
    : REGEX_PATTERNS.FILE_SANITIZE;

  return filename.replace(pattern, '_');
}

/**
 * Create a unique filename with timestamp
 * @param baseName - Base name for the file
 * @param extension - File extension (without dot)
 * @returns Filename with timestamp
 */
export function createTimestampedFilename(baseName: string, extension: string): string {
  const safeName = sanitizeFilename(baseName);
  const timestamp = Date.now();
  return `${safeName}_${timestamp}.${extension}`;
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
  checkExists: (filename: string) => Promise<boolean>
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
