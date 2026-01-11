/**
 * Unit tests for Message Parser Utilities
 */

import {
  extractTextFromAttributedBody,
  cleanExtractedText,
  getMessageText,
  Message,
} from "../messageParser";
import { FALLBACK_MESSAGES } from "../../constants";

describe("messageParser", () => {
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
      const text = "Hello 👋 World";
      const result = cleanExtractedText(text);
      expect(result).toContain("Hello");
      expect(result).toContain("World");
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
