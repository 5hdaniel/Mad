/**
 * Message Parser Utilities
 * Handles extraction of text from macOS Messages attributed body format
 *
 * The attributedBody field in macOS Messages contains an NSAttributedString
 * serialized using NSKeyedArchiver in binary plist format.
 *
 * This module uses proper bplist parsing instead of string heuristics for
 * reliable text extraction without encoding artifacts.
 *
 * @see .claude/docs/shared/imessage-attributedbody-parsing.md
 */

// Using require for bplist-parser to access parseBuffer which isn't in types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bplistParser = require("bplist-parser") as {
  parseBuffer: (buffer: Buffer) => Promise<unknown[]>;
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
 * NSKeyedArchiver structure types
 */
interface NSKeyedArchiverRoot {
  $archiver?: string;
  $version?: number;
  $top?: { root?: { UID: number } };
  $objects?: unknown[];
}

interface UIDReference {
  UID: number;
}

/**
 * Check if a value is a UID reference
 */
function isUID(value: unknown): value is UIDReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "UID" in value &&
    typeof (value as UIDReference).UID === "number"
  );
}

/**
 * Resolve a UID reference to the actual object in $objects array
 */
function resolveUID(objects: unknown[], uid: UIDReference | unknown): unknown {
  if (isUID(uid)) {
    return objects[uid.UID];
  }
  return uid;
}

/**
 * Extract text from NSKeyedArchiver structure
 * Navigates the $objects array to find the actual string content
 */
function extractTextFromNSKeyedArchiver(parsed: NSKeyedArchiverRoot): string | null {
  const objects = parsed.$objects;
  if (!objects || !Array.isArray(objects)) {
    return null;
  }

  // Strategy 1: Find string directly in objects (common for simple messages)
  // The actual message text is usually the longest non-metadata string
  const candidates: string[] = [];

  for (const obj of objects) {
    if (typeof obj === "string") {
      // Skip metadata strings
      if (
        obj.startsWith("NS") ||
        obj.startsWith("$") ||
        obj.includes("__kIM") ||
        obj.includes("kIMMessagePart") ||
        obj.includes("AttributeName") ||
        obj === "NSAttributedString" ||
        obj === "NSMutableAttributedString" ||
        obj === "NSDictionary" ||
        obj === "NSArray" ||
        obj === "NSMutableDictionary"
      ) {
        continue;
      }
      candidates.push(obj);
    }
  }

  // Strategy 2: Look for NS.string key in dictionary objects
  for (const obj of objects) {
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      const dictObj = obj as Record<string, unknown>;

      // Check for NS.string (NSString storage)
      if ("NS.string" in dictObj) {
        const nsString = resolveUID(objects, dictObj["NS.string"]);
        if (typeof nsString === "string") {
          candidates.push(nsString);
        }
      }

      // Check for NS.bytes (sometimes text is stored as data)
      if ("NS.bytes" in dictObj && Buffer.isBuffer(dictObj["NS.bytes"])) {
        const bytesText = (dictObj["NS.bytes"] as Buffer).toString("utf8");
        if (bytesText && bytesText.length > 0) {
          candidates.push(bytesText);
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Return the longest candidate (usually the actual message)
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

/**
 * Extract text from macOS Messages attributedBody blob (NSKeyedArchiver format)
 * Uses proper bplist parsing for reliable extraction.
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
    // Method 1: Parse as binary plist (NSKeyedArchiver format)
    try {
      const parsed = await bplistParser.parseBuffer(attributedBodyBuffer);

      if (parsed && parsed.length > 0) {
        const root = parsed[0] as NSKeyedArchiverRoot;

        // Verify it's an NSKeyedArchiver
        if (root.$archiver === "NSKeyedArchiver" && root.$objects) {
          const extractedText = extractTextFromNSKeyedArchiver(root);

          if (extractedText && extractedText.length >= MIN_MESSAGE_TEXT_LENGTH) {
            const cleaned = cleanExtractedText(extractedText);
            if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH) {
              return cleaned;
            }
          }
        }
      }
    } catch (bplistError) {
      // bplist parsing failed, fall back to heuristic method
      logService.debug("bplist parse failed, using fallback", "MessageParser", {
        error: (bplistError as Error).message,
      });
    }

    // Method 2: Fallback to heuristic extraction for non-standard formats
    const extractedText = extractUsingHeuristics(attributedBodyBuffer);

    if (
      extractedText &&
      extractedText.length >= MIN_MESSAGE_TEXT_LENGTH &&
      extractedText.length < MAX_MESSAGE_TEXT_LENGTH
    ) {
      return cleanExtractedText(extractedText);
    }

    return FALLBACK_MESSAGES.UNABLE_TO_EXTRACT;
  } catch (e) {
    logService.error("Error parsing attributedBody:", "MessageParser", {
      error: (e as Error).message,
    });
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
  let cleaned = text
    .replace(REGEX_PATTERNS.NULL_BYTES, "") // Remove null bytes
    .replace(REGEX_PATTERNS.CONTROL_CHARS, "") // Remove control chars
    .trim();

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
export async function getMessageText(message: Message): Promise<string> {
  // Plain text is preferred
  if (message.text) {
    return message.text;
  }

  // Try to extract from attributed body
  if (message.attributedBody) {
    return await extractTextFromAttributedBody(message.attributedBody);
  }

  // Fallback based on message type
  if (message.cache_has_attachments === 1) {
    return FALLBACK_MESSAGES.ATTACHMENT;
  }

  return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
}
