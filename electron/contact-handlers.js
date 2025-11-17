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
  // Get all contacts for a user
  ipcMain.handle('contacts:get-all', async (event, userId) => {
    try {
      console.log('[Main] Getting all contacts for user:', userId);

      // Get manual contacts from database
      const manualContacts = await databaseService.getContactsByUserId(userId);

      // Get contacts from macOS Contacts app
      const { phoneToContactInfo, status } = await getContactNames();

      // Convert Contacts app data to contact objects
      const contactsAppContacts = [];
      const seenContacts = new Set();

      if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
        for (const [phone, contactInfo] of Object.entries(phoneToContactInfo)) {
          // Use the contact name as unique key to avoid duplicates
          // (same contact may have multiple phone numbers)
          if (!seenContacts.has(contactInfo.name)) {
            seenContacts.add(contactInfo.name);

            contactsAppContacts.push({
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

      console.log(`[Main] Found ${manualContacts.length} manual contacts and ${contactsAppContacts.length} Contacts app contacts`);

      // Merge manual contacts and Contacts app contacts
      const allContacts = [...manualContacts, ...contactsAppContacts];

      return {
        success: true,
        contacts: allContacts,
        contactsStatus: status, // Include loading status
      };
    } catch (error) {
      console.error('[Main] Get contacts failed:', error);
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

      // Get manual contacts sorted by activity
      const manualContacts = await databaseService.getContactsSortedByActivity(userId, propertyAddress);

      // Get contacts from macOS Contacts app
      const { phoneToContactInfo } = await getContactNames();

      // Convert Contacts app data to contact objects
      const contactsAppContacts = [];
      const seenContacts = new Set();

      if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
        for (const [phone, contactInfo] of Object.entries(phoneToContactInfo)) {
          if (!seenContacts.has(contactInfo.name)) {
            seenContacts.add(contactInfo.name);

            contactsAppContacts.push({
              id: `contacts-app-${contactInfo.name}`,
              name: contactInfo.name,
              phone: contactInfo.phones?.[0] || null,
              email: contactInfo.emails?.[0] || null,
              source: 'contacts_app',
              allPhones: contactInfo.phones || [],
              allEmails: contactInfo.emails || [],
              activityScore: 0, // Contacts app contacts have no activity score
            });
          }
        }
      }

      // Manual contacts come first (already sorted by activity), then Contacts app contacts
      const allContacts = [...manualContacts, ...contactsAppContacts];

      console.log(`[Main] Returning ${allContacts.length} total contacts (${manualContacts.length} with activity, ${contactsAppContacts.length} from Contacts app)`);

      return {
        success: true,
        contacts: allContacts,
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

  // Search external contacts (without saving to database)
  ipcMain.handle('contacts:search-external', async (event, searchQuery = '') => {
    try {
      console.log('[Main] Searching external contacts:', searchQuery);

      // Get contacts from macOS Contacts app
      const { phoneToContactInfo, status } = await getContactNames();

      // Convert Contacts app data to contact objects
      const externalContacts = [];
      const seenContacts = new Set();

      if (phoneToContactInfo && Object.keys(phoneToContactInfo).length > 0) {
        for (const [phone, contactInfo] of Object.entries(phoneToContactInfo)) {
          if (!seenContacts.has(contactInfo.name)) {
            seenContacts.add(contactInfo.name);

            // Filter by search query if provided
            const matchesSearch = !searchQuery ||
              contactInfo.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              contactInfo.emails?.some(email => email.toLowerCase().includes(searchQuery.toLowerCase())) ||
              contactInfo.phones?.some(phone => phone.includes(searchQuery));

            if (matchesSearch) {
              externalContacts.push({
                id: `external-${contactInfo.name}-${Date.now()}`, // Temporary ID
                name: contactInfo.name,
                phone: contactInfo.phones?.[0] || null,
                email: contactInfo.emails?.[0] || null,
                source: 'contacts_app',
                allPhones: contactInfo.phones || [],
                allEmails: contactInfo.emails || [],
              });
            }
          }
        }
      }

      console.log(`[Main] Found ${externalContacts.length} external contacts`);

      return {
        success: true,
        contacts: externalContacts,
        status,
      };
    } catch (error) {
      console.error('[Main] Search external contacts failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Import multiple contacts
  ipcMain.handle('contacts:import-multiple', async (event, userId, contactsToImport) => {
    try {
      console.log('[Main] Importing multiple contacts:', contactsToImport.length);

      const importedContacts = [];

      for (const contactData of contactsToImport) {
        const contact = await databaseService.createContact(userId, {
          name: contactData.name,
          email: contactData.email || null,
          phone: contactData.phone || null,
          company: contactData.company || null,
          title: contactData.title || null,
          source: contactData.source || 'manual',
        });

        importedContacts.push(contact);
      }

      console.log(`[Main] Successfully imported ${importedContacts.length} contacts`);

      return {
        success: true,
        contacts: importedContacts,
      };
    } catch (error) {
      console.error('[Main] Import multiple contacts failed:', error);
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
