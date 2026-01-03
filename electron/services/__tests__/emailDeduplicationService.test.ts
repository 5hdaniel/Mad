/**
 * Unit Tests for Email Deduplication Service (TASK-919)
 *
 * Tests the EmailDeduplicationService's ability to detect duplicate emails
 * using Message-ID headers and content hashes.
 */

import {
  EmailDeduplicationService,
  createEmailDeduplicationService,
} from "../emailDeduplicationService";

// Mock logService - must be defined before jest.mock hoisting
jest.mock("../logService", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("EmailDeduplicationService", () => {
  // Mock database
  let mockDb: {
    prepare: jest.Mock;
  };
  let mockPreparedStatement: {
    get: jest.Mock;
    all: jest.Mock;
  };
  let service: EmailDeduplicationService;

  const testUserId = "test-user-123";

  beforeEach(() => {
    // Reset mocks
    mockPreparedStatement = {
      get: jest.fn(),
      all: jest.fn(),
    };
    mockDb = {
      prepare: jest.fn().mockReturnValue(mockPreparedStatement),
    };
    service = new EmailDeduplicationService(mockDb as unknown as import("better-sqlite3").Database);
  });

  describe("checkForDuplicate", () => {
    describe("Message-ID matching", () => {
      it("should detect duplicate via Message-ID header", () => {
        // Arrange
        const messageIdHeader = "<unique-123@mail.gmail.com>";
        const contentHash = "abc123hash";
        mockPreparedStatement.get.mockReturnValueOnce({ id: "original-msg-1" });

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          messageIdHeader,
          contentHash
        );

        // Assert
        expect(result.isDuplicate).toBe(true);
        expect(result.originalId).toBe("original-msg-1");
        expect(result.matchMethod).toBe("message_id");
        expect(mockDb.prepare).toHaveBeenCalledWith(
          expect.stringContaining("message_id_header")
        );
      });

      it("should handle case with Message-ID but no match", () => {
        // Arrange
        const messageIdHeader = "<no-match@example.com>";
        const contentHash = "abc123hash";
        mockPreparedStatement.get.mockReturnValue(undefined);

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          messageIdHeader,
          contentHash
        );

        // Assert
        expect(result.isDuplicate).toBe(false);
        expect(result.originalId).toBeUndefined();
      });

      it("should use first call for Message-ID and second for content hash", () => {
        // Arrange
        const messageIdHeader = "<test@example.com>";
        const contentHash = "hash456";
        mockPreparedStatement.get
          .mockReturnValueOnce(undefined) // Message-ID not found
          .mockReturnValueOnce({ id: "hash-match-id" }); // Content hash found

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          messageIdHeader,
          contentHash
        );

        // Assert
        expect(result.isDuplicate).toBe(true);
        expect(result.matchMethod).toBe("content_hash");
        expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      });
    });

    describe("Content hash fallback", () => {
      it("should detect duplicate via content hash when Message-ID is null", () => {
        // Arrange
        const contentHash = "sha256-content-hash";
        mockPreparedStatement.get.mockReturnValueOnce({ id: "hash-orig-id" });

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          null,
          contentHash
        );

        // Assert
        expect(result.isDuplicate).toBe(true);
        expect(result.originalId).toBe("hash-orig-id");
        expect(result.matchMethod).toBe("content_hash");
        // Should only query content hash, not Message-ID
        expect(mockDb.prepare).toHaveBeenCalledTimes(1);
        expect(mockDb.prepare).toHaveBeenCalledWith(
          expect.stringContaining("content_hash")
        );
      });

      it("should fall back to content hash when Message-ID query fails", () => {
        // Arrange
        const messageIdHeader = "<test@example.com>";
        const contentHash = "fallback-hash";
        mockPreparedStatement.get
          .mockImplementationOnce(() => {
            throw new Error("Database error");
          })
          .mockReturnValueOnce({ id: "fallback-id" });

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          messageIdHeader,
          contentHash
        );

        // Assert
        expect(result.isDuplicate).toBe(true);
        expect(result.originalId).toBe("fallback-id");
        expect(result.matchMethod).toBe("content_hash");
      });
    });

    describe("No match scenarios", () => {
      it("should return isDuplicate: false when no match found", () => {
        // Arrange
        mockPreparedStatement.get.mockReturnValue(undefined);

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          "<new@example.com>",
          "new-hash"
        );

        // Assert
        expect(result.isDuplicate).toBe(false);
        expect(result.originalId).toBeUndefined();
        expect(result.matchMethod).toBeUndefined();
      });

      it("should return isDuplicate: false when both null/empty", () => {
        // Arrange - no database calls should be made for empty content hash
        mockPreparedStatement.get.mockReturnValue(undefined);

        // Act
        const result = service.checkForDuplicate(testUserId, null, "");

        // Assert
        expect(result.isDuplicate).toBe(false);
      });

      it("should handle database errors gracefully", () => {
        // Arrange
        mockPreparedStatement.get.mockImplementation(() => {
          throw new Error("Database connection failed");
        });

        // Act
        const result = service.checkForDuplicate(
          testUserId,
          null,
          "some-hash"
        );

        // Assert
        expect(result.isDuplicate).toBe(false);
        expect(result.originalId).toBeUndefined();
      });
    });

    describe("SQL query verification", () => {
      it("should include duplicate_of IS NULL in queries", () => {
        // Arrange
        mockPreparedStatement.get.mockReturnValue(undefined);

        // Act
        service.checkForDuplicate(testUserId, "<test@example.com>", "hash");

        // Assert
        expect(mockDb.prepare).toHaveBeenCalledWith(
          expect.stringContaining("duplicate_of IS NULL")
        );
      });

      it("should scope queries by user_id", () => {
        // Arrange
        mockPreparedStatement.get.mockReturnValue(undefined);

        // Act
        service.checkForDuplicate(testUserId, "<test@example.com>", "hash");

        // Assert
        expect(mockDb.prepare).toHaveBeenCalledWith(
          expect.stringContaining("user_id = ?")
        );
      });
    });
  });

  describe("checkForDuplicatesBatch", () => {
    it("should return empty map for empty input", () => {
      // Act
      const results = service.checkForDuplicatesBatch(testUserId, []);

      // Assert
      expect(results.size).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should batch check multiple emails", () => {
      // Arrange
      const emails = [
        { messageIdHeader: "<msg1@example.com>", contentHash: "hash1" },
        { messageIdHeader: "<msg2@example.com>", contentHash: "hash2" },
        { messageIdHeader: null, contentHash: "hash3" },
      ];

      // Message-ID query returns one match
      mockPreparedStatement.all
        .mockReturnValueOnce([
          { id: "orig-1", message_id_header: "<msg1@example.com>" },
        ])
        // Content hash query returns one match
        .mockReturnValueOnce([{ id: "orig-3", content_hash: "hash3" }]);

      // Act
      const results = service.checkForDuplicatesBatch(testUserId, emails);

      // Assert
      expect(results.size).toBe(3);

      // First email: duplicate via Message-ID
      expect(results.get(0)?.isDuplicate).toBe(true);
      expect(results.get(0)?.originalId).toBe("orig-1");
      expect(results.get(0)?.matchMethod).toBe("message_id");

      // Second email: no match
      expect(results.get(1)?.isDuplicate).toBe(false);

      // Third email: duplicate via content hash
      expect(results.get(2)?.isDuplicate).toBe(true);
      expect(results.get(2)?.originalId).toBe("orig-3");
      expect(results.get(2)?.matchMethod).toBe("content_hash");
    });

    it("should handle database error in batch check", () => {
      // Arrange
      const emails = [
        { messageIdHeader: "<msg@example.com>", contentHash: "hash" },
      ];
      mockPreparedStatement.all.mockImplementation(() => {
        throw new Error("Batch query failed");
      });

      // Act
      const results = service.checkForDuplicatesBatch(testUserId, emails);

      // Assert
      expect(results.size).toBe(0);
    });

    it("should prefer Message-ID match over content hash match", () => {
      // Arrange
      const emails = [
        { messageIdHeader: "<msg@example.com>", contentHash: "hash1" },
      ];

      // Both match
      mockPreparedStatement.all
        .mockReturnValueOnce([
          { id: "msg-id-match", message_id_header: "<msg@example.com>" },
        ])
        .mockReturnValueOnce([{ id: "hash-match", content_hash: "hash1" }]);

      // Act
      const results = service.checkForDuplicatesBatch(testUserId, emails);

      // Assert
      expect(results.get(0)?.originalId).toBe("msg-id-match");
      expect(results.get(0)?.matchMethod).toBe("message_id");
    });
  });

  describe("createEmailDeduplicationService factory", () => {
    it("should create a new service instance", () => {
      // Act
      const newService = createEmailDeduplicationService(mockDb as unknown as import("better-sqlite3").Database);

      // Assert
      expect(newService).toBeInstanceOf(EmailDeduplicationService);
    });
  });
});
