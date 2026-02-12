/**
 * Tests for Auto-Link Service
 * TASK-1031: Auto-link communications when contact is added to transaction
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

const mockCreateThreadCommunicationReference = jest.fn();
const mockIsThreadLinkedToTransaction = jest.fn();

jest.mock("../messageMatchingService", () => ({
  normalizePhone: jest.fn((phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }),
}));

// BACKLOG-502: Mock the thread-based linking functions from communicationDbService
jest.mock("../db/communicationDbService", () => ({
  createThreadCommunicationReference: (...args: unknown[]) => mockCreateThreadCommunicationReference(...args),
  isThreadLinkedToTransaction: (...args: unknown[]) => mockIsThreadLinkedToTransaction(...args),
}));

// TASK-1951: Mock the preference helper
// Default: messages inference enabled for existing test compatibility
const mockIsContactSourceEnabled = jest.fn();
jest.mock("../../utils/preferenceHelper", () => ({
  isContactSourceEnabled: (...args: unknown[]) => mockIsContactSourceEnabled(...args),
}));

describe("autoLinkService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // BACKLOG-502: Default behavior for thread linking mocks
    mockCreateThreadCommunicationReference.mockResolvedValue("comm-ref-id");
    mockIsThreadLinkedToTransaction.mockResolvedValue(false);
    // TASK-1951: Default to messages inference enabled for existing test compatibility
    mockIsContactSourceEnabled.mockResolvedValue(true);
  });

  describe("autoLinkCommunicationsForContact", () => {
    const mockContactId = "contact-123";
    const mockTransactionId = "txn-456";
    const mockUserId = "user-789";

    // Helper to set up standard mocks
    // Note: Since TASK-1037 fix, emails are queried from 'communications' table
    // and text messages from 'messages' table
    const setupMocks = (options: {
      contactExists?: boolean;
      emails?: string[];
      phones?: string[];
      transactionExists?: boolean;
      foundEmailIds?: string[];
      foundMessageIds?: string[];
      emailAlreadyLinked?: Set<string>;
    }) => {
      const {
        contactExists = true,
        emails = [],
        phones = [],
        transactionExists = true,
        foundEmailIds = [],
        foundMessageIds = [],
        emailAlreadyLinked = new Set<string>(),
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
        // For user email lookup (TEST-051-007 fix)
        if (sql.includes("FROM users_local")) {
          return { email: "user@example.com" };
        }
        return null;
      });

      mockDbAll.mockImplementation((sql: string) => {
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
        // Text messages from messages table (BACKLOG-502: includes thread_id for thread-level linking)
        if (sql.includes("FROM messages") && sql.includes("sms")) {
          return foundMessageIds.map((id, idx) => ({ id, thread_id: `thread-${idx + 1}` }));
        }
        return [];
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
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessageIds: [],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(2);
      expect(result.messagesLinked).toBe(0);
      // Emails use linkExistingCommunication (dbRun for UPDATE)
      expect(mockDbRun).toHaveBeenCalledTimes(2);
      // createCommunicationReference is NOT used for emails anymore
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(0);
    });

    it("should link text messages matching contact phone numbers", async () => {
      setupMocks({
        contactExists: true,
        emails: [],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: [],
        foundMessageIds: ["msg-1", "msg-2", "msg-3"],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(0);
      // BACKLOG-502: Each message has a unique thread_id (thread-1, thread-2, thread-3),
      // so 3 threads are linked
      expect(result.messagesLinked).toBe(3);
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(3);
    });

    it("should count already-linked communications", async () => {
      // email-2 is already linked to this transaction
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessageIds: [],
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
        foundMessageIds: [],
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
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: ["email-1"],
        foundMessageIds: ["msg-1", "msg-2"],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(1);
      // BACKLOG-502: Each message has unique thread_id (thread-1, thread-2), so 2 threads linked
      expect(result.messagesLinked).toBe(2);
      // Emails use dbRun (1 call for UPDATE), messages use createThreadCommunicationReference (2 calls)
      expect(mockDbRun).toHaveBeenCalledTimes(1);
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(2);
    });

    it("should update communication with correct transaction_id for emails", async () => {
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1"],
        foundMessageIds: [],
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
      setupMocks({
        contactExists: true,
        emails: [],
        phones: ["+14155551234"],
        transactionExists: true,
        foundEmailIds: [],
        foundMessageIds: ["msg-1"],
      });

      await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // BACKLOG-502: Verify thread-based linking with phone match confidence (0.9 vs 0.85 for email)
      // First param is thread_id (from our mock: "thread-1"), not message_id
      expect(mockCreateThreadCommunicationReference).toHaveBeenCalledWith(
        "thread-1",  // thread_id from the mock
        mockTransactionId,
        mockUserId,
        "auto",
        0.9 // Phone confidence
      );
    });

    it("should NOT link emails when contact's only email is the user's own email (TEST-051-007)", async () => {
      // TEST-051-007: User's email should never be treated as a contact
      // Mock returns user@example.com as the user's email
      setupMocks({
        contactExists: true,
        emails: ["user@example.com"], // Contact's email is the user's own email
        phones: [],
        transactionExists: true,
        foundEmailIds: [], // No emails should be found since we filter out user's email
        foundMessageIds: [],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Should not link any emails because contact's email is the user's email
      expect(result.emailsLinked).toBe(0);
      expect(result.messagesLinked).toBe(0);
      expect(mockDbRun).not.toHaveBeenCalled();
    });

    it("should only link emails for actual contacts, not user's email (TEST-051-007)", async () => {
      // TEST-051-007: Contact has multiple emails, one is user's email
      setupMocks({
        contactExists: true,
        emails: ["user@example.com", "contact@example.com"], // Mix of user and contact emails
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1"], // Should only find emails for contact@example.com
        foundMessageIds: [],
      });

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Should link emails only for contact@example.com, not user@example.com
      expect(result.emailsLinked).toBe(1);

      // Verify that the SQL query was built only for contact@example.com
      // Check dbAll was called with SQL containing only the contact email pattern
      const dbAllCalls = mockDbAll.mock.calls;
      const emailQueryCall = dbAllCalls.find(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes("communication_type = 'email'")
      );

      if (emailQueryCall) {
        const params = emailQueryCall[1] as unknown[];
        // Should have patterns for contact@example.com only (not user@example.com)
        // Pattern is %email% for LIKE matching
        expect(params).toContain("%contact@example.com%");
        expect(params).not.toContain("%user@example.com%");
      }
    });

    // TASK-1951: Inferred contact source preference tests
    describe("inferred contact source preferences", () => {
      it("should skip message auto-link when messages inference is disabled", async () => {
        // Messages inference is OFF
        mockIsContactSourceEnabled.mockResolvedValue(false);

        setupMocks({
          contactExists: true,
          emails: [],
          phones: ["+14155551234"],
          transactionExists: true,
          foundEmailIds: [],
          foundMessageIds: ["msg-1", "msg-2"],
        });

        const result = await autoLinkCommunicationsForContact({
          contactId: mockContactId,
          transactionId: mockTransactionId,
        });

        // Messages should NOT be linked (messages inference disabled)
        expect(result.messagesLinked).toBe(0);
        // No thread communication references created
        expect(mockCreateThreadCommunicationReference).not.toHaveBeenCalled();
      });

      it("should link messages when messages inference is enabled", async () => {
        // Messages inference is ON
        mockIsContactSourceEnabled.mockResolvedValue(true);

        setupMocks({
          contactExists: true,
          emails: [],
          phones: ["+14155551234"],
          transactionExists: true,
          foundEmailIds: [],
          foundMessageIds: ["msg-1", "msg-2"],
        });

        const result = await autoLinkCommunicationsForContact({
          contactId: mockContactId,
          transactionId: mockTransactionId,
        });

        // Messages should be linked when inference is enabled
        expect(result.messagesLinked).toBe(2);
        expect(mockCreateThreadCommunicationReference).toHaveBeenCalledTimes(2);
      });

      it("should check messages preference with correct arguments", async () => {
        mockIsContactSourceEnabled.mockResolvedValue(false);

        setupMocks({
          contactExists: true,
          emails: ["john@example.com"],
          phones: [],
          transactionExists: true,
          foundEmailIds: [],
          foundMessageIds: [],
        });

        await autoLinkCommunicationsForContact({
          contactId: mockContactId,
          transactionId: mockTransactionId,
        });

        // Verify isContactSourceEnabled was called with correct args
        expect(mockIsContactSourceEnabled).toHaveBeenCalledWith(
          mockUserId,
          "inferred",
          "messages",
          false, // default OFF
        );
      });
    });
  });
});
