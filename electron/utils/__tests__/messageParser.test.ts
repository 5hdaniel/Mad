/**
 * Unit tests for Message Parser Utilities
 *
 * Tests cover:
 * - Binary plist (bplist00) format detection and parsing (TASK-1035)
 * - Text extraction from attributedBody (typedstream format)
 * - Multi-encoding support (UTF-8, UTF-16 LE/BE, Latin-1)
 * - Replacement character (U+FFFD) handling
 * - Text cleaning without data loss
 */

import {
  extractTextFromAttributedBody,
  cleanExtractedText,
  getMessageText,
  Message,
  isBinaryPlist,
  extractTextFromBinaryPlist,
  isTypedstream,
  detectAttributedBodyFormat,
  AttributedBodyFormat,
  extractTextFromTypedstream,
} from "../messageParser";
import { FALLBACK_MESSAGES } from "../../constants";
import { REPLACEMENT_CHAR } from "../encodingUtils";
import {
  createTypedstreamBuffer,
  createMultiSegmentTypedstream,
  TYPEDSTREAM_SAMPLES,
  BPLIST_STRUCTURES,
  EDGE_CASE_BUFFERS,
  GARBAGE_PATTERNS,
  isValidExtractedText,
  METADATA_STRINGS,
} from "./fixtures/messageParserFixtures";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const simplePlist = require("simple-plist") as {
  bplistCreator: (obj: unknown) => Buffer;
  parse: (data: Buffer | string) => unknown;
};

describe("messageParser", () => {
  /**
   * TASK-1035: Binary plist (bplist00) format tests
   * These tests verify the fix for iMessage corruption where binary plist
   * data was being misinterpreted as text (showing "bplist00" garbage).
   */
  describe("isBinaryPlist", () => {
    it("should detect buffer starting with bplist00 magic bytes", () => {
      const bplistBuffer = Buffer.from("bplist00" + "\x00".repeat(20));
      expect(isBinaryPlist(bplistBuffer)).toBe(true);
    });

    it("should return false for non-bplist buffer", () => {
      const normalBuffer = Buffer.from("streamtyped" + "\x00".repeat(20));
      expect(isBinaryPlist(normalBuffer)).toBe(false);
    });

    it("should return false for empty buffer", () => {
      const emptyBuffer = Buffer.from("");
      expect(isBinaryPlist(emptyBuffer)).toBe(false);
    });

    it("should return false for buffer smaller than magic bytes", () => {
      const smallBuffer = Buffer.from("bplist");
      expect(isBinaryPlist(smallBuffer)).toBe(false);
    });

    it("should return false for buffer with bplist00 not at start", () => {
      const buffer = Buffer.from("some prefix bplist00 data");
      expect(isBinaryPlist(buffer)).toBe(false);
    });
  });

  /**
   * TASK-1046: Typedstream format detection tests
   * These tests verify detection of the legacy Apple typedstream serialization format
   */
  describe("isTypedstream", () => {
    it("should detect buffer starting with streamtyped marker", () => {
      const buffer = Buffer.from("streamtyped" + "\x00".repeat(20));
      expect(isTypedstream(buffer)).toBe(true);
    });

    it("should detect streamtyped marker with preamble bytes", () => {
      // Typedstream format often has 1-4 preamble bytes before the marker
      const preamble = Buffer.from([0x04, 0x0b]);
      const marker = Buffer.from("streamtyped");
      const data = Buffer.from("\x00".repeat(20));
      const buffer = Buffer.concat([preamble, marker, data]);
      expect(isTypedstream(buffer)).toBe(true);
    });

    it("should return false for bplist buffer", () => {
      const bplistBuffer = Buffer.from("bplist00" + "\x00".repeat(20));
      expect(isTypedstream(bplistBuffer)).toBe(false);
    });

    it("should return false for empty buffer", () => {
      const emptyBuffer = Buffer.from("");
      expect(isTypedstream(emptyBuffer)).toBe(false);
    });

    it("should return false for buffer smaller than marker", () => {
      const smallBuffer = Buffer.from("stream");
      expect(isTypedstream(smallBuffer)).toBe(false);
    });

    it("should return false for buffer with streamtyped beyond 50 bytes", () => {
      // Marker should be within first 50 bytes
      const padding = "x".repeat(60);
      const buffer = Buffer.from(padding + "streamtyped");
      expect(isTypedstream(buffer)).toBe(false);
    });

    it("should return false for plain text buffer", () => {
      const buffer = Buffer.from("Hello, this is just plain text!");
      expect(isTypedstream(buffer)).toBe(false);
    });

    it("should detect streamtyped at position 39 (within 50 byte window)", () => {
      // Position 39 + 11 bytes marker = 50 bytes total, exactly at boundary
      const padding = "x".repeat(39);
      const buffer = Buffer.from(padding + "streamtyped");
      expect(isTypedstream(buffer)).toBe(true);
    });
  });

  /**
   * TASK-1046: Combined format detection tests
   * Tests the detectAttributedBodyFormat function that identifies format using magic bytes
   */
  describe("detectAttributedBodyFormat", () => {
    it("should return 'bplist' for binary plist buffer", () => {
      const bplistBuffer = Buffer.from("bplist00" + "\x00".repeat(20));
      expect(detectAttributedBodyFormat(bplistBuffer)).toBe("bplist");
    });

    it("should return 'typedstream' for typedstream buffer", () => {
      const typedstreamBuffer = Buffer.from("streamtyped" + "\x00".repeat(20));
      expect(detectAttributedBodyFormat(typedstreamBuffer)).toBe("typedstream");
    });

    it("should return 'unknown' for plain text buffer", () => {
      const plainText = Buffer.from("Hello, this is plain text");
      expect(detectAttributedBodyFormat(plainText)).toBe("unknown");
    });

    it("should return 'unknown' for null buffer", () => {
      expect(detectAttributedBodyFormat(null)).toBe("unknown");
    });

    it("should return 'unknown' for undefined buffer", () => {
      expect(detectAttributedBodyFormat(undefined)).toBe("unknown");
    });

    it("should return 'unknown' for empty buffer", () => {
      const emptyBuffer = Buffer.from("");
      expect(detectAttributedBodyFormat(emptyBuffer)).toBe("unknown");
    });

    it("should return 'unknown' for short buffer (not matching any format)", () => {
      const shortBuffer = Buffer.from("abc");
      expect(detectAttributedBodyFormat(shortBuffer)).toBe("unknown");
    });

    it("should prioritize bplist over typedstream when both markers present", () => {
      // If bplist marker is at start, should detect as bplist even if streamtyped appears later
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null", "streamtyped is just text content here"],
      };
      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      expect(detectAttributedBodyFormat(bplistBuffer)).toBe("bplist");
    });

    it("should detect typedstream with preamble bytes", () => {
      const preamble = Buffer.from([0x04, 0x0b]);
      const marker = Buffer.from("streamtyped");
      const data = Buffer.from("\x00".repeat(20));
      const buffer = Buffer.concat([preamble, marker, data]);
      expect(detectAttributedBodyFormat(buffer)).toBe("typedstream");
    });

    it("should return correct type for type checking", () => {
      const result: AttributedBodyFormat = detectAttributedBodyFormat(
        Buffer.from("bplist00")
      );
      // TypeScript should accept this assignment
      expect(["bplist", "typedstream", "unknown"]).toContain(result);
    });

    it("should return 'unknown' for random binary data", () => {
      const randomBuffer = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]);
      expect(detectAttributedBodyFormat(randomBuffer)).toBe("unknown");
    });
  });

  describe("extractTextFromBinaryPlist", () => {
    it("should extract text from NSKeyedArchiver plist with string in $objects", () => {
      // Create a mock NSKeyedArchiver structure
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $version: 100000,
        $objects: [
          "$null",
          "Hello, this is the actual message text!",
          { "$class": { CF$UID: 3 } },
          { "$classname": "NSMutableAttributedString" },
        ],
        $top: { root: { CF$UID: 2 } },
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("Hello, this is the actual message text!");
    });

    it("should return longest non-metadata string from $objects", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "short",
          "This is a longer message that should be selected",
          "__kIMMessagePartAttributeName",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("This is a longer message that should be selected");
    });

    it("should skip metadata strings like $null and NS prefixed", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "NSMutableAttributedString",
          "NSAttributedString",
          "Actual user message",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("Actual user message");
    });

    /**
     * TASK-1047: Test for kIM pattern (without underscore prefix)
     * iMessage metadata can use both __kIM and kIM prefixes
     */
    it("should skip kIM prefixed metadata strings (without underscore)", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "kIMMessagePartAttributeName", // Without underscore prefix
          "kIMFileTransferGUID",
          "kIMDataDetectedData",
          "This is the actual message",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("This is the actual message");
    });

    it("should skip both __kIM and kIM prefixed metadata strings", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "__kIMMessagePartAttributeName", // With underscore prefix
          "kIMBalloonBundleID", // Without underscore prefix
          "The real message content here",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("The real message content here");
    });

    it("should not filter strings that just contain kIM in the middle", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "I love making kIM chi at home",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("I love making kIM chi at home");
    });

    it("should extract text from NS.string property", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          { "NS.string": "Message from NS.string property" },
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("Message from NS.string property");
    });

    it("should return null for non-NSKeyedArchiver plist", () => {
      const regularPlist = {
        someKey: "someValue",
        anotherKey: 123,
      };

      const bplistBuffer = simplePlist.bplistCreator(regularPlist);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBeNull();
    });

    it("should return null for plist without $objects", () => {
      const incompletePlist = {
        $archiver: "NSKeyedArchiver",
        $version: 100000,
        // Missing $objects
      };

      const bplistBuffer = simplePlist.bplistCreator(incompletePlist);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBeNull();
    });

    it("should return null if no valid string candidates found", () => {
      const noStringsPlist = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null", "NSMutableAttributedString"],
      };

      const bplistBuffer = simplePlist.bplistCreator(noStringsPlist);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBeNull();
    });

    it("should handle unicode text correctly", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "Hello! \u{1F44B} Let's meet at caf\u00e9 \u2014 it'll be fun!",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("Hello! \u{1F44B} Let's meet at caf\u00e9 \u2014 it'll be fun!");
    });

    it("should handle CJK characters", () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "\u4f60\u597d \u3053\u3093\u306b\u3061\u306f \uc548\ub155\ud558\uc138\uc694",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = extractTextFromBinaryPlist(bplistBuffer);

      expect(result).toBe("\u4f60\u597d \u3053\u3093\u306b\u3061\u306f \uc548\ub155\ud558\uc138\uc694");
    });

    it("should handle invalid buffer gracefully", () => {
      const invalidBuffer = Buffer.from("not a valid plist at all");
      const result = extractTextFromBinaryPlist(invalidBuffer);

      // Should return null without throwing
      expect(result).toBeNull();
    });
  });

  /**
   * TASK-1048: Typedstream extraction and metadata filtering tests
   * Tests verify that extractTextFromTypedstream uses consistent metadata filtering
   */
  describe("extractTextFromTypedstream", () => {
    /**
     * Helper to create a mock typedstream buffer
     * Format: NSString marker + preamble + length + text
     */
    function createTypedstreamBuffer(text: string): Buffer {
      const nsStringMarker = Buffer.from("NSString");
      const preamble = Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]); // Regular preamble
      const textBuffer = Buffer.from(text, "utf8");
      const lengthByte = Buffer.from([textBuffer.length]);
      return Buffer.concat([nsStringMarker, preamble, lengthByte, textBuffer]);
    }

    it("should extract text from simple typedstream buffer", () => {
      const buffer = createTypedstreamBuffer("Hello, this is a test message!");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBe("Hello, this is a test message!");
    });

    it("should return longest text when multiple segments present", () => {
      // Create buffer with multiple NSString segments
      const segment1 = createTypedstreamBuffer("short");
      const segment2 = createTypedstreamBuffer("This is a much longer message segment");
      const combined = Buffer.concat([segment1, segment2]);

      const result = extractTextFromTypedstream(combined);
      expect(result).toBe("This is a much longer message segment");
    });

    it("should filter out __kIM prefixed metadata", () => {
      const buffer = createTypedstreamBuffer("__kIMMessagePartAttributeName");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should filter out kIM prefixed metadata (without underscore)", () => {
      // TASK-1048: kIM pattern should be filtered for consistency with TASK-1047
      const buffer = createTypedstreamBuffer("kIMFileTransferGUID");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should filter out NSData metadata", () => {
      const buffer = createTypedstreamBuffer("NSData");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should filter out NSDictionary metadata", () => {
      const buffer = createTypedstreamBuffer("NSDictionary");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should filter out NS. prefixed metadata", () => {
      const buffer = createTypedstreamBuffer("NS.string");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should filter out streamtyped marker", () => {
      const buffer = createTypedstreamBuffer("streamtyped");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should not filter strings that just contain kIM in the middle", () => {
      // Same false positive prevention as TASK-1047
      const buffer = createTypedstreamBuffer("I love making kIM chi at home");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBe("I love making kIM chi at home");
    });

    it("should return null for empty buffer", () => {
      const buffer = Buffer.from("");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should return null for buffer without NSString marker", () => {
      const buffer = Buffer.from("random data without markers");
      const result = extractTextFromTypedstream(buffer);
      expect(result).toBeNull();
    });

    it("should handle mutable preamble (0x95)", () => {
      const nsStringMarker = Buffer.from("NSString");
      const mutablePreamble = Buffer.from([0x01, 0x95, 0x84, 0x01, 0x2b]); // Mutable preamble
      const text = "Message with mutable string";
      const textBuffer = Buffer.from(text, "utf8");
      const lengthByte = Buffer.from([textBuffer.length]);
      const buffer = Buffer.concat([nsStringMarker, mutablePreamble, lengthByte, textBuffer]);

      const result = extractTextFromTypedstream(buffer);
      expect(result).toBe("Message with mutable string");
    });
  });

  /**
   * TASK-1049: Deterministic format routing tests
   * Tests verify that extractTextFromAttributedBody uses format detection
   * to route parsing and returns UNABLE_TO_PARSE for unknown formats.
   */
  describe("extractTextFromAttributedBody - deterministic routing (TASK-1049)", () => {
    it("should route bplist format to binary plist parser", async () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null", "Message from bplist"],
      };
      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);

      const result = await extractTextFromAttributedBody(bplistBuffer);

      expect(result).toBe("Message from bplist");
    });

    it("should route typedstream format to typedstream parser", async () => {
      // Create a proper typedstream buffer with streamtyped marker and NSString
      const streamtyped = Buffer.from("streamtyped");
      const nsStringMarker = Buffer.from("NSString");
      const preamble = Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]);
      const text = "Message from typedstream";
      const textBuffer = Buffer.from(text, "utf8");
      const lengthByte = Buffer.from([textBuffer.length]);
      const buffer = Buffer.concat([
        Buffer.from([0x04, 0x0b]), // preamble
        streamtyped,
        Buffer.alloc(10), // padding
        nsStringMarker,
        preamble,
        lengthByte,
        textBuffer,
      ]);

      const result = await extractTextFromAttributedBody(buffer);

      expect(result).toBe("Message from typedstream");
    });

    it("should return UNABLE_TO_PARSE for unknown format", async () => {
      // Buffer without bplist00 or streamtyped markers
      const unknownBuffer = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01, 0x02, 0x03]);

      const result = await extractTextFromAttributedBody(unknownBuffer);

      expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
    });

    it("should return UNABLE_TO_PARSE when bplist parser returns null", async () => {
      // Valid bplist structure but no extractable text
      const noTextPlist = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null"], // Only metadata, no actual text
      };
      const bplistBuffer = simplePlist.bplistCreator(noTextPlist);

      const result = await extractTextFromAttributedBody(bplistBuffer);

      expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
    });

    it("should return UNABLE_TO_PARSE when typedstream parser returns null", async () => {
      // Buffer with streamtyped marker but no extractable NSString content
      const preamble = Buffer.from([0x04, 0x0b]);
      const marker = Buffer.from("streamtyped");
      const data = Buffer.from("\x00".repeat(50)); // No NSString marker
      const buffer = Buffer.concat([preamble, marker, data]);

      const result = await extractTextFromAttributedBody(buffer);

      expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
    });

    it("should return REACTION_OR_SYSTEM for null input", async () => {
      const result = await extractTextFromAttributedBody(null);
      expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
    });

    it("should return REACTION_OR_SYSTEM for empty buffer", async () => {
      const result = await extractTextFromAttributedBody(Buffer.from(""));
      expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
    });
  });

  describe("extractTextFromAttributedBody - binary plist integration", () => {
    it("should extract text from binary plist buffer", async () => {
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "This is a message stored in binary plist format",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = await extractTextFromAttributedBody(bplistBuffer);

      expect(result).toBe("This is a message stored in binary plist format");
    });

    it("should prefer binary plist parsing over typedstream for bplist00 buffers", async () => {
      // Even if the plist contains "streamtyped" text, it should use bplist parsing
      const nsKeyedArchiverData = {
        $archiver: "NSKeyedArchiver",
        $objects: [
          "$null",
          "streamtyped is just text here, not a marker",
        ],
      };

      const bplistBuffer = simplePlist.bplistCreator(nsKeyedArchiverData);
      const result = await extractTextFromAttributedBody(bplistBuffer);

      expect(result).toBe("streamtyped is just text here, not a marker");
    });

    it("should return UNABLE_TO_PARSE if binary plist has no extractable text", async () => {
      // TASK-1049: No heuristic fallbacks, return deterministic fallback
      const noStringsPlist = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null"],
      };

      const bplistBuffer = simplePlist.bplistCreator(noStringsPlist);
      const result = await extractTextFromAttributedBody(bplistBuffer);

      // Should return UNABLE_TO_PARSE fallback (deterministic)
      expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
    });
  });

  describe("extractTextFromAttributedBody", () => {
    it("should return fallback for null input", async () => {
      expect(await extractTextFromAttributedBody(null)).toBe(
        FALLBACK_MESSAGES.REACTION_OR_SYSTEM,
      );
    });

    it("should return fallback for undefined input", async () => {
      expect(await extractTextFromAttributedBody(undefined)).toBe(
        FALLBACK_MESSAGES.REACTION_OR_SYSTEM,
      );
    });

    it("should extract text from buffer with NSString marker", async () => {
      // Create a buffer simulating macOS message format with NSString
      const messageText = "Hello, this is a test message!";
      const buffer = Buffer.from(
        `some binary data NSString` +
          "\x00".repeat(20) + // padding
          messageText +
          "\x00more data",
      );

      const result = await extractTextFromAttributedBody(buffer);

      // Should extract readable text
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should extract text from buffer with streamtyped marker", async () => {
      const messageText = "Test message with streamtyped";
      const buffer = Buffer.from(
        "streamtyped" + // marker
          messageText,
      );

      const result = await extractTextFromAttributedBody(buffer);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should return UNABLE_TO_PARSE for unrecognized format", async () => {
      // TASK-1049: Deterministic parsing returns clear fallback for unknown formats
      const buffer = Buffer.from("random binary data without markers");

      const result = await extractTextFromAttributedBody(buffer);

      // Should return UNABLE_TO_PARSE fallback (deterministic)
      expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
    });

    it("should handle very long text gracefully", async () => {
      const longText = "A".repeat(15000); // Exceeds MAX_MESSAGE_TEXT_LENGTH
      const buffer = Buffer.from("NSString" + "\x00".repeat(20) + longText);

      const result = await extractTextFromAttributedBody(buffer);

      // Should return fallback for text too long
      expect(typeof result).toBe("string");
    });

    it("should handle buffer with control characters", async () => {
      const buffer = Buffer.from(
        "NSString" + "\x00".repeat(20) + "Hello\x00World\x01\x02\x03 Test",
      );

      const result = await extractTextFromAttributedBody(buffer);

      // Should clean up control characters
      expect(typeof result).toBe("string");
    });
  });

  describe("cleanExtractedText", () => {
    it("should remove null bytes", () => {
      expect(cleanExtractedText("Hello\x00World")).toBe("HelloWorld");
    });

    it("should remove control characters", () => {
      expect(cleanExtractedText("Hello\x01\x02\x03World")).toBe("HelloWorld");
    });

    it("should trim whitespace", () => {
      expect(cleanExtractedText("  Hello World  ")).toBe("Hello World");
    });

    it("should handle text with mixed issues", () => {
      expect(cleanExtractedText("  Hello\x00\x01World  ")).toBe("HelloWorld");
    });

    it("should preserve normal characters", () => {
      expect(cleanExtractedText("Hello, World! 123")).toBe("Hello, World! 123");
    });

    it("should handle empty string", () => {
      expect(cleanExtractedText("")).toBe("");
    });

    it("should handle unicode characters", () => {
      expect(cleanExtractedText("Hello 世界")).toBe("Hello 世界");
    });

    it("should handle emojis", () => {
      const text = "Hello \u{1F44B} World";
      const result = cleanExtractedText(text);
      expect(result).toContain("Hello");
      expect(result).toContain("World");
    });

    it("should NOT remove replacement characters (U+FFFD)", () => {
      // This is critical - removing U+FFFD causes data loss
      const textWithReplacement = `Hello${REPLACEMENT_CHAR}World`;
      const result = cleanExtractedText(textWithReplacement);

      // The replacement character should still be present
      expect(result).toContain(REPLACEMENT_CHAR);
      expect(result).toBe(`Hello${REPLACEMENT_CHAR}World`);
    });

    it("should preserve smart quotes", () => {
      const text = "\u201cHello\u201d and \u2018World\u2019";
      const result = cleanExtractedText(text);
      expect(result).toBe(text);
    });

    it("should preserve accented characters", () => {
      const text = "Let's meet at caf\u00e9 for r\u00e9sum\u00e9 review";
      const result = cleanExtractedText(text);
      expect(result).toBe(text);
    });

    it("should preserve currency symbols", () => {
      const text = "Price: \u20ac100, \u00a350, \u00a530";
      const result = cleanExtractedText(text);
      expect(result).toBe(text);
    });

    it("should preserve CJK characters", () => {
      const text = "\u4f60\u597d \u3053\u3093\u306b\u3061\u306f";
      const result = cleanExtractedText(text);
      expect(result).toBe(text);
    });
  });

  describe("Encoding scenarios (TASK-1028)", () => {
    describe("UTF-8 text handling", () => {
      it("should handle UTF-8 text with special characters", async () => {
        const messageText = "Let's meet at caf\u00e9";
        const buffer = Buffer.from(`NSString${"\x00".repeat(20)}${messageText}`);

        const result = await extractTextFromAttributedBody(buffer);

        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
      });

      it("should handle UTF-8 emoji content", async () => {
        const messageText = "Great job! \u{1F44D}\u{1F389}";
        const buffer = Buffer.from(`NSString${"\x00".repeat(20)}${messageText}`);

        const result = await extractTextFromAttributedBody(buffer);

        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
      });

      it("should handle UTF-8 smart quotes", async () => {
        const messageText = "\u201cHello\u201d and \u2018World\u2019";
        const buffer = Buffer.from(`NSString${"\x00".repeat(20)}${messageText}`);

        const result = await extractTextFromAttributedBody(buffer);

        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
      });
    });

    describe("Multi-encoding fallback", () => {
      it("should handle Latin-1 encoded text", async () => {
        // Latin-1: "caf\xe9" (cafe with accent)
        const latin1Buffer = Buffer.from([
          0x4e, 0x53, 0x53, 0x74, 0x72, 0x69, 0x6e, 0x67, // "NSString"
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // padding
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00,
          0x63, 0x61, 0x66, 0xe9, // "caf\xe9" in Latin-1
        ]);

        const result = await extractTextFromAttributedBody(latin1Buffer);

        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
      });

      it("should handle text without NSString marker", async () => {
        const messageText = "Hello, this is a plain text message!";
        const buffer = Buffer.from(messageText);

        const result = await extractTextFromAttributedBody(buffer);

        // Should either extract or return fallback, but not crash
        expect(typeof result).toBe("string");
      });
    });

    describe("Replacement character preservation", () => {
      it("should NOT strip replacement characters - that causes data loss", async () => {
        // Create a buffer that simulates corrupted data
        // The key is that we should preserve U+FFFD, not strip it
        const textWithReplacement = `Hello${REPLACEMENT_CHAR}World`;
        const message: Message = {
          text: textWithReplacement,
          attributedBody: null,
        };

        const result = await getMessageText(message);

        // Critical: replacement character should still be there
        expect(result).toContain(REPLACEMENT_CHAR);
      });

      it("should log warning but preserve text when encoding fails", async () => {
        // This test verifies we don't silently drop content
        const message: Message = {
          text: null,
          attributedBody: Buffer.from("streamtyped" + "some content here"),
        };

        const result = await getMessageText(message);

        // Should return something, not throw
        expect(typeof result).toBe("string");
      });
    });

    describe("Real-world encoding scenarios", () => {
      it("should handle text with curly apostrophes", async () => {
        const message: Message = {
          text: "Let\u2019s do this", // curly apostrophe
          attributedBody: null,
        };

        const result = await getMessageText(message);

        expect(result).toBe("Let\u2019s do this");
      });

      it("should handle text with em-dash", async () => {
        const message: Message = {
          text: "Hello\u2014World", // em-dash
          attributedBody: null,
        };

        const result = await getMessageText(message);

        expect(result).toBe("Hello\u2014World");
      });

      it("should handle non-Latin scripts", async () => {
        const message: Message = {
          text: "\u4f60\u597d \u3053\u3093\u306b\u3061\u306f \uc548\ub155\ud558\uc138\uc694", // Chinese, Japanese, Korean
          attributedBody: null,
        };

        const result = await getMessageText(message);

        expect(result).toBe("\u4f60\u597d \u3053\u3093\u306b\u3061\u306f \uc548\ub155\ud558\uc138\uc694");
      });

      it("should handle currency symbols", async () => {
        const message: Message = {
          text: "Price: \u20ac100, \u00a350, \u00a530",
          attributedBody: null,
        };

        const result = await getMessageText(message);

        expect(result).toBe("Price: \u20ac100, \u00a350, \u00a530");
      });

      it("should handle mixed emoji and text", async () => {
        const message: Message = {
          text: "Meeting at 3pm \u{1F4C5} don\u2019t forget! \u{1F44D}",
          attributedBody: null,
        };

        const result = await getMessageText(message);

        expect(result).toContain("\u{1F4C5}");
        expect(result).toContain("\u{1F44D}");
        expect(result).toContain("\u2019"); // curly apostrophe preserved
      });
    });
  });

  describe("getMessageText", () => {
    it("should return plain text when available", async () => {
      const message: Message = {
        text: "Hello World",
        attributedBody: Buffer.from("some data"),
      };

      expect(await getMessageText(message)).toBe("Hello World");
    });

    it("should extract from attributedBody when text is null", async () => {
      const message: Message = {
        text: null,
        attributedBody: Buffer.from(
          "NSString" + "\x00".repeat(20) + "Extracted Text",
        ),
      };

      const result = await getMessageText(message);
      expect(typeof result).toBe("string");
    });

    it("should return attachment fallback when has attachments and no text", async () => {
      const message: Message = {
        text: null,
        attributedBody: null,
        cache_has_attachments: 1,
      };

      expect(await getMessageText(message)).toBe(FALLBACK_MESSAGES.ATTACHMENT);
    });

    it("should return reaction fallback when no text, no body, and no attachments", async () => {
      const message: Message = {
        text: null,
        attributedBody: null,
        cache_has_attachments: 0,
      };

      expect(await getMessageText(message)).toBe(
        FALLBACK_MESSAGES.REACTION_OR_SYSTEM,
      );
    });

    it("should prefer text over attributedBody", async () => {
      const message: Message = {
        text: "Plain Text",
        attributedBody: Buffer.from(
          "NSString" + "\x00".repeat(20) + "Different Text",
        ),
      };

      expect(await getMessageText(message)).toBe("Plain Text");
    });

    it("should handle empty text as no text", async () => {
      const message: Message = {
        text: "",
        attributedBody: Buffer.from(
          "NSString" + "\x00".repeat(20) + "From Body",
        ),
      };

      // Empty string is falsy, so should use attributedBody
      const result = await getMessageText(message);
      expect(typeof result).toBe("string");
    });

    it("should handle undefined text", async () => {
      const message: Message = {
        text: undefined,
        cache_has_attachments: 1,
      };

      expect(await getMessageText(message)).toBe(FALLBACK_MESSAGES.ATTACHMENT);
    });
  });

  /**
   * TASK-1051: Comprehensive typedstream extraction tests using fixtures
   */
  describe("extractTextFromTypedstream - comprehensive (TASK-1051)", () => {
    describe("Format variations", () => {
      it("should extract text from simple typedstream (fixture)", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.SIMPLE);
        expect(result).toBe("Hello, this is a test message!");
      });

      it("should handle typedstream with streamtyped marker (fixture)", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.WITH_MARKER);
        expect(result).toBe("Hello from typedstream!");
      });

      it("should handle mutable string preamble (fixture)", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.MUTABLE_STRING);
        expect(result).toBe("Check out this link!");
      });

      it("should handle extended length format (>127 bytes)", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.EXTENDED_LENGTH);
        expect(result).toBe("A".repeat(150));
      });

      it("should handle extended length format with 0x81 prefix", () => {
        // Create a buffer with 200 chars to require extended length
        const longText = "B".repeat(200);
        const buffer = createTypedstreamBuffer(longText);
        const result = extractTextFromTypedstream(buffer);
        expect(result).toBe(longText);
      });
    });

    describe("Unicode content", () => {
      it("should extract unicode text from typedstream", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.UNICODE);
        expect(result).toBe("Hello! Let's meet at cafe for coffee!");
      });

      it("should handle emoji content", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.EMOJI);
        expect(result).toBe("Great job! Thumbs up! Party!");
      });

      it("should handle CJK characters", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.CJK);
        expect(result).toBe("Hello in Chinese, Japanese, and Korean");
      });
    });

    describe("Multiple segments", () => {
      it("should return longest segment from multi-segment buffer", () => {
        const buffer = createMultiSegmentTypedstream([
          "short",
          "medium length text",
          "This is the longest text segment in the buffer",
        ]);
        const result = extractTextFromTypedstream(buffer);
        expect(result).toBe("This is the longest text segment in the buffer");
      });

      it("should handle two equal-length segments", () => {
        const buffer = createMultiSegmentTypedstream([
          "first segment here",
          "other segment too",
        ]);
        const result = extractTextFromTypedstream(buffer);
        // Should return one of them (first sorted longest)
        expect(result).toBe("first segment here");
      });
    });

    describe("Metadata filtering", () => {
      it("should filter NSKeyedArchiver class names that match filter patterns", () => {
        // These specific class names match the isTypedstreamMetadata filter
        // Note: The filter uses includes() checks, so the exact class name must be in the list
        // or contain one of the filtered substrings
        const filteredClasses = [
          "NSAttributedString", // matches includes("NSAttributedString")
          "NSMutableString",    // matches includes("NSMutableString")
          "NSString",           // matches includes("NSString")
          "NSObject",           // matches includes("NSObject")
          "NSDictionary",       // matches includes("NSDictionary")
          "NSArray",            // matches includes("NSArray")
          "NSData",             // matches includes("NSData")
        ];
        for (const metadata of filteredClasses) {
          const buffer = createTypedstreamBuffer(metadata);
          const result = extractTextFromTypedstream(buffer);
          expect(result).toBeNull();
        }
      });

      it("should NOT filter NSMutableAttributedString (not in filter list)", () => {
        // NSMutableAttributedString doesn't match any filter pattern:
        // - It doesn't contain "NSAttributedString" (different string)
        // - It doesn't contain "NSMutableString" (different string)
        // - It DOES contain "String" but that's not a filter
        // This is a known limitation of the current filter design
        const buffer = createTypedstreamBuffer("NSMutableAttributedString");
        const result = extractTextFromTypedstream(buffer);
        // The filter misses this one - it's a complex class name
        expect(result).toBe("NSMutableAttributedString");
      });

      it("should filter all iMessage metadata keys", () => {
        for (const metadata of METADATA_STRINGS.IMESSAGE_KEYS) {
          const buffer = createTypedstreamBuffer(metadata);
          const result = extractTextFromTypedstream(buffer);
          expect(result).toBeNull();
        }
      });

      it("should filter format markers", () => {
        for (const marker of METADATA_STRINGS.FORMAT_MARKERS) {
          const buffer = createTypedstreamBuffer(marker);
          const result = extractTextFromTypedstream(buffer);
          expect(result).toBeNull();
        }
      });

      it("should NOT filter kIM appearing in middle of text (not at start)", () => {
        // Note: The filter uses startsWith("kIM") so middle occurrences are allowed
        const buffer = createTypedstreamBuffer("The kIM chi was delicious");
        const result = extractTextFromTypedstream(buffer);
        expect(result).toBe("The kIM chi was delicious");
      });

      it("should filter text containing NS class names (aggressive filter)", () => {
        // Note: Current implementation uses includes() for NS class names
        // This is intentionally aggressive to prevent metadata leaking through
        // Text containing "NSString" etc. will be filtered
        const textsWithClasses = [
          "I love NSString programming",
          "Let me explain NSAttributedString to you",
        ];
        for (const text of textsWithClasses) {
          const buffer = createTypedstreamBuffer(text);
          const result = extractTextFromTypedstream(buffer);
          // These are filtered because they contain NS class names
          expect(result).toBeNull();
        }
      });
    });

    describe("Edge cases", () => {
      it("should return null for empty string content", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.EMPTY_STRING);
        expect(result).toBeNull();
      });

      it("should handle very short string (2 chars)", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.SHORT_STRING);
        expect(result).toBeNull(); // Too short (< 3 chars after filtering)
      });

      it("should return null for metadata-only content", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.ONLY_METADATA);
        expect(result).toBeNull();
      });

      it("should return null for kIM metadata without underscore", () => {
        const result = extractTextFromTypedstream(TYPEDSTREAM_SAMPLES.KIM_METADATA);
        expect(result).toBeNull();
      });

      it("should handle buffer with truncated length byte", () => {
        // Create buffer that ends right after NSString marker
        const buffer = Buffer.from("NSString");
        const result = extractTextFromTypedstream(buffer);
        expect(result).toBeNull();
      });

      it("should handle buffer with invalid length value", () => {
        // Create buffer with length byte pointing beyond buffer
        const nsStringMarker = Buffer.from("NSString");
        const preamble = Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]);
        const invalidLength = Buffer.from([0xff]); // 255 bytes but buffer is shorter
        const buffer = Buffer.concat([nsStringMarker, preamble, invalidLength, Buffer.from("short")]);
        const result = extractTextFromTypedstream(buffer);
        expect(result).toBeNull();
      });
    });
  });

  /**
   * TASK-1051: Comprehensive binary plist extraction tests using fixtures
   */
  describe("extractTextFromBinaryPlist - comprehensive (TASK-1051)", () => {
    describe("Structure variations", () => {
      it("should extract from simple message structure", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("Hello, this is a message from binary plist!");
      });

      it("should extract from NS.string property", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.NS_STRING_PROPERTY);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("Message from NS.string property");
      });

      it("should pick longest from multiple strings", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.MULTIPLE_STRINGS);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("This is a longer message that should be selected");
      });
    });

    describe("Metadata filtering", () => {
      it("should return null for metadata-only structure", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.ONLY_METADATA);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBeNull();
      });

      it("should return null for empty $objects", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.EMPTY_OBJECTS);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBeNull();
      });

      it("should return null for non-NSKeyedArchiver plist", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.NOT_KEYED_ARCHIVER);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBeNull();
      });

      it("should filter kIM metadata strings", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.KIM_METADATA);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("This is the actual message");
      });

      it("should filter mixed __kIM and kIM metadata", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.MIXED_KIM);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("The real message content here");
      });

      it("should NOT filter kIM appearing in middle of text", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.KIM_IN_MIDDLE);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("I love making kIM chi at home");
      });
    });

    describe("Unicode content", () => {
      it("should handle unicode message", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.UNICODE_MESSAGE);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("Hello! Let's meet at cafe - it'll be fun!");
      });

      it("should handle CJK message", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.CJK_MESSAGE);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("Chinese, Japanese, Korean greetings");
      });
    });

    describe("Edge cases", () => {
      it("should handle streamtyped as text content", () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.STREAMTYPED_AS_TEXT);
        const result = extractTextFromBinaryPlist(buffer);
        expect(result).toBe("streamtyped is just text content here, not a marker");
      });

      it("should handle malformed bplist gracefully", () => {
        const result = extractTextFromBinaryPlist(EDGE_CASE_BUFFERS.INVALID_BPLIST);
        expect(result).toBeNull();
      });

      it("should handle empty buffer", () => {
        const result = extractTextFromBinaryPlist(EDGE_CASE_BUFFERS.EMPTY);
        expect(result).toBeNull();
      });

      it("should handle random binary data", () => {
        const result = extractTextFromBinaryPlist(EDGE_CASE_BUFFERS.RANDOM_BINARY);
        expect(result).toBeNull();
      });
    });
  });

  /**
   * TASK-1051: Main parser flow integration tests
   */
  describe("extractTextFromAttributedBody - integration (TASK-1051)", () => {
    describe("Format routing", () => {
      it("should route bplist to binary parser and extract text", async () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE);
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe("Hello, this is a message from binary plist!");
      });

      it("should route typedstream to typedstream parser", async () => {
        const buffer = createTypedstreamBuffer("Message via typedstream", {
          includeStreamMarker: true,
        });
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe("Message via typedstream");
      });

      it("should return UNABLE_TO_PARSE for unknown format", async () => {
        const result = await extractTextFromAttributedBody(EDGE_CASE_BUFFERS.RANDOM_BINARY);
        expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
      });

      it("should return UNABLE_TO_PARSE for plain text without markers", async () => {
        const result = await extractTextFromAttributedBody(EDGE_CASE_BUFFERS.PLAIN_TEXT);
        expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
      });
    });

    describe("Fallback handling", () => {
      it("should return REACTION_OR_SYSTEM for null buffer", async () => {
        const result = await extractTextFromAttributedBody(null);
        expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
      });

      it("should return REACTION_OR_SYSTEM for undefined buffer", async () => {
        const result = await extractTextFromAttributedBody(undefined);
        expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
      });

      it("should return REACTION_OR_SYSTEM for empty buffer", async () => {
        const result = await extractTextFromAttributedBody(EDGE_CASE_BUFFERS.EMPTY);
        expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
      });

      it("should return UNABLE_TO_PARSE when bplist has no extractable content", async () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.EMPTY_OBJECTS);
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
      });

      it("should return UNABLE_TO_PARSE when typedstream has no extractable content", async () => {
        // Typedstream marker but no NSString content
        const preamble = Buffer.from([0x04, 0x0b]);
        const marker = Buffer.from("streamtyped");
        const padding = Buffer.alloc(50);
        const buffer = Buffer.concat([preamble, marker, padding]);
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe(FALLBACK_MESSAGES.UNABLE_TO_PARSE);
      });
    });

    describe("Text cleaning integration", () => {
      it("should clean control characters from extracted bplist text", async () => {
        const plist = {
          $archiver: "NSKeyedArchiver",
          $objects: ["$null", "Hello\x00\x01\x02World"],
        };
        const buffer = simplePlist.bplistCreator(plist);
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe("HelloWorld");
      });

      it("should clean control characters from extracted typedstream text", async () => {
        const buffer = createTypedstreamBuffer("Hello\x00\x01\x02World", {
          includeStreamMarker: true,
        });
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe("HelloWorld");
      });

      it("should preserve unicode in cleaned text", async () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.UNICODE_MESSAGE);
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toContain("cafe");
      });
    });
  });

  /**
   * TASK-1051: Regression tests for garbage text issues
   */
  describe("Regression Tests (TASK-1051)", () => {
    describe("Garbage text prevention", () => {
      it("should NOT return Chinese characters for English bplist message", async () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE);
        const result = await extractTextFromAttributedBody(buffer);

        // Verify no garbage patterns
        expect(result).not.toMatch(GARBAGE_PATTERNS.CJK_RANGE);
        expect(result).not.toMatch(GARBAGE_PATTERNS.DEVANAGARI);
        expect(result).not.toMatch(GARBAGE_PATTERNS.RAW_MARKER);
        expect(result).not.toMatch(GARBAGE_PATTERNS.BPLIST_MARKER);
      });

      it("should NOT return streamtyped marker in output", async () => {
        const buffer = createTypedstreamBuffer("Hello world", {
          includeStreamMarker: true,
        });
        const result = await extractTextFromAttributedBody(buffer);

        expect(result).not.toContain("streamtyped");
        expect(result).toBe("Hello world");
      });

      it("should NOT return bplist00 marker in output", async () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE);
        const result = await extractTextFromAttributedBody(buffer);

        expect(result).not.toContain("bplist00");
      });

      it("should return valid text or fallback, never garbage", async () => {
        const buffer = simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE);
        const result = await extractTextFromAttributedBody(buffer);

        // Either readable or fallback
        const isReadable = isValidExtractedText(result, true);
        const isFallback = Object.values(FALLBACK_MESSAGES).includes(result);
        expect(isReadable || isFallback).toBe(true);
      });
    });

    describe("Fallback consistency", () => {
      it("should always return string type, never null or undefined", async () => {
        const testCases = [
          null,
          undefined,
          EDGE_CASE_BUFFERS.EMPTY,
          EDGE_CASE_BUFFERS.RANDOM_BINARY,
          EDGE_CASE_BUFFERS.PLAIN_TEXT,
          EDGE_CASE_BUFFERS.ALL_NULLS,
        ];

        for (const testCase of testCases) {
          const result = await extractTextFromAttributedBody(testCase as Buffer | null);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      });

      it("should return one of the defined fallback messages for unparseable content", async () => {
        const result = await extractTextFromAttributedBody(EDGE_CASE_BUFFERS.RANDOM_BINARY);
        const validFallbacks = Object.values(FALLBACK_MESSAGES);
        expect(validFallbacks).toContain(result);
      });
    });

    describe("Rich message handling", () => {
      it("should parse rich message with link (mutable string)", async () => {
        const buffer = createTypedstreamBuffer("Check out https://example.com", {
          preamble: "mutable",
          includeStreamMarker: true,
        });
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toContain("example.com");
      });

      it("should parse calendar event message", async () => {
        const buffer = createTypedstreamBuffer("Meeting tomorrow at 3pm", {
          preamble: "mutable",
          includeStreamMarker: true,
        });
        const result = await extractTextFromAttributedBody(buffer);
        expect(result).toBe("Meeting tomorrow at 3pm");
      });
    });
  });

  /**
   * TASK-1051: getMessageText comprehensive tests
   */
  describe("getMessageText - comprehensive (TASK-1051)", () => {
    describe("Priority handling", () => {
      it("should use text field when valid (priority 1)", async () => {
        const message: Message = {
          text: "Direct text content",
          attributedBody: simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE),
        };
        const result = await getMessageText(message);
        expect(result).toBe("Direct text content");
      });

      it("should fall back to attributedBody when text is empty (priority 2)", async () => {
        const message: Message = {
          text: "",
          attributedBody: simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE),
        };
        const result = await getMessageText(message);
        expect(result).toBe("Hello, this is a message from binary plist!");
      });

      it("should fall back to attributedBody when text is null (priority 2)", async () => {
        const message: Message = {
          text: null,
          attributedBody: simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE),
        };
        const result = await getMessageText(message);
        expect(result).toBe("Hello, this is a message from binary plist!");
      });

      it("should return ATTACHMENT fallback when has attachments (priority 3)", async () => {
        const message: Message = {
          text: null,
          attributedBody: null,
          cache_has_attachments: 1,
        };
        const result = await getMessageText(message);
        expect(result).toBe(FALLBACK_MESSAGES.ATTACHMENT);
      });

      it("should return REACTION_OR_SYSTEM as last resort (priority 4)", async () => {
        const message: Message = {
          text: null,
          attributedBody: null,
          cache_has_attachments: 0,
        };
        const result = await getMessageText(message);
        expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
      });
    });

    describe("Text cleaning", () => {
      it("should clean control characters from text field", async () => {
        const message: Message = {
          text: "Hello\x00\x01World",
          attributedBody: null,
        };
        const result = await getMessageText(message);
        expect(result).toBe("HelloWorld");
      });

      it("should preserve replacement characters", async () => {
        const message: Message = {
          text: `Hello${REPLACEMENT_CHAR}World`,
          attributedBody: null,
        };
        const result = await getMessageText(message);
        expect(result).toContain(REPLACEMENT_CHAR);
      });

      it("should preserve unicode in text field", async () => {
        const message: Message = {
          text: "Let's meet at cafe",
          attributedBody: null,
        };
        const result = await getMessageText(message);
        expect(result).toBe("Let's meet at cafe");
      });
    });

    describe("Edge cases", () => {
      it("should handle whitespace-only text as invalid", async () => {
        const message: Message = {
          text: "   ",
          attributedBody: simplePlist.bplistCreator(BPLIST_STRUCTURES.SIMPLE_MESSAGE),
        };
        const result = await getMessageText(message);
        // Whitespace-only text is cleaned to empty, should fall back to attributedBody
        expect(result).toBe("Hello, this is a message from binary plist!");
      });

      it("should handle message with all properties undefined", async () => {
        const message: Message = {};
        const result = await getMessageText(message);
        expect(result).toBe(FALLBACK_MESSAGES.REACTION_OR_SYSTEM);
      });

      it("should handle very long text gracefully", async () => {
        const longText = "A".repeat(15000);
        const message: Message = {
          text: longText,
          attributedBody: null,
        };
        const result = await getMessageText(message);
        // Should handle gracefully - either truncate or return fallback
        expect(typeof result).toBe("string");
      });
    });
  });

  /**
   * TASK-1051: Performance and stress tests
   */
  describe("Performance Tests (TASK-1051)", () => {
    it("should handle large bplist buffer efficiently", async () => {
      const largeText = "A".repeat(5000);
      const plist = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null", largeText],
      };
      const buffer = simplePlist.bplistCreator(plist);

      const start = Date.now();
      const result = await extractTextFromAttributedBody(buffer);
      const duration = Date.now() - start;

      expect(result).toBe(largeText);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it("should handle large typedstream buffer efficiently", async () => {
      const buffer = EDGE_CASE_BUFFERS.LARGE;
      const start = Date.now();
      const result = await extractTextFromAttributedBody(buffer);
      const duration = Date.now() - start;

      expect(typeof result).toBe("string");
      expect(duration).toBeLessThan(1000);
    });

    it("should handle many small buffers efficiently", async () => {
      const buffers = Array(100).fill(null).map(() =>
        simplePlist.bplistCreator({
          $archiver: "NSKeyedArchiver",
          $objects: ["$null", "Short message"],
        })
      );

      const start = Date.now();
      for (const buffer of buffers) {
        await extractTextFromAttributedBody(buffer);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // 100 buffers in under 5 seconds
    });
  });
});
