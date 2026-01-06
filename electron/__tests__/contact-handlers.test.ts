/**
 * Unit tests for Contact Handlers
 * Tests contact IPC handlers including:
 * - CRUD operations
 * - Contact import
 * - Activity-based sorting
 * - Delete protection
 */

import type { IpcMainInvokeEvent } from "electron";

// Mock electron module
const mockIpcHandle = jest.fn();

jest.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

// Mock services - inline factories since jest.mock is hoisted
jest.mock("../services/databaseService", () => ({
  __esModule: true,
  default: {
    getImportedContactsByUserId: jest.fn(),
    getUnimportedContactsByUserId: jest.fn(),
    getContactsSortedByActivity: jest.fn(),
    createContact: jest.fn(),
    updateContact: jest.fn(),
    getContactById: jest.fn(),
    deleteContact: jest.fn(),
    removeContact: jest.fn(),
    getTransactionsByContact: jest.fn(),
    markContactAsImported: jest.fn(),
  },
}));

jest.mock("../services/contactsService", () => ({
  __esModule: true,
  getContactNames: jest.fn(),
}));

jest.mock("../services/auditService", () => ({
  __esModule: true,
  default: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../services/logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import after mocks are set up
import { registerContactHandlers } from "../contact-handlers";
import databaseService from "../services/databaseService";
import { getContactNames } from "../services/contactsService";
import auditService from "../services/auditService";
import logService from "../services/logService";

// Get typed references to mocked services
const mockDatabaseService = databaseService as jest.Mocked<
  typeof databaseService
>;
const mockContactsService = {
  getContactNames: getContactNames as jest.MockedFunction<
    typeof getContactNames
  >,
};
const mockAuditService = auditService as jest.Mocked<typeof auditService>;
const mockLogService = logService as jest.Mocked<typeof logService>;

// Test UUIDs
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_CONTACT_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("Contact Handlers", () => {
  let registeredHandlers: Map<string, Function>;
  const mockEvent = {} as IpcMainInvokeEvent;

  beforeAll(() => {
    // Capture registered handlers
    registeredHandlers = new Map();
    mockIpcHandle.mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    // Register all handlers
    registerContactHandlers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("contacts:get-all", () => {
    it("should return all imported contacts for user", async () => {
      const mockContacts = [
        { id: "contact-1", name: "John Doe", email: "john@example.com" },
        { id: "contact-2", name: "Jane Smith", email: "jane@example.com" },
      ];
      mockDatabaseService.getImportedContactsByUserId.mockResolvedValue(
        mockContacts,
      );

      const handler = registeredHandlers.get("contacts:get-all");
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(2);
      expect(mockLogService.info).toHaveBeenCalledWith(
        "Getting all imported contacts",
        "Contacts",
        expect.any(Object),
      );
    });

    it("should handle invalid user ID", async () => {
      const handler = registeredHandlers.get("contacts:get-all");
      const result = await handler(mockEvent, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle database error", async () => {
      mockDatabaseService.getImportedContactsByUserId.mockRejectedValue(
        new Error("Database error"),
      );

      const handler = registeredHandlers.get("contacts:get-all");
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe("contacts:get-available", () => {
    it("should return available contacts for import", async () => {
      // Mock unimported DB contacts (empty for this test)
      mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([]);
      // Mock macOS contacts app
      mockContactsService.getContactNames.mockResolvedValue({
        phoneToContactInfo: {
          "555-1234": {
            name: "John Doe",
            phones: ["555-1234"],
            emails: ["john@example.com"],
          },
          "555-5678": {
            name: "Jane Smith",
            phones: ["555-5678"],
            emails: ["jane@example.com"],
          },
        },
        status: "loaded",
      });
      mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

      const handler = registeredHandlers.get("contacts:get-available");
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(2);
      expect(result.contactsStatus).toBe("loaded");
    });

    it("should filter out already imported contacts", async () => {
      // Mock unimported DB contacts (empty for this test)
      mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([]);
      // Mock macOS contacts app
      mockContactsService.getContactNames.mockResolvedValue({
        phoneToContactInfo: {
          "555-1234": {
            name: "John Doe",
            phones: ["555-1234"],
            emails: ["john@example.com"],
          },
          "555-5678": {
            name: "Jane Smith",
            phones: ["555-5678"],
            emails: ["jane@example.com"],
          },
        },
        status: "loaded",
      });
      mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([
        { name: "John Doe", email: "john@example.com" },
      ]);

      const handler = registeredHandlers.get("contacts:get-available");
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].name).toBe("Jane Smith");
    });

    it("should handle invalid user ID", async () => {
      const handler = registeredHandlers.get("contacts:get-available");
      const result = await handler(mockEvent, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle contacts service error", async () => {
      // Mock unimported DB contacts (empty for this test)
      mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([]);
      mockContactsService.getContactNames.mockRejectedValue(
        new Error("Contacts access denied"),
      );

      const handler = registeredHandlers.get("contacts:get-available");
      const result = await handler(mockEvent, TEST_USER_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Contacts access denied");
    });

    // TASK-982: Deduplication tests
    describe("deduplication by email", () => {
      it("should dedupe contacts with same email from iPhone sync and macOS Contacts", async () => {
        // Same contact exists in both sources with same email
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          {
            id: "db-1",
            name: "John Doe",
            email: "john@example.com",
            phone: "555-1234",
          },
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "555-9999": {
              name: "John D.", // Slightly different name
              phones: ["555-9999"],
              emails: ["john@example.com"], // Same email
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        // Should only have 1 contact (iPhone-synced takes precedence)
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].id).toBe("db-1"); // DB contact wins
        expect(result.contacts[0].isFromDatabase).toBe(true);
      });

      it("should be case-insensitive when deduping by email", async () => {
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          {
            id: "db-1",
            name: "John Doe",
            email: "John@Example.COM",
            phone: "555-1234",
          },
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "555-9999": {
              name: "John D.",
              phones: ["555-9999"],
              emails: ["john@example.com"], // Same email, different case
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.contacts).toHaveLength(1);
      });
    });

    describe("deduplication by phone", () => {
      it("should dedupe contacts with same phone number (different formats)", async () => {
        // iPhone sync has one format, macOS Contacts has another
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          {
            id: "db-1",
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "+15551234567",
          },
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "(555) 123-4567": {
              name: "Jane S.", // Slightly different name
              phones: ["(555) 123-4567"], // Same phone, different format
              emails: ["janes@other.com"], // Different email
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        // Should only have 1 contact (iPhone-synced takes precedence)
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].id).toBe("db-1");
      });

      it("should handle phone numbers with and without country code", async () => {
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          { id: "db-1", name: "Bob Jones", phone: "5559876543" }, // No country code
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "+1 555 987 6543": {
              name: "Robert Jones",
              phones: ["+1 555 987 6543"], // With country code
              emails: [],
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].id).toBe("db-1");
      });
    });

    describe("deduplication by name (fallback)", () => {
      it("should dedupe contacts with same name when no email or phone overlap", async () => {
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          { id: "db-1", name: "Alice Brown" }, // No email or phone
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "555-0000": {
              name: "Alice Brown", // Same name
              phones: ["555-0000"],
              emails: ["alice@work.com"],
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.contacts).toHaveLength(1);
        expect(result.contacts[0].id).toBe("db-1");
      });

      it("should be case-insensitive when deduping by name", async () => {
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          { id: "db-1", name: "CHARLIE DAVIS" },
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "555-1111": {
              name: "charlie davis", // Same name, different case
              phones: ["555-1111"],
              emails: [],
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.contacts).toHaveLength(1);
      });
    });

    describe("iPhone-synced contacts take precedence", () => {
      it("should prefer iPhone-synced contacts over macOS Contacts app", async () => {
        // Same person in both sources
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          {
            id: "db-real-id",
            name: "Priority Contact",
            email: "priority@example.com",
            phone: "555-2222",
            company: "iPhone Company",
          },
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "555-2222": {
              name: "Priority Contact",
              phones: ["555-2222"],
              emails: ["priority@example.com"],
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.contacts).toHaveLength(1);
        // Should have the real DB ID from iPhone sync
        expect(result.contacts[0].id).toBe("db-real-id");
        expect(result.contacts[0].isFromDatabase).toBe(true);
        expect(result.contacts[0].company).toBe("iPhone Company");
      });
    });

    describe("no false positives in deduplication", () => {
      it("should not dedupe contacts with different identifiers", async () => {
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([
          {
            id: "db-1",
            name: "Person One",
            email: "one@example.com",
            phone: "555-1111",
          },
        ]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "555-2222": {
              name: "Person Two", // Different name
              phones: ["555-2222"], // Different phone
              emails: ["two@example.com"], // Different email
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        // Should have both contacts (no deduplication)
        expect(result.contacts).toHaveLength(2);
      });
    });

    describe("already imported contacts filtered by phone", () => {
      it("should filter out macOS contacts if phone matches already imported", async () => {
        mockDatabaseService.getUnimportedContactsByUserId.mockResolvedValue([]);
        mockContactsService.getContactNames.mockResolvedValue({
          phoneToContactInfo: {
            "(555) 333-4444": {
              name: "Already Imported Person",
              phones: ["(555) 333-4444"],
              emails: ["different@email.com"],
            },
          },
          status: "loaded",
        });
        mockDatabaseService.getImportedContactsByUserId.mockResolvedValue([
          {
            name: "Other Name",
            email: "other@email.com",
            phone: "+15553334444",
          }, // Same phone normalized
        ]);

        const handler = registeredHandlers.get("contacts:get-available");
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        // Should be empty - phone matches already imported contact
        expect(result.contacts).toHaveLength(0);
      });
    });
  });

  describe("contacts:import", () => {
    const contactsToImport = [
      { name: "John Doe", email: "john@example.com", phone: "555-1234" },
      { name: "Jane Smith", email: "jane@example.com", phone: "555-5678" },
    ];

    it("should import contacts successfully", async () => {
      mockDatabaseService.createContact.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (data: any) => ({
          id: `contact-${data.name}`,
          ...data,
        }),
      );

      const handler = registeredHandlers.get("contacts:import");
      const result = await handler(mockEvent, TEST_USER_ID, contactsToImport);

      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(2);
      expect(mockDatabaseService.createContact).toHaveBeenCalledTimes(2);
    });

    it("should handle invalid user ID", async () => {
      const handler = registeredHandlers.get("contacts:import");
      const result = await handler(mockEvent, "", contactsToImport);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle empty contacts array", async () => {
      const handler = registeredHandlers.get("contacts:import");
      const result = await handler(mockEvent, TEST_USER_ID, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle non-array contacts", async () => {
      const handler = registeredHandlers.get("contacts:import");
      const result = await handler(mockEvent, TEST_USER_ID, "not-an-array");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should reject more than 1000 contacts", async () => {
      const manyContacts = Array(1001).fill({
        name: "Test",
        email: "test@example.com",
      });

      const handler = registeredHandlers.get("contacts:import");
      const result = await handler(mockEvent, TEST_USER_ID, manyContacts);

      expect(result.success).toBe(false);
      expect(result.error).toContain("1000");
    });

    it("should handle import failure", async () => {
      mockDatabaseService.createContact.mockRejectedValue(
        new Error("Import failed"),
      );

      const handler = registeredHandlers.get("contacts:import");
      const result = await handler(mockEvent, TEST_USER_ID, contactsToImport);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Import failed");
    });
  });

  describe("contacts:get-sorted-by-activity", () => {
    it("should return contacts sorted by activity", async () => {
      const sortedContacts = [
        { id: "contact-1", name: "Active John", lastActivity: new Date() },
        {
          id: "contact-2",
          name: "Less Active Jane",
          lastActivity: new Date(Date.now() - 86400000),
        },
      ];
      mockDatabaseService.getContactsSortedByActivity.mockResolvedValue(
        sortedContacts,
      );

      const handler = registeredHandlers.get("contacts:get-sorted-by-activity");
      const result = await handler(mockEvent, TEST_USER_ID, "123 Main St");

      expect(result.success).toBe(true);
      expect(result.contacts).toHaveLength(2);
      expect(
        mockDatabaseService.getContactsSortedByActivity,
      ).toHaveBeenCalledWith(TEST_USER_ID, "123 Main St");
    });

    it("should work without property address", async () => {
      mockDatabaseService.getContactsSortedByActivity.mockResolvedValue([]);

      const handler = registeredHandlers.get("contacts:get-sorted-by-activity");
      const result = await handler(mockEvent, TEST_USER_ID, null);

      expect(result.success).toBe(true);
      expect(
        mockDatabaseService.getContactsSortedByActivity,
      ).toHaveBeenCalledWith(TEST_USER_ID, undefined);
    });

    it("should handle invalid user ID", async () => {
      const handler = registeredHandlers.get("contacts:get-sorted-by-activity");
      const result = await handler(mockEvent, "", null);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });
  });

  describe("contacts:create", () => {
    const validContactData = {
      name: "New Contact",
      email: "new@example.com",
      phone: "555-9999",
    };

    it("should create contact successfully", async () => {
      const createdContact = { id: "contact-new", ...validContactData };
      mockDatabaseService.createContact.mockResolvedValue(createdContact);

      const handler = registeredHandlers.get("contacts:create");
      const result = await handler(mockEvent, TEST_USER_ID, validContactData);

      expect(result.success).toBe(true);
      expect(result.contact).toEqual(createdContact);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONTACT_CREATE",
          success: true,
        }),
      );
    });

    it("should handle invalid user ID", async () => {
      const handler = registeredHandlers.get("contacts:create");
      const result = await handler(mockEvent, "", validContactData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle creation failure", async () => {
      mockDatabaseService.createContact.mockRejectedValue(
        new Error("Creation failed"),
      );

      const handler = registeredHandlers.get("contacts:create");
      const result = await handler(mockEvent, TEST_USER_ID, validContactData);

      expect(result.success).toBe(false);
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe("contacts:update", () => {
    const existingContact = {
      id: TEST_CONTACT_ID,
      user_id: TEST_USER_ID,
      name: "Old Name",
      email: "old@example.com",
    };

    it("should update contact successfully", async () => {
      mockDatabaseService.getContactById.mockResolvedValue(existingContact);
      mockDatabaseService.updateContact.mockResolvedValue(undefined);

      const handler = registeredHandlers.get("contacts:update");
      const result = await handler(mockEvent, TEST_CONTACT_ID, {
        name: "New Name",
      });

      expect(result.success).toBe(true);
      expect(mockDatabaseService.updateContact).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONTACT_UPDATE",
          success: true,
        }),
      );
    });

    it("should handle invalid contact ID", async () => {
      const handler = registeredHandlers.get("contacts:update");
      const result = await handler(mockEvent, "", { name: "New Name" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle update failure", async () => {
      mockDatabaseService.getContactById.mockResolvedValue(existingContact);
      mockDatabaseService.updateContact.mockRejectedValue(
        new Error("Update failed"),
      );

      const handler = registeredHandlers.get("contacts:update");
      const result = await handler(mockEvent, TEST_CONTACT_ID, {
        name: "New Name",
      });

      expect(result.success).toBe(false);
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe("contacts:checkCanDelete", () => {
    it("should return true when contact has no transactions", async () => {
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([]);

      const handler = registeredHandlers.get("contacts:checkCanDelete");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(true);
      expect(result.canDelete).toBe(true);
      expect(result.count).toBe(0);
    });

    it("should return false when contact has transactions", async () => {
      const transactions = [
        { id: "txn-1", property_address: "123 Main St" },
        { id: "txn-2", property_address: "456 Oak Ave" },
      ];
      mockDatabaseService.getTransactionsByContact.mockResolvedValue(
        transactions,
      );

      const handler = registeredHandlers.get("contacts:checkCanDelete");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(true);
      expect(result.canDelete).toBe(false);
      expect(result.transactions).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it("should handle invalid contact ID", async () => {
      const handler = registeredHandlers.get("contacts:checkCanDelete");
      const result = await handler(mockEvent, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });
  });

  describe("contacts:delete", () => {
    const existingContact = {
      id: TEST_CONTACT_ID,
      user_id: TEST_USER_ID,
      name: "John Doe",
    };

    it("should delete contact successfully when no transactions", async () => {
      mockDatabaseService.getContactById.mockResolvedValue(existingContact);
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([]);
      mockDatabaseService.deleteContact.mockResolvedValue(undefined);

      const handler = registeredHandlers.get("contacts:delete");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONTACT_DELETE",
          success: true,
        }),
      );
    });

    it("should prevent deletion when contact has transactions", async () => {
      mockDatabaseService.getContactById.mockResolvedValue(existingContact);
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([
        { id: "txn-1" },
      ]);

      const handler = registeredHandlers.get("contacts:delete");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(false);
      expect(result.canDelete).toBe(false);
      expect(result.error).toContain("associated transactions");
    });

    it("should handle invalid contact ID", async () => {
      const handler = registeredHandlers.get("contacts:delete");
      const result = await handler(mockEvent, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle deletion failure", async () => {
      mockDatabaseService.getContactById.mockResolvedValue(existingContact);
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([]);
      mockDatabaseService.deleteContact.mockRejectedValue(
        new Error("Delete failed"),
      );

      const handler = registeredHandlers.get("contacts:delete");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(false);
      expect(mockLogService.error).toHaveBeenCalled();
    });
  });

  describe("contacts:remove", () => {
    it("should remove contact from local database successfully", async () => {
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([]);
      mockDatabaseService.removeContact.mockResolvedValue(undefined);

      const handler = registeredHandlers.get("contacts:remove");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(true);
      expect(mockDatabaseService.removeContact).toHaveBeenCalledWith(
        TEST_CONTACT_ID,
      );
    });

    it("should prevent removal when contact has transactions", async () => {
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([
        { id: "txn-1" },
      ]);

      const handler = registeredHandlers.get("contacts:remove");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(false);
      expect(result.canDelete).toBe(false);
      expect(result.error).toContain("associated transactions");
    });

    it("should handle invalid contact ID", async () => {
      const handler = registeredHandlers.get("contacts:remove");
      const result = await handler(mockEvent, "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should handle removal failure", async () => {
      mockDatabaseService.getTransactionsByContact.mockResolvedValue([]);
      mockDatabaseService.removeContact.mockRejectedValue(
        new Error("Removal failed"),
      );

      const handler = registeredHandlers.get("contacts:remove");
      const result = await handler(mockEvent, TEST_CONTACT_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Removal failed");
    });
  });
});
