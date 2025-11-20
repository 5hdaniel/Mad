"use strict";
/**
 * Message Parser Utilities
 * Handles extraction of text from macOS Messages attributed body format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromAttributedBody = extractTextFromAttributedBody;
exports.cleanExtractedText = cleanExtractedText;
exports.getMessageText = getMessageText;
const constants_1 = require("../constants");
/**
 * Extract text from macOS Messages attributedBody blob (NSKeyedArchiver format)
 * This contains NSAttributedString with the actual message text
 *
 * @param attributedBodyBuffer - The attributedBody buffer from Messages database
 * @returns Extracted text or fallback message
 */
function extractTextFromAttributedBody(attributedBodyBuffer) {
    if (!attributedBodyBuffer) {
        return constants_1.FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
    }
    try {
        const bodyText = attributedBodyBuffer.toString('utf8');
        let extractedText = null;
        // Method 1: Look for text after NSString marker
        // The format is: ...NSString[binary][length markers]ACTUAL_TEXT
        extractedText = extractFromNSString(bodyText);
        // Method 2: If method 1 failed, look for text after 'streamtyped'
        if (!extractedText) {
            extractedText = extractFromStreamtyped(bodyText);
        }
        // Validate and clean extracted text
        if (extractedText &&
            extractedText.length >= constants_1.MIN_MESSAGE_TEXT_LENGTH &&
            extractedText.length < constants_1.MAX_MESSAGE_TEXT_LENGTH) {
            // Additional cleaning
            extractedText = cleanExtractedText(extractedText);
            return extractedText;
        }
        else {
            return constants_1.FALLBACK_MESSAGES.UNABLE_TO_EXTRACT;
        }
    }
    catch (e) {
        console.error('Error parsing attributedBody:', e.message);
        return constants_1.FALLBACK_MESSAGES.PARSING_ERROR;
    }
}
/**
 * Extract text by looking for NSString marker
 * @param bodyText - The attributedBody as text
 * @returns Extracted text or null
 */
function extractFromNSString(bodyText) {
    const nsStringIndex = bodyText.indexOf('NSString');
    if (nsStringIndex === -1) {
        return null;
    }
    // Skip NSString and more metadata bytes to get closer to actual text
    const afterNSString = bodyText.substring(nsStringIndex + 20);
    // Find ALL sequences of printable text
    const allMatches = afterNSString.match(constants_1.REGEX_PATTERNS.MESSAGE_TEXT_READABLE);
    if (!allMatches || allMatches.length === 0) {
        return null;
    }
    // Find the longest match that contains alphanumeric characters
    for (const match of allMatches.sort((a, b) => b.length - a.length)) {
        const cleaned = match
            .replace(constants_1.REGEX_PATTERNS.LEADING_SYMBOLS, '')
            .replace(constants_1.REGEX_PATTERNS.TRAILING_SYMBOLS, '')
            .trim();
        // Accept if it has alphanumeric content and is reasonable length
        if (cleaned.length >= constants_1.MIN_CLEANED_TEXT_LENGTH &&
            constants_1.REGEX_PATTERNS.MESSAGE_TEXT_ALPHANUMERIC.test(cleaned)) {
            return cleaned;
        }
    }
    return null;
}
/**
 * Extract text by looking for streamtyped marker
 * @param bodyText - The attributedBody as text
 * @returns Extracted text or null
 */
function extractFromStreamtyped(bodyText) {
    const streamIndex = bodyText.indexOf(constants_1.STREAMTYPED_MARKER);
    if (streamIndex === -1) {
        return null;
    }
    const afterStream = bodyText.substring(streamIndex + constants_1.STREAMTYPED_OFFSET);
    const textMatch = afterStream.match(constants_1.REGEX_PATTERNS.MESSAGE_TEXT_READABLE);
    if (textMatch) {
        return textMatch[0]
            .replace(constants_1.REGEX_PATTERNS.LEADING_SYMBOLS, '')
            .trim();
    }
    return null;
}
/**
 * Clean extracted text by removing control characters and null bytes
 * @param text - Text to clean
 * @returns Cleaned text
 */
function cleanExtractedText(text) {
    return text
        .replace(constants_1.REGEX_PATTERNS.NULL_BYTES, '') // Remove null bytes
        .replace(constants_1.REGEX_PATTERNS.CONTROL_CHARS, '') // Remove control chars
        .trim();
}
/**
 * Get message text from a message object
 * Handles both plain text and attributed body formats
 *
 * @param message - Message object from database
 * @returns Message text or fallback message
 */
function getMessageText(message) {
    // Plain text is preferred
    if (message.text) {
        return message.text;
    }
    // Try to extract from attributed body
    if (message.attributedBody) {
        return extractTextFromAttributedBody(message.attributedBody);
    }
    // Fallback based on message type
    if (message.cache_has_attachments === 1) {
        return constants_1.FALLBACK_MESSAGES.ATTACHMENT;
    }
    return constants_1.FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
}
