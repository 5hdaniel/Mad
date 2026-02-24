/**
 * Unit tests for Feedback Service
 *
 * Tests cover:
 * - recordTransactionFeedback (approve/reject/edit)
 * - recordRoleFeedback
 * - recordCommunicationFeedback
 * - getFeedbackStats calculation
 * - Model/prompt version tracking
 * - Empty stats handling
 */

import {
  FeedbackService,
  getFeedbackService,
  resetFeedbackService,
  TransactionFeedback,
  RoleFeedback,
  CommunicationFeedback,
} from "../feedbackService";
import databaseService from "../databaseService";
import type { UserFeedback } from "../../types";

// Mock the database service
jest.mock("../databaseService");

const mockDatabaseService = databaseService as jest.Mocked<
  typeof databaseService
>;

describe("FeedbackService", () => {
  const mockUserId = "test-user-123";
  let feedbackService: FeedbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFeedbackService();
    feedbackService = getFeedbackService();

    // Default mock implementations
    mockDatabaseService.saveFeedback.mockResolvedValue({
      id: "generated-id",
      user_id: mockUserId,
      feedback_type: "confirmation",
      created_at: new Date().toISOString(),
    });

    mockDatabaseService.getFeedbackByField.mockResolvedValue([]);
  });

  describe("singleton pattern", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = getFeedbackService();
      const instance2 = getFeedbackService();
      expect(instance1).toBe(instance2);
    });

    it("should return new instance after reset", () => {
      const instance1 = getFeedbackService();
      resetFeedbackService();
      const instance2 = getFeedbackService();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("recordTransactionFeedback", () => {
    it("should record approval without corrections", async () => {
      const feedback: TransactionFeedback = {
        detectedTransactionId: "trans-123",
        action: "confirm",
      };

      await feedbackService.recordTransactionFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          transaction_id: "trans-123",
          feedback_type: "transaction_link",
        })
      );

      // Verify original_value contains action and category
      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.action).toBe("transaction_approved");
      expect(metadata.category).toBe("llm_transaction_action");
      expect(metadata.dbFeedbackType).toBe("confirmation");
    });

    it("should record rejection", async () => {
      const feedback: TransactionFeedback = {
        detectedTransactionId: "trans-456",
        action: "reject",
      };

      await feedbackService.recordTransactionFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          transaction_id: "trans-456",
          feedback_type: "transaction_link",
        })
      );

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.action).toBe("transaction_rejected");
      expect(metadata.dbFeedbackType).toBe("rejection");
    });

    it("should record edit with corrections", async () => {
      const feedback: TransactionFeedback = {
        detectedTransactionId: "trans-789",
        action: "confirm",
        corrections: {
          propertyAddress: "123 Main St",
          transactionType: "sale",
        },
      };

      await feedbackService.recordTransactionFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          transaction_id: "trans-789",
          feedback_type: "transaction_link",
        })
      );

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.action).toBe("transaction_edited");
      expect(metadata.dbFeedbackType).toBe("correction");

      const corrections = JSON.parse(call.corrected_value as string);
      expect(corrections.propertyAddress).toBe("123 Main St");
      expect(corrections.transactionType).toBe("sale");
    });

    it("should track model and prompt version", async () => {
      const feedback: TransactionFeedback = {
        detectedTransactionId: "trans-001",
        action: "confirm",
        modelVersion: "gpt-4-turbo-2024-04-09",
        promptVersion: "v1.2.3",
      };

      await feedbackService.recordTransactionFeedback(mockUserId, feedback);

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.modelVersion).toBe("gpt-4-turbo-2024-04-09");
      expect(metadata.promptVersion).toBe("v1.2.3");
    });

    it("should handle merge action as rejection", async () => {
      const feedback: TransactionFeedback = {
        detectedTransactionId: "trans-merge",
        action: "merge",
      };

      await feedbackService.recordTransactionFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback_type: "transaction_link",
        })
      );
    });
  });

  describe("recordRoleFeedback", () => {
    it("should record role correction", async () => {
      const feedback: RoleFeedback = {
        transactionId: "trans-role-123",
        contactId: "contact-456",
        originalRole: "buyer",
        correctedRole: "seller",
      };

      await feedbackService.recordRoleFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          transaction_id: "trans-role-123",
          contact_id: "contact-456",
          feedback_type: "contact_role",
          corrected_value: "seller",
        })
      );

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.action).toBe("contact_role_corrected");
      expect(metadata.contactId).toBe("contact-456");
      expect(metadata.originalRole).toBe("buyer");
      expect(metadata.category).toBe("llm_contact_role");
    });

    it("should track model and prompt version for role feedback", async () => {
      const feedback: RoleFeedback = {
        transactionId: "trans-001",
        contactId: "contact-001",
        originalRole: "agent",
        correctedRole: "listing_agent",
        modelVersion: "claude-3-opus",
        promptVersion: "role-v2.0",
      };

      await feedbackService.recordRoleFeedback(mockUserId, feedback);

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.modelVersion).toBe("claude-3-opus");
      expect(metadata.promptVersion).toBe("role-v2.0");
    });
  });

  describe("recordCommunicationFeedback", () => {
    it("should record communication unlink (not relevant)", async () => {
      const feedback: CommunicationFeedback = {
        communicationId: "comm-123",
        wasRelevant: false,
      };

      await feedbackService.recordCommunicationFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          message_id: "comm-123",
          feedback_type: "message_relevance",
        })
      );

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.action).toBe("communication_unlinked");
      expect(metadata.wasRelevant).toBe(false);
      expect(metadata.dbFeedbackType).toBe("rejection");
    });

    it("should record communication add (was relevant)", async () => {
      const feedback: CommunicationFeedback = {
        communicationId: "comm-456",
        wasRelevant: true,
        correctTransactionId: "trans-correct",
      };

      await feedbackService.recordCommunicationFeedback(mockUserId, feedback);

      expect(mockDatabaseService.saveFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          message_id: "comm-456",
          transaction_id: "trans-correct",
          feedback_type: "message_relevance",
          corrected_value: "trans-correct",
        })
      );

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.action).toBe("communication_added");
      expect(metadata.wasRelevant).toBe(true);
      expect(metadata.dbFeedbackType).toBe("confirmation");
    });

    it("should track model and prompt version for communication feedback", async () => {
      const feedback: CommunicationFeedback = {
        communicationId: "comm-001",
        wasRelevant: true,
        modelVersion: "gpt-4",
        promptVersion: "comm-v1.0",
      };

      await feedbackService.recordCommunicationFeedback(mockUserId, feedback);

      const call = mockDatabaseService.saveFeedback.mock.calls[0][0];
      const metadata = JSON.parse(call.original_value as string);
      expect(metadata.modelVersion).toBe("gpt-4");
      expect(metadata.promptVersion).toBe("comm-v1.0");
    });
  });

  describe("getFeedbackStats", () => {
    it("should return zero stats when no feedback exists", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const stats = await feedbackService.getFeedbackStats(mockUserId);

      expect(stats.totalFeedback).toBe(0);
      expect(stats.transactionApprovals).toBe(0);
      expect(stats.transactionRejections).toBe(0);
      expect(stats.transactionEdits).toBe(0);
      expect(stats.roleCorrections).toBe(0);
      expect(stats.communicationUnlinks).toBe(0);
      expect(stats.communicationAdds).toBe(0);
      expect(stats.approvalRate).toBe(0);
      expect(stats.correctionRate).toBe(0);
    });

    it("should calculate stats correctly from feedback records", async () => {
      mockDatabaseService.getFeedbackByField.mockImplementation(
        async (_userId, fieldName) => {
          if (fieldName === "transaction_link") {
            return [
              {
                id: "1",
                user_id: mockUserId,
                feedback_type: "confirmation",
                original_value: JSON.stringify({ action: "transaction_approved" }),
                created_at: new Date().toISOString(),
              },
              {
                id: "2",
                user_id: mockUserId,
                feedback_type: "confirmation",
                original_value: JSON.stringify({ action: "transaction_approved" }),
                created_at: new Date().toISOString(),
              },
              {
                id: "3",
                user_id: mockUserId,
                feedback_type: "rejection",
                original_value: JSON.stringify({ action: "transaction_rejected" }),
                created_at: new Date().toISOString(),
              },
              {
                id: "4",
                user_id: mockUserId,
                feedback_type: "correction",
                original_value: JSON.stringify({ action: "transaction_edited" }),
                created_at: new Date().toISOString(),
              },
            ] as UserFeedback[];
          }
          if (fieldName === "contact_role") {
            return [
              {
                id: "5",
                user_id: mockUserId,
                feedback_type: "contact_role",
                original_value: JSON.stringify({ action: "contact_role_corrected" }),
                created_at: new Date().toISOString(),
              },
            ] as UserFeedback[];
          }
          if (fieldName === "message_relevance") {
            return [
              {
                id: "6",
                user_id: mockUserId,
                feedback_type: "rejection",
                original_value: JSON.stringify({ action: "communication_unlinked" }),
                created_at: new Date().toISOString(),
              },
              {
                id: "7",
                user_id: mockUserId,
                feedback_type: "confirmation",
                original_value: JSON.stringify({ action: "communication_added" }),
                created_at: new Date().toISOString(),
              },
            ] as UserFeedback[];
          }
          return [];
        }
      );

      const stats = await feedbackService.getFeedbackStats(mockUserId);

      expect(stats.totalFeedback).toBe(7);
      expect(stats.transactionApprovals).toBe(2);
      expect(stats.transactionRejections).toBe(1);
      expect(stats.transactionEdits).toBe(1);
      expect(stats.roleCorrections).toBe(1);
      expect(stats.communicationUnlinks).toBe(1);
      expect(stats.communicationAdds).toBe(1);

      // Approval rate: (2 approvals + 1 edit) / 4 total transactions = 0.75
      expect(stats.approvalRate).toBe(0.75);
      // Correction rate: 1 edit / 4 total transactions = 0.25
      expect(stats.correctionRate).toBe(0.25);
    });

    it("should handle malformed JSON gracefully", async () => {
      mockDatabaseService.getFeedbackByField.mockImplementation(
        async (_userId, fieldName) => {
          if (fieldName === "transaction_link") {
            return [
              {
                id: "1",
                user_id: mockUserId,
                feedback_type: "transaction_link",
                original_value: "not valid json",
                created_at: new Date().toISOString(),
              },
              {
                id: "2",
                user_id: mockUserId,
                feedback_type: "transaction_link",
                original_value: null,
                created_at: new Date().toISOString(),
              },
            ] as UserFeedback[];
          }
          return [];
        }
      );

      const stats = await feedbackService.getFeedbackStats(mockUserId);

      // Should fall back to counting by fieldName category
      expect(stats.totalFeedback).toBe(2);
      // Both fall back to transactionEdits since dbFeedbackType is unavailable
      expect(stats.transactionEdits).toBe(2);
    });

    it("should query all LLM field types", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      await feedbackService.getFeedbackStats(mockUserId);

      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledWith(
        mockUserId,
        "transaction_link",
        1000
      );
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledWith(
        mockUserId,
        "contact_role",
        1000
      );
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledWith(
        mockUserId,
        "message_relevance",
        1000
      );
    });

    it("should handle role feedback fallback correctly", async () => {
      mockDatabaseService.getFeedbackByField.mockImplementation(
        async (_userId, fieldName) => {
          if (fieldName === "contact_role") {
            return [
              {
                id: "1",
                user_id: mockUserId,
                feedback_type: "contact_role",
                original_value: "invalid json",
                created_at: new Date().toISOString(),
              },
            ] as UserFeedback[];
          }
          return [];
        }
      );

      const stats = await feedbackService.getFeedbackStats(mockUserId);

      expect(stats.roleCorrections).toBe(1);
    });

    it("should handle communication feedback fallback correctly", async () => {
      mockDatabaseService.getFeedbackByField.mockImplementation(
        async (_userId, fieldName) => {
          if (fieldName === "message_relevance") {
            return [
              {
                id: "1",
                user_id: mockUserId,
                feedback_type: "message_relevance",
                original_value: "invalid",
                created_at: new Date().toISOString(),
              },
              {
                id: "2",
                user_id: mockUserId,
                feedback_type: "message_relevance",
                original_value: "invalid",
                created_at: new Date().toISOString(),
              },
            ] as UserFeedback[];
          }
          return [];
        }
      );

      const stats = await feedbackService.getFeedbackStats(mockUserId);

      // Both fall back to communicationUnlinks since dbFeedbackType is unavailable
      expect(stats.communicationUnlinks).toBe(2);
    });
  });

  describe("error handling", () => {
    it("should propagate database errors from saveFeedback", async () => {
      mockDatabaseService.saveFeedback.mockRejectedValue(
        new Error("Database connection failed")
      );

      const feedback: TransactionFeedback = {
        detectedTransactionId: "trans-123",
        action: "confirm",
      };

      await expect(
        feedbackService.recordTransactionFeedback(mockUserId, feedback)
      ).rejects.toThrow("Database connection failed");
    });

    it("should propagate database errors from getFeedbackByField", async () => {
      mockDatabaseService.getFeedbackByField.mockRejectedValue(
        new Error("Query failed")
      );

      await expect(feedbackService.getFeedbackStats(mockUserId)).rejects.toThrow(
        "Query failed"
      );
    });
  });
});
