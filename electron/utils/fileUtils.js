/**
 * File Utilities
 * Handles file path sanitization and manipulation
 */

const { REGEX_PATTERNS } = require('../constants');

/**
 * Sanitize filename by removing special characters
 * @param {string} filename - Filename to sanitize
 * @param {boolean} preserveSpaces - Whether to preserve spaces (default: false)
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename, preserveSpaces = false) {
  if (!filename) return 'unnamed';

  const pattern = preserveSpaces
    ? REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
    : REGEX_PATTERNS.FILE_SANITIZE;

  return filename.replace(pattern, '_').toLowerCase();
}

/**
 * Sanitize filename and preserve original casing
 * @param {string} filename - Filename to sanitize
 * @param {boolean} preserveSpaces - Whether to preserve spaces (default: true)
 * @returns {string} Sanitized filename with original casing
 */
function sanitizeFilenamePreserveCase(filename, preserveSpaces = true) {
  if (!filename) return 'unnamed';

  const pattern = preserveSpaces
    ? REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
    : REGEX_PATTERNS.FILE_SANITIZE;

  return filename.replace(pattern, '_');
}

/**
 * Create a unique filename with timestamp
 * @param {string} baseName - Base name for the file
 * @param {string} extension - File extension (without dot)
 * @returns {string} Filename with timestamp
 */
function createTimestampedFilename(baseName, extension) {
  const safeName = sanitizeFilename(baseName);
  const timestamp = Date.now();
  return `${safeName}_${timestamp}.${extension}`;
}

/**
 * Ensure filename is unique by appending number if needed
 * @param {string} baseName - Base name for the file
 * @param {string} extension - File extension (without dot)
 * @param {Function} checkExists - Function that checks if file exists (async)
 * @returns {Promise<string>} Unique filename
 */
async function ensureUniqueFilename(baseName, extension, checkExists) {
  const safeName = sanitizeFilename(baseName);
  let filename = `${safeName}.${extension}`;
  let counter = 1;

  while (await checkExists(filename)) {
    filename = `${safeName}_${counter}.${extension}`;
    counter++;
  }

  return filename;
}

module.exports = {
  sanitizeFilename,
  sanitizeFilenamePreserveCase,
  createTimestampedFilename,
  ensureUniqueFilename
};
