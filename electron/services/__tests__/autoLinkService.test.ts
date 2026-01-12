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

jest.mock("../db/core/dbConnection", () => ({
  dbAll: (...args: unknown[]) => mockDbAll(...args),
  dbGet: (...args: unknown[]) => mockDbGet(...args),
  dbRun: jest.fn(),
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

const mockCreateCommunicationReference = jest.fn();

jest.mock("../messageMatchingService", () => ({
  normalizePhone: jest.fn((phone) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }),
  createCommunicationReference: (...args: unknown[]) => mockCreateCommunicationReference(...args),
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
    const setupMocks = (options: {
      contactExists?: boolean;
      emails?: string[];
      phones?: string[];
      transactionExists?: boolean;
      foundEmailIds?: string[];
      foundMessageIds?: string[];
    }) => {
      const {
        contactExists = true,
        emails = [],
        phones = [],
        transactionExists = true,
        foundEmailIds = [],
        foundMessageIds = [],
      } = options;

      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM contacts")) {
          return contactExists ? { id: mockContactId } : null;
        }
        if (sql.includes("FROM transactions")) {
          return transactionExists
            ? {
                user_id: mockUserId,
                started_at: "2024-01-01T00:00:00Z",
                closed_at: null,
                representation_start_date: null,
                closing_date: null,
              }
            : null;
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
        if (sql.includes("FROM messages") && sql.includes("channel = 'email'")) {
          return foundEmailIds.map((id) => ({ id }));
        }
        if (sql.includes("FROM messages") && sql.includes("sms")) {
          return foundMessageIds.map((id) => ({ id }));
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
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessageIds: [],
      });

      mockCreateCommunicationReference
        .mockResolvedValueOnce("ref-1")
        .mockResolvedValueOnce("ref-2");

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(2);
      expect(result.messagesLinked).toBe(0);
      expect(mockCreateCommunicationReference).toHaveBeenCalledTimes(2);
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

      mockCreateCommunicationReference
        .mockResolvedValueOnce("ref-1")
        .mockResolvedValueOnce("ref-2")
        .mockResolvedValueOnce("ref-3");

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(0);
      expect(result.messagesLinked).toBe(3);
      expect(mockCreateCommunicationReference).toHaveBeenCalledTimes(3);
    });

    it("should count already-linked communications", async () => {
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1", "email-2"],
        foundMessageIds: [],
      });

      // First email links successfully, second is already linked
      mockCreateCommunicationReference
        .mockResolvedValueOnce("ref-1")
        .mockResolvedValueOnce(null); // Already linked

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(1);
      expect(result.alreadyLinked).toBe(1);
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
      mockCreateCommunicationReference
        .mockResolvedValueOnce("ref-1")
        .mockRejectedValueOnce(new Error("Database error"));

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

      mockCreateCommunicationReference
        .mockResolvedValueOnce("ref-email")
        .mockResolvedValueOnce("ref-msg-1")
        .mockResolvedValueOnce("ref-msg-2");

      const result = await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      expect(result.emailsLinked).toBe(1);
      expect(result.messagesLinked).toBe(2);
      expect(mockCreateCommunicationReference).toHaveBeenCalledTimes(3);
    });

    it("should call createCommunicationReference with correct parameters", async () => {
      setupMocks({
        contactExists: true,
        emails: ["john@example.com"],
        phones: [],
        transactionExists: true,
        foundEmailIds: ["email-1"],
        foundMessageIds: [],
      });

      mockCreateCommunicationReference.mockResolvedValueOnce("ref-1");

      await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Verify the call parameters
      expect(mockCreateCommunicationReference).toHaveBeenCalledWith(
        "email-1",
        mockTransactionId,
        mockUserId,
        "auto",
        0.85 // Email confidence
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

      mockCreateCommunicationReference.mockResolvedValueOnce("ref-1");

      await autoLinkCommunicationsForContact({
        contactId: mockContactId,
        transactionId: mockTransactionId,
      });

      // Verify phone match has higher confidence (0.9 vs 0.85)
      expect(mockCreateCommunicationReference).toHaveBeenCalledWith(
        "msg-1",
        mockTransactionId,
        mockUserId,
        "auto",
        0.9 // Phone confidence
      );
    });
  });
});
