// ============================================
// CONTACT IPC HANDLERS
// This file contains contact handlers to be registered in main.js
// ============================================

const { ipcMain } = require('electron');
const databaseService = require('./services/databaseService');
const { getContactNames } = require('./services/contactsService');

/**
 * Register all contact-related IPC handlers
 */
function registerContactHandlers() {
  // Get all imported contacts for a user (local database only)
  ipcMain.handle('contacts:get-all', async (event, userId) => {
    try {
      console.log('[Main] Getting all imported contacts for user:', userId);

      // Get only imported contacts from database
      const importedContacts = await databaseService.getImportedContactsByUserId(userId);

      console.log(`[Main] Found ${importedContacts.length} imported contacts`);

      return {
        success: true,
        contacts: importedContacts,
      };
    } catch (error) {
      console.error('[Main] Get contacts failed:', error);
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

      // Get contacts from macOS Contacts app
      const { phoneToContactInfo, status } = await getContactNames();

      // Get already imported contact names/emails to filter them out
      const importedContacts = await databaseService.getImportedContactsByUserId(userId);
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

      const importedContacts = [];

      for (const contact of contactsToImport) {
        const importedContact = await databaseService.createContact(userId, {
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          company: contact.company || null,
          title: contact.title || null,
          source: contact.source || 'contacts_app',
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

      // Get only imported contacts sorted by activity
      const importedContacts = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

      console.log(`[Main] Returning ${importedContacts.length} imported contacts sorted by activity`);

      return {
        success: true,
        contacts: importedContacts,
      };
    } catch (error) {
      console.error('[Main] Get sorted contacts failed:', error);
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

      const contact = await databaseService.createContact(userId, {
        name: contactData.name,
        email: contactData.email || null,
        phone: contactData.phone || null,
        company: contactData.company || null,
        title: contactData.title || null,
        source: 'manual',
      });

      return {
        success: true,
        contact,
      };
    } catch (error) {
      console.error('[Main] Create contact failed:', error);
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

      const contact = await databaseService.updateContact(contactId, updates);

      return {
        success: true,
        contact,
      };
    } catch (error) {
      console.error('[Main] Update contact failed:', error);
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

      await databaseService.deleteContact(contactId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Delete contact failed:', error);
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

      await databaseService.removeContact(contactId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Remove contact failed:', error);
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
