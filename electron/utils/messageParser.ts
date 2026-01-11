/**
 * Message Parser Utilities
 * Handles extraction of text from macOS Messages attributed body format
 */

import {
  MAX_MESSAGE_TEXT_LENGTH,
  MIN_MESSAGE_TEXT_LENGTH,
  MIN_CLEANED_TEXT_LENGTH,
  STREAMTYPED_MARKER,
  STREAMTYPED_OFFSET,
  REGEX_PATTERNS,
  FALLBACK_MESSAGES,
} from "../constants";
import logService from "../services/logService";

/**
 * Message object interface
 */
export interface Message {
  text?: string | null;
  attributedBody?: Buffer | null;
  cache_has_attachments?: number;
}

/**
 * Extract text from macOS Messages attributedBody blob (NSKeyedArchiver format)
 * This contains NSAttributedString with the actual message text
 *
 * @param attributedBodyBuffer - The attributedBody buffer from Messages database
 * @returns Extracted text or fallback message
 */
export function extractTextFromAttributedBody(
  attributedBodyBuffer: Buffer | null | undefined,
): string {
  if (!attributedBodyBuffer) {
    return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
  }

  try {
    const bodyText = attributedBodyBuffer.toString("utf8");
    let extractedText: string | null = null;

    // Method 1: Look for text after NSString marker
    // The format is: ...NSString[binary][length markers]ACTUAL_TEXT
    extractedText = extractFromNSString(bodyText);

    // Method 2: If method 1 failed, look for text after 'streamtyped'
    if (!extractedText) {
      extractedText = extractFromStreamtyped(bodyText);
    }

    // Validate and clean extracted text
    if (
      extractedText &&
      extractedText.length >= MIN_MESSAGE_TEXT_LENGTH &&
      extractedText.length < MAX_MESSAGE_TEXT_LENGTH
    ) {
      // Additional cleaning
      extractedText = cleanExtractedText(extractedText);
      return extractedText;
    } else {
      return FALLBACK_MESSAGES.UNABLE_TO_EXTRACT;
    }
  } catch (e) {
    logService.error("Error parsing attributedBody:", "MessageParser", { error: (e as Error).message });
    return FALLBACK_MESSAGES.PARSING_ERROR;
  }
}

/**
 * Extract text by looking for NSString marker
 * The NSKeyedArchiver format stores the string length before the actual text.
 * Format after NSString: [metadata bytes][length byte(s)][actual text]
 *
 * @param bodyText - The attributedBody as text
 * @returns Extracted text or null
 */
function extractFromNSString(bodyText: string): string | null {
  const nsStringIndex = bodyText.indexOf("NSString");
  if (nsStringIndex === -1) {
    return null;
  }

  // Get everything after NSString
  const afterNSString = bodyText.substring(nsStringIndex + 8); // 8 = length of "NSString"

  // The text follows some binary metadata. Instead of using a fixed offset,
  // scan for the first sequence of readable characters that looks like actual text.
  // The key insight is that the actual message text is usually the LONGEST
  // continuous sequence of printable characters in the buffer.

  // Find all readable text sequences
  const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{3,}/g;
  const allMatches: string[] = [];
  let match;

  while ((match = readablePattern.exec(afterNSString)) !== null) {
    // Skip known metadata strings
    const text = match[0];
    if (
      text.includes("NSAttributedString") ||
      text.includes("NSMutableString") ||
      text.includes("NSObject") ||
      text.includes("NSDictionary") ||
      text.includes("NSArray") ||
      text.includes("$class") ||
      text.includes("$objects") ||
      text.includes("$archiver") ||
      text.includes("$version") ||
      text.includes("$top") ||
      text.startsWith("NS.") ||
      // Filter out internal iMessage attribute keys
      text.includes("__kIM") ||
      text.includes("kIMMessagePart") ||
      text.includes("AttributeName") ||
      // Filter out hex-like patterns (e.g., "00", "0A", etc.)
      /^[0-9A-Fa-f]{2,4}$/.test(text.trim())
    ) {
      continue;
    }
    allMatches.push(text);
  }

  if (allMatches.length === 0) {
    return null;
  }

  // Sort by length (longest first) and find the best candidate
  // The actual message is typically the longest readable sequence
  for (const candidate of allMatches.sort((a, b) => b.length - a.length)) {
    const cleaned = candidate
      .replace(REGEX_PATTERNS.LEADING_SYMBOLS, "")
      .replace(REGEX_PATTERNS.TRAILING_SYMBOLS, "")
      .trim();

    // Accept if it has alphanumeric content and is reasonable length
    if (
      cleaned.length >= MIN_CLEANED_TEXT_LENGTH &&
      REGEX_PATTERNS.MESSAGE_TEXT_ALPHANUMERIC.test(cleaned)
    ) {
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
function extractFromStreamtyped(bodyText: string): string | null {
  const streamIndex = bodyText.indexOf(STREAMTYPED_MARKER);
  if (streamIndex === -1) {
    return null;
  }

  const afterStream = bodyText.substring(streamIndex + STREAMTYPED_OFFSET);
  const textMatch = afterStream.match(REGEX_PATTERNS.MESSAGE_TEXT_READABLE);

  if (textMatch) {
    return textMatch[0].replace(REGEX_PATTERNS.LEADING_SYMBOLS, "").trim();
  }

  return null;
}

/**
 * Clean extracted text by removing control characters and null bytes
 * @param text - Text to clean
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  let cleaned = text
    .replace(REGEX_PATTERNS.NULL_BYTES, "") // Remove null bytes
    .replace(REGEX_PATTERNS.CONTROL_CHARS, "") // Remove control chars
    .trim();

  // Remove leading hex-like patterns (e.g., "00 ", "0A ")
  cleaned = cleaned.replace(/^([0-9A-Fa-f]{2}\s*)+/, "").trim();

  // Remove iMessage internal attribute names that might have leaked through
  cleaned = cleaned.replace(/__kIM\w+/g, "").trim();
  cleaned = cleaned.replace(/kIMMessagePart\w*/g, "").trim();

  return cleaned;
}

/**
 * Get message text from a message object
 * Handles both plain text and attributed body formats
 *
 * @param message - Message object from database
 * @returns Message text or fallback message
 */
export function getMessageText(message: Message): string {
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
    return FALLBACK_MESSAGES.ATTACHMENT;
  }

  return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
}
