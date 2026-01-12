/**
 * Tests for TransactionCard component and utility functions
 */

import { formatCommunicationCounts } from "../TransactionCard";

describe("formatCommunicationCounts", () => {
  describe("email only", () => {
    it("shows plural for multiple emails", () => {
      expect(formatCommunicationCounts(5, 0)).toBe("5 emails");
    });

    it("shows singular for one email", () => {
      expect(formatCommunicationCounts(1, 0)).toBe("1 email");
    });
  });

  describe("text only", () => {
    it("shows plural for multiple texts", () => {
      expect(formatCommunicationCounts(0, 3)).toBe("3 texts");
    });

    it("shows singular for one text", () => {
      expect(formatCommunicationCounts(0, 1)).toBe("1 text");
    });
  });

  describe("both email and text", () => {
    it("shows both counts when both exist", () => {
      expect(formatCommunicationCounts(8, 4)).toBe("8 emails, 4 texts");
    });

    it("handles singular correctly for both", () => {
      expect(formatCommunicationCounts(1, 1)).toBe("1 email, 1 text");
    });

    it("handles mixed singular/plural", () => {
      expect(formatCommunicationCounts(1, 5)).toBe("1 email, 5 texts");
      expect(formatCommunicationCounts(3, 1)).toBe("3 emails, 1 text");
    });
  });

  describe("no communications", () => {
    it("shows no communications when both are zero", () => {
      expect(formatCommunicationCounts(0, 0)).toBe("No communications");
    });
  });

  describe("edge cases", () => {
    it("handles large numbers", () => {
      expect(formatCommunicationCounts(100, 50)).toBe("100 emails, 50 texts");
    });
  });
});
