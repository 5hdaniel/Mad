"use strict";
/**
 * Date Utilities
 * Handles date formatting and conversion, especially for macOS timestamps
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.macTimestampToDate = macTimestampToDate;
exports.getYearsAgoTimestamp = getYearsAgoTimestamp;
exports.formatDateForFilename = formatDateForFilename;
const constants_1 = require("../constants");
/**
 * Convert macOS timestamp (nanoseconds since 2001-01-01) to JavaScript Date
 * @param macTimestamp - macOS timestamp in nanoseconds
 * @returns JavaScript Date object
 */
function macTimestampToDate(macTimestamp) {
    if (!macTimestamp) {
        return new Date(0);
    }
    // Mac timestamps are in nanoseconds since 2001-01-01, convert to milliseconds
    return new Date(constants_1.MAC_EPOCH + macTimestamp / 1000000);
}
/**
 * Get timestamp from N years ago
 * @param years - Number of years to go back
 * @returns Timestamp in milliseconds
 */
function getYearsAgoTimestamp(years) {
    return Date.now() - (years * 365 * 24 * 60 * 60 * 1000);
}
/**
 * Format date for file names (YYYYMMDD_HHMMSS)
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDateForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
