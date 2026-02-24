/**
 * Unit tests for Phone Utilities
 */

import {
  normalizePhoneNumber,
  formatPhoneNumber,
  phoneNumbersMatch,
} from "../phoneUtils";

describe("phoneUtils", () => {
  describe("normalizePhoneNumber", () => {
    it("should return empty string for null input", () => {
      expect(normalizePhoneNumber(null)).toBe("");
    });

    it("should return empty string for undefined input", () => {
      expect(normalizePhoneNumber(undefined)).toBe("");
    });

    it("should return empty string for empty string input", () => {
      expect(normalizePhoneNumber("")).toBe("");
    });

    it("should remove dashes from phone number", () => {
      expect(normalizePhoneNumber("555-123-4567")).toBe("5551234567");
    });

    it("should remove parentheses from phone number", () => {
      expect(normalizePhoneNumber("(555) 123-4567")).toBe("5551234567");
    });

    it("should remove spaces from phone number", () => {
      expect(normalizePhoneNumber("555 123 4567")).toBe("5551234567");
    });

    it("should remove plus sign from phone number", () => {
      expect(normalizePhoneNumber("+1 555 123 4567")).toBe("15551234567");
    });

    it("should remove dots from phone number", () => {
      expect(normalizePhoneNumber("555.123.4567")).toBe("5551234567");
    });

    it("should handle already normalized numbers", () => {
      expect(normalizePhoneNumber("5551234567")).toBe("5551234567");
    });

    it("should remove all non-digit characters", () => {
      expect(normalizePhoneNumber("+1 (555) 123-4567 ext. 890")).toBe(
        "15551234567890",
      );
    });

    it("should preserve email handles unchanged (lowercased)", () => {
      expect(normalizePhoneNumber("user@icloud.com")).toBe("user@icloud.com");
    });

    it("should lowercase email handles", () => {
      expect(normalizePhoneNumber("User@ICLOUD.COM")).toBe("user@icloud.com");
    });

    it("should preserve complex email handles", () => {
      expect(normalizePhoneNumber("madison.jones+tag@gmail.com")).toBe(
        "madison.jones+tag@gmail.com",
      );
    });
  });

  describe("formatPhoneNumber", () => {
    it("should return empty string for null input", () => {
      expect(formatPhoneNumber(null)).toBe("");
    });

    it("should return empty string for undefined input", () => {
      expect(formatPhoneNumber(undefined)).toBe("");
    });

    it("should return email addresses unchanged", () => {
      expect(formatPhoneNumber("test@example.com")).toBe("test@example.com");
    });

    it("should format 11-digit US number with country code", () => {
      expect(formatPhoneNumber("15551234567")).toBe("+1 (555) 123-4567");
    });

    it("should format 10-digit US number", () => {
      expect(formatPhoneNumber("5551234567")).toBe("(555) 123-4567");
    });

    it("should format 7-digit local number", () => {
      expect(formatPhoneNumber("1234567")).toBe("123-4567");
    });

    it("should return cleaned number for unknown formats", () => {
      expect(formatPhoneNumber("12345")).toBe("12345");
    });

    it("should format numbers with formatting characters", () => {
      expect(formatPhoneNumber("(555) 123-4567")).toBe("(555) 123-4567");
    });

    it("should format number with country code and formatting", () => {
      expect(formatPhoneNumber("+1 (555) 123-4567")).toBe("+1 (555) 123-4567");
    });

    it("should handle numbers with leading 1 but not 11 digits", () => {
      // 12 digits should return as-is (unknown format)
      expect(formatPhoneNumber("155512345678")).toBe("155512345678");
    });

    it("should return original if cleaned is empty", () => {
      // Special characters only
      expect(formatPhoneNumber("---")).toBe("---");
    });
  });

  describe("phoneNumbersMatch", () => {
    it("should return false for null first input", () => {
      expect(phoneNumbersMatch(null, "5551234567")).toBe(false);
    });

    it("should return false for null second input", () => {
      expect(phoneNumbersMatch("5551234567", null)).toBe(false);
    });

    it("should return false for both null inputs", () => {
      expect(phoneNumbersMatch(null, null)).toBe(false);
    });

    it("should return true for exact matches", () => {
      expect(phoneNumbersMatch("5551234567", "5551234567")).toBe(true);
    });

    it("should return true for formatted vs unformatted", () => {
      expect(phoneNumbersMatch("(555) 123-4567", "5551234567")).toBe(true);
    });

    it("should return true when matching last 10 digits", () => {
      expect(phoneNumbersMatch("15551234567", "5551234567")).toBe(true);
    });

    it("should return true for both having country code", () => {
      expect(phoneNumbersMatch("+1 (555) 123-4567", "1-555-123-4567")).toBe(
        true,
      );
    });

    it("should return false for different numbers", () => {
      expect(phoneNumbersMatch("5551234567", "5559876543")).toBe(false);
    });

    it("should return false for empty strings", () => {
      expect(phoneNumbersMatch("", "")).toBe(false);
    });

    it("should return false when one is empty", () => {
      expect(phoneNumbersMatch("5551234567", "")).toBe(false);
    });

    it("should handle short numbers", () => {
      // Both less than 10 digits
      expect(phoneNumbersMatch("1234567", "1234567")).toBe(true);
      expect(phoneNumbersMatch("1234567", "7654321")).toBe(false);
    });

    it("should match based on last 10 digits when lengths differ", () => {
      // 11 digit vs 10 digit - should match on last 10
      expect(phoneNumbersMatch("15551234567", "5551234567")).toBe(true);
    });
  });
});
