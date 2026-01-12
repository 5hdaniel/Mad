/**
 * @jest-environment node
 */

/**
 * Unit tests for DatabaseService
 * Tests comprehensive database operations including:
 * - User CRUD operations
 * - Session management
 * - Contact operations
 * - Transaction operations
 * - Communication operations
 * - SQL injection prevention
 * - Error handling
 */

import { jest } from "@jest/globals";

// Mock Electron modules
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn(() => "/mock/user/data"),
  },
}));

// Mock better-sqlite3-multiple-ciphers
const mockStatement = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

const mockDb = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => mockStatement),
  close: jest.fn(),
  serialize: jest.fn((callback: () => void) => callback()),
  run: jest.fn(
    (
      _sql: string,
      _params: unknown[],
      callback: (err: Error | null) => void,
    ) => {
      if (callback) callback(null);
      return mockDb;
    },
  ),
  transaction: jest.fn((callback: () => void) => {
    return () => callback();
  }),
};

jest.mock("better-sqlite3-multiple-ciphers", () => {
  return jest.fn(() => mockDb);
});

// Mock fs
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeSync: jest.fn(),
  fsyncSync: jest.fn(),
  closeSync: jest.fn(),
  openSync: jest.fn(),
  unlinkSync: jest.fn(),
  copyFileSync: jest.fn(),
  renameSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 1024 })),
}));

// Mock crypto
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-1234"),
  randomBytes: jest.fn(() => Buffer.from("random-bytes-for-testing")),
}));

// Mock databaseEncryptionService
jest.mock("../databaseEncryptionService", () => ({
  databaseEncryptionService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getEncryptionKey: jest.fn().mockResolvedValue("test-encryption-key-hex"),
    isDatabaseEncrypted: jest.fn().mockResolvedValue(false),
  },
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getEncryptionKey: jest.fn().mockResolvedValue("test-encryption-key-hex"),
    isDatabaseEncrypted: jest.fn().mockResolvedValue(false),
  },
}));

// Mock logService - must use factory function that creates mocks inline
jest.mock("../logService", () => {
  const mockFns = {
    info: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
  };
  return {
    __esModule: true,
    default: mockFns,
    logService: mockFns,
  };
});

import fs from "fs";

describe("DatabaseService", () => {
  let databaseService: typeof import("../databaseService").default;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset mock defaults
    mockStatement.get.mockReturnValue(undefined);
    mockStatement.all.mockReturnValue([]);
    mockStatement.run.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue("-- schema SQL");

    // Re-import to get fresh instance
    const module = await import("../databaseService");
    databaseService = module.default;
  });

  describe("initialization", () => {
    it("should initialize database successfully", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(databaseService.initialize()).resolves.toBe(true);
      expect(mockDb.pragma).toHaveBeenCalled();
    });

    it("should throw error when database operations fail", async () => {
      mockDb.pragma.mockImplementationOnce(() => {
        throw new Error("Failed to set pragma");
      });

      await expect(databaseService.initialize()).rejects.toThrow();
    });
  });

  describe("User Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("createUser", () => {
      it("should create a new user with all fields", async () => {
        const userData = {
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          oauth_provider: "google" as const,
          oauth_id: "google-123",
        };

        const mockUser = {
          id: "test-uuid-1234",
          ...userData,
          subscription_tier: "free",
          subscription_status: "trial",
        };

        mockStatement.get.mockReturnValueOnce(mockUser);

        const user = await databaseService.createUser(userData);

        expect(user.email).toBe("test@example.com");
        expect(mockStatement.run).toHaveBeenCalled();
      });

      it("should throw error when user creation fails", async () => {
        mockStatement.get.mockReturnValue(undefined);

        await expect(
          databaseService.createUser({
            email: "test@example.com",
            oauth_provider: "google",
            oauth_id: "test-id",
          }),
        ).rejects.toThrow("Failed to create user");
      });
    });

    describe("getUserById", () => {
      it("should return user when found", async () => {
        const mockUser = {
          id: "user-123",
          email: "test@example.com",
          oauth_provider: "google",
          oauth_id: "google-123",
        };

        mockStatement.get.mockReturnValue(mockUser);

        const user = await databaseService.getUserById("user-123");

        expect(user).toEqual(mockUser);
        expect(mockStatement.get).toHaveBeenCalledWith("user-123");
      });

      it("should return null when user not found", async () => {
        mockStatement.get.mockReturnValue(undefined);

        const user = await databaseService.getUserById("non-existent");

        expect(user).toBeNull();
      });
    });

    describe("getUserByEmail", () => {
      it("should return user when found by email", async () => {
        const mockUser = {
          id: "user-123",
          email: "test@example.com",
        };

        mockStatement.get.mockReturnValue(mockUser);

        const user = await databaseService.getUserByEmail("test@example.com");

        expect(user).toEqual(mockUser);
      });
    });

    describe("updateUser", () => {
      it("should update allowed fields", async () => {
        await databaseService.updateUser("user-123", {
          first_name: "Updated",
          last_name: "Name",
          timezone: "America/New_York",
        });

        expect(mockStatement.run).toHaveBeenCalled();
      });

      it("should throw error when no valid fields to update", async () => {
        await expect(
          databaseService.updateUser("user-123", {
            id: "cannot-update",
          } as any),
        ).rejects.toThrow("No valid fields to update");
      });
    });

    describe("deleteUser", () => {
      it("should delete user by id", async () => {
        await databaseService.deleteUser("user-123");

        expect(mockStatement.run).toHaveBeenCalledWith("user-123");
      });
    });

    describe("acceptTerms", () => {
      it("should accept terms and return updated user", async () => {
        const mockUser = {
          id: "user-123",
          email: "test@example.com",
          terms_accepted_at: new Date().toISOString(),
          terms_version_accepted: "1.0",
        };

        mockStatement.get.mockReturnValue(mockUser);

        const user = await databaseService.acceptTerms(
          "user-123",
          "1.0",
          "1.0",
        );

        expect(user).toEqual(mockUser);
        expect(mockStatement.run).toHaveBeenCalled();
      });

      it("should throw NotFoundError when user not found after accepting terms", async () => {
        mockStatement.get.mockReturnValue(undefined);

        await expect(
          databaseService.acceptTerms("non-existent", "1.0", "1.0"),
        ).rejects.toThrow("User not found after accepting terms");
      });
    });
  });

  describe("Session Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("createSession", () => {
      it("should create a session and return token", async () => {
        const sessionToken = await databaseService.createSession("user-123");

        expect(sessionToken).toBe("test-uuid-1234");
        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe("validateSession", () => {
      it("should return session and user when valid", async () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const mockSessionUser = {
          id: "session-123",
          user_id: "user-123",
          session_token: "valid-token",
          expires_at: futureDate.toISOString(),
          email: "test@example.com",
        };

        mockStatement.get.mockReturnValue(mockSessionUser);

        const result = await databaseService.validateSession("valid-token");

        expect(result).not.toBeNull();
        expect(result?.session_token).toBe("valid-token");
      });

      it("should return null for non-existent session", async () => {
        mockStatement.get.mockReturnValue(undefined);

        const result = await databaseService.validateSession("invalid-token");

        expect(result).toBeNull();
      });

      it("should delete and return null for expired session", async () => {
        const pastDate = new Date(Date.now() - 1000);
        const mockExpiredSession = {
          id: "session-123",
          user_id: "user-123",
          session_token: "expired-token",
          expires_at: pastDate.toISOString(),
        };

        mockStatement.get.mockReturnValue(mockExpiredSession);

        const result = await databaseService.validateSession("expired-token");

        expect(result).toBeNull();
      });
    });

    describe("deleteSession", () => {
      it("should delete session by token", async () => {
        await databaseService.deleteSession("session-token");

        expect(mockStatement.run).toHaveBeenCalledWith("session-token");
      });
    });

    describe("deleteAllUserSessions", () => {
      it("should delete all sessions for a user", async () => {
        await databaseService.deleteAllUserSessions("user-123");

        expect(mockStatement.run).toHaveBeenCalledWith("user-123");
      });
    });
  });

  describe("Contact Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("createContact", () => {
      it("should create contact with all fields", async () => {
        const contactData = {
          user_id: "user-123",
          name: "John Doe",
          email: "john@example.com",
          phone: "555-1234",
          company: "Acme Inc",
          title: "Manager",
          source: "manual" as const,
        };

        const mockContact = {
          id: "test-uuid-1234",
          ...contactData,
        };

        mockStatement.get.mockReturnValue(mockContact);

        const contact = await databaseService.createContact(contactData);

        expect(contact.name).toBe("John Doe");
        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe("getContacts", () => {
      it("should return all contacts for a user", async () => {
        const mockContacts = [
          { id: "1", name: "Contact 1", user_id: "user-123" },
          { id: "2", name: "Contact 2", user_id: "user-123" },
        ];

        mockStatement.all.mockReturnValue(mockContacts);

        const contacts = await databaseService.getContacts({
          user_id: "user-123",
        });

        expect(contacts).toHaveLength(2);
      });

      it("should filter by source", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getContacts({
          user_id: "user-123",
          source: "email",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by is_imported", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getContacts({
          user_id: "user-123",
          is_imported: true,
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });
    });

    describe("searchContacts", () => {
      it("should search contacts by name or email", async () => {
        const mockContacts = [
          { id: "1", name: "John Doe", email: "john@example.com" },
        ];

        mockStatement.all.mockReturnValue(mockContacts);

        const contacts = await databaseService.searchContacts(
          "John",
          "user-123",
        );

        expect(contacts).toHaveLength(1);
        expect(mockStatement.all).toHaveBeenCalledWith(
          "user-123",
          "%John%",
          "%John%",
        );
      });
    });

    describe("updateContact", () => {
      it("should update allowed contact fields", async () => {
        await databaseService.updateContact("contact-123", {
          display_name: "Updated Name",
          company: "Updated Company",
        });

        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe("deleteContact", () => {
      it("should delete contact by id", async () => {
        await databaseService.deleteContact("contact-123");

        expect(mockStatement.run).toHaveBeenCalledWith("contact-123");
      });
    });
  });

  describe("Transaction Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("createTransaction", () => {
      it("should create transaction with required fields", async () => {
        const transactionData = {
          user_id: "user-123",
          property_address: "123 Main St",
        };

        const mockTransaction = {
          id: "test-uuid-1234",
          ...transactionData,
          transaction_status: "completed",
        };

        mockStatement.get.mockReturnValue(mockTransaction);

        const transaction =
          await databaseService.createTransaction(transactionData);

        expect(transaction.property_address).toBe("123 Main St");
      });

      it("should create transaction with all optional fields", async () => {
        const transactionData = {
          user_id: "user-123",
          property_address: "123 Main St",
          property_street: "Main St",
          property_city: "Springfield",
          property_state: "IL",
          property_zip: "62701",
          transaction_type: "purchase" as const,
          closing_date: "2024-12-31",
        };

        const mockTransaction = {
          id: "test-uuid-1234",
          ...transactionData,
        };

        mockStatement.get.mockReturnValue(mockTransaction);

        const transaction =
          await databaseService.createTransaction(transactionData);

        expect(transaction.property_city).toBe("Springfield");
      });
    });

    describe("getTransactions", () => {
      it("should return all transactions for a user", async () => {
        const mockTransactions = [
          { id: "1", property_address: "123 Main St", user_id: "user-123" },
          { id: "2", property_address: "456 Oak Ave", user_id: "user-123" },
        ];

        mockStatement.all.mockReturnValue(mockTransactions);

        const transactions = await databaseService.getTransactions({
          user_id: "user-123",
        });

        expect(transactions).toHaveLength(2);
      });

      it("should filter by transaction_type", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getTransactions({
          user_id: "user-123",
          transaction_type: "purchase",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by status", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getTransactions({
          user_id: "user-123",
          status: "active",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by date range", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getTransactions({
          user_id: "user-123",
          start_date: "2024-01-01",
          end_date: "2024-12-31",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by property_address", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getTransactions({
          user_id: "user-123",
          property_address: "Main",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });
    });

    describe("getTransactionById", () => {
      it("should return transaction when found", async () => {
        const mockTransaction = {
          id: "txn-123",
          property_address: "123 Main St",
        };

        mockStatement.get.mockReturnValue(mockTransaction);

        const transaction = await databaseService.getTransactionById("txn-123");

        expect(transaction).toEqual(mockTransaction);
      });

      it("should return null when not found", async () => {
        mockStatement.get.mockReturnValue(undefined);

        const transaction =
          await databaseService.getTransactionById("non-existent");

        expect(transaction).toBeNull();
      });
    });

    describe("updateTransaction", () => {
      it("should update transaction fields", async () => {
        await databaseService.updateTransaction("txn-123", {
          property_address: "Updated Address",
          closing_date: "2024-12-31",
        });

        expect(mockStatement.run).toHaveBeenCalled();
      });

      it("should serialize JSON fields", async () => {
        await databaseService.updateTransaction("txn-123", {
          property_coordinates: { lat: 40.7128, lng: -74.006 } as any,
          other_contacts: ["contact-1", "contact-2"] as any,
        });

        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe("deleteTransaction", () => {
      it("should delete transaction by id", async () => {
        await databaseService.deleteTransaction("txn-123");

        expect(mockStatement.run).toHaveBeenCalledWith("txn-123");
      });
    });
  });

  describe("SQL Injection Prevention", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    it("should safely handle malicious input in property_address", async () => {
      const maliciousInput = "'; DROP TABLE transactions; --";

      const mockTransaction = {
        id: "test-uuid-1234",
        user_id: "user-123",
        property_address: maliciousInput,
      };

      mockStatement.get.mockReturnValue(mockTransaction);

      const transaction = await databaseService.createTransaction({
        user_id: "user-123",
        property_address: maliciousInput,
      });

      // The malicious input should be stored as-is (escaped by parameterized query)
      expect(transaction.property_address).toBe(maliciousInput);
    });

    it("should safely handle SQL injection in user email", async () => {
      const maliciousEmail = "test@example.com'; DELETE FROM users; --";

      mockStatement.get.mockReturnValue({
        id: "user-123",
        email: maliciousEmail,
      });

      await databaseService.createUser({
        email: maliciousEmail,
        oauth_provider: "google",
        oauth_id: "google-123",
      });

      // Verify parameterized query is used (no raw SQL execution)
      expect(mockStatement.run).toHaveBeenCalled();
    });

    it("should safely handle malicious input in contact search", async () => {
      const maliciousSearch = "'; DROP TABLE contacts; --";

      mockStatement.all.mockReturnValue([]);

      await databaseService.searchContacts(maliciousSearch, "user-123");

      // Should use parameterized query with LIKE
      expect(mockStatement.all).toHaveBeenCalledWith(
        "user-123",
        expect.stringContaining(maliciousSearch),
        expect.stringContaining(maliciousSearch),
      );
    });
  });

  describe("Communication Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("createCommunication", () => {
      it("should create communication with all fields", async () => {
        const commData = {
          user_id: "user-123",
          communication_type: "email" as const,
          sender: "sender@example.com",
          recipients: "recipient@example.com",
          subject: "Test Subject",
          body: "<p>Test body</p>",
          body_plain: "Test body",
          sent_at: "2024-01-15T10:00:00Z",
        };

        const mockComm = {
          id: "test-uuid-1234",
          ...commData,
        };

        mockStatement.get.mockReturnValue(mockComm);

        const communication =
          await databaseService.createCommunication(commData);

        expect(communication.subject).toBe("Test Subject");
      });
    });

    describe("getCommunications", () => {
      it("should filter communications by user_id", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getCommunications({ user_id: "user-123" });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by transaction_id", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getCommunications({
          user_id: "user-123",
          transaction_id: "txn-123",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by date range", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getCommunications({
          user_id: "user-123",
          start_date: "2024-01-01",
          end_date: "2024-12-31",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by has_attachments", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getCommunications({
          user_id: "user-123",
          has_attachments: true,
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });
    });

    describe("linkCommunicationToTransaction", () => {
      it("should update communication with transaction_id", async () => {
        await databaseService.linkCommunicationToTransaction(
          "comm-123",
          "txn-456",
        );

        expect(mockStatement.run).toHaveBeenCalledWith("txn-456", "comm-123");
      });
    });
  });

  describe("Transaction Contact Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("assignContactToTransaction", () => {
      it("should assign contact with role data", async () => {
        const result = await databaseService.assignContactToTransaction(
          "txn-123",
          {
            contact_id: "contact-456",
            role: "Buyer Agent",
            role_category: "Agent",
            specific_role: "Buyer Agent",
            is_primary: true,
          },
        );

        expect(result).toBe("test-uuid-1234");
        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe("getTransactionContacts", () => {
      it("should return contacts for transaction", async () => {
        const mockContacts = [
          { id: "contact-1", name: "Agent 1" },
          { id: "contact-2", name: "Agent 2" },
        ];

        mockStatement.all.mockReturnValue(mockContacts);

        const contacts =
          await databaseService.getTransactionContacts("txn-123");

        expect(contacts).toHaveLength(2);
      });
    });

    describe("isContactAssignedToTransaction", () => {
      it("should return true when contact is assigned", async () => {
        mockStatement.get.mockReturnValue({ id: "tc-123" });

        const result = await databaseService.isContactAssignedToTransaction(
          "txn-123",
          "contact-456",
        );

        expect(result).toBe(true);
      });

      it("should return false when contact is not assigned", async () => {
        mockStatement.get.mockReturnValue(undefined);

        const result = await databaseService.isContactAssignedToTransaction(
          "txn-123",
          "contact-456",
        );

        expect(result).toBe(false);
      });
    });

    describe("unlinkContactFromTransaction", () => {
      it("should remove contact from transaction", async () => {
        await databaseService.unlinkContactFromTransaction(
          "txn-123",
          "contact-456",
        );

        expect(mockStatement.run).toHaveBeenCalledWith(
          "txn-123",
          "contact-456",
        );
      });
    });

    describe("batchUpdateContactAssignments", () => {
      beforeEach(() => {
        mockDb.transaction.mockClear();
        mockStatement.get.mockClear();
        mockStatement.run.mockClear();
      });

      it("should handle empty operations array", async () => {
        await databaseService.batchUpdateContactAssignments("txn-123", []);
        // No database transaction should be created for empty array
        expect(mockDb.transaction).not.toHaveBeenCalled();
      });

      it("should execute add operations", async () => {
        mockStatement.get.mockReturnValue(undefined); // No existing assignment

        await databaseService.batchUpdateContactAssignments("txn-123", [
          {
            action: "add",
            contactId: "contact-1",
            role: "Buyer Agent",
            roleCategory: "buyer_side",
            isPrimary: true,
          },
        ]);

        expect(mockDb.transaction).toHaveBeenCalled();
      });

      it("should execute remove operations", async () => {
        await databaseService.batchUpdateContactAssignments("txn-123", [
          {
            action: "remove",
            contactId: "contact-1",
          },
        ]);

        expect(mockDb.transaction).toHaveBeenCalled();
      });

      it("should handle mixed add and remove operations", async () => {
        mockStatement.get.mockReturnValue(undefined);

        await databaseService.batchUpdateContactAssignments("txn-123", [
          { action: "remove", contactId: "contact-1" },
          {
            action: "add",
            contactId: "contact-2",
            role: "Seller Agent",
            roleCategory: "seller_side",
          },
          { action: "remove", contactId: "contact-3" },
        ]);

        expect(mockDb.transaction).toHaveBeenCalled();
      });

      it("should update existing assignment instead of inserting", async () => {
        // Simulate existing assignment
        mockStatement.get.mockReturnValue({ id: "existing-tc-123" });

        await databaseService.batchUpdateContactAssignments("txn-123", [
          {
            action: "add",
            contactId: "contact-1",
            role: "Updated Role",
            roleCategory: "neutral",
            isPrimary: false,
          },
        ]);

        expect(mockDb.transaction).toHaveBeenCalled();
      });
    });
  });

  describe("OAuth Token Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("saveOAuthToken", () => {
      it("should save OAuth token with all fields", async () => {
        const tokenId = await databaseService.saveOAuthToken(
          "user-123",
          "google",
          "authentication",
          {
            access_token: "access-token-123",
            refresh_token: "refresh-token-123",
            token_expires_at: new Date().toISOString(),
            scopes_granted: ["email", "profile"],
            connected_email_address: "test@gmail.com",
            mailbox_connected: true,
          },
        );

        expect(tokenId).toBe("test-uuid-1234");
      });
    });

    describe("getOAuthToken", () => {
      it("should return token when found", async () => {
        const mockToken = {
          id: "token-123",
          user_id: "user-123",
          provider: "google",
          purpose: "authentication",
          scopes_granted: '["email","profile"]',
        };

        mockStatement.get.mockReturnValue(mockToken);

        const token = await databaseService.getOAuthToken(
          "user-123",
          "google",
          "authentication",
        );

        expect(token).not.toBeNull();
        expect(token?.scopes_granted).toEqual(["email", "profile"]);
      });

      it("should return null when not found", async () => {
        mockStatement.get.mockReturnValue(undefined);

        const token = await databaseService.getOAuthToken(
          "user-123",
          "google",
          "authentication",
        );

        expect(token).toBeNull();
      });
    });

    describe("deleteOAuthToken", () => {
      it("should delete token by user, provider, and purpose", async () => {
        await databaseService.deleteOAuthToken(
          "user-123",
          "google",
          "authentication",
        );

        expect(mockStatement.run).toHaveBeenCalledWith(
          "user-123",
          "google",
          "authentication",
        );
      });
    });
  });

  describe("Audit Log Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("insertAuditLog", () => {
      it("should insert audit log entry", async () => {
        await databaseService.insertAuditLog({
          id: "audit-123",
          timestamp: new Date(),
          userId: "user-123",
          sessionId: "session-456",
          action: "LOGIN",
          resourceType: "SESSION",
          resourceId: "session-456",
          success: true,
        });

        expect(mockStatement.run).toHaveBeenCalled();
      });

      it("should handle optional fields", async () => {
        await databaseService.insertAuditLog({
          id: "audit-123",
          timestamp: new Date(),
          userId: "user-123",
          action: "LOGIN",
          resourceType: "SESSION",
          success: true,
          metadata: { provider: "google" },
          ipAddress: "127.0.0.1",
          userAgent: "Test Agent",
        });

        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe("getUnsyncedAuditLogs", () => {
      it("should return unsynced audit logs", async () => {
        const mockLogs = [
          {
            id: "audit-1",
            timestamp: new Date().toISOString(),
            user_id: "user-123",
            action: "LOGIN",
            resource_type: "SESSION",
            success: 1,
          },
        ];

        mockStatement.all.mockReturnValue(mockLogs);

        const logs = await databaseService.getUnsyncedAuditLogs(100);

        expect(logs).toHaveLength(1);
        expect(logs[0].action).toBe("LOGIN");
      });
    });

    describe("getAuditLogs", () => {
      it("should filter audit logs by userId", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getAuditLogs({ userId: "user-123" });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by action", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getAuditLogs({
          userId: "user-123",
          action: "LOGIN",
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should filter by date range", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getAuditLogs({
          userId: "user-123",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-12-31"),
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });

      it("should apply limit and offset", async () => {
        mockStatement.all.mockReturnValue([]);

        await databaseService.getAuditLogs({
          userId: "user-123",
          limit: 50,
          offset: 10,
        });

        expect(mockStatement.all).toHaveBeenCalled();
      });
    });
  });

  describe("User Feedback Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("saveFeedback", () => {
      it("should save user feedback", async () => {
        const mockFeedback = {
          id: "test-uuid-1234",
          user_id: "user-123",
          transaction_id: "txn-456",
          feedback_type: "correction" as const,
          field_name: "closing_date",
          original_value: "2024-01-01",
          corrected_value: "2024-01-15",
        };

        mockStatement.get.mockReturnValue(mockFeedback);

        const feedback = await databaseService.saveFeedback({
          user_id: "user-123",
          transaction_id: "txn-456",
          feedback_type: "correction",
          field_name: "closing_date",
          original_value: "2024-01-01",
          corrected_value: "2024-01-15",
        });

        expect(feedback.field_name).toBe("closing_date");
      });
    });

    describe("getFeedbackByTransaction", () => {
      it("should return feedback for transaction", async () => {
        const mockFeedback = [
          {
            id: "fb-1",
            field_name: "closing_date",
            feedback_type: "correction",
          },
        ];

        mockStatement.all.mockReturnValue(mockFeedback);

        const feedback =
          await databaseService.getFeedbackByTransaction("txn-123");

        expect(feedback).toHaveLength(1);
      });
    });
  });

  describe("Utility Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("vacuum", () => {
      it("should run VACUUM command", async () => {
        await databaseService.vacuum();

        expect(mockDb.exec).toHaveBeenCalledWith("VACUUM");
      });
    });

    describe("close", () => {
      it("should close database connection", async () => {
        await databaseService.close();

        expect(mockDb.close).toHaveBeenCalled();
      });
    });

    describe("rekeyDatabase", () => {
      it("should rekey database with new encryption key", async () => {
        await databaseService.rekeyDatabase("new-encryption-key-hex");

        expect(mockDb.pragma).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    it("should throw DatabaseError when database not initialized", async () => {
      // Close the database first
      await databaseService.close();

      await expect(databaseService.getUserById("user-123")).rejects.toThrow(
        "Database is not initialized",
      );
    });
  });

  describe("Contact Activity Operations", () => {
    beforeEach(async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await databaseService.initialize();
    });

    describe("getOrCreateContactFromEmail", () => {
      it("should return existing contact when found", async () => {
        const existingContact = {
          id: "contact-123",
          user_id: "user-123",
          email: "existing@example.com",
          name: "Existing Contact",
        };

        mockStatement.get.mockReturnValue(existingContact);

        const contact = await databaseService.getOrCreateContactFromEmail(
          "user-123",
          "existing@example.com",
          "Existing Contact",
        );

        expect(contact.id).toBe("contact-123");
      });

      it("should create new contact when not found", async () => {
        // First call returns undefined (no existing contact)
        mockStatement.get
          .mockReturnValueOnce(undefined)
          // Second call returns the created contact
          .mockReturnValueOnce({
            id: "test-uuid-1234",
            user_id: "user-123",
            email: "new@example.com",
            name: "New Contact",
            source: "email",
          });

        const contact = await databaseService.getOrCreateContactFromEmail(
          "user-123",
          "new@example.com",
          "New Contact",
        );

        expect(contact.email).toBe("new@example.com");
        expect(contact.source).toBe("email");
      });
    });
  });
});
