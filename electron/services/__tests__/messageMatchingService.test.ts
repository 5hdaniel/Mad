/**
 * Message Matching Service Tests
 * Tests for phone normalization and message-contact matching logic.
 *
 * @see TASK-977
 */

import {
  normalizePhone,
  phonesMatch,
} from "../messageMatchingService";

describe("messageMatchingService", () => {
  describe("normalizePhone", () => {
    it("normalizes 10-digit US phone numbers", () => {
      expect(normalizePhone("4155550000")).toBe("+14155550000");
      expect(normalizePhone("415-555-0000")).toBe("+14155550000");
      expect(normalizePhone("(415) 555-0000")).toBe("+14155550000");
      expect(normalizePhone("415.555.0000")).toBe("+14155550000");
      expect(normalizePhone("415 555 0000")).toBe("+14155550000");
    });

    it("normalizes 11-digit US phone numbers with country code", () => {
      expect(normalizePhone("14155550000")).toBe("+14155550000");
      expect(normalizePhone("1-415-555-0000")).toBe("+14155550000");
      expect(normalizePhone("+14155550000")).toBe("+14155550000");
      expect(normalizePhone("+1 (415) 555-0000")).toBe("+14155550000");
    });

    it("normalizes international phone numbers", () => {
      expect(normalizePhone("+442079460123")).toBe("+442079460123");
      expect(normalizePhone("+44 20 7946 0123")).toBe("+442079460123");
      expect(normalizePhone("442079460123")).toBe("+442079460123");
    });

    it("returns null for invalid phone numbers", () => {
      expect(normalizePhone(null)).toBeNull();
      expect(normalizePhone(undefined)).toBeNull();
      expect(normalizePhone("")).toBeNull();
      expect(normalizePhone("123")).toBeNull(); // Too short
      expect(normalizePhone("12345")).toBeNull(); // Too short
      expect(normalizePhone("abc")).toBeNull();
    });

    it("handles edge cases", () => {
      // Leading zeros are preserved as they indicate international format
      expect(normalizePhone("04155550000")).toBe("+04155550000");
      // Numbers with extensions: all digits are kept, treated as international (>10 digits)
      expect(normalizePhone("4155550000 ext 123")).toBe("+4155550000123");
    });
  });

  describe("phonesMatch", () => {
    it("matches identical normalized phone numbers", () => {
      expect(phonesMatch("+14155550000", "+14155550000")).toBe(true);
      expect(phonesMatch("+442079460123", "+442079460123")).toBe(true);
    });

    it("matches phone numbers in different formats", () => {
      expect(phonesMatch("(415) 555-0000", "+14155550000")).toBe(true);
      expect(phonesMatch("415-555-0000", "1-415-555-0000")).toBe(true);
      expect(phonesMatch("4155550000", "+1 (415) 555-0000")).toBe(true);
    });

    it("returns false for different phone numbers", () => {
      expect(phonesMatch("+14155550000", "+14155550001")).toBe(false);
      expect(phonesMatch("4155550000", "5105550000")).toBe(false);
    });

    it("returns false for invalid phone numbers", () => {
      expect(phonesMatch(null, "+14155550000")).toBe(false);
      expect(phonesMatch("+14155550000", null)).toBe(false);
      expect(phonesMatch(null, null)).toBe(false);
      expect(phonesMatch("", "+14155550000")).toBe(false);
      expect(phonesMatch("123", "+14155550000")).toBe(false);
    });
  });
});
