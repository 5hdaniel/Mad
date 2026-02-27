/**
 * Encoding Detection and Conversion Utilities
 *
 * Handles detection and decoding of text in various encodings commonly found
 * in macOS Messages attributedBody blobs (typedstream format).
 *
 * The typedstream format may contain:
 * - UTF-8 encoded strings
 * - UTF-16 LE (Little Endian) encoded strings
 * - UTF-16 BE (Big Endian) encoded strings
 * - Latin-1 (ISO-8859-1) encoded strings
 *
 * This module provides utilities to detect encoding via BOM markers and
 * attempt multiple encoding fallbacks to ensure text is decoded correctly
 * without data loss.
 */

import logService from "../services/logService";

/**
 * Encoding types we attempt for decoding
 */
export type SupportedEncoding = "utf8" | "utf16le" | "utf16be" | "latin1";

/**
 * Result of encoding detection
 */
export interface EncodingDetectionResult {
  encoding: SupportedEncoding;
  hasBOM: boolean;
  bomLength: number;
}

/**
 * Unicode replacement character (U+FFFD)
 * This appears when a decoder cannot interpret bytes as valid characters
 */
export const REPLACEMENT_CHAR = "\uFFFD";

/**
 * Byte Order Mark (BOM) signatures
 */
const BOM_SIGNATURES = {
  // UTF-16 LE: FF FE
  UTF16_LE: [0xff, 0xfe] as const,
  // UTF-16 BE: FE FF
  UTF16_BE: [0xfe, 0xff] as const,
  // UTF-8: EF BB BF
  UTF8: [0xef, 0xbb, 0xbf] as const,
};

/**
 * Detect encoding from BOM (Byte Order Mark)
 *
 * @param buffer - Buffer to analyze
 * @returns Encoding detection result with BOM info
 */
export function detectEncodingFromBOM(buffer: Buffer): EncodingDetectionResult {
  if (buffer.length < 2) {
    return { encoding: "utf8", hasBOM: false, bomLength: 0 };
  }

  // Check for UTF-8 BOM (3 bytes)
  if (
    buffer.length >= 3 &&
    buffer[0] === BOM_SIGNATURES.UTF8[0] &&
    buffer[1] === BOM_SIGNATURES.UTF8[1] &&
    buffer[2] === BOM_SIGNATURES.UTF8[2]
  ) {
    return { encoding: "utf8", hasBOM: true, bomLength: 3 };
  }

  // Check for UTF-16 LE BOM (2 bytes: FF FE)
  if (buffer[0] === BOM_SIGNATURES.UTF16_LE[0] && buffer[1] === BOM_SIGNATURES.UTF16_LE[1]) {
    return { encoding: "utf16le", hasBOM: true, bomLength: 2 };
  }

  // Check for UTF-16 BE BOM (2 bytes: FE FF)
  if (buffer[0] === BOM_SIGNATURES.UTF16_BE[0] && buffer[1] === BOM_SIGNATURES.UTF16_BE[1]) {
    return { encoding: "utf16be", hasBOM: true, bomLength: 2 };
  }

  // No BOM detected - default to UTF-8 for initial attempt
  return { encoding: "utf8", hasBOM: false, bomLength: 0 };
}

/**
 * Check if a string contains Unicode replacement characters (U+FFFD)
 *
 * @param text - Text to check
 * @returns True if text contains replacement characters
 */
export function containsReplacementChars(text: string): boolean {
  return text.includes(REPLACEMENT_CHAR);
}

/**
 * Count the number of replacement characters in a string
 *
 * @param text - Text to analyze
 * @returns Count of U+FFFD characters
 */
export function countReplacementChars(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char === REPLACEMENT_CHAR) {
      count++;
    }
  }
  return count;
}

/**
 * Decode buffer with UTF-16 BE encoding
 * Node.js doesn't have built-in UTF-16 BE support, so we swap bytes and use UTF-16 LE
 *
 * @param buffer - Buffer to decode
 * @param skipBOM - Number of bytes to skip for BOM
 * @returns Decoded string
 */
export function decodeUtf16BE(buffer: Buffer, skipBOM = 0): string {
  const content = buffer.subarray(skipBOM);

  // Create a new buffer with swapped bytes
  const swapped = Buffer.alloc(content.length);
  for (let i = 0; i < content.length - 1; i += 2) {
    swapped[i] = content[i + 1];
    swapped[i + 1] = content[i];
  }

  return swapped.toString("utf16le");
}

/**
 * Attempt to decode buffer using multiple encodings
 * Returns the first successful decode (no replacement chars) or best effort
 *
 * @deprecated TASK-1049: This function is deprecated as part of the deterministic
 * message parsing refactor. The message parser now uses format detection (bplist00
 * or streamtyped magic bytes) and dedicated parsers instead of encoding guessing.
 * This function may be removed in a future release.
 *
 * @param buffer - Buffer to decode
 * @param context - Optional context for logging
 * @returns Decoded text and encoding used
 */
export function tryMultipleEncodings(
  buffer: Buffer,
  context?: string
): { text: string; encoding: SupportedEncoding; hasReplacementChars: boolean } {
  // First, check for BOM
  const bomResult = detectEncodingFromBOM(buffer);

  if (bomResult.hasBOM) {
    // Use detected encoding from BOM
    let decoded: string;

    if (bomResult.encoding === "utf16be") {
      decoded = decodeUtf16BE(buffer, bomResult.bomLength);
    } else if (bomResult.encoding === "utf16le") {
      decoded = buffer.subarray(bomResult.bomLength).toString("utf16le");
    } else {
      decoded = buffer.subarray(bomResult.bomLength).toString("utf8");
    }

    if (!containsReplacementChars(decoded)) {
      logService.debug(`Decoded with BOM-detected encoding: ${bomResult.encoding}`, "EncodingUtils", {
        context,
      });
      return { text: decoded, encoding: bomResult.encoding, hasReplacementChars: false };
    }
  }

  // Try encodings in order of likelihood for macOS Messages
  const encodingsToTry: SupportedEncoding[] = ["utf8", "utf16le", "utf16be", "latin1"];
  const results: Map<SupportedEncoding, { text: string; replacementCount: number }> = new Map();

  for (const encoding of encodingsToTry) {
    let decoded: string;

    try {
      if (encoding === "utf16be") {
        decoded = decodeUtf16BE(buffer, 0);
      } else {
        decoded = buffer.toString(encoding as BufferEncoding);
      }

      const replacementCount = countReplacementChars(decoded);
      results.set(encoding, { text: decoded, replacementCount });

      // If no replacement chars, this is our best result
      if (replacementCount === 0) {
        logService.debug(`Successfully decoded with ${encoding} (no replacement chars)`, "EncodingUtils", {
          context,
        });
        return { text: decoded, encoding, hasReplacementChars: false };
      }
    } catch (e) {
      // Encoding failed, continue to next
      logService.debug(`Encoding ${encoding} failed: ${(e as Error).message}`, "EncodingUtils", { context });
    }
  }

  // No perfect decode found - return the one with fewest replacement chars
  let bestEncoding: SupportedEncoding = "utf8";
  let bestResult = results.get("utf8");
  let lowestReplacements = bestResult?.replacementCount ?? Infinity;

  for (const [encoding, result] of results) {
    if (result.replacementCount < lowestReplacements) {
      bestEncoding = encoding;
      bestResult = result;
      lowestReplacements = result.replacementCount;
    }
  }

  if (bestResult) {
    if (lowestReplacements > 0) {
      logService.warn(
        `Could not fully decode text, using ${bestEncoding} with ${lowestReplacements} replacement chars`,
        "EncodingUtils",
        {
          context,
          bufferLength: buffer.length,
          hexPreview: buffer.subarray(0, 50).toString("hex"),
        }
      );
    }
    return { text: bestResult.text, encoding: bestEncoding, hasReplacementChars: lowestReplacements > 0 };
  }

  // Fallback to UTF-8
  const fallback = buffer.toString("utf8");
  return { text: fallback, encoding: "utf8", hasReplacementChars: containsReplacementChars(fallback) };
}

/**
 * Analyze buffer for encoding characteristics (for debugging)
 *
 * @param buffer - Buffer to analyze
 * @returns Analysis result
 */
export function analyzeBufferEncoding(buffer: Buffer): {
  hasBOM: boolean;
  detectedEncoding: SupportedEncoding;
  firstBytes: string;
  hasNullBytes: boolean;
  hasAlternatingNulls: boolean;
} {
  const bomResult = detectEncodingFromBOM(buffer);

  // Check for null bytes (common in UTF-16)
  let hasNullBytes = false;
  let nullByteCount = 0;
  let alternatingNullPattern: boolean;

  for (let i = 0; i < Math.min(buffer.length, 100); i++) {
    if (buffer[i] === 0) {
      hasNullBytes = true;
      nullByteCount++;
    }
  }

  // Check for alternating null pattern (typical UTF-16 for ASCII)
  // In UTF-16 LE, ASCII characters have format: byte, 0x00
  // In UTF-16 BE, ASCII characters have format: 0x00, byte
  if (buffer.length >= 4) {
    const isUTF16LE = buffer[1] === 0 && buffer[3] === 0 && buffer[0] !== 0 && buffer[2] !== 0;
    const isUTF16BE = buffer[0] === 0 && buffer[2] === 0 && buffer[1] !== 0 && buffer[3] !== 0;
    alternatingNullPattern = isUTF16LE || isUTF16BE;
  } else {
    alternatingNullPattern = false;
  }

  return {
    hasBOM: bomResult.hasBOM,
    detectedEncoding: bomResult.encoding,
    firstBytes: buffer.subarray(0, 20).toString("hex"),
    hasNullBytes,
    hasAlternatingNulls: alternatingNullPattern && nullByteCount > 5,
  };
}

/**
 * Extract text segments from a typedstream buffer
 * Looks for readable text sequences after trying multiple encodings
 *
 * @deprecated TASK-1049: This function is deprecated as part of the deterministic
 * message parsing refactor. Use extractTextFromTypedstream() from messageParser.ts
 * instead, which provides proper typedstream format parsing without encoding guessing.
 * This function may be removed in a future release.
 *
 * @param buffer - Buffer containing typedstream data
 * @returns Extracted text segments
 */
export function extractTextSegments(buffer: Buffer): string[] {
  const segments: string[] = [];
  const { text, encoding } = tryMultipleEncodings(buffer);

  // Look for continuous readable text sequences
  const readablePattern = /[\x20-\x7E\u00A0-\uFFFF]{3,}/g;
  let match;

  while ((match = readablePattern.exec(text)) !== null) {
    const segment = match[0].trim();
    if (segment.length >= 3) {
      segments.push(segment);
    }
  }

  logService.debug(`Extracted ${segments.length} text segments using ${encoding}`, "EncodingUtils");

  return segments;
}
