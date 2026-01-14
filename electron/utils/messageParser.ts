/**
 * Message Parser Utilities
 * Handles extraction of text from macOS Messages attributed body format
 *
 * The attributedBody field in macOS Messages contains an NSAttributedString
 * serialized in one of two formats:
 *
 * 1. **Binary plist (bplist00)** - NSKeyedArchiver format, parsed with simple-plist
 *    - Starts with "bplist00" magic bytes
 *    - Contains $archiver, $objects, $top keys
 *    - String content stored in $objects array
 *
 * 2. **Typedstream format** - Legacy Apple format, parsed with imessage-parser
 *    - Starts with "streamtyped" or other markers
 *    - Contains NSString markers and inline text
 *
 * TASK-1035: Added binary plist support to fix corruption where bplist data
 * was being misinterpreted as text (showing "bplist00" garbage characters).
 *
 * @see https://fatbobman.com/en/posts/deep-dive-into-imessage/
 * @see https://github.com/alexkwolfe/imessage-parser
 */

// Using require for imessage-parser to avoid ESM/CJS issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseAttributedBody: parseTypedStream } = require("imessage-parser") as {
  parseAttributedBody: (buffer: Buffer, options?: { cleanOutput?: boolean }) => { text: string };
};

/**
 * Preamble bytes that appear after NSString marker in typedstream format.
 * There are two variants:
 * - REGULAR (0x94): Used for immutable NSString in simple messages
 * - MUTABLE (0x95): Used for NSMutableString in rich messages (links, calendars, etc.)
 *
 * The imessage-parser library only handles REGULAR, causing rich messages to fail.
 */
const NSSTRING_PREAMBLE_REGULAR = Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]);
const NSSTRING_PREAMBLE_MUTABLE = Buffer.from([0x01, 0x95, 0x84, 0x01, 0x2b]);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const simplePlist = require("simple-plist") as {
  parse: (data: Buffer | string) => unknown;
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
 * Magic bytes for binary plist format
 * Binary plists start with "bplist00" (8 bytes)
 */
const BPLIST_MAGIC = Buffer.from("bplist00");

/**
 * Check if a buffer is a binary plist (bplist00 format)
 * @param buffer - Buffer to check
 * @returns True if buffer starts with bplist00 magic bytes
 */
export function isBinaryPlist(buffer: Buffer): boolean {
  if (buffer.length < BPLIST_MAGIC.length) {
    return false;
  }
  return buffer.subarray(0, BPLIST_MAGIC.length).equals(BPLIST_MAGIC);
}

/**
 * Typedstream marker for detecting legacy Apple typedstream format
 * Typedstream buffers contain "streamtyped" marker, typically within first 50 bytes
 * (there may be 1-4 preamble bytes before the marker)
 */
const TYPEDSTREAM_MARKER = Buffer.from("streamtyped");

/**
 * Check if a buffer is in typedstream format
 *
 * Typedstream is a legacy Apple serialization format used for NSAttributedString.
 * The marker "streamtyped" appears within the first ~50 bytes, potentially
 * preceded by preamble bytes.
 *
 * @param buffer - Buffer to check
 * @returns True if buffer contains streamtyped marker in first 50 bytes
 */
export function isTypedstream(buffer: Buffer): boolean {
  if (buffer.length < TYPEDSTREAM_MARKER.length) {
    return false;
  }

  // Check for "streamtyped" marker anywhere in first 50 bytes
  // (there may be preamble bytes before it)
  const searchWindow = buffer.subarray(0, Math.min(50, buffer.length));
  return searchWindow.includes(TYPEDSTREAM_MARKER);
}

/**
 * Possible formats for attributedBody data
 */
export type AttributedBodyFormat = "bplist" | "typedstream" | "unknown";

/**
 * Detect the format of an attributedBody buffer using magic bytes
 *
 * This function provides deterministic format detection before parsing:
 * - Binary plist (bplist00): NSKeyedArchiver format, starts with "bplist00"
 * - Typedstream: Legacy Apple format, contains "streamtyped" marker
 * - Unknown: Format not recognized, may need heuristic parsing
 *
 * TASK-1046: Foundation for deterministic message parsing refactor
 *
 * @param buffer - Buffer to detect format for (can be null/undefined)
 * @returns Detected format: 'bplist', 'typedstream', or 'unknown'
 */
export function detectAttributedBodyFormat(
  buffer: Buffer | null | undefined
): AttributedBodyFormat {
  if (!buffer || buffer.length === 0) {
    return "unknown";
  }

  if (isBinaryPlist(buffer)) {
    logService.debug("Detected binary plist format (bplist00 magic bytes)", "MessageParser");
    return "bplist";
  }

  if (isTypedstream(buffer)) {
    logService.debug("Detected typedstream format (streamtyped marker)", "MessageParser");
    return "typedstream";
  }

  logService.debug("Unknown attributedBody format", "MessageParser");
  return "unknown";
}

/**
 * NSKeyedArchiver plist structure (simplified)
 * The actual structure is complex, but we extract text from $objects
 */
interface NSKeyedArchiverPlist {
  $archiver?: string;
  $objects?: unknown[];
  $top?: { root?: { CF$UID?: number } | number };
  $version?: number;
}

/**
 * Extract text from binary plist containing NSAttributedString
 *
 * NSKeyedArchiver stores objects in $objects array with references.
 * The string content is typically stored as:
 * - Direct string values in $objects
 * - Objects with NS.string or NSString keys
 *
 * @param buffer - Binary plist buffer
 * @returns Extracted text or null if parsing fails
 */
export function extractTextFromBinaryPlist(buffer: Buffer): string | null {
  try {
    const parsed = simplePlist.parse(buffer) as NSKeyedArchiverPlist;

    // Verify this is an NSKeyedArchiver plist
    if (parsed.$archiver !== "NSKeyedArchiver" || !parsed.$objects) {
      logService.debug("Not an NSKeyedArchiver plist or missing $objects", "MessageParser");
      return null;
    }

    const objects = parsed.$objects;

    // Strategy 1: Find the longest string in $objects
    // NSAttributedString stores the text content as a string in the objects array
    const stringCandidates: string[] = [];

    for (const obj of objects) {
      // Direct string value
      if (typeof obj === "string" && obj.length > 0) {
        // Skip metadata strings
        if (!isNSKeyedArchiverMetadata(obj)) {
          stringCandidates.push(obj);
        }
      }

      // Object with NS.string property (NSMutableString)
      if (obj && typeof obj === "object" && "NS.string" in obj) {
        const nsString = (obj as { "NS.string": unknown })["NS.string"];
        if (typeof nsString === "string" && nsString.length > 0) {
          stringCandidates.push(nsString);
        }
      }

      // Object with NSString property
      if (obj && typeof obj === "object" && "NSString" in obj) {
        const nsString = (obj as { NSString: unknown }).NSString;
        if (typeof nsString === "string" && nsString.length > 0) {
          stringCandidates.push(nsString);
        }
      }
    }

    if (stringCandidates.length === 0) {
      logService.debug("No string candidates found in binary plist", "MessageParser");
      return null;
    }

    // Return the longest non-metadata string (likely the message content)
    stringCandidates.sort((a, b) => b.length - a.length);
    const result = stringCandidates[0];

    logService.debug(`Extracted text from binary plist: ${result.length} chars`, "MessageParser");
    return result;
  } catch (error) {
    logService.debug("Binary plist parsing failed", "MessageParser", {
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Check if a string is NSKeyedArchiver metadata (should be filtered from results)
 *
 * NSKeyedArchiver format contains many internal metadata strings that should
 * not be returned as message content. This function identifies these patterns:
 *
 * - $null: Null placeholder
 * - NS*: Cocoa class names (NSString, NSArray, NSMutableString, etc.)
 * - __kIM*: iMessage internal keys with double underscore prefix
 * - kIM*: iMessage internal keys without underscore prefix (TASK-1047)
 * - AttributeName/MessagePart: Formatting attributes
 * - $class: Class reference marker
 * - XX.yyyy patterns: Property accessors (NS.string, NS.data, etc.)
 *
 * @param text - String to check
 * @returns True if the string is metadata and should be filtered
 */
function isNSKeyedArchiverMetadata(text: string): boolean {
  return (
    text === "$null" ||
    text.startsWith("NS") ||
    text.startsWith("__kIM") ||
    text.startsWith("kIM") || // TASK-1047: iMessage keys without underscore prefix
    text.includes("AttributeName") ||
    text.includes("MessagePart") ||
    text.includes("$class") ||
    /^[A-Z]{2,}\.[a-z]+$/.test(text) // e.g., "NS.string", "NS.data"
  );
}

/**
 * Custom typedstream parser that handles both regular and mutable NSString preambles.
 *
 * The imessage-parser library only recognizes the REGULAR preamble (0x94),
 * but rich messages (links, calendar events, etc.) use MUTABLE preamble (0x95).
 * This causes the library to misread the length byte and return garbage.
 *
 * This function properly handles both cases.
 *
 * @param buffer - Typedstream buffer to parse
 * @returns Extracted text or null if parsing fails
 */
export function extractTextFromTypedstream(buffer: Buffer): string | null {
  const results: string[] = [];
  let offset = 0;
  const nsStringMarker = Buffer.from("NSString");

  while (offset < buffer.length) {
    const idx = buffer.indexOf(nsStringMarker, offset);
    if (idx === -1) break;

    let pos = idx + 8; // After "NSString"

    // Check for preambles (both regular and mutable)
    if (pos + 5 <= buffer.length) {
      const nextBytes = buffer.subarray(pos, pos + 5);
      if (
        nextBytes.equals(NSSTRING_PREAMBLE_REGULAR) ||
        nextBytes.equals(NSSTRING_PREAMBLE_MUTABLE)
      ) {
        pos += 5; // Skip preamble
      }
    }

    if (pos >= buffer.length) break;

    // Read length
    const lengthByte = buffer[pos++];
    let length: number;

    if (lengthByte === 0x81) {
      // Extended length (2 bytes little-endian)
      if (pos + 2 > buffer.length) break;
      length = buffer[pos] | (buffer[pos + 1] << 8);
      pos += 2;
    } else {
      length = lengthByte;
    }

    // Validate length
    if (length > 0 && length <= buffer.length - pos && length < 10000) {
      const text = buffer.subarray(pos, pos + length).toString("utf8");
      // Filter out metadata strings
      if (
        text.length > 2 &&
        !text.includes("__kIM") &&
        !text.includes("NSData") &&
        !text.includes("NSDictionary") &&
        !text.startsWith("NS.")
      ) {
        results.push(text);
      }
    }

    offset = idx + 1;
  }

  if (results.length === 0) return null;

  // Return longest result (likely the actual message content)
  results.sort((a, b) => b.length - a.length);
  return results[0];
}

/**
 * Message object interface
 */
export interface Message {
  text?: string | null;
  attributedBody?: Buffer | null;
  cache_has_attachments?: number;
}

/**
 * Extract text from macOS Messages attributedBody blob
 *
 * Supports two formats:
 * 1. Binary plist (bplist00) - NSKeyedArchiver format, parsed with simple-plist
 * 2. Typedstream format - Legacy Apple format, parsed with imessage-parser
 *
 * TASK-1035: Added binary plist detection and parsing to fix corruption where
 * bplist data was being misinterpreted as text (showing "bplist00" garbage).
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

  // TASK-1035: Check for binary plist format FIRST
  // Binary plists start with "bplist00" and require different parsing
  if (isBinaryPlist(attributedBodyBuffer)) {
    logService.debug("Detected binary plist format, using simple-plist parser", "MessageParser");

    const bplistResult = extractTextFromBinaryPlist(attributedBodyBuffer);
    if (bplistResult && bplistResult.length >= MIN_MESSAGE_TEXT_LENGTH) {
      const cleaned = cleanExtractedText(bplistResult);
      if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
        return cleaned;
      }
    }

    // Binary plist parsing failed - try heuristic extraction as fallback
    logService.debug("Binary plist text extraction failed, trying heuristic fallback", "MessageParser");
    return await tryFallbackExtraction(attributedBodyBuffer);
  }

  // Not binary plist - use typedstream parser
  // TRY OUR CUSTOM PARSER FIRST - it handles both regular and mutable NSString preambles
  // The imessage-parser library only handles regular preamble (0x94), failing on rich messages
  const customResult = extractTextFromTypedstream(attributedBodyBuffer);
  if (customResult && customResult.length >= MIN_MESSAGE_TEXT_LENGTH) {
    const cleaned = cleanExtractedText(customResult);
    if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
      logService.debug(`Custom typedstream parser succeeded: ${cleaned.length} chars`, "MessageParser");
      return cleaned;
    }
  }

  // Fall back to imessage-parser library for edge cases
  try {
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
  // Check if text looks like corrupted binary data
  // Binary garbage often contains bplist markers or high concentration of CJK/unusual characters
  const looksLikeBinaryGarbage = (text: string): boolean => {
    if (!text || text.length < 10) return false;
    // Check for bplist signature (may appear as garbled text)
    if (text.includes("bplist") || text.includes("streamtyped")) return true;
    // Check for high concentration of rare Unicode (CJK, symbols, control chars)
    // Normal text rarely has >30% chars outside basic Latin + common punctuation
    const unusualChars = text.split("").filter(c => {
      const code = c.charCodeAt(0);
      // Outside ASCII printable (32-126) and common extended (é, ñ, etc. 128-255)
      return code > 255 || (code < 32 && code !== 10 && code !== 13);
    }).length;
    return unusualChars / text.length > 0.3;
  };

  // Plain text is preferred, but check for binary garbage first
  if (message.text && !looksLikeBinaryGarbage(message.text)) {
    // Apply cleaning to handle potential UTF-16 encoding or null byte issues
    const cleaned = cleanExtractedText(message.text);
    if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH) {
      return cleaned;
    }
    // If cleaning resulted in empty/short text, try attributedBody
  }

  // Try to extract from attributed body (preferred if text was garbage)
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
