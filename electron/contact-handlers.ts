// ============================================
// CONTACT IPC HANDLERS
// This file contains contact handlers to be registered in main.js
// ============================================

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import databaseService from './services/databaseService';
import { getContactNames } from './services/contactsService';
import type { Contact, Transaction } from './types/models';

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  validateContactId,
  validateContactData,
  validateString,
  sanitizeObject,
} from './utils/validation';

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

/**
 * Register all contact-related IPC handlers
 */
export function registerContactHandlers(): void {
  // Get all imported contacts for a user (local database only)
  ipcMain.handle('contacts:get-all', async (event: IpcMainInvokeEvent, userId: string): Promise<ContactResponse> => {
    try {
      console.log('[Main] Getting all imported contacts for user:', userId);

      // Validate input
      const validatedUserId = validateUserId(userId)!; // Will throw if invalid, never null

      // Get only imported contacts from database
      const importedContacts = await databaseService.getImportedContactsByUserId(validatedUserId);

      console.log(`[Main] Found ${importedContacts.length} imported contacts`);

      return {
        success: true,
        contacts: importedContacts,
      };
    } catch (error) {
      console.error('[Main] Get contacts failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get available contacts for import (from external sources)
  ipcMain.handle('contacts:get-available', async (event: IpcMainInvokeEvent, userId: string): Promise<ContactResponse> => {
    try {
      console.log('[Main] Getting available contacts for import for user:', userId);

      // Validate input
      const validatedUserId = validateUserId(userId)!; // Will throw if invalid, never null

      // Get contacts from macOS Contacts app
      const { phoneToContactInfo, status } = await getContactNames();

      // Get already imported contact names/emails to filter them out
      const importedContacts = await databaseService.getImportedContactsByUserId(validatedUserId);
      const importedNames = new Set(importedContacts.map(c => c.name?.toLowerCase()));
      const importedEmails = new Set(importedContacts.map(c => c.email?.toLowerCase()).filter(Boolean));

      // Convert Contacts app data to contact objects
      const availableContacts: any[] = [];
      const seenContacts = new Set<string>();

      if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
        for (const [_phone, contactInfo] of Object.entries(phoneToContactInfo)) {
          // Use the contact name as unique key to avoid duplicates
          // (same contact may have multiple phone numbers)
          const nameLower = contactInfo.name?.toLowerCase();
          const primaryEmail = contactInfo.emails?.[0]?.toLowerCase();

          // Skip if already imported (by name or email)
          if (importedNames.has(nameLower) || (primaryEmail && importedEmails.has(primaryEmail))) {
            continue;
          }

          if (!seenContacts.has(contactInfo.name)) {
            seenContacts.add(contactInfo.name);

            availableContacts.push({
              id: `contacts-app-${contactInfo.name}`, // Temporary ID for UI
              name: contactInfo.name,
              phone: contactInfo.phones?.[0] || null, // Primary phone
              email: contactInfo.emails?.[0] || null, // Primary email
              source: 'contacts_app',
              allPhones: contactInfo.phones || [],
              allEmails: contactInfo.emails || [],
            });
          }
        }
      }

      console.log(`[Main] Found ${availableContacts.length} available contacts for import`);

      return {
        success: true,
        contacts: availableContacts,
        contactsStatus: status, // Include loading status
      };
    } catch (error) {
      console.error('[Main] Get available contacts failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Import contacts from external sources
  ipcMain.handle('contacts:import', async (event: IpcMainInvokeEvent, userId: string, contactsToImport: unknown[]): Promise<ContactResponse> => {
    try {
      console.log('[Main] Importing contacts for user:', userId, 'count:', contactsToImport.length);

      // Validate inputs
      const validatedUserId = validateUserId(userId)!; // Will throw if invalid, never null

      // Validate contacts array
      if (!Array.isArray(contactsToImport)) {
        throw new ValidationError('Contacts to import must be an array', 'contactsToImport');
      }

      if (contactsToImport.length === 0) {
        throw new ValidationError('No contacts provided for import', 'contactsToImport');
      }

      if (contactsToImport.length > 1000) {
        throw new ValidationError('Cannot import more than 1000 contacts at once', 'contactsToImport');
      }

      const importedContacts: Contact[] = [];

      for (const contact of contactsToImport) {
        // Validate each contact's data (basic validation)
        const sanitizedContact = sanitizeObject(contact);
        const validatedData = validateContactData(sanitizedContact, false);

        const importedContact = await databaseService.createContact({
          user_id: validatedUserId,
          name: validatedData.name || 'Unknown',
          email: validatedData.email ?? undefined,
          phone: validatedData.phone ?? undefined,
          company: validatedData.company ?? undefined,
          title: validatedData.title ?? undefined,
          source: (sanitizedContact as any).source || 'contacts_app',
          is_imported: true,
        });
        importedContacts.push(importedContact);
      }

      console.log(`[Main] Successfully imported ${importedContacts.length} contacts`);

      return {
        success: true,
        contacts: importedContacts,
      };
    } catch (error) {
      console.error('[Main] Import contacts failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get contacts sorted by recent activity and address relevance
  ipcMain.handle('contacts:get-sorted-by-activity', async (event: IpcMainInvokeEvent, userId: string, propertyAddress: string | null = null): Promise<ContactResponse> => {
    try {
      console.log('[Main] Getting contacts sorted by activity for user:', userId, 'address:', propertyAddress);

      // Validate inputs
      const validatedUserId = validateUserId(userId)!; // Will throw if invalid, never null

      // Validate propertyAddress (optional)
      const validatedAddress = propertyAddress
        ? validateString(propertyAddress, 'propertyAddress', { required: false, maxLength: 500 })
        : undefined;

      // Get only imported contacts sorted by activity
      const importedContacts = await databaseService.getContactsSortedByActivity(validatedUserId, validatedAddress ?? undefined);

      console.log(`[Main] Returning ${importedContacts.length} imported contacts sorted by activity`);

      return {
        success: true,
        contacts: importedContacts,
      };
    } catch (error) {
      console.error('[Main] Get sorted contacts failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Create new contact
  ipcMain.handle('contacts:create', async (event: IpcMainInvokeEvent, userId: string, contactData: unknown): Promise<ContactResponse> => {
    try {
      console.log('[Main] Creating contact:', contactData);

      // Validate inputs
      const validatedUserId = validateUserId(userId)!; // Will throw if invalid, never null
      const validatedData = validateContactData(contactData, false);

      const contact = await databaseService.createContact({
        user_id: validatedUserId,
        name: validatedData.name || 'Unknown',
        email: validatedData.email ?? undefined,
        phone: validatedData.phone ?? undefined,
        company: validatedData.company ?? undefined,
        title: validatedData.title ?? undefined,
        source: 'manual',
        is_imported: false,
      });

      return {
        success: true,
        contact,
      };
    } catch (error) {
      console.error('[Main] Create contact failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Update contact
  ipcMain.handle('contacts:update', async (event: IpcMainInvokeEvent, contactId: string, updates: unknown): Promise<ContactResponse> => {
    try {
      console.log('[Main] Updating contact:', contactId, updates);

      // Validate inputs
      const validatedContactId = validateContactId(contactId)!; // Will throw if invalid, never null
      const validatedUpdates = validateContactData(sanitizeObject(updates || {}), true);

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
      const contact = await databaseService.getContactById(validatedContactId);

      return {
        success: true,
        contact: contact || undefined,
      };
    } catch (error) {
      console.error('[Main] Update contact failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Check if contact can be deleted (get associated transactions)
  ipcMain.handle('contacts:checkCanDelete', async (event: IpcMainInvokeEvent, contactId: string): Promise<ContactResponse> => {
    try {
      console.log('[Main] Checking if contact can be deleted:', contactId);

      // Validate input
      const validatedContactId = validateContactId(contactId)!; // Will throw if invalid, never null

      const transactions = await databaseService.getTransactionsByContact(validatedContactId);

      return {
        success: true,
        canDelete: transactions.length === 0,
        transactions: transactions,
        count: transactions.length
      };
    } catch (error) {
      console.error('[Main] Check can delete contact failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Delete contact
  ipcMain.handle('contacts:delete', async (event: IpcMainInvokeEvent, contactId: string): Promise<ContactResponse> => {
    try {
      console.log('[Main] Deleting contact:', contactId);

      // Validate input
      const validatedContactId = validateContactId(contactId)!; // Will throw if invalid, never null

      // Check if contact has associated transactions
      const check = await databaseService.getTransactionsByContact(validatedContactId);
      if (check.length > 0) {
        return {
          success: false,
          error: 'Cannot delete contact with associated transactions',
          canDelete: false,
          transactions: check,
          count: check.length
        };
      }

      await databaseService.deleteContact(validatedContactId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Delete contact failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Remove contact from local database (un-import)
  ipcMain.handle('contacts:remove', async (event: IpcMainInvokeEvent, contactId: string): Promise<ContactResponse> => {
    try {
      console.log('[Main] Removing contact from local database:', contactId);

      // Validate input
      const validatedContactId = validateContactId(contactId)!; // Will throw if invalid, never null

      // Check if contact has associated transactions
      const check = await databaseService.getTransactionsByContact(validatedContactId);
      if (check.length > 0) {
        return {
          success: false,
          error: 'Cannot remove contact with associated transactions',
          canDelete: false,
          transactions: check,
          count: check.length
        };
      }

      await databaseService.removeContact(validatedContactId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Remove contact failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
