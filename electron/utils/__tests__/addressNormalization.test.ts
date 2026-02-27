/**
 * Unit tests for Address Normalization Utility
 *
 * Tests address normalization and content matching used by auto-link services
 * to filter emails to the correct transaction.
 *
 * TASK-2087: Updated to test separate-parts matching with word boundaries.
 * Address filtering applies to EMAILS ONLY, not text messages.
 *
 * @see TASK-2087
 */

import { normalizeAddress, contentContainsAddress, withAddressFallback, type NormalizedAddress } from "../addressNormalization";

describe("addressNormalization", () => {
  describe("normalizeAddress", () => {
    it("should normalize a full address with city/state/zip", () => {
      const result = normalizeAddress("123 Oak Street, Portland, OR 97201");
      expect(result).toEqual({ streetNumber: "123", streetName: "oak", full: "123 oak" });
    });

    it("should strip abbreviated suffixes", () => {
      const result = normalizeAddress("456 Elm Dr");
      expect(result).toEqual({ streetNumber: "456", streetName: "elm", full: "456 elm" });
    });

    it("should preserve directional prefixes in street names", () => {
      const result = normalizeAddress("7890 NW Johnson Blvd, Suite 200");
      expect(result).toEqual({ streetNumber: "7890", streetName: "nw johnson", full: "7890 nw johnson" });
    });

    it("should strip suffix with trailing period", () => {
      const result = normalizeAddress("123 Oak St.");
      expect(result).toEqual({ streetNumber: "123", streetName: "oak", full: "123 oak" });
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
      const result = normalizeAddress("100 Main");
      expect(result).toEqual({ streetNumber: "100", streetName: "main", full: "100 main" });
    });

    it("should handle Road suffix", () => {
      const result = normalizeAddress("500 Pine Road");
      expect(result).toEqual({ streetNumber: "500", streetName: "pine", full: "500 pine" });
    });

    it("should handle Avenue suffix", () => {
      const result = normalizeAddress("200 Maple Ave");
      expect(result).toEqual({ streetNumber: "200", streetName: "maple", full: "200 maple" });
    });

    it("should handle Way suffix", () => {
      const result = normalizeAddress("300 Cedar Way");
      expect(result).toEqual({ streetNumber: "300", streetName: "cedar", full: "300 cedar" });
    });

    it("should handle Lane suffix", () => {
      const result = normalizeAddress("400 Birch Lane");
      expect(result).toEqual({ streetNumber: "400", streetName: "birch", full: "400 birch" });
    });

    it("should handle Court suffix", () => {
      const result = normalizeAddress("600 Willow Ct");
      expect(result).toEqual({ streetNumber: "600", streetName: "willow", full: "600 willow" });
    });

    it("should handle Parkway suffix", () => {
      const result = normalizeAddress("700 River Parkway");
      expect(result).toEqual({ streetNumber: "700", streetName: "river", full: "700 river" });
    });

    it("should handle Highway suffix", () => {
      expect(normalizeAddress("1200 Highway")).toBeNull();
      // "1200" is the number, "highway" is the suffix -> after pop, only "1200" remains -> null
    });

    it("should handle multi-word street names", () => {
      const result = normalizeAddress("250 Martin Luther King Blvd");
      expect(result).toEqual({ streetNumber: "250", streetName: "martin luther king", full: "250 martin luther king" });
    });

    it("should be case-insensitive", () => {
      const result = normalizeAddress("123 OAK STREET");
      expect(result).toEqual({ streetNumber: "123", streetName: "oak", full: "123 oak" });
    });

    it("should handle whitespace-only input", () => {
      expect(normalizeAddress("   ")).toBeNull();
    });

    it("should handle extra whitespace in address", () => {
      const result = normalizeAddress("  123   Oak   Street  ");
      expect(result).toEqual({ streetNumber: "123", streetName: "oak", full: "123 oak" });
    });

    it("should return null when street number + suffix leaves nothing", () => {
      // "99 St" -> tokens ["99", "st"], suffix stripped -> ["99"], length < 2 -> null
      expect(normalizeAddress("99 St")).toBeNull();
    });

    it("should handle Loop suffix", () => {
      const result = normalizeAddress("800 River Loop");
      expect(result).toEqual({ streetNumber: "800", streetName: "river", full: "800 river" });
    });

    it("should handle Terrace suffix", () => {
      const result = normalizeAddress("900 Hill Terrace");
      expect(result).toEqual({ streetNumber: "900", streetName: "hill", full: "900 hill" });
    });

    it("should handle Trail suffix", () => {
      const result = normalizeAddress("1000 Forest Trail");
      expect(result).toEqual({ streetNumber: "1000", streetName: "forest", full: "1000 forest" });
    });

    it("should handle Alley suffix", () => {
      const result = normalizeAddress("50 Rose Alley");
      expect(result).toEqual({ streetNumber: "50", streetName: "rose", full: "50 rose" });
    });

    it("should handle Aly abbreviation", () => {
      const result = normalizeAddress("50 Rose Aly");
      expect(result).toEqual({ streetNumber: "50", streetName: "rose", full: "50 rose" });
    });

    it("should handle Path suffix", () => {
      const result = normalizeAddress("75 Deer Path");
      expect(result).toEqual({ streetNumber: "75", streetName: "deer", full: "75 deer" });
    });

    it("should handle Run suffix", () => {
      const result = normalizeAddress("88 Fox Run");
      expect(result).toEqual({ streetNumber: "88", streetName: "fox", full: "88 fox" });
    });

    it("should handle Pass suffix", () => {
      const result = normalizeAddress("200 Mountain Pass");
      expect(result).toEqual({ streetNumber: "200", streetName: "mountain", full: "200 mountain" });
    });

    it("should handle Pike suffix", () => {
      const result = normalizeAddress("1500 Columbia Pike");
      expect(result).toEqual({ streetNumber: "1500", streetName: "columbia", full: "1500 columbia" });
    });

    it("should handle Crossing suffix", () => {
      const result = normalizeAddress("300 Creek Crossing");
      expect(result).toEqual({ streetNumber: "300", streetName: "creek", full: "300 creek" });
    });

    it("should handle Xing abbreviation", () => {
      const result = normalizeAddress("300 Creek Xing");
      expect(result).toEqual({ streetNumber: "300", streetName: "creek", full: "300 creek" });
    });

    it("should handle Commons suffix", () => {
      const result = normalizeAddress("400 Village Commons");
      expect(result).toEqual({ streetNumber: "400", streetName: "village", full: "400 village" });
    });

    it("should not strip non-suffix words", () => {
      const result = normalizeAddress("123 Oak Hill");
      expect(result).toEqual({ streetNumber: "123", streetName: "oak hill", full: "123 oak hill" });
    });

    it("should handle address with apartment/suite info after comma", () => {
      const result = normalizeAddress("123 Oak Street, Apt 4B, Portland, OR");
      expect(result).toEqual({ streetNumber: "123", streetName: "oak", full: "123 oak" });
    });
  });

  describe("contentContainsAddress", () => {
    // Helper to create a NormalizedAddress for testing
    const addr = (streetNumber: string, streetName: string): NormalizedAddress => ({
      streetNumber,
      streetName,
      full: `${streetNumber} ${streetName}`,
    });

    it("should find address parts independently in email subject", () => {
      expect(contentContainsAddress("Subject about 123 Oak property", addr("123", "oak"))).toBe(true);
    });

    it("should return false for unrelated content", () => {
      expect(contentContainsAddress("Unrelated email about something else", addr("123", "oak"))).toBe(false);
    });

    it("should return false for null content", () => {
      expect(contentContainsAddress(null, addr("123", "oak"))).toBe(false);
    });

    it("should return false for undefined content", () => {
      expect(contentContainsAddress(undefined, addr("123", "oak"))).toBe(false);
    });

    it("should return false for empty content", () => {
      expect(contentContainsAddress("", addr("123", "oak"))).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(contentContainsAddress("Documents for 123 OAK Street closing", addr("123", "oak"))).toBe(true);
    });

    it("should match address in body text", () => {
      const body = "Please review the documents for the property at 456 Elm. The closing is next week.";
      expect(contentContainsAddress(body, addr("456", "elm"))).toBe(true);
    });

    it("should NOT match partial number overlap (word boundary)", () => {
      // "123" should not match "1234" thanks to word boundaries
      expect(contentContainsAddress("Property at 1234 Oak Street", addr("123", "oak"))).toBe(false);
    });

    it("should NOT match partial street name overlap (word boundary)", () => {
      // "oak" should not match "oakland"
      expect(contentContainsAddress("Oakland office at 123 Main", addr("123", "oak"))).toBe(false);
    });

    it("should match when number and name are in different parts", () => {
      expect(contentContainsAddress("The Oak property - unit 123 update", addr("123", "oak"))).toBe(true);
    });

    it("should match when number and name are reversed", () => {
      expect(contentContainsAddress("Oak Street sale, property #123", addr("123", "oak"))).toBe(true);
    });

    it("should match with extra spaces between parts", () => {
      expect(contentContainsAddress("Property at 123   Oak   Street", addr("123", "oak"))).toBe(true);
    });

    it("should match address embedded in longer text", () => {
      const body = "Re: Offer on 7890 nw johnson - please sign the attached documents.";
      expect(contentContainsAddress(body, addr("7890", "nw johnson"))).toBe(true);
    });

    it("should require ALL words of multi-word street name", () => {
      // "nw johnson" requires both "nw" and "johnson"
      expect(contentContainsAddress("Property at 7890 Johnson Ave", addr("7890", "nw johnson"))).toBe(false);
    });

    it("should match multi-word street name with words in different positions", () => {
      expect(contentContainsAddress("NW region: 7890 Johnson closing docs", addr("7890", "nw johnson"))).toBe(true);
    });

    it("should not match when only street number is present", () => {
      expect(contentContainsAddress("Invoice #123 for services rendered", addr("123", "oak"))).toBe(false);
    });

    it("should not match when only street name is present", () => {
      expect(contentContainsAddress("Oak trees in the park discussion", addr("123", "oak"))).toBe(false);
    });

    it("should handle address number at word boundary with punctuation", () => {
      expect(contentContainsAddress("Re: 456 elm closing", addr("456", "elm"))).toBe(true);
    });

    it("should not match number embedded in larger number", () => {
      expect(contentContainsAddress("Account #45678 oak transaction", addr("456", "oak"))).toBe(false);
    });
  });

  describe("withAddressFallback", () => {
    const testAddr: NormalizedAddress = { streetNumber: "123", streetName: "oak", full: "123 oak" };

    it("should return filtered results when address filter produces results", async () => {
      const queryFn = jest.fn()
        .mockResolvedValueOnce(["a", "b"]); // first call with address returns results
      const debugLog = jest.fn();

      const result = await withAddressFallback(queryFn, testAddr, debugLog, "items");

      expect(result).toEqual(["a", "b"]);
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(queryFn).toHaveBeenCalledWith(testAddr);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining("Address filter applied"));
    });

    it("should fall back to unfiltered when address filter returns empty", async () => {
      const queryFn = jest.fn()
        .mockResolvedValueOnce([])             // first call with address: empty
        .mockResolvedValueOnce(["x", "y"]);    // second call without address: results
      const debugLog = jest.fn();

      const result = await withAddressFallback(queryFn, testAddr, debugLog, "items");

      expect(result).toEqual(["x", "y"]);
      expect(queryFn).toHaveBeenCalledTimes(2);
      expect(queryFn).toHaveBeenNthCalledWith(1, testAddr);
      expect(queryFn).toHaveBeenNthCalledWith(2, null);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining("Address filter fallback"));
    });

    it("should return empty when both filtered and unfiltered are empty", async () => {
      const queryFn = jest.fn()
        .mockResolvedValueOnce([])   // with address: empty
        .mockResolvedValueOnce([]);  // without address: still empty
      const debugLog = jest.fn();

      const result = await withAddressFallback(queryFn, testAddr, debugLog, "items");

      expect(result).toEqual([]);
      expect(queryFn).toHaveBeenCalledTimes(2);
      // No log since unfiltered also returned empty
      expect(debugLog).not.toHaveBeenCalled();
    });

    it("should skip fallback logic when no address is provided", async () => {
      const queryFn = jest.fn().mockResolvedValueOnce(["a", "b"]);
      const debugLog = jest.fn();

      const result = await withAddressFallback(queryFn, null, debugLog, "items");

      expect(result).toEqual(["a", "b"]);
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(queryFn).toHaveBeenCalledWith(null);
      // No address = no log message
      expect(debugLog).not.toHaveBeenCalled();
    });

    it("should return empty without fallback when no address and no results", async () => {
      const queryFn = jest.fn().mockResolvedValueOnce([]);
      const debugLog = jest.fn();

      const result = await withAddressFallback(queryFn, null, debugLog, "items");

      expect(result).toEqual([]);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });
});
