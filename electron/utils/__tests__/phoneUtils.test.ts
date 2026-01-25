/**
 * Unit tests for Phone Utilities
 *
 * Consolidated tests from phoneUtils.test.ts and phoneNormalization.test.ts (TASK-1201)
 */

import {
  normalizePhoneNumber,
  formatPhoneNumber,
  phoneNumbersMatch,
  extractDigits,
  getTrailingDigits,
  isPhoneNumber,
  normalizeToE164,
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

    it("should handle international numbers with suffix matching", () => {
      // UK number - last 10 digits should match
      expect(phoneNumbersMatch("+44 20 7946 0958", "2079460958")).toBe(true);
    });
  });

  // ============================================
  // Tests merged from phoneNormalization.test.ts
  // ============================================

  describe("extractDigits", () => {
    it("should extract only digits", () => {
      expect(extractDigits("(555) 123-4567")).toBe("5551234567");
    });

    it("should handle already clean numbers", () => {
      expect(extractDigits("5551234567")).toBe("5551234567");
    });

    it("should handle numbers with country code", () => {
      expect(extractDigits("+1 555 123 4567")).toBe("15551234567");
    });

    it("should return empty string for no digits", () => {
      expect(extractDigits("abc")).toBe("");
    });

    it("should return empty string for null", () => {
      expect(extractDigits(null)).toBe("");
    });

    it("should return empty string for undefined", () => {
      expect(extractDigits(undefined)).toBe("");
    });
  });

  describe("getTrailingDigits", () => {
    it("should return last 10 digits by default", () => {
      expect(getTrailingDigits("15551234567")).toBe("5551234567");
    });

    it("should return specified number of digits", () => {
      expect(getTrailingDigits("5551234567", 7)).toBe("1234567");
    });

    it("should return all digits if fewer than requested", () => {
      expect(getTrailingDigits("1234567", 10)).toBe("1234567");
    });

    it("should handle formatted numbers", () => {
      expect(getTrailingDigits("(555) 123-4567", 10)).toBe("5551234567");
    });

    it("should handle null input", () => {
      expect(getTrailingDigits(null)).toBe("");
    });

    it("should handle undefined input", () => {
      expect(getTrailingDigits(undefined)).toBe("");
    });
  });

  describe("isPhoneNumber", () => {
    it("should return true for phone numbers", () => {
      expect(isPhoneNumber("5551234567")).toBe(true);
      expect(isPhoneNumber("(555) 123-4567")).toBe(true);
      expect(isPhoneNumber("+1 555 123 4567")).toBe(true);
    });

    it("should return false for email addresses", () => {
      expect(isPhoneNumber("test@example.com")).toBe(false);
      expect(isPhoneNumber("user@domain.org")).toBe(false);
    });

    it("should return false for short strings", () => {
      expect(isPhoneNumber("12345")).toBe(false);
    });

    it("should handle mixed content", () => {
      // Contains @ so it's an email
      expect(isPhoneNumber("555@company.com")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isPhoneNumber(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPhoneNumber(undefined)).toBe(false);
    });
  });

  describe("normalizeToE164", () => {
    it("should add country code to 10-digit US numbers", () => {
      expect(normalizeToE164("5551234567")).toBe("+15551234567");
    });

    it("should preserve 11-digit numbers with country code", () => {
      expect(normalizeToE164("15551234567")).toBe("+15551234567");
    });

    it("should remove formatting from phone numbers", () => {
      expect(normalizeToE164("(555) 123-4567")).toBe("+15551234567");
    });

    it("should remove spaces from phone numbers", () => {
      expect(normalizeToE164("+1 555 123 4567")).toBe("+15551234567");
    });

    it("should remove dots from phone numbers", () => {
      expect(normalizeToE164("555.123.4567")).toBe("+15551234567");
    });

    it("should handle international numbers", () => {
      expect(normalizeToE164("+44 20 7946 0958")).toBe("+442079460958");
    });

    it("should handle empty string", () => {
      expect(normalizeToE164("")).toBe("+");
    });

    it("should handle null", () => {
      expect(normalizeToE164(null)).toBe("+");
    });

    it("should handle short numbers", () => {
      expect(normalizeToE164("1234567")).toBe("+1234567");
    });
  });

  describe("sample test cases from task", () => {
    // These should all result in matching
    const testNumbers = [
      "(555) 123-4567",
      "555-123-4567",
      "+1 555 123 4567",
      "15551234567",
      "5551234567",
    ];

    it("should normalize all variations to match using getTrailingDigits", () => {
      const normalized = testNumbers.map((n) => getTrailingDigits(n, 10));
      const expected = "5551234567";

      for (const num of normalized) {
        expect(num).toBe(expected);
      }
    });

    it("should match all variations against each other", () => {
      for (let i = 0; i < testNumbers.length; i++) {
        for (let j = i + 1; j < testNumbers.length; j++) {
          expect(phoneNumbersMatch(testNumbers[i], testNumbers[j])).toBe(true);
        }
      }
    });
  });
});
