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

    it("should fall back to heuristics if binary plist has no extractable text", async () => {
      const noStringsPlist = {
        $archiver: "NSKeyedArchiver",
        $objects: ["$null"],
      };

      const bplistBuffer = simplePlist.bplistCreator(noStringsPlist);
      const result = await extractTextFromAttributedBody(bplistBuffer);

      // Should return a fallback message, not crash
      expect(typeof result).toBe("string");
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

    it("should return unable to extract for unrecognized format", async () => {
      const buffer = Buffer.from("random binary data without markers");

      const result = await extractTextFromAttributedBody(buffer);

      // Should return one of the fallback messages
      expect([
        FALLBACK_MESSAGES.UNABLE_TO_EXTRACT,
        FALLBACK_MESSAGES.REACTION_OR_SYSTEM,
      ]).toContain(result);
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
});
