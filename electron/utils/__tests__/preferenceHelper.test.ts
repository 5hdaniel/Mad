/**
 * Unit tests for preferenceHelper
 *
 * Tests the isContactSourceEnabled helper function with various
 * preference shapes including missing keys, explicit values, and error cases.
 */

// Mock supabaseService before import
const mockGetPreferences = jest.fn();
jest.mock("../../services/supabaseService", () => ({
  __esModule: true,
  default: {
    getPreferences: mockGetPreferences,
  },
}));

jest.mock("../../services/logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { isContactSourceEnabled } from "../preferenceHelper";

describe("preferenceHelper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isContactSourceEnabled", () => {
    it("should return true when preference is explicitly true", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {
            outlookContacts: true,
          },
        },
      });

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts");
      expect(result).toBe(true);
    });

    it("should return false when preference is explicitly false", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {
            outlookContacts: false,
          },
        },
      });

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts");
      expect(result).toBe(false);
    });

    it("should return defaultValue when preference key is missing", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {},
        },
      });

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", true);
      expect(result).toBe(true);
    });

    it("should return defaultValue when contactSources is missing", async () => {
      mockGetPreferences.mockResolvedValue({});

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", true);
      expect(result).toBe(true);
    });

    it("should return defaultValue when preferences are empty", async () => {
      mockGetPreferences.mockResolvedValue({});

      const result = await isContactSourceEnabled("user-1", "direct", "macosContacts");
      expect(result).toBe(true); // default is true
    });

    it("should return defaultValue when category is missing", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {},
      });

      const result = await isContactSourceEnabled("user-1", "direct", "macosContacts", true);
      expect(result).toBe(true);
    });

    it("should return custom default when specified and key is missing", async () => {
      mockGetPreferences.mockResolvedValue({});

      const result = await isContactSourceEnabled("user-1", "direct", "macosContacts", false);
      expect(result).toBe(false);
    });

    it("should support inferred category", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          inferred: {
            outlookEmails: false,
          },
        },
      });

      const result = await isContactSourceEnabled("user-1", "inferred", "outlookEmails");
      expect(result).toBe(false);
    });

    it("should return defaultValue on error (fail-open)", async () => {
      mockGetPreferences.mockRejectedValue(new Error("Network error"));

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", true);
      expect(result).toBe(true);
    });

    it("should return false as defaultValue on error when defaultValue is false", async () => {
      mockGetPreferences.mockRejectedValue(new Error("Network error"));

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", false);
      expect(result).toBe(false);
    });

    it("should ignore non-boolean values in preferences", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {
            outlookContacts: "yes", // string, not boolean
          },
        },
      });

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", true);
      expect(result).toBe(true); // falls back to default since not boolean
    });

    it("should handle null preference value", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {
            outlookContacts: null,
          },
        },
      });

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", true);
      expect(result).toBe(true); // null is not boolean, uses default
    });

    it("should handle undefined preference value", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {
            outlookContacts: undefined,
          },
        },
      });

      const result = await isContactSourceEnabled("user-1", "direct", "outlookContacts", true);
      expect(result).toBe(true); // undefined is not boolean, uses default
    });
  });
});
