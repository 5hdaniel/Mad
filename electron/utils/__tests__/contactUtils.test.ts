/**
 * Unit tests for Contact Utilities
 */

import {
  resolveContactName,
  formatSenderName,
  looksLikePhoneNumber,
} from "../contactUtils";

// Note: getContactNamesByPhones requires database access and is tested via integration tests

describe("contactUtils", () => {
  describe("resolveContactName", () => {
    const nameMap = {
      "5551234567": "John Doe",
      "+15559876543": "Jane Smith",
      "2079460958": "UK Contact",
    };

    it("should return null for null phone", () => {
      expect(resolveContactName(null, nameMap)).toBeNull();
    });

    it("should return null for undefined phone", () => {
      expect(resolveContactName(undefined, nameMap)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(resolveContactName("", nameMap)).toBeNull();
    });

    it("should find name by direct lookup", () => {
      expect(resolveContactName("5551234567", nameMap)).toBe("John Doe");
    });

    it("should find name by normalized lookup", () => {
      // Phone with formatting should still match
      expect(resolveContactName("(555) 123-4567", nameMap)).toBe("John Doe");
    });

    it("should find name when phone has country code", () => {
      // 11-digit number should match 10-digit key
      expect(resolveContactName("15551234567", nameMap)).toBe("John Doe");
    });

    it("should find name when key has country code", () => {
      // Should match against +15559876543 -> 5559876543
      expect(resolveContactName("5559876543", nameMap)).toBe("Jane Smith");
    });

    it("should return null when no match found", () => {
      expect(resolveContactName("5550000000", nameMap)).toBeNull();
    });

    it("should return null for empty nameMap", () => {
      expect(resolveContactName("5551234567", {})).toBeNull();
    });
  });

  describe("formatSenderName", () => {
    const nameMap = {
      "5551234567": "John Doe",
    };

    it("should return 'Unknown' for null sender", () => {
      expect(formatSenderName(null, nameMap)).toBe("Unknown");
    });

    it("should return 'Unknown' for undefined sender", () => {
      expect(formatSenderName(undefined, nameMap)).toBe("Unknown");
    });

    it("should return formatted name with phone for known contact", () => {
      expect(formatSenderName("+15551234567", nameMap)).toBe(
        "John Doe (+15551234567)"
      );
    });

    it("should return phone as-is for unknown phone", () => {
      expect(formatSenderName("+15550000000", nameMap)).toBe("+15550000000");
    });

    it("should return email as-is (not a phone)", () => {
      expect(formatSenderName("test@example.com", nameMap)).toBe(
        "test@example.com"
      );
    });

    it("should return short string as-is (not enough digits)", () => {
      expect(formatSenderName("12345", nameMap)).toBe("12345");
    });
  });

  describe("looksLikePhoneNumber", () => {
    it("should return true for number starting with +", () => {
      expect(looksLikePhoneNumber("+15551234567")).toBe(true);
    });

    it("should return true for 10+ digit number", () => {
      expect(looksLikePhoneNumber("5551234567")).toBe(true);
    });

    it("should return true for 7+ digit number", () => {
      expect(looksLikePhoneNumber("1234567")).toBe(true);
    });

    it("should return false for email", () => {
      expect(looksLikePhoneNumber("test@example.com")).toBe(false);
    });

    it("should return false for short number", () => {
      expect(looksLikePhoneNumber("12345")).toBe(false);
    });

    it("should return false for null", () => {
      expect(looksLikePhoneNumber(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(looksLikePhoneNumber(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(looksLikePhoneNumber("")).toBe(false);
    });
  });
});
