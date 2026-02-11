/**
 * @jest-environment node
 */

/**
 * Tests for preferenceHelper
 * TASK-1951: Verifies contact source preference checking
 */

import { isContactSourceEnabled } from "../preferenceHelper";

// Mock supabaseService
const mockGetPreferences = jest.fn();
jest.mock("../../services/supabaseService", () => ({
  __esModule: true,
  default: {
    getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  },
}));

// Mock logService
jest.mock("../../services/logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("preferenceHelper", () => {
  const userId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isContactSourceEnabled", () => {
    it("should return the stored preference when it exists (inferred.outlookEmails)", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          inferred: {
            outlookEmails: true,
          },
        },
      });

      const result = await isContactSourceEnabled(userId, "inferred", "outlookEmails", false);
      expect(result).toBe(true);
    });

    it("should return false when inferred.outlookEmails is explicitly false", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          inferred: {
            outlookEmails: false,
          },
        },
      });

      const result = await isContactSourceEnabled(userId, "inferred", "outlookEmails", false);
      expect(result).toBe(false);
    });

    it("should return the default value when preference is not set", async () => {
      mockGetPreferences.mockResolvedValue({});

      const result = await isContactSourceEnabled(userId, "inferred", "outlookEmails", false);
      expect(result).toBe(false);
    });

    it("should return the default value when contactSources is missing", async () => {
      mockGetPreferences.mockResolvedValue({ scan: { lookbackMonths: 6 } });

      const result = await isContactSourceEnabled(userId, "inferred", "gmailEmails", false);
      expect(result).toBe(false);
    });

    it("should return default value when preferences fetch fails", async () => {
      mockGetPreferences.mockRejectedValue(new Error("Network error"));

      const result = await isContactSourceEnabled(userId, "inferred", "messages", false);
      expect(result).toBe(false);
    });

    it("should use default true for direct sources", async () => {
      mockGetPreferences.mockResolvedValue({});

      const result = await isContactSourceEnabled(userId, "direct", "outlookContacts", true);
      expect(result).toBe(true);
    });

    it("should respect explicitly set direct source preferences", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          direct: {
            gmailContacts: false,
          },
        },
      });

      const result = await isContactSourceEnabled(userId, "direct", "gmailContacts", true);
      expect(result).toBe(false);
    });

    it("should handle null preferences gracefully", async () => {
      mockGetPreferences.mockResolvedValue(null);

      const result = await isContactSourceEnabled(userId, "inferred", "messages", false);
      expect(result).toBe(false);
    });

    it("should handle undefined contactSources category", async () => {
      mockGetPreferences.mockResolvedValue({
        contactSources: {
          // 'inferred' is missing
          direct: { outlookContacts: true },
        },
      });

      const result = await isContactSourceEnabled(userId, "inferred", "outlookEmails", false);
      expect(result).toBe(false);
    });
  });
});
