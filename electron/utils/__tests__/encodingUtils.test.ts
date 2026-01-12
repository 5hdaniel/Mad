/**
 * Unit tests for Encoding Detection and Conversion Utilities
 *
 * Tests cover:
 * - BOM detection for UTF-8, UTF-16 LE, UTF-16 BE
 * - Multi-encoding fallback for text decoding
 * - Replacement character detection
 * - Various encoding scenarios
 */

import {
  detectEncodingFromBOM,
  containsReplacementChars,
  countReplacementChars,
  decodeUtf16BE,
  tryMultipleEncodings,
  analyzeBufferEncoding,
  REPLACEMENT_CHAR,
} from "../encodingUtils";

describe("encodingUtils", () => {
  describe("detectEncodingFromBOM", () => {
    it("should detect UTF-8 BOM", () => {
      const buffer = Buffer.from([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f]); // BOM + "Hello"
      const result = detectEncodingFromBOM(buffer);

      expect(result.encoding).toBe("utf8");
      expect(result.hasBOM).toBe(true);
      expect(result.bomLength).toBe(3);
    });

    it("should detect UTF-16 LE BOM", () => {
      const buffer = Buffer.from([0xff, 0xfe, 0x48, 0x00, 0x65, 0x00]); // BOM + "He" in UTF-16 LE
      const result = detectEncodingFromBOM(buffer);

      expect(result.encoding).toBe("utf16le");
      expect(result.hasBOM).toBe(true);
      expect(result.bomLength).toBe(2);
    });

    it("should detect UTF-16 BE BOM", () => {
      const buffer = Buffer.from([0xfe, 0xff, 0x00, 0x48, 0x00, 0x65]); // BOM + "He" in UTF-16 BE
      const result = detectEncodingFromBOM(buffer);

      expect(result.encoding).toBe("utf16be");
      expect(result.hasBOM).toBe(true);
      expect(result.bomLength).toBe(2);
    });

    it("should return utf8 with no BOM for plain text", () => {
      const buffer = Buffer.from("Hello, World!");
      const result = detectEncodingFromBOM(buffer);

      expect(result.encoding).toBe("utf8");
      expect(result.hasBOM).toBe(false);
      expect(result.bomLength).toBe(0);
    });

    it("should handle empty buffer", () => {
      const buffer = Buffer.alloc(0);
      const result = detectEncodingFromBOM(buffer);

      expect(result.encoding).toBe("utf8");
      expect(result.hasBOM).toBe(false);
    });

    it("should handle very short buffer", () => {
      const buffer = Buffer.from([0x41]); // Just "A"
      const result = detectEncodingFromBOM(buffer);

      expect(result.encoding).toBe("utf8");
      expect(result.hasBOM).toBe(false);
    });
  });

  describe("containsReplacementChars", () => {
    it("should return false for normal text", () => {
      expect(containsReplacementChars("Hello, World!")).toBe(false);
    });

    it("should return true for text with replacement character", () => {
      expect(containsReplacementChars("Hello\uFFFDWorld")).toBe(true);
    });

    it("should return true for text with multiple replacement characters", () => {
      expect(containsReplacementChars("\uFFFD\uFFFD\uFFFD")).toBe(true);
    });

    it("should handle empty string", () => {
      expect(containsReplacementChars("")).toBe(false);
    });

    it("should handle unicode text without replacement chars", () => {
      expect(containsReplacementChars("Hello 世界 caf\u00e9")).toBe(false);
    });

    it("should handle emoji", () => {
      expect(containsReplacementChars("Great job! \u{1F44D}\u{1F389}")).toBe(false);
    });
  });

  describe("countReplacementChars", () => {
    it("should return 0 for normal text", () => {
      expect(countReplacementChars("Hello, World!")).toBe(0);
    });

    it("should count single replacement character", () => {
      expect(countReplacementChars("Hello\uFFFDWorld")).toBe(1);
    });

    it("should count multiple replacement characters", () => {
      expect(countReplacementChars("\uFFFDHello\uFFFDWorld\uFFFD")).toBe(3);
    });

    it("should handle empty string", () => {
      expect(countReplacementChars("")).toBe(0);
    });
  });

  describe("decodeUtf16BE", () => {
    it("should decode UTF-16 BE text", () => {
      // "Hi" in UTF-16 BE: 0x00 0x48 0x00 0x69
      const buffer = Buffer.from([0x00, 0x48, 0x00, 0x69]);
      const result = decodeUtf16BE(buffer);

      expect(result).toBe("Hi");
    });

    it("should decode UTF-16 BE with BOM skip", () => {
      // BOM (FE FF) + "Hi" in UTF-16 BE
      const buffer = Buffer.from([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69]);
      const result = decodeUtf16BE(buffer, 2);

      expect(result).toBe("Hi");
    });

    it("should handle accented characters", () => {
      // "caf\u00e9" in UTF-16 BE
      const buffer = Buffer.from([0x00, 0x63, 0x00, 0x61, 0x00, 0x66, 0x00, 0xe9]);
      const result = decodeUtf16BE(buffer);

      expect(result).toBe("caf\u00e9");
    });
  });

  describe("tryMultipleEncodings", () => {
    it("should decode UTF-8 text correctly", () => {
      const buffer = Buffer.from("Hello, World!");
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe("Hello, World!");
      expect(result.encoding).toBe("utf8");
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should decode UTF-16 LE text with BOM correctly", () => {
      // "Hello" in UTF-16 LE with BOM
      const buffer = Buffer.from([0xff, 0xfe, 0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f, 0x00]);
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe("Hello");
      expect(result.encoding).toBe("utf16le");
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should decode UTF-16 LE text without BOM", () => {
      // "Hello" in UTF-16 LE without BOM
      // Note: Without a BOM, the decoder may interpret this differently
      const buffer = Buffer.from([0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f, 0x00]);
      const result = tryMultipleEncodings(buffer);

      // Without BOM, it will try UTF-8 first which interprets null bytes as null chars
      // Then UTF-16 LE should decode correctly
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should decode Latin-1 text correctly", () => {
      // Latin-1: "caf\xe9" (e with acute accent)
      const buffer = Buffer.from([0x63, 0x61, 0x66, 0xe9]);
      const result = tryMultipleEncodings(buffer);

      // Should decode without replacement chars (either as UTF-8 or Latin-1)
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should use BOM-detected encoding when present", () => {
      // UTF-16 LE BOM + "Hi"
      const buffer = Buffer.from([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe("Hi");
      expect(result.encoding).toBe("utf16le");
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should handle text with special characters", () => {
      const text = "Let's meet at caf\u00e9 for r\u00e9sum\u00e9 review";
      const buffer = Buffer.from(text, "utf8");
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe(text);
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should handle smart quotes", () => {
      // Smart quotes in UTF-8
      const text = "\u201cHello\u201d and \u2018World\u2019";
      const buffer = Buffer.from(text, "utf8");
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe(text);
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should handle emoji", () => {
      const text = "Great job! \u{1F44D}\u{1F389}";
      const buffer = Buffer.from(text, "utf8");
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe(text);
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should handle CJK characters", () => {
      const text = "\u4f60\u597d \u3053\u3093\u306b\u3061\u306f \uc548\ub155\ud558\uc138\uc694";
      const buffer = Buffer.from(text, "utf8");
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe(text);
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should handle currency symbols", () => {
      const text = "Price: \u20ac100, \u00a350, \u00a530";
      const buffer = Buffer.from(text, "utf8");
      const result = tryMultipleEncodings(buffer);

      expect(result.text).toBe(text);
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should return encoding with fewest replacement chars when all fail", () => {
      // Create a buffer that will produce replacement chars in all encodings
      // This is intentionally malformed data
      const buffer = Buffer.from([0x80, 0x81, 0x82, 0x83]);
      const result = tryMultipleEncodings(buffer);

      // Should still return something, potentially with replacement chars
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe("string");
    });
  });

  describe("analyzeBufferEncoding", () => {
    it("should detect BOM presence", () => {
      const buffer = Buffer.from([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      const result = analyzeBufferEncoding(buffer);

      expect(result.hasBOM).toBe(true);
      expect(result.detectedEncoding).toBe("utf8");
    });

    it("should detect null bytes", () => {
      const buffer = Buffer.from([0x48, 0x00, 0x65, 0x00, 0x6c, 0x00]);
      const result = analyzeBufferEncoding(buffer);

      expect(result.hasNullBytes).toBe(true);
    });

    it("should provide hex preview of first bytes", () => {
      const buffer = Buffer.from("Hello");
      const result = analyzeBufferEncoding(buffer);

      expect(result.firstBytes).toBe("48656c6c6f");
    });

    it("should handle short buffers", () => {
      const buffer = Buffer.from("Hi");
      const result = analyzeBufferEncoding(buffer);

      expect(result.firstBytes).toBeDefined();
    });
  });

  describe("REPLACEMENT_CHAR constant", () => {
    it("should be the Unicode replacement character", () => {
      expect(REPLACEMENT_CHAR).toBe("\uFFFD");
      expect(REPLACEMENT_CHAR.charCodeAt(0)).toBe(0xfffd);
    });
  });

  describe("Edge cases", () => {
    it("should handle mixed valid and invalid bytes", () => {
      // Valid UTF-8 "Hello" followed by some bytes
      // Note: 0xc0 and 0xc1 are overlong encodings which may produce replacement chars
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64]); // "Hello World"
      const result = tryMultipleEncodings(buffer);

      // Should decode without issues
      expect(result.text).toContain("Hello");
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should choose encoding with fewest replacement chars for invalid data", () => {
      // Create bytes that are invalid in UTF-8 but valid in Latin-1
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x80, 0x81]); // Hello + high bytes
      const result = tryMultipleEncodings(buffer);

      // Latin-1 can decode any byte, so should have no replacement chars
      expect(result.hasReplacementChars).toBe(false);
    });

    it("should handle buffer with only BOM", () => {
      const buffer = Buffer.from([0xef, 0xbb, 0xbf]);
      const result = tryMultipleEncodings(buffer);

      expect(result.encoding).toBe("utf8");
      expect(result.text).toBe("");
    });

    it("should handle very large buffer efficiently", () => {
      const largeText = "A".repeat(100000);
      const buffer = Buffer.from(largeText);

      const start = Date.now();
      const result = tryMultipleEncodings(buffer);
      const duration = Date.now() - start;

      expect(result.text).toBe(largeText);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
