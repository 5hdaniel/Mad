/**
 * Tests for TransactionStatusWrapper component and getStatusConfig utility
 * Verifies AI gating behavior for rejected status (BACKLOG-462)
 */

import { getStatusConfig } from "../TransactionStatusWrapper";
import type { Transaction } from "@/types";

// Helper to create mock transaction
function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "test-123",
    property_address: "123 Main St",
    status: "active",
    detection_status: "confirmed",
    detection_source: "auto",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    property_id: null,
    parties: [],
    ...overrides,
  } as Transaction;
}

describe("getStatusConfig", () => {
  describe("AI add-on gating for rejected status", () => {
    it("should return Rejected config when hasAIAddon is true and detection_status is rejected", () => {
      const transaction = createMockTransaction({
        detection_status: "rejected",
        status: "active",
      });

      const config = getStatusConfig(transaction, true);

      expect(config.label).toBe("Rejected");
      expect(config.textColor).toBe("text-red-800");
      expect(config.buttonText).toBe("Restore");
    });

    it("should return Active config when hasAIAddon is false and detection_status is rejected", () => {
      const transaction = createMockTransaction({
        detection_status: "rejected",
        status: "active",
      });

      const config = getStatusConfig(transaction, false);

      expect(config.label).toBe("Active");
      expect(config.textColor).toBe("text-green-800");
      expect(config.buttonText).toBe("Export");
    });

    it("should default hasAIAddon to true for backward compatibility", () => {
      const transaction = createMockTransaction({
        detection_status: "rejected",
        status: "active",
      });

      // Call without second parameter - should default to hasAIAddon = true
      const config = getStatusConfig(transaction);

      expect(config.label).toBe("Rejected");
    });
  });

  describe("Pending status (AI-independent)", () => {
    it("should return Pending config when detection_status is pending", () => {
      const transaction = createMockTransaction({
        detection_status: "pending",
        status: "active",
      });

      // With AI add-on
      const configWithAI = getStatusConfig(transaction, true);
      expect(configWithAI.label).toBe("Pending Review");
      expect(configWithAI.showConfidence).toBe(true);

      // Without AI add-on - still shows pending (could be manual workflow)
      const configWithoutAI = getStatusConfig(transaction, false);
      expect(configWithoutAI.label).toBe("Pending Review");
      expect(configWithoutAI.showConfidence).toBe(true);
    });

    it("should return Pending config when status is pending", () => {
      const transaction = createMockTransaction({
        detection_status: "confirmed",
        status: "pending",
      });

      const config = getStatusConfig(transaction, false);

      expect(config.label).toBe("Pending Review");
    });
  });

  describe("Closed status", () => {
    it("should return Closed config when status is closed", () => {
      const transaction = createMockTransaction({
        detection_status: "confirmed",
        status: "closed",
      });

      const config = getStatusConfig(transaction, true);

      expect(config.label).toBe("Closed");
      expect(config.textColor).toBe("text-gray-700");
      expect(config.buttonText).toBe("Export");
    });

    it("should return Closed config regardless of AI add-on status", () => {
      const transaction = createMockTransaction({
        detection_status: "confirmed",
        status: "closed",
      });

      const configWithAI = getStatusConfig(transaction, true);
      const configWithoutAI = getStatusConfig(transaction, false);

      expect(configWithAI.label).toBe("Closed");
      expect(configWithoutAI.label).toBe("Closed");
    });
  });

  describe("Active status (default)", () => {
    it("should return Active config for confirmed active transactions", () => {
      const transaction = createMockTransaction({
        detection_status: "confirmed",
        status: "active",
      });

      const config = getStatusConfig(transaction, true);

      expect(config.label).toBe("Active");
      expect(config.textColor).toBe("text-green-800");
      expect(config.buttonText).toBe("Export");
    });

    it("should return Active config regardless of AI add-on for non-rejected active transactions", () => {
      const transaction = createMockTransaction({
        detection_status: "confirmed",
        status: "active",
      });

      const configWithAI = getStatusConfig(transaction, true);
      const configWithoutAI = getStatusConfig(transaction, false);

      expect(configWithAI.label).toBe("Active");
      expect(configWithoutAI.label).toBe("Active");
    });
  });

  describe("Status priority", () => {
    it("should prioritize pending over rejected", () => {
      const transaction = createMockTransaction({
        detection_status: "pending", // Higher priority
        status: "active",
      });

      const config = getStatusConfig(transaction, true);

      expect(config.label).toBe("Pending Review");
    });

    it("should prioritize rejected over closed (when hasAIAddon)", () => {
      const transaction = createMockTransaction({
        detection_status: "rejected",
        status: "closed",
      });

      const config = getStatusConfig(transaction, true);

      expect(config.label).toBe("Rejected");
    });

    it("should fall through to closed when rejected but no AI add-on", () => {
      const transaction = createMockTransaction({
        detection_status: "rejected",
        status: "closed",
      });

      const config = getStatusConfig(transaction, false);

      // Without AI add-on, rejected is not recognized, so falls through to closed check
      expect(config.label).toBe("Closed");
    });
  });
});
