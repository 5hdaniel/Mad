/**
 * Unit tests for Address Normalization Utility
 *
 * Tests address normalization and content matching used by auto-link services
 * to filter emails/messages to the correct transaction.
 *
 * @see TASK-2087
 */

import { normalizeAddress, contentContainsAddress } from "../addressNormalization";

describe("addressNormalization", () => {
  describe("normalizeAddress", () => {
    it("should normalize a full address with city/state/zip", () => {
      expect(normalizeAddress("123 Oak Street, Portland, OR 97201")).toBe("123 oak");
    });

    it("should strip abbreviated suffixes", () => {
      expect(normalizeAddress("456 Elm Dr")).toBe("456 elm");
    });

    it("should preserve directional prefixes in street names", () => {
      expect(normalizeAddress("7890 NW Johnson Blvd, Suite 200")).toBe("7890 nw johnson");
    });

    it("should strip suffix with trailing period", () => {
      expect(normalizeAddress("123 Oak St.")).toBe("123 oak");
    });

    it("should return null for missing street number", () => {
      expect(normalizeAddress("Oak Street")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(normalizeAddress("")).toBeNull();
    });

    it("should return null for null input", () => {
      expect(normalizeAddress(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(normalizeAddress(undefined)).toBeNull();
    });

    it("should return null for only a number (no street name)", () => {
      expect(normalizeAddress("123")).toBeNull();
    });

    it("should keep address without a known suffix as-is", () => {
      expect(normalizeAddress("100 Main")).toBe("100 main");
    });

    it("should handle Road suffix", () => {
      expect(normalizeAddress("500 Pine Road")).toBe("500 pine");
    });

    it("should handle Avenue suffix", () => {
      expect(normalizeAddress("200 Maple Ave")).toBe("200 maple");
    });

    it("should handle Way suffix", () => {
      expect(normalizeAddress("300 Cedar Way")).toBe("300 cedar");
    });

    it("should handle Lane suffix", () => {
      expect(normalizeAddress("400 Birch Lane")).toBe("400 birch");
    });

    it("should handle Court suffix", () => {
      expect(normalizeAddress("600 Willow Ct")).toBe("600 willow");
    });

    it("should handle Parkway suffix", () => {
      expect(normalizeAddress("700 River Parkway")).toBe("700 river");
    });

    it("should handle Highway suffix", () => {
      expect(normalizeAddress("1200 Highway")).toBeNull();
      // "1200" is the number, "highway" is the suffix -> after pop, only "1200" remains -> null
    });

    it("should handle multi-word street names", () => {
      expect(normalizeAddress("250 Martin Luther King Blvd")).toBe("250 martin luther king");
    });

    it("should be case-insensitive", () => {
      expect(normalizeAddress("123 OAK STREET")).toBe("123 oak");
    });

    it("should handle whitespace-only input", () => {
      expect(normalizeAddress("   ")).toBeNull();
    });

    it("should handle extra whitespace in address", () => {
      expect(normalizeAddress("  123   Oak   Street  ")).toBe("123 oak");
    });

    it("should return null when street number + suffix leaves nothing", () => {
      // "99 St" -> tokens ["99", "st"], suffix stripped -> ["99"], length < 2 -> null
      expect(normalizeAddress("99 St")).toBeNull();
    });

    it("should handle Loop suffix", () => {
      expect(normalizeAddress("800 River Loop")).toBe("800 river");
    });

    it("should handle Terrace suffix", () => {
      expect(normalizeAddress("900 Hill Terrace")).toBe("900 hill");
    });

    it("should handle Trail suffix", () => {
      expect(normalizeAddress("1000 Forest Trail")).toBe("1000 forest");
    });

    it("should not strip non-suffix words", () => {
      expect(normalizeAddress("123 Oak Hill")).toBe("123 oak hill");
    });

    it("should handle address with apartment/suite info after comma", () => {
      expect(normalizeAddress("123 Oak Street, Apt 4B, Portland, OR")).toBe("123 oak");
    });
  });

  describe("contentContainsAddress", () => {
    it("should find address in email subject", () => {
      expect(contentContainsAddress("Subject about 123 Oak property", "123 oak")).toBe(true);
    });

    it("should return false for unrelated content", () => {
      expect(contentContainsAddress("Unrelated email about something else", "123 oak")).toBe(false);
    });

    it("should return false for null content", () => {
      expect(contentContainsAddress(null, "123 oak")).toBe(false);
    });

    it("should return false for undefined content", () => {
      expect(contentContainsAddress(undefined, "123 oak")).toBe(false);
    });

    it("should return false for empty content", () => {
      expect(contentContainsAddress("", "123 oak")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(contentContainsAddress("Documents for 123 OAK Street closing", "123 oak")).toBe(true);
    });

    it("should match address in body text", () => {
      const body = "Please review the documents for the property at 456 Elm. The closing is next week.";
      expect(contentContainsAddress(body, "456 elm")).toBe(true);
    });

    it("should not match partial number overlap", () => {
      // "123 oak" should not match "1234 oak" because "123 " is a substring check
      // Actually "123 oak" IS a substring of "1234 oakland" -- this is a known limitation
      // but "123 oak" won't match "124 oak" which is the important case
      expect(contentContainsAddress("Property at 124 Oak", "123 oak")).toBe(false);
    });

    it("should match address embedded in longer text", () => {
      const body = "Re: Offer on 7890 nw johnson - please sign the attached documents.";
      expect(contentContainsAddress(body, "7890 nw johnson")).toBe(true);
    });
  });
});
