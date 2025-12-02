/**
 * iPhone IPC Handlers
 * Handles all iPhone-related IPC communications between main and renderer
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import {
  discoverBackups,
  extractContacts,
  extractConversations,
  extractMessages,
  streamMessagesForContacts,
  getBackupLocations,
} from './services/iphoneBackupService';

import {
  iPhoneBackup,
  iPhoneContact,
  iPhoneConversation,
  iPhoneMessage,
  SyncProgress,
} from './types/iphone';

import { getContactNames, resolveContactName } from './services/contactsService';
import { macTimestampToDate } from './utils/dateUtils';
import { sanitizeFilename, createTimestampedFilename } from './utils/fileUtils';

let mainWindow: BrowserWindow | null = null;

/**
 * Register all iPhone-related IPC handlers
 */
export function registerIPhoneHandlers(window: BrowserWindow): void {
  mainWindow = window;

  // ============================================
  // PLATFORM DETECTION
  // ============================================

  /**
   * Get current platform information
   */
  ipcMain.handle('iphone:get-platform', async () => {
    return {
      platform: process.platform,
      isWindows: process.platform === 'win32',
      isMac: process.platform === 'darwin',
      isLinux: process.platform === 'linux',
      backupLocations: getBackupLocations(),
    };
  });

  // ============================================
  // BACKUP DISCOVERY
  // ============================================

  /**
   * Discover all available iPhone backups
   */
  ipcMain.handle('iphone:discover-backups', async () => {
    try {
      console.log('[iPhone] Discovering backups...');
      const backups = await discoverBackups();

      return {
        success: true,
        backups: backups.map(b => ({
          ...b,
          lastBackupDate: b.lastBackupDate.toISOString(),
        })),
      };
    } catch (error) {
      console.error('[iPhone] Error discovering backups:', error);
      return {
        success: false,
        error: (error as Error).message,
        backups: [],
      };
    }
  });

  /**
   * Check if iTunes/Apple backup is available
   */
  ipcMain.handle('iphone:check-backup-available', async () => {
    try {
      const backups = await discoverBackups();
      const hasBackups = backups.length > 0;
      const hasUnencrypted = backups.some(b => !b.isEncrypted);

      return {
        success: true,
        available: hasBackups,
        hasUnencrypted,
        backupCount: backups.length,
        message: hasBackups
          ? hasUnencrypted
            ? `Found ${backups.length} backup(s), ${backups.filter(b => !b.isEncrypted).length} unencrypted`
            : 'All backups are encrypted. Please disable backup encryption in iTunes/Finder.'
          : 'No iPhone backups found. Please create a backup using iTunes or Finder.',
      };
    } catch (error) {
      return {
        success: false,
        available: false,
        error: (error as Error).message,
      };
    }
  });

  // ============================================
  // CONTACT EXTRACTION
  // ============================================

  /**
   * Extract contacts from a specific backup
   */
  ipcMain.handle('iphone:get-contacts', async (_event, backupId: string) => {
    try {
      console.log('[iPhone] Getting contacts from backup:', backupId);

      // Find the backup
      const backups = await discoverBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        return {
          success: false,
          error: 'Backup not found',
          contacts: [],
        };
      }

      if (backup.isEncrypted) {
        return {
          success: false,
          error: 'Backup is encrypted. Please disable backup encryption in iTunes/Finder.',
          contacts: [],
        };
      }

      // Send progress updates
      const onProgress = (progress: SyncProgress) => {
        mainWindow?.webContents.send('iphone:sync-progress', progress);
      };

      const contacts = await extractContacts(backup, onProgress);

      return {
        success: true,
        contacts,
        count: contacts.length,
      };
    } catch (error) {
      console.error('[iPhone] Error getting contacts:', error);
      return {
        success: false,
        error: (error as Error).message,
        contacts: [],
      };
    }
  });

  // ============================================
  // CONVERSATION EXTRACTION
  // ============================================

  /**
   * Extract conversations from a specific backup
   */
  ipcMain.handle('iphone:get-conversations', async (_event, backupId: string) => {
    try {
      console.log('[iPhone] Getting conversations from backup:', backupId);

      const backups = await discoverBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        return {
          success: false,
          error: 'Backup not found',
          conversations: [],
        };
      }

      if (backup.isEncrypted) {
        return {
          success: false,
          error: 'Backup is encrypted. Please disable backup encryption in iTunes/Finder.',
          conversations: [],
        };
      }

      const onProgress = (progress: SyncProgress) => {
        mainWindow?.webContents.send('iphone:sync-progress', progress);
      };

      const conversations = await extractConversations(backup, onProgress);

      return {
        success: true,
        conversations: conversations.map(c => ({
          ...c,
          lastMessageDate: c.lastMessageDate?.toISOString(),
        })),
        count: conversations.length,
      };
    } catch (error) {
      console.error('[iPhone] Error getting conversations:', error);
      return {
        success: false,
        error: (error as Error).message,
        conversations: [],
      };
    }
  });

  /**
   * Get messages for a specific conversation
   */
  ipcMain.handle('iphone:get-messages', async (_event, backupId: string, conversationId: string) => {
    try {
      console.log('[iPhone] Getting messages for conversation:', conversationId);

      const backups = await discoverBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        return {
          success: false,
          error: 'Backup not found',
          messages: [],
        };
      }

      const onProgress = (progress: SyncProgress) => {
        mainWindow?.webContents.send('iphone:sync-progress', progress);
      };

      const messages = await extractMessages(backup, conversationId, onProgress);

      return {
        success: true,
        messages: messages.map(m => ({
          ...m,
          date: m.date.toISOString(),
        })),
        count: messages.length,
      };
    } catch (error) {
      console.error('[iPhone] Error getting messages:', error);
      return {
        success: false,
        error: (error as Error).message,
        messages: [],
      };
    }
  });

  // ============================================
  // SELECTIVE DATA STREAMING
  // ============================================

  /**
   * Stream messages for selected contacts
   * This is the main function for pulling data from iPhone to the app
   */
  ipcMain.handle(
    'iphone:stream-contact-messages',
    async (_event, backupId: string, contactIds: string[]) => {
      try {
        console.log('[iPhone] Streaming messages for contacts:', contactIds.length);

        const backups = await discoverBackups();
        const backup = backups.find(b => b.id === backupId);

        if (!backup) {
          return {
            success: false,
            error: 'Backup not found',
          };
        }

        // First get all contacts
        const allContacts = await extractContacts(backup);
        const selectedContacts = allContacts.filter(c => contactIds.includes(c.id));

        if (selectedContacts.length === 0) {
          return {
            success: false,
            error: 'No matching contacts found',
          };
        }

        const results: { contact: iPhoneContact; messages: iPhoneMessage[] }[] = [];

        const onProgress = (progress: SyncProgress) => {
          mainWindow?.webContents.send('iphone:sync-progress', progress);
        };

        const onData = (data: { contact: iPhoneContact; messages: iPhoneMessage[] }) => {
          results.push(data);

          // Stream each contact's data to the renderer
          mainWindow?.webContents.send('iphone:contact-data', {
            contact: data.contact,
            messages: data.messages.map(m => ({
              ...m,
              date: m.date.toISOString(),
            })),
            messageCount: data.messages.length,
          });
        };

        await streamMessagesForContacts(backup, selectedContacts, onProgress, onData);

        // Send completion
        mainWindow?.webContents.send('iphone:sync-progress', {
          status: 'complete',
          stage: 'Sync complete',
          message: `Synced ${results.length} contacts with ${results.reduce((sum, r) => sum + r.messages.length, 0)} messages`,
        });

        return {
          success: true,
          contactCount: results.length,
          messageCount: results.reduce((sum, r) => sum + r.messages.length, 0),
        };
      } catch (error) {
        console.error('[iPhone] Error streaming messages:', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // ============================================
  // EXPORT FUNCTIONALITY
  // ============================================

  /**
   * Export iPhone data to files
   */
  ipcMain.handle(
    'iphone:export-data',
    async (
      _event,
      backupId: string,
      contactIds: string[],
      options: { includeMessages: boolean; format: 'txt' | 'json' }
    ) => {
      try {
        console.log('[iPhone] Exporting data for contacts:', contactIds.length);

        // Show save dialog
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
          title: 'Select Export Folder',
          defaultPath: path.join(os.homedir(), 'Documents'),
          properties: ['openDirectory', 'createDirectory'],
          buttonLabel: 'Export Here',
        });

        if (canceled || !filePaths || filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        // Create export folder
        const timestamp = new Date()
          .toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
          .replace(/[/:]/g, '-')
          .replace(/,/g, '');

        const exportFolderName = `iPhone Export ${timestamp}`;
        const exportPath = path.join(filePaths[0], exportFolderName);
        await fs.mkdir(exportPath, { recursive: true });

        const backups = await discoverBackups();
        const backup = backups.find(b => b.id === backupId);

        if (!backup) {
          return { success: false, error: 'Backup not found' };
        }

        // Get contacts
        const allContacts = await extractContacts(backup);
        const selectedContacts = allContacts.filter(c => contactIds.includes(c.id));

        let totalMessages = 0;
        const exportedFiles: string[] = [];

        for (let i = 0; i < selectedContacts.length; i++) {
          const contact = selectedContacts[i];

          mainWindow?.webContents.send('iphone:sync-progress', {
            status: 'streaming',
            stage: `Exporting ${contact.displayName}...`,
            current: i + 1,
            total: selectedContacts.length,
          });

          // Create contact folder
          const contactFolder = path.join(exportPath, sanitizeFilename(contact.displayName, true));
          await fs.mkdir(contactFolder, { recursive: true });

          // Export contact info
          const contactInfoPath = path.join(contactFolder, 'contact_info.txt');
          let contactInfo = `Contact: ${contact.displayName}\n`;
          contactInfo += `=`.repeat(50) + '\n\n';

          if (contact.firstName) contactInfo += `First Name: ${contact.firstName}\n`;
          if (contact.lastName) contactInfo += `Last Name: ${contact.lastName}\n`;
          if (contact.organization) contactInfo += `Organization: ${contact.organization}\n`;

          contactInfo += '\nPhone Numbers:\n';
          contact.phoneNumbers.forEach(p => {
            contactInfo += `  - ${p.label || 'other'}: ${p.value}\n`;
          });

          contactInfo += '\nEmail Addresses:\n';
          contact.emailAddresses.forEach(e => {
            contactInfo += `  - ${e.label || 'other'}: ${e.value}\n`;
          });

          await fs.writeFile(contactInfoPath, contactInfo, 'utf8');
          exportedFiles.push('contact_info.txt');

          // Export messages if requested
          if (options.includeMessages) {
            const messageResults: { messages: iPhoneMessage[] }[] = [];

            await streamMessagesForContacts(
              backup,
              [contact],
              undefined,
              (data) => {
                messageResults.push({ messages: data.messages });
              }
            );

            const allMessages = messageResults.flatMap(r => r.messages);
            totalMessages += allMessages.length;

            if (allMessages.length > 0) {
              if (options.format === 'json') {
                const messagesPath = path.join(contactFolder, 'messages.json');
                await fs.writeFile(
                  messagesPath,
                  JSON.stringify(allMessages, null, 2),
                  'utf8'
                );
                exportedFiles.push('messages.json');
              } else {
                const messagesPath = path.join(contactFolder, 'messages.txt');
                let messagesContent = `Messages with ${contact.displayName}\n`;
                messagesContent += `Exported: ${new Date().toLocaleString()}\n`;
                messagesContent += `Total Messages: ${allMessages.length}\n`;
                messagesContent += `=`.repeat(80) + '\n\n';

                for (const msg of allMessages) {
                  const sender = msg.isFromMe ? 'Me' : contact.displayName;
                  const text = msg.text || (msg.hasAttachments ? '[Attachment]' : '[Empty message]');
                  messagesContent += `[${msg.date.toLocaleString()}] ${sender}:\n${text}\n\n`;
                }

                await fs.writeFile(messagesPath, messagesContent, 'utf8');
                exportedFiles.push('messages.txt');
              }
            }
          }
        }

        mainWindow?.webContents.send('iphone:sync-progress', {
          status: 'complete',
          stage: 'Export complete',
          message: `Exported ${selectedContacts.length} contacts with ${totalMessages} messages`,
        });

        return {
          success: true,
          exportPath,
          contactCount: selectedContacts.length,
          messageCount: totalMessages,
          filesCreated: exportedFiles,
        };
      } catch (error) {
        console.error('[iPhone] Error exporting data:', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // ============================================
  // UTILITY HANDLERS
  // ============================================

  /**
   * Open backup location in file explorer
   */
  ipcMain.handle('iphone:open-backup-location', async () => {
    const { shell } = require('electron');
    const locations = getBackupLocations();

    for (const location of locations) {
      try {
        await fs.access(location);
        await shell.openPath(location);
        return { success: true, path: location };
      } catch {
        continue;
      }
    }

    return {
      success: false,
      error: 'No backup location found',
      expectedLocations: locations,
    };
  });

  /**
   * Get backup details
   */
  ipcMain.handle('iphone:get-backup-details', async (_event, backupId: string) => {
    try {
      const backups = await discoverBackups();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        return { success: false, error: 'Backup not found' };
      }

      return {
        success: true,
        backup: {
          ...backup,
          lastBackupDate: backup.lastBackupDate.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  console.log('[iPhone] IPC handlers registered');
}
