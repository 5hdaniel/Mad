// ============================================
// CONTACT IPC HANDLERS
// This file contains contact handlers to be registered in main.js
// ============================================

const { ipcMain } = require('electron');
const databaseService = require('./services/databaseService');

/**
 * Register all contact-related IPC handlers
 */
function registerContactHandlers() {
  // Get all contacts for a user
  ipcMain.handle('contacts:get-all', async (event, userId) => {
    try {
      console.log('[Main] Getting all contacts for user:', userId);

      const contacts = await databaseService.getContactsByUserId(userId);

      return {
        success: true,
        contacts,
      };
    } catch (error) {
      console.error('[Main] Get contacts failed:', error);
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
}

module.exports = {
  registerContactHandlers,
};
