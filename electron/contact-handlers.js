// ============================================
// CONTACT IPC HANDLERS
// This file contains contact handlers to be registered in main.js
// ============================================

const { ipcMain } = require('electron');
const databaseService = require('./services/databaseService');
const { getContactNames } = require('./services/contactsService');

// Import validation utilities
const {
  ValidationError,
  validateUserId,
  validateContactId,
  validateContactData,
  validateString,
  sanitizeObject,
} = require('./utils/validation');

/**
 * Register all contact-related IPC handlers
 */
function registerContactHandlers() {
  // Get all imported contacts for a user (local database only)
  ipcMain.handle('contacts:get-all', async (event, userId) => {
    try {
      console.log('[Main] Getting all imported contacts for user:', userId);

      // Validate input
      const validatedUserId = validateUserId(userId);

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
        error: error.message,
      };
    }
  });

  // Get available contacts for import (from external sources)
  ipcMain.handle('contacts:get-available', async (event, userId) => {
    try {
      console.log('[Main] Getting available contacts for import for user:', userId);

      // Validate input
      const validatedUserId = validateUserId(userId);

      // Get contacts from macOS Contacts app
      const { phoneToContactInfo, status } = await getContactNames();

      // Get already imported contact names/emails to filter them out
      const importedContacts = await databaseService.getImportedContactsByUserId(validatedUserId);
      const importedNames = new Set(importedContacts.map(c => c.name?.toLowerCase()));
      const importedEmails = new Set(importedContacts.map(c => c.email?.toLowerCase()).filter(Boolean));

      // Convert Contacts app data to contact objects
      const availableContacts = [];
      const seenContacts = new Set();

      if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
        for (const [phone, contactInfo] of Object.entries(phoneToContactInfo)) {
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
        error: error.message,
      };
    }
  });

  // Import contacts from external sources
  ipcMain.handle('contacts:import', async (event, userId, contactsToImport) => {
    try {
      console.log('[Main] Importing contacts for user:', userId, 'count:', contactsToImport.length);

      // Validate inputs
      const validatedUserId = validateUserId(userId);

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

      const importedContacts = [];

      for (const contact of contactsToImport) {
        // Validate each contact's data (basic validation)
        const sanitizedContact = sanitizeObject(contact);
        const validatedData = validateContactData(sanitizedContact, false);

        const importedContact = await databaseService.createContact(validatedUserId, {
          ...validatedData,
          source: sanitizedContact.source || 'contacts_app',
          is_imported: 1,
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
        error: error.message,
      };
    }
  });

  // Get contacts sorted by recent activity and address relevance
  ipcMain.handle('contacts:get-sorted-by-activity', async (event, userId, propertyAddress = null) => {
    try {
      console.log('[Main] Getting contacts sorted by activity for user:', userId, 'address:', propertyAddress);

      // Validate inputs
      const validatedUserId = validateUserId(userId);

      // Validate propertyAddress (optional)
      const validatedAddress = propertyAddress
        ? validateString(propertyAddress, 'propertyAddress', { required: false, maxLength: 500 })
        : null;

      // Get only imported contacts sorted by activity
      const importedContacts = await databaseService.getContactsSortedByActivity(validatedUserId, validatedAddress);

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
        error: error.message,
      };
    }
  });

  // Create new contact
  ipcMain.handle('contacts:create', async (event, userId, contactData) => {
    try {
      console.log('[Main] Creating contact:', contactData);

      // Validate inputs
      const validatedUserId = validateUserId(userId);
      const validatedData = validateContactData(contactData, false);

      const contact = await databaseService.createContact(validatedUserId, {
        ...validatedData,
        source: 'manual',
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
        error: error.message,
      };
    }
  });

  // Update contact
  ipcMain.handle('contacts:update', async (event, contactId, updates) => {
    try {
      console.log('[Main] Updating contact:', contactId, updates);

      // Validate inputs
      const validatedContactId = validateContactId(contactId);
      const validatedUpdates = validateContactData(sanitizeObject(updates || {}), true);

      const contact = await databaseService.updateContact(validatedContactId, validatedUpdates);

      return {
        success: true,
        contact,
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
        error: error.message,
      };
    }
  });

  // Check if contact can be deleted (get associated transactions)
  ipcMain.handle('contacts:checkCanDelete', async (event, contactId) => {
    try {
      console.log('[Main] Checking if contact can be deleted:', contactId);

      // Validate input
      const validatedContactId = validateContactId(contactId);

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
        error: error.message,
      };
    }
  });

  // Delete contact
  ipcMain.handle('contacts:delete', async (event, contactId) => {
    try {
      console.log('[Main] Deleting contact:', contactId);

      // Validate input
      const validatedContactId = validateContactId(contactId);

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
        error: error.message,
      };
    }
  });

  // Remove contact from local database (un-import)
  ipcMain.handle('contacts:remove', async (event, contactId) => {
    try {
      console.log('[Main] Removing contact from local database:', contactId);

      // Validate input
      const validatedContactId = validateContactId(contactId);

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
        error: error.message,
      };
    }
  });
}

module.exports = {
  registerContactHandlers,
};
