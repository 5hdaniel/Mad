/**
 * @jest-environment node
 */

/**
 * Unit tests for SubmissionService
 * TASK-1779: Tests email attachment inclusion in broker portal upload
 */

// Mock dependencies before importing
jest.mock("../supabaseService");
jest.mock("../supabaseStorageService");
jest.mock("../databaseService");
jest.mock("../logService");
jest.mock("../contactsService");
jest.mock("electron", () => ({
  app: {
    getVersion: jest.fn().mockReturnValue("2.0.0"),
  },
}));

import { submissionService } from "../submissionService";
import databaseService from "../databaseService";

describe("SubmissionService", () => {
  // Mock database for testing
  let mockPrepare: jest.Mock;
  let mockAll: jest.Mock;
  let mockGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAll = jest.fn().mockReturnValue([]);
    mockGet = jest.fn().mockReturnValue(null);
    mockPrepare = jest.fn().mockReturnValue({
      all: mockAll,
      get: mockGet,
      run: jest.fn().mockReturnValue({ changes: 1 }),
    });

    (databaseService.getRawDatabase as jest.Mock).mockReturnValue({
      prepare: mockPrepare,
    });
  });

  describe("loadTransactionAttachments (internal)", () => {
    // Access the private method through reflection for testing
    const loadAttachments = async (transactionId: string) => {
      // We test this indirectly through the SQL queries
      return (submissionService as any).loadTransactionAttachments(transactionId);
    };

    it("should query both text message and email attachments", async () => {
      const mockTextAttachment = {
        id: "att-text-1",
        message_id: "msg-1",
        filename: "document.pdf",
        storage_path: "/path/to/document.pdf",
        created_at: "2024-01-15T10:00:00Z",
      };

      const mockEmailAttachment = {
        id: "att-email-1",
        email_id: "email-1",
        filename: "email-attachment.pdf",
        storage_path: "/path/to/email-attachment.pdf",
        created_at: "2024-01-16T10:00:00Z",
      };

      // First call returns text attachments
      mockAll
        .mockReturnValueOnce([mockTextAttachment])
        // Second call returns email attachments
        .mockReturnValueOnce([mockEmailAttachment]);

      const result = await loadAttachments("txn-123");

      // Verify two queries were executed
      expect(mockPrepare).toHaveBeenCalledTimes(2);

      // First query for text message attachments
      const firstQuery = mockPrepare.mock.calls[0][0];
      expect(firstQuery).toContain("a.message_id = m.id");
      expect(firstQuery).toContain("c.transaction_id = ?");

      // Second query for email attachments (TASK-1779)
      const secondQuery = mockPrepare.mock.calls[1][0];
      expect(secondQuery).toContain("c.email_id = e.id");
      expect(secondQuery).toContain("a.email_id IS NOT NULL");
      expect(secondQuery).toContain("a.storage_path IS NOT NULL");

      // Verify both attachments are returned
      expect(result).toHaveLength(2);
      expect(result.map((a: any) => a.id)).toContain("att-text-1");
      expect(result.map((a: any) => a.id)).toContain("att-email-1");
    });

    it("should deduplicate attachments by id", async () => {
      const duplicateAttachment = {
        id: "att-dup-1",
        message_id: "msg-1",
        email_id: null,
        filename: "duplicate.pdf",
        storage_path: "/path/to/duplicate.pdf",
        created_at: "2024-01-15T10:00:00Z",
      };

      // Same attachment returned by both queries
      mockAll
        .mockReturnValueOnce([duplicateAttachment])
        .mockReturnValueOnce([duplicateAttachment]);

      const result = await loadAttachments("txn-123");

      // Should have only 1 unique attachment
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("att-dup-1");
    });

    it("should sort attachments by created_at", async () => {
      const olderAttachment = {
        id: "att-older",
        filename: "older.pdf",
        storage_path: "/path/to/older.pdf",
        created_at: "2024-01-10T10:00:00Z",
      };

      const newerAttachment = {
        id: "att-newer",
        filename: "newer.pdf",
        storage_path: "/path/to/newer.pdf",
        created_at: "2024-01-20T10:00:00Z",
      };

      // Return in reverse order to test sorting
      mockAll
        .mockReturnValueOnce([newerAttachment])
        .mockReturnValueOnce([olderAttachment]);

      const result = await loadAttachments("txn-123");

      expect(result).toHaveLength(2);
      // Older attachment should be first
      expect(result[0].id).toBe("att-older");
      expect(result[1].id).toBe("att-newer");
    });

    it("should handle empty results for both queries", async () => {
      mockAll
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const result = await loadAttachments("txn-123");

      expect(result).toHaveLength(0);
    });

    it("should only include attachments with storage_path", async () => {
      // Verify the SQL queries filter by storage_path IS NOT NULL
      mockAll.mockReturnValue([]);

      await loadAttachments("txn-123");

      // Both queries should have the storage_path filter
      expect(mockPrepare.mock.calls[0][0]).toContain("storage_path IS NOT NULL");
      expect(mockPrepare.mock.calls[1][0]).toContain("storage_path IS NOT NULL");
    });
  });
});
