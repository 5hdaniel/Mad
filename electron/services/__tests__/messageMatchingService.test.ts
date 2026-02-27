/**
 * Message Matching Service Tests
 * Tests for phone normalization and message-contact matching logic.
 *
 * @see TASK-977
 * @see TASK-2087 (address filtering tests)
 */

import {
  normalizePhone,
  phonesMatch,
} from "../messageMatchingService";

describe("messageMatchingService", () => {
  describe("normalizePhone", () => {
    it("normalizes 10-digit US phone numbers", () => {
      expect(normalizePhone("4155550000")).toBe("+14155550000");
      expect(normalizePhone("415-555-0000")).toBe("+14155550000");
      expect(normalizePhone("(415) 555-0000")).toBe("+14155550000");
      expect(normalizePhone("415.555.0000")).toBe("+14155550000");
      expect(normalizePhone("415 555 0000")).toBe("+14155550000");
    });

    it("normalizes 11-digit US phone numbers with country code", () => {
      expect(normalizePhone("14155550000")).toBe("+14155550000");
      expect(normalizePhone("1-415-555-0000")).toBe("+14155550000");
      expect(normalizePhone("+14155550000")).toBe("+14155550000");
      expect(normalizePhone("+1 (415) 555-0000")).toBe("+14155550000");
    });

    it("normalizes international phone numbers", () => {
      expect(normalizePhone("+442079460123")).toBe("+442079460123");
      expect(normalizePhone("+44 20 7946 0123")).toBe("+442079460123");
      expect(normalizePhone("442079460123")).toBe("+442079460123");
    });

    it("returns null for invalid phone numbers", () => {
      expect(normalizePhone(null)).toBeNull();
      expect(normalizePhone(undefined)).toBeNull();
      expect(normalizePhone("")).toBeNull();
      expect(normalizePhone("123")).toBeNull(); // Too short
      expect(normalizePhone("12345")).toBeNull(); // Too short
      expect(normalizePhone("abc")).toBeNull();
    });

    it("handles edge cases", () => {
      // Leading zeros are preserved as they indicate international format
      expect(normalizePhone("04155550000")).toBe("+04155550000");
      // Numbers with extensions: all digits are kept, treated as international (>10 digits)
      expect(normalizePhone("4155550000 ext 123")).toBe("+4155550000123");
    });

    it("preserves email handles unchanged (lowercased)", () => {
      expect(normalizePhone("user@icloud.com")).toBe("user@icloud.com");
    });

    it("lowercases email handles", () => {
      expect(normalizePhone("User@ICLOUD.COM")).toBe("user@icloud.com");
    });

    it("preserves complex email handles", () => {
      expect(normalizePhone("madison.jones+tag@gmail.com")).toBe(
        "madison.jones+tag@gmail.com",
      );
    });
  });

  describe("phonesMatch", () => {
    it("matches identical normalized phone numbers", () => {
      expect(phonesMatch("+14155550000", "+14155550000")).toBe(true);
      expect(phonesMatch("+442079460123", "+442079460123")).toBe(true);
    });

    it("matches phone numbers in different formats", () => {
      expect(phonesMatch("(415) 555-0000", "+14155550000")).toBe(true);
      expect(phonesMatch("415-555-0000", "1-415-555-0000")).toBe(true);
      expect(phonesMatch("4155550000", "+1 (415) 555-0000")).toBe(true);
    });

    it("returns false for different phone numbers", () => {
      expect(phonesMatch("+14155550000", "+14155550001")).toBe(false);
      expect(phonesMatch("4155550000", "5105550000")).toBe(false);
    });

    it("returns false for invalid phone numbers", () => {
      expect(phonesMatch(null, "+14155550000")).toBe(false);
      expect(phonesMatch("+14155550000", null)).toBe(false);
      expect(phonesMatch(null, null)).toBe(false);
      expect(phonesMatch("", "+14155550000")).toBe(false);
      expect(phonesMatch("123", "+14155550000")).toBe(false);
    });
  });
});

// ============================================
// TASK-2087: Address filtering tests
// ============================================
// These tests require DB mocks and test autoLinkEmailsToTransaction /
// autoLinkTextsToTransaction address filtering behavior.

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

// Re-import after mocks are set up (jest hoists mocks above imports)
import {
  autoLinkEmailsToTransaction,
  autoLinkTextsToTransaction,
} from "../messageMatchingService";

describe("messageMatchingService - address filtering (TASK-2087)", () => {
  const mockUserId = "user-1";
  const mockTransactionId = "txn-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("filterEmailMatchesByAddress (via autoLinkEmailsToTransaction)", () => {
    it("should process messages in batches when there are more than 100", async () => {
      // Set up transaction with address
      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM transactions")) {
          return {
            user_id: mockUserId,
            property_address: "123 Oak Street, Portland, OR",
            property_street: null,
          };
        }
        // For createCommunicationReference checks
        if (sql.includes("FROM communications") && sql.includes("message_id")) return null;
        if (sql.includes("FROM messages WHERE id")) return { id: "msg" };
        return null;
      });

      // Generate 150 message IDs to trigger batching (batch size = 100)
      const messageIds = Array.from({ length: 150 }, (_, i) => `msg-${i}`);

      mockDbAll.mockImplementation((sql: string) => {
        // Contact emails for transaction
        if (sql.includes("FROM transaction_contacts") && sql.includes("contact_emails")) {
          return [{ contactId: "contact-1", email: "agent@realty.com" }];
        }
        // findEmailsByAddresses: return 150 matching messages
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'")) {
          return messageIds.map(id => ({
            id,
            sender: "agent@realty.com",
            recipients: null,
            direction: "inbound",
            channel: "email",
          }));
        }
        // filterEmailMatchesByAddress: batch queries for message content
        if (sql.includes("FROM messages") && sql.includes("subject")) {
          // Extract the IDs from the SQL placeholders by checking params
          // Return messages with address in content for about half
          return messageIds
            .filter((_, i) => i % 2 === 0)
            .map(id => ({
              id,
              subject: "Re: 123 Oak closing",
              body_text: null,
            }));
        }
        return [];
      });

      const result = await autoLinkEmailsToTransaction(mockTransactionId);

      // Should have linked the filtered subset (those with address in content)
      expect(result.linked).toBeGreaterThan(0);
      expect(result.linked).toBeLessThan(150);

      // Verify that the batch query for message content was called
      // (filterEmailMatchesByAddress uses batches of 100)
      const contentQueryCalls = mockDbAll.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("subject, body_text")
      );
      // With 150 messages, there should be 2 batch calls (100 + 50)
      expect(contentQueryCalls.length).toBe(2);
    });

    it("should filter emails by address content when transaction has property_address", async () => {
      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM transactions")) {
          return {
            user_id: mockUserId,
            property_address: "456 Elm Drive, Seattle, WA",
            property_street: null,
          };
        }
        if (sql.includes("FROM communications") && sql.includes("message_id")) return null;
        if (sql.includes("FROM messages WHERE id")) return { id: "msg" };
        return null;
      });

      mockDbAll.mockImplementation((sql: string) => {
        if (sql.includes("FROM transaction_contacts") && sql.includes("contact_emails")) {
          return [{ contactId: "contact-1", email: "buyer@example.com" }];
        }
        // findEmailsByAddresses: return 3 messages
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'")) {
          return [
            { id: "msg-1", sender: "buyer@example.com", recipients: null, direction: "inbound", channel: "email" },
            { id: "msg-2", sender: "buyer@example.com", recipients: null, direction: "inbound", channel: "email" },
            { id: "msg-3", sender: "buyer@example.com", recipients: null, direction: "inbound", channel: "email" },
          ];
        }
        // filterEmailMatchesByAddress: only msg-1 and msg-3 mention the address
        if (sql.includes("subject, body_text")) {
          return [
            { id: "msg-1", subject: "456 Elm closing documents", body_text: null },
            { id: "msg-3", subject: null, body_text: "Please review the offer for 456 Elm." },
          ];
        }
        return [];
      });

      const result = await autoLinkEmailsToTransaction(mockTransactionId);

      // Only 2 of 3 emails mention the address
      expect(result.linked).toBe(2);
    });
  });

  describe("autoLinkEmailsToTransaction - address fallback", () => {
    it("should fall back to unfiltered results when no emails match the address", async () => {
      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM transactions")) {
          return {
            user_id: mockUserId,
            property_address: "999 Nonexistent Way, Nowhere, XX",
            property_street: null,
          };
        }
        if (sql.includes("FROM communications") && sql.includes("message_id")) return null;
        if (sql.includes("FROM messages WHERE id")) return { id: "msg" };
        return null;
      });

      let findEmailsCallCount = 0;
      mockDbAll.mockImplementation((sql: string) => {
        if (sql.includes("FROM transaction_contacts") && sql.includes("contact_emails")) {
          return [{ contactId: "contact-1", email: "seller@example.com" }];
        }
        // countAllEmailsMatchingAddress: queries ALL emails (no NOT IN exclusion)
        // Return emails but none matching the address (content check is in JS)
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'") && !sql.includes("NOT IN")) {
          return [
            { id: "msg-1", sender: "seller@example.com", recipients: null, subject: "General inquiry", body_text: null },
            { id: "msg-2", sender: "seller@example.com", recipients: null, subject: "Follow up", body_text: null },
          ];
        }
        // findEmailsByAddresses: return 2 messages each time it's called (uses NOT IN for exclusion)
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'")) {
          findEmailsCallCount++;
          return [
            { id: "msg-1", sender: "seller@example.com", recipients: null, direction: "inbound", channel: "email" },
            { id: "msg-2", sender: "seller@example.com", recipients: null, direction: "inbound", channel: "email" },
          ];
        }
        // filterEmailMatchesByAddress: NO emails match the address
        if (sql.includes("subject, body_text")) {
          return [];
        }
        return [];
      });

      const result = await autoLinkEmailsToTransaction(mockTransactionId);

      // Fallback: all emails should be linked since address filter returned nothing
      // AND countAllEmailsMatchingAddress confirmed no emails match the address
      expect(result.linked).toBe(2);
      // findEmailsByAddresses should be called twice via withAddressFallback
      // (once with address filter that yields empty, once without)
      expect(findEmailsCallCount).toBe(2);
    });

    it("should skip address filter when transaction has no property_address", async () => {
      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM transactions")) {
          return {
            user_id: mockUserId,
            property_address: null,
            property_street: null,
          };
        }
        if (sql.includes("FROM communications") && sql.includes("message_id")) return null;
        if (sql.includes("FROM messages WHERE id")) return { id: "msg" };
        return null;
      });

      mockDbAll.mockImplementation((sql: string) => {
        if (sql.includes("FROM transaction_contacts") && sql.includes("contact_emails")) {
          return [{ contactId: "contact-1", email: "agent@realty.com" }];
        }
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'")) {
          return [
            { id: "msg-1", sender: "agent@realty.com", recipients: null, direction: "inbound", channel: "email" },
          ];
        }
        return [];
      });

      const result = await autoLinkEmailsToTransaction(mockTransactionId);

      expect(result.linked).toBe(1);

      // Should NOT have queried for message content (no address filter)
      const contentQueryCalls = mockDbAll.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("subject, body_text")
      );
      expect(contentQueryCalls.length).toBe(0);
    });
  });

  describe("autoLinkEmailsToTransaction - no fallback when already linked", () => {
    it("should NOT fall back when matching emails are already linked to the transaction", async () => {
      // BUG SCENARIO (TASK-2087 QA fix):
      // Transaction has address "456 Maple Drive", contact has matching emails
      // that are already linked. Fallback should NOT trigger.
      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM transactions")) {
          return {
            user_id: mockUserId,
            property_address: "456 Maple Drive, Portland, OR",
            property_street: null,
          };
        }
        if (sql.includes("FROM communications") && sql.includes("message_id")) return null;
        if (sql.includes("FROM messages WHERE id")) return { id: "msg" };
        return null;
      });

      let findEmailsCallCount = 0;
      mockDbAll.mockImplementation((sql: string) => {
        if (sql.includes("FROM transaction_contacts") && sql.includes("contact_emails")) {
          return [{ contactId: "contact-1", email: "bob@example.com" }];
        }
        // countAllEmailsMatchingAddress: queries ALL emails without NOT IN exclusion
        // Return an email that mentions the address (already linked but still matches)
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'") && !sql.includes("NOT IN")) {
          return [
            {
              id: "msg-1",
              sender: "bob@example.com",
              recipients: null,
              subject: "456 Maple closing docs",
              body_text: null,
            },
          ];
        }
        // findEmailsByAddresses: uses NOT IN to exclude already-linked emails
        // Returns 0 because the matching email is already linked
        if (sql.includes("FROM messages m") && sql.includes("channel = 'email'") && sql.includes("NOT IN")) {
          findEmailsCallCount++;
          return [];
        }
        return [];
      });

      const result = await autoLinkEmailsToTransaction(mockTransactionId);

      // Should NOT have linked anything (all are already linked)
      expect(result.linked).toBe(0);
      // findEmailsByAddresses should only be called ONCE (no fallback)
      expect(findEmailsCallCount).toBe(1);
    });
  });

  describe("autoLinkTextsToTransaction - no address filtering", () => {
    it("should NOT apply address filtering to text messages", async () => {
      mockDbGet.mockImplementation((sql: string) => {
        if (sql.includes("FROM transactions")) {
          return {
            user_id: mockUserId,
            started_at: "2024-01-01T00:00:00Z",
            closed_at: null,
          };
        }
        if (sql.includes("FROM communications") && sql.includes("message_id")) return null;
        if (sql.includes("FROM messages WHERE id")) return { id: "msg" };
        return null;
      });

      mockDbAll.mockImplementation((sql: string) => {
        // Contact phones for transaction
        if (sql.includes("FROM transaction_contacts") && sql.includes("contact_phones")) {
          return [{ contactId: "contact-1", phone: "+14155551234" }];
        }
        // findTextMessagesByPhones: return messages
        // participants_flat must contain the phone digits for matching
        if (sql.includes("FROM messages m") && sql.includes("channel IN ('sms', 'imessage')")) {
          return [
            {
              id: "msg-1",
              participants: null,
              participants_flat: "14155551234",
              direction: "inbound",
              channel: "sms",
            },
            {
              id: "msg-2",
              participants: null,
              participants_flat: "14155551234",
              direction: "outbound",
              channel: "imessage",
            },
          ];
        }
        return [];
      });

      const result = await autoLinkTextsToTransaction(mockTransactionId);

      // All messages should be linked without any address filtering
      expect(result.linked).toBe(2);

      // Verify NO queries for message content (subject/body_text) were made
      // Address filtering queries use "subject, body_text" in their SQL
      const contentQueryCalls = mockDbAll.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("subject, body_text")
      );
      expect(contentQueryCalls.length).toBe(0);

      // Also verify the text message query SQL does NOT reference address-related columns
      const textQueryCalls = mockDbAll.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("channel IN ('sms', 'imessage')")
      );
      for (const call of textQueryCalls) {
        const sql = call[0] as string;
        expect(sql).not.toContain("body_text");
        expect(sql).not.toContain("subject");
        expect(sql).not.toContain("property_address");
      }
    });
  });
});
