/**
 * Message Parser Utilities
 * Handles extraction of text from macOS Messages attributed body format
 *
 * The attributedBody field in macOS Messages contains an NSAttributedString
 * serialized using Apple's typedstream format (NOT NSKeyedArchiver/bplist).
 *
 * This module uses the imessage-parser library for proper typedstream parsing,
 * with multi-encoding fallback support to handle various text encodings
 * (UTF-8, UTF-16 LE/BE, Latin-1) that may appear in typedstream data.
 *
 * @see https://github.com/alexkwolfe/imessage-parser
 */

// Using require for imessage-parser to avoid ESM/CJS issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseAttributedBody: parseTypedStream } = require("imessage-parser") as {
  parseAttributedBody: (buffer: Buffer, options?: { cleanOutput?: boolean }) => { text: string };
};
import {
  MAX_MESSAGE_TEXT_LENGTH,
  MIN_MESSAGE_TEXT_LENGTH,
  REGEX_PATTERNS,
  FALLBACK_MESSAGES,
} from "../constants";
import logService from "../services/logService";
import {
  containsReplacementChars,
  tryMultipleEncodings,
  REPLACEMENT_CHAR,
} from "./encodingUtils";

/**
 * Message object interface
 */
export interface Message {
  text?: string | null;
  attributedBody?: Buffer | null;
  cache_has_attachments?: number;
}

/**
 * Extract text from macOS Messages attributedBody blob (typedstream format)
 * Uses imessage-parser library for proper typedstream parsing, with
 * multi-encoding fallback to handle UTF-16 and other encodings.
 *
 * IMPORTANT: This function NEVER strips U+FFFD replacement characters as that
 * would cause data loss. Instead, it attempts multiple encodings to properly
 * decode the text.
 *
 * @param attributedBodyBuffer - The attributedBody buffer from Messages database
 * @returns Extracted text or fallback message
 */
export async function extractTextFromAttributedBody(
  attributedBodyBuffer: Buffer | null | undefined
): Promise<string> {
  if (!attributedBodyBuffer) {
    return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
  }

  try {
    // Use imessage-parser library for proper typedstream parsing
    const result = parseTypedStream(attributedBodyBuffer, { cleanOutput: true });

    if (result && result.text && result.text.length >= MIN_MESSAGE_TEXT_LENGTH) {
      // Check if the result contains replacement characters (U+FFFD)
      // This indicates encoding issues that we need to handle
      if (containsReplacementChars(result.text)) {
        logService.debug("imessage-parser result contains replacement chars, trying multi-encoding", "MessageParser");

        // Try multi-encoding fallback on the raw buffer
        const multiEncodingResult = tryMultiEncodingExtraction(attributedBodyBuffer);
        if (multiEncodingResult && !containsReplacementChars(multiEncodingResult)) {
          const cleaned = cleanExtractedText(multiEncodingResult);
          if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
            return cleaned;
          }
        }

        // If multi-encoding didn't help, still use the original result
        // but log a warning. We NEVER strip replacement chars as that loses data.
        logService.warn("Could not resolve encoding issues, preserving original text with replacement chars", "MessageParser", {
          bufferLength: attributedBodyBuffer.length,
          replacementCharCount: countReplacementCharsInText(result.text),
        });
      }

      // Clean any remaining artifacts (but NOT replacement characters)
      const cleaned = cleanExtractedText(result.text);
      if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
        return cleaned;
      }
    }

    // If imessage-parser returned nothing useful, try our heuristic extraction
    return await tryFallbackExtraction(attributedBodyBuffer);
  } catch (e) {
    logService.debug("typedstream parse failed", "MessageParser", {
      error: (e as Error).message,
    });

    // Fallback to heuristic extraction for non-standard formats
    return await tryFallbackExtraction(attributedBodyBuffer);
  }
}

/**
 * Count replacement characters in text (helper for logging)
 */
function countReplacementCharsInText(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char === REPLACEMENT_CHAR) count++;
  }
  return count;
}

/**
 * Try extracting text using multiple encodings
 * This is used when imessage-parser produces text with U+FFFD characters
 */
function tryMultiEncodingExtraction(buffer: Buffer): string | null {
  // Try decoding the buffer with multiple encodings
  const { text, encoding, hasReplacementChars } = tryMultipleEncodings(buffer, "MessageParser");

  if (!hasReplacementChars && text.length > 0) {
    logService.debug(`Multi-encoding extraction succeeded with ${encoding}`, "MessageParser");

    // Look for the actual message content in the decoded text
    // The typedstream format has metadata - we need to extract just the message
    const extracted = extractMessageFromDecodedText(text);
    return extracted;
  }

  // Also try the heuristic approach with different encodings
  const heuristicResult = extractUsingHeuristicsMultiEncoding(buffer);
  if (heuristicResult && !containsReplacementChars(heuristicResult)) {
    return heuristicResult;
  }

  return null;
}

/**
 * Extract actual message content from decoded typedstream text
 * The typedstream contains metadata - we want just the user's message
 */
function extractMessageFromDecodedText(text: string): string | null {
  // Look for readable text sequences, excluding metadata
  const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{3,}/g;
  const candidates: string[] = [];
  let match;

  while ((match = readablePattern.exec(text)) !== null) {
    const segment = match[0];

    // Skip metadata strings
    if (isTypedstreamMetadata(segment)) {
      continue;
    }

    candidates.push(segment);
  }

  if (candidates.length === 0) return null;

  // Return the longest non-metadata segment
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

/**
 * Check if a string segment is typedstream metadata
 */
function isTypedstreamMetadata(text: string): boolean {
  return (
    text.includes("NSAttributedString") ||
    text.includes("NSMutableString") ||
    text.includes("NSObject") ||
    text.includes("NSDictionary") ||
    text.includes("NSArray") ||
    text.includes("NSString") ||
    text.includes("$class") ||
    text.includes("$objects") ||
    text.includes("$archiver") ||
    text.includes("$version") ||
    text.includes("$top") ||
    text.startsWith("NS.") ||
    text.includes("__kIM") ||
    text.includes("kIMMessagePart") ||
    text.includes("AttributeName") ||
    text.includes("streamtyped") ||
    /^[0-9A-Fa-f]{2,4}$/.test(text.trim())
  );
}

/**
 * Fallback extraction when imessage-parser fails
 */
async function tryFallbackExtraction(buffer: Buffer): Promise<string> {
  try {
    // First try multi-encoding heuristics
    const heuristicResult = extractUsingHeuristicsMultiEncoding(buffer);
    if (
      heuristicResult &&
      heuristicResult.length >= MIN_MESSAGE_TEXT_LENGTH &&
      heuristicResult.length < MAX_MESSAGE_TEXT_LENGTH
    ) {
      return cleanExtractedText(heuristicResult);
    }

    // Fall back to legacy UTF-8 only heuristics
    const legacyResult = extractUsingHeuristics(buffer);
    if (
      legacyResult &&
      legacyResult.length >= MIN_MESSAGE_TEXT_LENGTH &&
      legacyResult.length < MAX_MESSAGE_TEXT_LENGTH
    ) {
      return cleanExtractedText(legacyResult);
    }
  } catch (fallbackError) {
    logService.error("Error parsing attributedBody:", "MessageParser", {
      error: (fallbackError as Error).message,
    });
  }

  return FALLBACK_MESSAGES.PARSING_ERROR;
}

/**
 * Enhanced heuristic extraction that tries multiple encodings
 * Used when the standard parser fails
 */
function extractUsingHeuristicsMultiEncoding(buffer: Buffer): string | null {
  // Try UTF-8 first (most common)
  let result = extractWithEncoding(buffer, "utf8");
  if (result && !containsReplacementChars(result)) {
    return result;
  }

  // Try UTF-16 LE (common on macOS)
  result = extractWithEncoding(buffer, "utf16le");
  if (result && !containsReplacementChars(result)) {
    return result;
  }

  // Try Latin-1 as final fallback
  result = extractWithEncoding(buffer, "latin1");
  if (result && !containsReplacementChars(result)) {
    return result;
  }

  // Return the UTF-8 result even if it has replacement chars
  // (better than nothing, and we don't strip them)
  return extractWithEncoding(buffer, "utf8");
}

/**
 * Extract text using a specific encoding
 */
function extractWithEncoding(buffer: Buffer, encoding: BufferEncoding): string | null {
  try {
    const bodyText = buffer.toString(encoding);

    // Look for text after NSString marker
    const nsStringIndex = bodyText.indexOf("NSString");
    if (nsStringIndex === -1) {
      // No NSString marker - try to find any readable content
      const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{5,}/g;
      const matches: string[] = [];
      let match;

      while ((match = readablePattern.exec(bodyText)) !== null) {
        const text = match[0];
        if (!isTypedstreamMetadata(text)) {
          matches.push(text);
        }
      }

      if (matches.length > 0) {
        matches.sort((a, b) => b.length - a.length);
        return matches[0];
      }

      return null;
    }

    const afterNSString = bodyText.substring(nsStringIndex + 8);

    // Find readable text sequences
    const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{3,}/g;
    const allMatches: string[] = [];

    let match;
    while ((match = readablePattern.exec(afterNSString)) !== null) {
      const text = match[0];
      if (!isTypedstreamMetadata(text)) {
        allMatches.push(text);
      }
    }

    if (allMatches.length === 0) {
      return null;
    }

    // Sort by length and return longest
    allMatches.sort((a, b) => b.length - a.length);
    return allMatches[0];
  } catch {
    return null;
  }
}

/**
 * Fallback heuristic extraction for non-standard formats
 * Used when bplist parsing fails
 */
function extractUsingHeuristics(buffer: Buffer): string | null {
  const bodyText = buffer.toString("utf8");

  // Look for text after NSString marker
  const nsStringIndex = bodyText.indexOf("NSString");
  if (nsStringIndex === -1) {
    return null;
  }

  const afterNSString = bodyText.substring(nsStringIndex + 8);

  // Find readable text sequences
  const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{3,}/g;
  const allMatches: string[] = [];
  let match;

  while ((match = readablePattern.exec(afterNSString)) !== null) {
    const text = match[0];
    // Skip metadata strings
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
      text.includes("__kIM") ||
      text.includes("kIMMessagePart") ||
      text.includes("AttributeName") ||
      /^[0-9A-Fa-f]{2,4}$/.test(text.trim())
    ) {
      continue;
    }
    allMatches.push(text);
  }

  if (allMatches.length === 0) {
    return null;
  }

  // Sort by length and return longest
  allMatches.sort((a, b) => b.length - a.length);
  return allMatches[0];
}

/**
 * Clean extracted text by removing control characters and artifacts
 *
 * IMPORTANT: This function does NOT remove U+FFFD replacement characters.
 * Removing replacement characters causes DATA LOSS as they often represent
 * actual characters that couldn't be decoded. Instead, we preserve them
 * and rely on multi-encoding detection to properly decode the text upstream.
 *
 * @param text - Text to clean
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove null bytes and control characters FIRST
  // NOTE: We do NOT remove U+FFFD (replacement character) as that causes data loss
  cleaned = cleaned
    .replace(REGEX_PATTERNS.NULL_BYTES, "") // Remove null bytes
    .replace(REGEX_PATTERNS.CONTROL_CHARS, "") // Remove control chars (but NOT U+FFFD)
    .trim();

  // Remove iMessage internal attribute names that might have leaked through
  cleaned = cleaned.replace(/__kIM\w+/g, "").trim();
  cleaned = cleaned.replace(/kIMMessagePart\w*/g, "").trim();

  // AGGRESSIVE: Remove "00" anywhere it appears on its own line or at start
  // This handles various encoding artifacts from typedstream parsing
  cleaned = cleaned
    .replace(/^00\n/gm, "") // "00" on its own line (multiline)
    .replace(/^00\r\n/gm, "") // "00" with Windows line endings
    .replace(/^00\s+/gm, "") // "00" followed by whitespace at line start
    .replace(/^00$/gm, "") // "00" as entire line
    .trim();

  // Split into lines and filter empty ones
  const lines = cleaned.split(/[\r\n]+/);
  const filteredLines = lines
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0) return false;
      // Remove lines that are just "00" or other short hex values
      if (/^[0-9A-Fa-f]{2,4}$/.test(line)) return false;
      return true;
    });

  return filteredLines.join("\n").trim();
}

/**
 * Get message text from a message object
 * Handles both plain text and attributed body formats
 * Applies cleaning to handle UTF-16 encoding issues and artifacts
 *
 * @param message - Message object from database
 * @returns Message text or fallback message
 */
export async function getMessageText(message: Message): Promise<string> {
  // Plain text is preferred, but still clean it for encoding issues
  if (message.text) {
    // Apply cleaning to handle potential UTF-16 encoding or null byte issues
    const cleaned = cleanExtractedText(message.text);
    if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH) {
      return cleaned;
    }
    // If cleaning resulted in empty/short text, try attributedBody
  }

  // Try to extract from attributed body
  if (message.attributedBody) {
    return await extractTextFromAttributedBody(message.attributedBody);
  }

  // If we had text but it was cleaned to nothing, return original
  if (message.text) {
    return message.text;
  }

  // Fallback based on message type
  if (message.cache_has_attachments === 1) {
    return FALLBACK_MESSAGES.ATTACHMENT;
  }

  return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
}
