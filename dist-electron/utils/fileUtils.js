"use strict";
/**
 * File Utilities
 * Handles file path sanitization and manipulation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeFilename = sanitizeFilename;
exports.sanitizeFilenamePreserveCase = sanitizeFilenamePreserveCase;
exports.createTimestampedFilename = createTimestampedFilename;
exports.ensureUniqueFilename = ensureUniqueFilename;
const constants_1 = require("../constants");
/**
 * Sanitize filename by removing special characters
 * @param filename - Filename to sanitize
 * @param preserveSpaces - Whether to preserve spaces (default: false)
 * @returns Sanitized filename
 */
function sanitizeFilename(filename, preserveSpaces = false) {
    if (!filename)
        return 'unnamed';
    const pattern = preserveSpaces
        ? constants_1.REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
        : constants_1.REGEX_PATTERNS.FILE_SANITIZE;
    return filename.replace(pattern, '_').toLowerCase();
}
/**
 * Sanitize filename and preserve original casing
 * @param filename - Filename to sanitize
 * @param preserveSpaces - Whether to preserve spaces (default: true)
 * @returns Sanitized filename with original casing
 */
function sanitizeFilenamePreserveCase(filename, preserveSpaces = true) {
    if (!filename)
        return 'unnamed';
    const pattern = preserveSpaces
        ? constants_1.REGEX_PATTERNS.FILE_SANITIZE_WITH_SPACES
        : constants_1.REGEX_PATTERNS.FILE_SANITIZE;
    return filename.replace(pattern, '_');
}
/**
 * Create a unique filename with timestamp
 * @param baseName - Base name for the file
 * @param extension - File extension (without dot)
 * @returns Filename with timestamp
 */
function createTimestampedFilename(baseName, extension) {
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
