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
    console.error("Error parsing attributedBody:", (e as Error).message);
    return FALLBACK_MESSAGES.PARSING_ERROR;
  }
}

/**
 * Extract text by looking for NSString marker
 * @param bodyText - The attributedBody as text
 * @returns Extracted text or null
 */
function extractFromNSString(bodyText: string): string | null {
  const nsStringIndex = bodyText.indexOf("NSString");
  if (nsStringIndex === -1) {
    return null;
  }

  // Skip NSString and more metadata bytes to get closer to actual text
  const afterNSString = bodyText.substring(nsStringIndex + 20);

  // Find ALL sequences of printable text
  const allMatches = afterNSString.match(REGEX_PATTERNS.MESSAGE_TEXT_READABLE);
  if (!allMatches || allMatches.length === 0) {
    return null;
  }

  // Find the longest match that contains alphanumeric characters
  for (const match of allMatches.sort((a, b) => b.length - a.length)) {
    const cleaned = match
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
  return text
    .replace(REGEX_PATTERNS.NULL_BYTES, "") // Remove null bytes
    .replace(REGEX_PATTERNS.CONTROL_CHARS, "") // Remove control chars
    .trim();
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
