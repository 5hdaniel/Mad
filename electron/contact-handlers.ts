// ============================================
// CONTACT IPC HANDLERS
// This file contains contact handlers to be registered in main.js
// ============================================

import { ipcMain, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { randomUUID } from "crypto";
import databaseService from "./services/databaseService";
import { getContactNames } from "./services/contactsService";
import auditService from "./services/auditService";
import logService from "./services/logService";
import type { Contact, Transaction } from "./types/models";

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  validateContactId,
  validateContactData,
  validateString,
  sanitizeObject,
} from "./utils/validation";
import { normalizePhoneNumber } from "./utils/phoneNormalization";

// Type definitions
interface ContactResponse {
  success: boolean;
  error?: string;
  contact?: Contact;
  contacts?: Contact[];
  contactsStatus?: unknown;
  canDelete?: boolean;
  transactions?: Transaction[] | any[]; // Can be Transaction[] or TransactionWithRoles[]
  count?: number;
  transactionCount?: number;
}

/** Reference to mainWindow for emitting progress events */
let _mainWindow: BrowserWindow | null = null;

/**
 * Register all contact-related IPC handlers
 * @param mainWindow - The main browser window for emitting progress events
 */
export function registerContactHandlers(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow;
  // Get all imported contacts for a user (local database only)
  ipcMain.handle(
    "contacts:get-all",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<ContactResponse> => {
      try {
        logService.info("Getting all imported contacts", "Contacts", {
          userId,
        });

        // Validate input
        const validatedUserId = validateUserId(userId); // Validated, will throw if invalid
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        // Get only imported contacts from database
        const importedContacts =
          await databaseService.getImportedContactsByUserId(validatedUserId);

        logService.info(
          `Found ${importedContacts.length} imported contacts`,
          "Contacts",
          { userId },
        );

        return {
          success: true,
          contacts: importedContacts,
        };
      } catch (error) {
        logService.error("Get contacts failed", "Contacts", {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get available contacts for import (from external sources + unimported DB contacts)
  ipcMain.handle(
    "contacts:get-available",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<ContactResponse> => {
      try {
        logService.info(
          "[Main] Getting available contacts for import",
          "Contacts",
          { userId },
        );

        // Validate input
        const validatedUserId = validateUserId(userId); // Validated, will throw if invalid
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        // Get contacts from macOS Contacts app
        const { phoneToContactInfo, status } = await getContactNames();

        // Get already imported contact names/emails to filter them out
        const importedContacts =
          await databaseService.getImportedContactsByUserId(validatedUserId);
        const importedNames = new Set(
          importedContacts.map((c) => c.name?.toLowerCase()),
        );
        const importedEmails = new Set(
          importedContacts.map((c) => c.email?.toLowerCase()).filter(Boolean),
        );

        // Build a set of normalized phones from imported contacts
        const importedPhones = new Set<string>();
        for (const ic of importedContacts) {
          if (ic.phone) {
            const normalized = normalizePhoneNumber(ic.phone);
            if (normalized && normalized !== "+") {
              importedPhones.add(normalized);
            }
          }
        }

        // Convert Contacts app data to contact objects
        const availableContacts: any[] = [];

        // Deduplication sets for name, email, and phone
        const seenNames = new Set<string>();
        const seenEmails = new Set<string>();
        const seenPhones = new Set<string>();

        /**
         * Check if a contact is a duplicate based on name, email, or phone.
         * Returns true if any identifier matches an already-seen contact.
         */
        function isDuplicate(contact: {
          name?: string | null;
          display_name?: string | null;
          email?: string | null;
          emails?: string[];
          phone?: string | null;
          phones?: string[];
        }): boolean {
          // Check email duplicates
          const email = contact.email?.toLowerCase();
          if (email && seenEmails.has(email)) return true;

          // Check all emails if available
          if (contact.emails) {
            for (const e of contact.emails) {
              if (e && seenEmails.has(e.toLowerCase())) return true;
            }
          }

          // Check phone duplicates (normalized)
          const phone = contact.phone;
          if (phone) {
            const normalizedPhone = normalizePhoneNumber(phone);
            if (
              normalizedPhone &&
              normalizedPhone !== "+" &&
              seenPhones.has(normalizedPhone)
            )
              return true;
          }

          // Check all phones if available
          if (contact.phones) {
            for (const p of contact.phones) {
              if (p) {
                const normalizedPhone = normalizePhoneNumber(p);
                if (
                  normalizedPhone &&
                  normalizedPhone !== "+" &&
                  seenPhones.has(normalizedPhone)
                )
                  return true;
              }
            }
          }

          // Check name duplicates (fallback)
          const nameLower = (
            contact.name || contact.display_name
          )?.toLowerCase();
          if (nameLower && seenNames.has(nameLower)) return true;

          return false;
        }

        /**
         * Mark a contact's identifiers as seen for deduplication.
         */
        function markAsSeen(contact: {
          name?: string | null;
          display_name?: string | null;
          email?: string | null;
          emails?: string[];
          phone?: string | null;
          phones?: string[];
        }): void {
          // Add name
          const nameLower = (
            contact.name || contact.display_name
          )?.toLowerCase();
          if (nameLower) seenNames.add(nameLower);

          // Add email
          const email = contact.email?.toLowerCase();
          if (email) seenEmails.add(email);

          // Add all emails if available
          if (contact.emails) {
            for (const e of contact.emails) {
              if (e) seenEmails.add(e.toLowerCase());
            }
          }

          // Add phone (normalized)
          if (contact.phone) {
            const normalizedPhone = normalizePhoneNumber(contact.phone);
            if (normalizedPhone && normalizedPhone !== "+")
              seenPhones.add(normalizedPhone);
          }

          // Add all phones if available
          if (contact.phones) {
            for (const p of contact.phones) {
              if (p) {
                const normalizedPhone = normalizePhoneNumber(p);
                if (normalizedPhone && normalizedPhone !== "+")
                  seenPhones.add(normalizedPhone);
              }
            }
          }
        }

        // STEP 1: Get unimported contacts from database (iPhone synced contacts)
        // These take precedence because they have real DB IDs
        const unimportedDbContacts =
          await databaseService.getUnimportedContactsByUserId(validatedUserId);

        logService.info(
          `[Main] Found ${unimportedDbContacts.length} unimported contacts from database (iPhone sync)`,
          "Contacts",
        );

        for (const dbContact of unimportedDbContacts) {
          // Skip if this is a duplicate (by email, phone, or name)
          if (isDuplicate(dbContact)) {
            continue;
          }

          // Mark this contact's identifiers as seen
          markAsSeen(dbContact);

          availableContacts.push({
            id: dbContact.id, // Use actual DB ID so we can mark as imported
            name: dbContact.name || dbContact.display_name,
            phone: dbContact.phone || null,
            email: dbContact.email || null,
            company: dbContact.company || null,
            source: dbContact.source || "contacts_app",
            isFromDatabase: true, // Flag to distinguish from macOS Contacts app
          });
        }

        // STEP 2: Add contacts from macOS Contacts app (if not already in list)
        if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
          for (const [_phone, contactInfo] of Object.entries(
            phoneToContactInfo,
          )) {
            const nameLower = contactInfo.name?.toLowerCase();
            const primaryEmail = contactInfo.emails?.[0]?.toLowerCase();

            // Skip if already imported (by name or email)
            if (
              importedNames.has(nameLower) ||
              (primaryEmail && importedEmails.has(primaryEmail))
            ) {
              continue;
            }

            // Check if already imported by phone
            if (contactInfo.phones) {
              let phoneAlreadyImported = false;
              for (const phone of contactInfo.phones) {
                const normalized = normalizePhoneNumber(phone);
                if (
                  normalized &&
                  normalized !== "+" &&
                  importedPhones.has(normalized)
                ) {
                  phoneAlreadyImported = true;
                  break;
                }
              }
              if (phoneAlreadyImported) continue;
            }

            // Create a temp object for deduplication check
            const macOsContact = {
              name: contactInfo.name,
              email: contactInfo.emails?.[0] || null,
              emails: contactInfo.emails,
              phone: contactInfo.phones?.[0] || null,
              phones: contactInfo.phones,
            };

            // Skip if already added from iPhone-synced contacts (by email, phone, or name)
            if (isDuplicate(macOsContact)) {
              continue;
            }

            // Mark this contact's identifiers as seen
            markAsSeen(macOsContact);

            availableContacts.push({
              id: `contacts-app-${randomUUID()}`, // Unique ID for UI (names aren't unique)
              name: contactInfo.name,
              phone: contactInfo.phones?.[0] || null, // Primary phone
              email: contactInfo.emails?.[0] || null, // Primary email
              source: "contacts_app",
              allPhones: contactInfo.phones || [],
              allEmails: contactInfo.emails || [],
              isFromDatabase: false,
            });
          }
        }

        logService.info(
          `[Main] Found ${availableContacts.length} total available contacts for import`,
          "Contacts",
        );

        return {
          success: true,
          contacts: availableContacts,
          contactsStatus: status, // Include loading status
        };
      } catch (error) {
        logService.error("[Main] Get available contacts failed:", "Contacts", {
          error,
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Import contacts from external sources
  ipcMain.handle(
    "contacts:import",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      contactsToImport: unknown[],
    ): Promise<ContactResponse> => {
      try {
        logService.info("[Main] Importing contacts", "Contacts", {
          userId,
          count: contactsToImport.length,
        });

        // Validate inputs
        const validatedUserId = validateUserId(userId); // Validated, will throw if invalid
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        // Validate contacts array
        if (!Array.isArray(contactsToImport)) {
          throw new ValidationError(
            "Contacts to import must be an array",
            "contactsToImport",
          );
        }

        if (contactsToImport.length === 0) {
          throw new ValidationError(
            "No contacts provided for import",
            "contactsToImport",
          );
        }

        if (contactsToImport.length > 5000) {
          throw new ValidationError(
            "Cannot import more than 5000 contacts at once",
            "contactsToImport",
          );
        }

        const importedContacts: Contact[] = [];
        const total = contactsToImport.length;

        // Separate contacts into two groups
        const existingDbContacts: { id: string; contact: any }[] = [];
        const newContactsToCreate: any[] = [];

        for (const contact of contactsToImport) {
          const sanitizedContact = sanitizeObject(contact) as any;
          const validatedData = validateContactData(sanitizedContact, false);

          if (
            sanitizedContact.isFromDatabase &&
            sanitizedContact.id &&
            !sanitizedContact.id.startsWith("contacts-app-")
          ) {
            existingDbContacts.push({ id: sanitizedContact.id, contact: sanitizedContact });
          } else {
            newContactsToCreate.push({
              user_id: validatedUserId,
              display_name: validatedData.name || "Unknown",
              email: validatedData.email ?? undefined,
              phone: validatedData.phone ?? undefined,
              company: validatedData.company ?? undefined,
              title: validatedData.title ?? undefined,
              source: sanitizedContact.source || "contacts_app",
              is_imported: true,
              allPhones: sanitizedContact.allPhones || [],
              allEmails: sanitizedContact.allEmails || [],
            });
          }
        }

        let processed = 0;

        // Mark existing DB contacts as imported
        for (const { id } of existingDbContacts) {
          await databaseService.markContactAsImported(id);
          const updatedContact = await databaseService.getContactById(id);
          if (updatedContact) {
            importedContacts.push(updatedContact);
          }
          processed++;
          if (_mainWindow && !_mainWindow.isDestroyed()) {
            _mainWindow.webContents.send("contacts:import-progress", {
              current: processed,
              total,
              percent: Math.round((processed / total) * 100),
            });
          }
        }

        // Batch create new contacts (much faster with transaction)
        if (newContactsToCreate.length > 0) {
          logService.info(
            `[Main] Batch importing ${newContactsToCreate.length} new contacts...`,
            "Contacts"
          );

          const createdIds = databaseService.createContactsBatch(
            newContactsToCreate,
            (current, _batchTotal) => {
              const overallCurrent = existingDbContacts.length + current;
              if (_mainWindow && !_mainWindow.isDestroyed()) {
                _mainWindow.webContents.send("contacts:import-progress", {
                  current: overallCurrent,
                  total,
                  percent: Math.round((overallCurrent / total) * 100),
                });
              }
            }
          );

          // Fetch created contacts
          for (const id of createdIds) {
            const contact = await databaseService.getContactById(id);
            if (contact) {
              importedContacts.push(contact);
            }
          }
        }

        logService.info(
          `[Main] Successfully imported ${importedContacts.length} contacts`,
          "Contacts",
        );

        return {
          success: true,
          contacts: importedContacts,
        };
      } catch (error) {
        logService.error("[Main] Import contacts failed:", "Contacts", {
          error,
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get contacts sorted by recent activity and address relevance
  ipcMain.handle(
    "contacts:get-sorted-by-activity",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      propertyAddress: string | null = null,
    ): Promise<ContactResponse> => {
      try {
        logService.info(
          "[Main] Getting contacts sorted by activity",
          "Contacts",
          { userId, propertyAddress },
        );

        // Validate inputs
        const validatedUserId = validateUserId(userId); // Validated, will throw if invalid
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }

        // Validate propertyAddress (optional)
        const validatedAddress = propertyAddress
          ? validateString(propertyAddress, "propertyAddress", {
              required: false,
              maxLength: 500,
            })
          : undefined;

        // Get only imported contacts sorted by activity
        const importedContacts =
          await databaseService.getContactsSortedByActivity(
            validatedUserId,
            validatedAddress ?? undefined,
          );

        logService.info(
          `[Main] Returning ${importedContacts.length} imported contacts sorted by activity`,
          "Contacts",
        );

        return {
          success: true,
          contacts: importedContacts,
        };
      } catch (error) {
        logService.error("[Main] Get sorted contacts failed:", "Contacts", {
          error,
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Create new contact
  ipcMain.handle(
    "contacts:create",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      contactData: unknown,
    ): Promise<ContactResponse> => {
      try {
        // Validate inputs
        const validatedUserId = validateUserId(userId); // Validated, will throw if invalid
        if (!validatedUserId) {
          throw new ValidationError("User ID validation failed", "userId");
        }
        const validatedData = validateContactData(contactData, false);

        const contact = await databaseService.createContact({
          user_id: validatedUserId,
          display_name: validatedData.name || "Unknown",
          email: validatedData.email ?? undefined,
          phone: validatedData.phone ?? undefined,
          company: validatedData.company ?? undefined,
          title: validatedData.title ?? undefined,
          source: "manual",
          is_imported: false,
        });

        // Audit log contact creation
        await auditService.log({
          userId: validatedUserId,
          action: "CONTACT_CREATE",
          resourceType: "CONTACT",
          resourceId: contact.id,
          metadata: { name: contact.name },
          success: true,
        });

        logService.info("Contact created", "Contacts", {
          userId: validatedUserId,
          contactId: contact.id,
        });

        return {
          success: true,
          contact,
        };
      } catch (error) {
        logService.error("Create contact failed", "Contacts", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Update contact
  ipcMain.handle(
    "contacts:update",
    async (
      event: IpcMainInvokeEvent,
      contactId: string,
      updates: unknown,
    ): Promise<ContactResponse> => {
      try {
        // Validate inputs
        const validatedContactId = validateContactId(contactId); // Validated, will throw if invalid
        if (!validatedContactId) {
          throw new ValidationError(
            "Contact ID validation failed",
            "contactId",
          );
        }
        const validatedUpdates = validateContactData(
          sanitizeObject(updates || {}),
          true,
        );

        // Get contact before update for audit logging
        const existingContact =
          await databaseService.getContactById(validatedContactId);
        const userId = existingContact?.user_id || "unknown";

        // Convert null to undefined for TypeScript strict mode
        const updatesData = {
          ...validatedUpdates,
          name: validatedUpdates.name ?? undefined,
          email: validatedUpdates.email ?? undefined,
          phone: validatedUpdates.phone ?? undefined,
          company: validatedUpdates.company ?? undefined,
          title: validatedUpdates.title ?? undefined,
        };

        await databaseService.updateContact(validatedContactId, updatesData);
        const contact =
          await databaseService.getContactById(validatedContactId);

        // Audit log contact update
        await auditService.log({
          userId,
          action: "CONTACT_UPDATE",
          resourceType: "CONTACT",
          resourceId: validatedContactId,
          metadata: { updatedFields: Object.keys(validatedUpdates) },
          success: true,
        });

        logService.info("Contact updated", "Contacts", {
          userId,
          contactId: validatedContactId,
        });

        return {
          success: true,
          contact: contact || undefined,
        };
      } catch (error) {
        logService.error("Update contact failed", "Contacts", {
          contactId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Check if contact can be deleted (get associated transactions)
  ipcMain.handle(
    "contacts:checkCanDelete",
    async (
      event: IpcMainInvokeEvent,
      contactId: string,
    ): Promise<ContactResponse> => {
      try {
        logService.info(
          "[Main] Checking if contact can be deleted",
          "Contacts",
          { contactId },
        );

        // Validate input
        const validatedContactId = validateContactId(contactId); // Validated, will throw if invalid
        if (!validatedContactId) {
          throw new ValidationError(
            "Contact ID validation failed",
            "contactId",
          );
        }

        const transactions =
          await databaseService.getTransactionsByContact(validatedContactId);

        return {
          success: true,
          canDelete: transactions.length === 0,
          transactions: transactions,
          count: transactions.length,
        };
      } catch (error) {
        logService.error(
          "[Main] Check can delete contact failed:",
          "Contacts",
          { contactId, error },
        );
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Delete contact
  ipcMain.handle(
    "contacts:delete",
    async (
      event: IpcMainInvokeEvent,
      contactId: string,
    ): Promise<ContactResponse> => {
      try {
        // Validate input
        const validatedContactId = validateContactId(contactId); // Validated, will throw if invalid
        if (!validatedContactId) {
          throw new ValidationError(
            "Contact ID validation failed",
            "contactId",
          );
        }

        // Get contact before delete for audit logging
        const existingContact =
          await databaseService.getContactById(validatedContactId);
        const userId = existingContact?.user_id || "unknown";
        const contactName = existingContact?.name || "unknown";

        // Check if contact has associated transactions
        const check =
          await databaseService.getTransactionsByContact(validatedContactId);
        if (check.length > 0) {
          return {
            success: false,
            error: "Cannot delete contact with associated transactions",
            canDelete: false,
            transactions: check,
            count: check.length,
          };
        }

        await databaseService.deleteContact(validatedContactId);

        // Audit log contact deletion
        await auditService.log({
          userId,
          action: "CONTACT_DELETE",
          resourceType: "CONTACT",
          resourceId: validatedContactId,
          metadata: { name: contactName },
          success: true,
        });

        logService.info("Contact deleted", "Contacts", {
          userId,
          contactId: validatedContactId,
        });

        return {
          success: true,
        };
      } catch (error) {
        logService.error("Delete contact failed", "Contacts", {
          contactId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Remove contact from local database (un-import)
  ipcMain.handle(
    "contacts:remove",
    async (
      event: IpcMainInvokeEvent,
      contactId: string,
    ): Promise<ContactResponse> => {
      try {
        logService.info(
          "[Main] Removing contact from local database",
          "Contacts",
          { contactId },
        );

        // Validate input
        const validatedContactId = validateContactId(contactId); // Validated, will throw if invalid
        if (!validatedContactId) {
          throw new ValidationError(
            "Contact ID validation failed",
            "contactId",
          );
        }

        // Check if contact has associated transactions
        const check =
          await databaseService.getTransactionsByContact(validatedContactId);
        if (check.length > 0) {
          return {
            success: false,
            error: "Cannot remove contact with associated transactions",
            canDelete: false,
            transactions: check,
            count: check.length,
          };
        }

        await databaseService.removeContact(validatedContactId);

        return {
          success: true,
        };
      } catch (error) {
        logService.error("[Main] Remove contact failed:", "Contacts", {
          contactId,
          error,
        });
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Look up contact names by phone numbers (batch)
  ipcMain.handle(
    "contacts:get-names-by-phones",
    async (
      _event: IpcMainInvokeEvent,
      phones: string[],
    ): Promise<{ success: boolean; names: Record<string, string>; error?: string }> => {
      try {
        if (!Array.isArray(phones)) {
          return { success: false, names: {}, error: "phones must be an array" };
        }

        const namesMap = await databaseService.getContactNamesByPhones(phones);

        // Convert Map to plain object for IPC
        const names: Record<string, string> = {};
        namesMap.forEach((name, phone) => {
          names[phone] = name;
        });

        return { success: true, names };
      } catch (error) {
        logService.error("Get contact names by phones failed", "Contacts", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return {
          success: false,
          names: {},
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );
}
