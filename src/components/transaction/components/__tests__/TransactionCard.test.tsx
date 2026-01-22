/**
 * Tests for TransactionCard component and utility functions
 */

import { formatCommunicationCounts } from "../TransactionCard";

describe("formatCommunicationCounts", () => {
  describe("email only (text is zero)", () => {
    it("shows plural for multiple email threads with zero texts", () => {
      expect(formatCommunicationCounts(5, 0)).toBe("5 email threads, 0 texts");
    });

    it("shows singular for one email thread with zero texts", () => {
      expect(formatCommunicationCounts(1, 0)).toBe("1 email thread, 0 texts");
    });
  });

  describe("text only (email is zero)", () => {
    it("shows plural for multiple texts with zero emails", () => {
      expect(formatCommunicationCounts(0, 3)).toBe("0 email threads, 3 texts");
    });

    it("shows singular for one text with zero emails", () => {
      expect(formatCommunicationCounts(0, 1)).toBe("0 email threads, 1 text");
    });
  });

  describe("both email and text", () => {
    it("shows both counts when both exist", () => {
      expect(formatCommunicationCounts(8, 4)).toBe("8 email threads, 4 texts");
    });

    it("handles singular correctly for both", () => {
      expect(formatCommunicationCounts(1, 1)).toBe("1 email thread, 1 text");
    });

    it("handles mixed singular/plural", () => {
      expect(formatCommunicationCounts(1, 5)).toBe("1 email thread, 5 texts");
      expect(formatCommunicationCounts(3, 1)).toBe("3 email threads, 1 text");
    });
  });

  describe("no communications (both zero)", () => {
    it("shows zero counts for both when both are zero", () => {
      expect(formatCommunicationCounts(0, 0)).toBe("0 email threads, 0 texts");
    });
  });

  describe("edge cases", () => {
    it("handles large numbers", () => {
      expect(formatCommunicationCounts(100, 50)).toBe("100 email threads, 50 texts");
    });
  });
});
