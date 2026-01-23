/**
 * Tests for Auto-Link Service
 * TASK-1031: Auto-link communications when contact is added to transaction
 * TASK-1115: Updated for thread-level message linking
 * BACKLOG-408: Verify sync works with contact_emails junction table
 */

import {
  autoLinkCommunicationsForContact,
} from "../autoLinkService";

// Mock dependencies
const mockDbAll = jest.fn();
const mockDbGet = jest.fn();
const mockDbRun = jest.fn();

jest.mock("../db/core/dbConnection", () => ({
  dbAll: (...args: unknown[]) => mockDbAll(...args),
  dbGet: (...args: unknown[]) => mockDbGet(...args),
  dbRun: (...args: unknown[]) => mockDbRun(...args),
}));

jest.mock("../logService", () => {
  const mockLogFn = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    default: {
      info: mockLogFn,
      warn: mockLogFn,
      error: mockLogFn,
      debug: mockLogFn,
    },
  };
});

// TASK-1115: Mock thread-level communication functions
const mockCreateThreadCommunicationReference = jest.fn();
const mockIsThreadLinkedToTransaction = jest.fn();

jest.mock("../db/communicationDbService", () => ({
  createThreadCommunicationReference: (...args: unknown[]) => mockCreateThreadCommunicationReference(...args),
  isThreadLinkedToTransaction: (...args: unknown[]) => mockIsThreadLinkedToTransaction(...args),
}));

jest.mock("../messageMatchingService", () => ({
  normalizePhone: jest.fn((phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }),
}));

describe("autoLinkService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("autoLinkCommunicationsForContact", () => {
    const mockContactId = "contact-123";
    const mockTransactionId = "txn-456";
    const mockUserId = "user-789";

    // Helper to set up standard mocks
    // Note: Since TASK-1037 fix, emails are queried from 'communications' table
    // and text messages from 'messages' table
    // TASK-1115: Messages now return thread_id for thread-level linking
    // BACKLOG-408: Emails come from contact_emails junction table
    const setupMocks = (options: {
      contactExists?: boolean;
      emails?: string[];
      phones?: string[];
      transactionExists?: boolean;
      foundEmailIds?: string[];
      foundMessages?: Array<{ id: string; thread_id: string | null }>;
      emailAlreadyLinked?: Set<string>;
      threadsAlreadyLinked?: Set<string>;
    }) => {
      const {
        contactExists = true,
        emails = [],
        phones = [],
        transactionExists = true,
        foundEmailIds = [],
        foundMessages = [],
        emailAlreadyLinked = new Set<string>(),
        threadsAlreadyLinked = new Set<string>(),
      } = options;

      mockDbGet.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql.includes("FROM contacts")) {
          return contactExists ? { id: mockContactId } : null;
        }
        if (sql.includes("FROM transactions")) {
          return transactionExists
            ? {
                user_id: mockUserId,
                started_at: "2024-01-01T00:00:00Z",
                closed_at: null,
              }
            : null;
        }
        // For linkExistingCommunication - check if already linked
        if (sql.includes("transaction_id FROM communications WHERE id")) {
          const commId = params?.[0] as string;
          if (emailAlreadyLinked.has(commId)) {
            return { transaction_id: mockTransactionId };
          }
          return { transaction_id: null };
        }
        return null;
      });

      mockDbAll.mockImplementation((sql: string) => {
        // BACKLOG-408: Emails from contact_emails junction table
        if (sql.includes("FROM contact_emails")) {
          return emails.map((email) => ({ email }));
        }
        if (sql.includes("FROM contact_phones")) {
          return phones.map((phone) => ({ phone_e164: phone }));
        }
        // Emails are now queried from communications table
        if (sql.includes("FROM communications") && sql.includes("communication_type = 'email'")) {
          return foundEmailIds.map((id) => ({ id }));
        }
        // TASK-1115: Text messages from messages table now include thread_id
        if (sql.includes("FROM messages") && sql.includes("sms")) {
          return foundMessages;
        }
        return [];
      });

      // TASK-1115: Mock thread linking functions
      mockIsThreadLinkedToTransaction.mockImplementation((threadId: string) => {
        return Promise.resolve(threadsAlreadyLinked.has(threadId));
      });
      mockCreateThreadCommunicationReference.mockImplementation(() => {
        return Promise.resolve("comm-ref-" + Math.random().toString(36).slice(2));
      });
    };

    it("should return zeros when contact is not found", async () => {
      setupMocks({ contactExists: false });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result).toEqual({
        emailsLinked: 0,
        messagesLinked: 0,
        alreadyLinked: 0,
        errors: 0,
      });
    });

    it("should return zeros when contact has no email or phone", async () => {
      setupMocks({
        contactExists: true,
        emails: [],
        phones: [],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result).toEqual({
        emailsLinked: 0,
        messagesLinked: 0,
        alreadyLinked: 0,
        errors: 0,
      });
    });

    it("should return zeros when transaction is not found", async () => {
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: false,
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result).toEqual({
        emailsLinked: 0,
        messagesLinked: 0,
        alreadyLinked: 0,
        errors: 0,
      });
    });

    it("should link emails matching contact email addresses", async () => {
      // With the TASK-1037 fix, emails come from the communications table
      // and are linked using UPDATE (dbRun) instead of createCommunicationReference
      // BACKLOG-408: Email addresses come from contact_emails junction table
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessages: [],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(2);
      expect(result.messagesLinked).toBe(0);
      // Emails use linkExistingCommunication (dbRun for UPDATE)
      expect(mockDbRun).toHaveBeenCalledTimes(2);
      // Thread-level linking is NOT used for emails, only for messages
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(0);
    });

    it("should link text messages matching contact phone numbers at thread level", async () => {
      // TASK-1115: Messages are now linked at thread level
      // 3 messages from 2 threads = 2 threads linked
      setupMocks({
        contactExists: true,
        emails: [],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: [],
        foundMessages: [
          { id: "msg-1", thread_id: "thread-1" },
          { id: "msg-2", thread_id: "thread-1" }, // Same thread as msg-1
          { id: "msg-3", thread_id: "thread-2" }, // Different thread
        ],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(0);
      // TASK-1115: messagesLinked now counts unique threads, not individual messages
      expect(result.messagesLinked).toBe(2);
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(2);
    });

    it("should count already-linked communications", async () => {
      // email-2 is already linked to this transaction
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessages: [],
        emailAlreadyLinked: new Set(["email-2"]),
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(1);
      expect(result.alreadyLinked).toBe(1);
      // Only one dbRun call because email-2 is already linked
      expect(mockDbRun).toHaveBeenCalledTimes(1);
    });

    it("should count errors during linking", async () => {
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessages: [],
      });

      // First succeeds, second fails
      mockDbRun
        .mockImplementationOnce(() => {}) // First email succeeds
        .mockImplementationOnce(() => {
          throw new Error("Database error");
        });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(1);
      expect(result.errors).toBe(1);
    });

    it("should link both emails and messages for a contact with both", async () => {
      // TASK-1115: Messages are now linked at thread level
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: ["email-1"],
        foundMessages: [
          { id: "msg-1", thread_id: "thread-1" },
          { id: "msg-2", thread_id: "thread-2" },
        ],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(1);
      // TASK-1115: messagesLinked counts unique threads (2 threads)
      expect(result.messagesLinked).toBe(2);
      // Emails use dbRun (1 call for UPDATE)
      expect(mockDbRun).toHaveBeenCalledTimes(1);
      // Messages use createThreadCommunicationReference (2 threads)
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(2);
    });

    it("should update communication with correct transaction_id for emails", async () => {
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1"],
        foundMessages: [],
      });

      await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Verify dbRun was called to UPDATE the communication with correct params
      expect(mockDbRun).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE communications"),
        expect.arrayContaining([
          mockTransactionId,
          "auto",
          0.85, // Email confidence
          "email-1",
        ])
      );
    });

    it("should use higher confidence for phone matches than email matches", async () => {
      // TASK-1115: Messages are now linked at thread level
      setupMocks({
        contactExists: true,
        emails: [],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: [],
        foundMessages: [{ id: "msg-1", thread_id: "thread-1" }],
      });

      await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Verify phone match has higher confidence (0.9 vs 0.85)
      // TASK-1115: Now uses createThreadCommunicationReference with thread_id
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledWith(
        "thread-1", // thread_id, not message_id
        mockTransactionId,
        mockUserId,
        "auto",
        0.9 // Phone confidence
      );
    });

    it("should handle messages without thread_id gracefully", async () => {
      // TASK-1115: Messages without thread_id are skipped (they'll be picked up
      // when thread_id is populated)
      setupMocks({
        contactExists: true,
        emails: [],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: [],
        foundMessages: [
          { id: "msg-1", thread_id: null },      // No thread_id - skipped
          { id: "msg-2", thread_id: "thread-1" }, // Has thread_id - linked
        ],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Only 1 thread linked (msg-1 has no thread_id)
      expect(result.messagesLinked).toBe(1);
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(1);
    });

    it("should count already-linked threads", async () => {
      // TASK-1115: Thread already linked to transaction
      setupMocks({
        contactExists: true,
        emails: [],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: [],
        foundMessages: [
          { id: "msg-1", thread_id: "thread-1" },
          { id: "msg-2", thread_id: "thread-2" },
        ],
        threadsAlreadyLinked: new Set(["thread-1"]), // thread-1 already linked
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.messagesLinked).toBe(1); // Only thread-2 linked
      expect(result.alreadyLinked).toBe(1);  // thread-1 was already linked
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(1);
    });
  });
});
