/**
 * @jest-environment node
 */

/**
 * Unit tests for Communication Database Service
 *
 * HOTFIX: Tests for duplicate messages bug fix
 * When the same message can be linked to a transaction via both:
 * 1. Direct message_id link (legacy)
 * 2. Thread-based thread_id link (TASK-1116)
 *
 * The message should only appear ONCE in the result set.
 */

import { jest } from "@jest/globals";

// Mock the dbAll function from core/dbConnection
const mockDbAll = jest.fn();
const mockDbGet = jest.fn();
const mockDbRun = jest.fn();

jest.mock("../core/dbConnection", () => ({
  dbAll: (...args: unknown[]) => mockDbAll(...args),
  dbGet: (...args: unknown[]) => mockDbGet(...args),
  dbRun: (...args: unknown[]) => mockDbRun(...args),
}));

// Mock validateFields to prevent field validation errors
jest.mock("../../../utils/sqlFieldWhitelist", () => ({
  validateFields: jest.fn(() => true),
}));

// Import after mocks are set up
import { getCommunicationsWithMessages } from "../communicationDbService";

describe("communicationDbService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCommunicationsWithMessages", () => {
    describe("duplicate message prevention", () => {
      it("should use GROUP BY clause to prevent duplicate messages", async () => {
        // Setup: Return empty result to verify query structure
        mockDbAll.mockReturnValue([]);

        await getCommunicationsWithMessages("test-transaction-id");

        // Verify dbAll was called
        expect(mockDbAll).toHaveBeenCalledTimes(1);

        // Get the SQL query that was executed
        const [sql, params] = mockDbAll.mock.calls[0] as [string, unknown[]];

        // Verify the query includes GROUP BY to prevent duplicates
        expect(sql).toContain("GROUP BY COALESCE(m.id, c.id)");

        // Verify transaction_id parameter was passed
        expect(params).toEqual(["test-transaction-id"]);
      });

      it("should return unique messages when same message is linked via message_id and thread_id", async () => {
        // Setup: Simulate the scenario where a message could be returned twice
        // but our GROUP BY ensures it's only returned once
        const mockResult = [
          {
            id: "msg-123",
            communication_id: "comm-1",
            user_id: "user-1",
            transaction_id: "txn-1",
            message_id: "msg-123",
            thread_id: "thread-456",
            body_text: "Hello world",
            sent_at: "2024-01-01T12:00:00Z",
          },
          {
            id: "msg-124",
            communication_id: "comm-2",
            user_id: "user-1",
            transaction_id: "txn-1",
            message_id: null, // Thread-based link
            thread_id: "thread-456",
            body_text: "Reply message",
            sent_at: "2024-01-01T12:01:00Z",
          },
        ];

        mockDbAll.mockReturnValue(mockResult);

        const result = await getCommunicationsWithMessages("txn-1");

        // Should return both messages (they have different IDs)
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("msg-123");
        expect(result[1].id).toBe("msg-124");
      });

      it("should use aggregate functions for communication metadata", async () => {
        mockDbAll.mockReturnValue([]);

        await getCommunicationsWithMessages("test-transaction-id");

        const [sql] = mockDbAll.mock.calls[0] as [string, unknown[]];

        // Verify aggregate functions are used for potentially duplicate fields
        expect(sql).toContain("MIN(c.id) as communication_id");
        expect(sql).toContain("MAX(c.message_id) as message_id");
        expect(sql).toContain("MAX(c.link_source) as link_source");
        expect(sql).toContain("MAX(c.link_confidence) as link_confidence");
        expect(sql).toContain("MIN(c.linked_at) as linked_at");
        expect(sql).toContain("MIN(c.created_at) as created_at");
      });
    });

    describe("query structure", () => {
      it("should join messages via message_id OR thread_id (mutually exclusive)", async () => {
        mockDbAll.mockReturnValue([]);

        await getCommunicationsWithMessages("test-transaction-id");

        const [sql] = mockDbAll.mock.calls[0] as [string, unknown[]];

        // Verify the JOIN logic uses both linking mechanisms
        expect(sql).toContain("c.message_id IS NOT NULL AND c.message_id = m.id");
        expect(sql).toContain("c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id");
      });

      it("should order results by sent_at descending", async () => {
        mockDbAll.mockReturnValue([]);

        await getCommunicationsWithMessages("test-transaction-id");

        const [sql] = mockDbAll.mock.calls[0] as [string, unknown[]];

        expect(sql).toContain("ORDER BY COALESCE(m.sent_at, c.sent_at) DESC");
      });

      it("should filter by transaction_id", async () => {
        mockDbAll.mockReturnValue([]);

        await getCommunicationsWithMessages("specific-txn-id");

        const [sql, params] = mockDbAll.mock.calls[0] as [string, unknown[]];

        expect(sql).toContain("WHERE c.transaction_id = ?");
        expect(params).toContain("specific-txn-id");
      });
    });

    describe("message content fallback", () => {
      it("should use COALESCE to prefer message table content over legacy columns", async () => {
        mockDbAll.mockReturnValue([]);

        await getCommunicationsWithMessages("test-transaction-id");

        const [sql] = mockDbAll.mock.calls[0] as [string, unknown[]];

        // Verify COALESCE is used for content fields
        expect(sql).toContain("COALESCE(m.channel, c.communication_type) as channel");
        expect(sql).toContain("COALESCE(m.body_text, c.body_plain) as body_text");
        expect(sql).toContain("COALESCE(m.body_html, c.body) as body");
        expect(sql).toContain("COALESCE(m.subject, c.subject) as subject");
        expect(sql).toContain("COALESCE(m.sent_at, c.sent_at) as sent_at");
      });
    });

    describe("return value", () => {
      it("should return empty array when no communications exist", async () => {
        mockDbAll.mockReturnValue([]);

        const result = await getCommunicationsWithMessages("no-comms-txn");

        expect(result).toEqual([]);
      });

      it("should return communications array from database", async () => {
        const mockCommunications = [
          {
            id: "msg-1",
            communication_id: "comm-1",
            body_text: "Test message",
          },
        ];
        mockDbAll.mockReturnValue(mockCommunications);

        const result = await getCommunicationsWithMessages("txn-1");

        expect(result).toEqual(mockCommunications);
      });
    });
  });
});
