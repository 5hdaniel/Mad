/**
 * Message Parser Utilities
 * Handles extraction of text from macOS Messages attributed body format
 *
 * The attributedBody field in macOS Messages contains an NSAttributedString
 * serialized using Apple's typedstream format (NOT NSKeyedArchiver/bplist).
 *
 * This module uses the imessage-parser library for proper typedstream parsing.
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
 * Uses imessage-parser library for proper typedstream parsing.
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
      // Clean any remaining artifacts
      const cleaned = cleanExtractedText(result.text);
      if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
        return cleaned;
      }
    }

    return FALLBACK_MESSAGES.UNABLE_TO_EXTRACT;
  } catch (e) {
    logService.debug("typedstream parse failed", "MessageParser", {
      error: (e as Error).message,
    });

    // Fallback to heuristic extraction for non-standard formats
    try {
      const extractedText = extractUsingHeuristics(attributedBodyBuffer);
      if (
        extractedText &&
        extractedText.length >= MIN_MESSAGE_TEXT_LENGTH &&
        extractedText.length < MAX_MESSAGE_TEXT_LENGTH
      ) {
        return cleanExtractedText(extractedText);
      }
    } catch (fallbackError) {
      logService.error("Error parsing attributedBody:", "MessageParser", {
        error: (fallbackError as Error).message,
      });
    }

    return FALLBACK_MESSAGES.PARSING_ERROR;
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
 * @param text - Text to clean
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove Unicode replacement characters (U+FFFD) - indicates failed decoding
  // These appear when bytes can't be decoded as valid UTF-8
  cleaned = cleaned.replace(/\uFFFD/g, "");

  // Remove null bytes and control characters FIRST
  cleaned = cleaned
    .replace(REGEX_PATTERNS.NULL_BYTES, "") // Remove null bytes
    .replace(REGEX_PATTERNS.CONTROL_CHARS, "") // Remove control chars
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
