// Register ts-node to enable TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
  }
});

const { app, BrowserWindow, ipcMain, dialog, shell, systemPreferences, Notification, session } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const { exec } = require('child_process');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import services and utilities
const { getContactNames, resolveContactName } = require('./services/contactsService.ts');
const {
  getAllConversations,
  getGroupChatParticipants,
  isGroupChat,
  getMessagesForContact,
  openMessagesDatabase
} = require('./services/messagesService.ts');
const { macTimestampToDate, getYearsAgoTimestamp } = require('./utils/dateUtils.ts');
const { normalizePhoneNumber, formatPhoneNumber } = require('./utils/phoneUtils.ts');
const { sanitizeFilename, createTimestampedFilename } = require('./utils/fileUtils.ts');
const { getMessageText } = require('./utils/messageParser.ts');
const {
  WINDOW_CONFIG,
  DEV_SERVER_URL,
  UPDATE_CHECK_DELAY,
  FIVE_YEARS_IN_MS
} = require('./constants.ts');

// Import new authentication services
const databaseService = require('./services/databaseService.ts');
const googleAuthService = require('./services/googleAuthService.ts');
const microsoftAuthService = require('./services/microsoftAuthService.ts');
const supabaseService = require('./services/supabaseService.ts');
const tokenEncryptionService = require('./services/tokenEncryptionService');
const connectionStatusService = require('./services/connectionStatusService');
const { initializeDatabase, registerAuthHandlers } = require('./auth-handlers.ts');
const { registerTransactionHandlers } = require('./transaction-handlers.ts');
const { registerContactHandlers } = require('./contact-handlers.ts');
const { registerAddressHandlers } = require('./address-handlers.ts');
const { registerFeedbackHandlers } = require('./feedback-handlers.ts');
const { registerSystemHandlers } = require('./system-handlers.ts');
const { registerPreferenceHandlers } = require('./preference-handlers.ts');

// Configure logging for auto-updater
log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow;

/**
 * Configure Content Security Policy for the application
 * This prevents the "unsafe-eval" security warning
 */
function setupContentSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;

    // Configure CSP based on environment
    // Development: Allow localhost dev server and inline styles for HMR
    // Production: Strict CSP without unsafe-eval
    const cspDirectives = isDevelopment
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' http://localhost:* ws://localhost:* https:",
          "media-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests"
        ]
      : [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "media-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'"
        ];

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives.join('; ')]
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: WINDOW_CONFIG.TITLE_BAR_STYLE,
    backgroundColor: WINDOW_CONFIG.BACKGROUND_COLOR
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // Check for updates after window loads (only in production)
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, UPDATE_CHECK_DELAY);
  }
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}%`;
  log.info(message);
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

app.whenReady().then(async () => {
  // Set up Content Security Policy
  setupContentSecurityPolicy();

  // Check if encryption is available (required for secure token storage)
  if (!tokenEncryptionService.isEncryptionAvailable()) {
    const platform = process.platform;
    let errorMessage = 'Encryption is not available on your system. MagicAudit requires OS-level encryption to securely store OAuth tokens.';

    if (platform === 'linux') {
      errorMessage += '\n\nOn Linux, please install one of the following:\n- gnome-keyring\n- kwallet\n- libsecret\n\nThen restart the application.';
    } else if (platform === 'darwin') {
      errorMessage += '\n\nThis is unexpected on macOS. Please ensure your system keychain is accessible.';
    } else if (platform === 'win32') {
      errorMessage += '\n\nThis is unexpected on Windows. Please ensure DPAPI is available.';
    }

    log.error('[Main] Encryption not available:', { platform });
    console.error('[Main] Encryption not available. OAuth functionality will fail.');

    // Show error dialog
    await dialog.showMessageBox({
      type: 'error',
      title: 'Encryption Not Available',
      message: errorMessage,
      buttons: ['Exit', 'Continue Anyway']
    }).then(result => {
      if (result.response === 0) {
        app.quit();
      }
    });
  }

  await initializeDatabase();
  createWindow();
  registerAuthHandlers(mainWindow);
  registerTransactionHandlers(mainWindow);
  registerContactHandlers();
  registerAddressHandlers();
  registerFeedbackHandlers();
  registerSystemHandlers();
  registerPreferenceHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Get app information for Full Disk Access
ipcMain.handle('get-app-info', () => {
  try {
    const appPath = app.getPath('exe');
    const appName = app.getName();

    return {
      name: appName,
      path: appPath,
      pid: process.pid
    };
  } catch (error) {
    console.error('Error getting app info:', error);
    return {
      name: 'Unknown',
      path: 'Unknown',
      pid: 0
    };
  }
});

// Get macOS version information
ipcMain.handle('get-macos-version', () => {
  try {
    if (process.platform === 'darwin') {
      const release = os.release();
      const parts = release.split('.');
      const majorVersion = parseInt(parts[0], 10);

      // Convert Darwin version to macOS version
      let macOSVersion = 10;
      if (majorVersion >= 20) {
        macOSVersion = majorVersion - 9; // Darwin 20 = macOS 11
      }

      // Name the versions
      const versionNames = {
        11: 'Big Sur',
        12: 'Monterey',
        13: 'Ventura',
        14: 'Sonoma',
        15: 'Sequoia',
        16: 'Tahoe'
      };

      const macOSName = versionNames[macOSVersion] || 'Unknown';

      // Determine UI style
      const uiStyle = macOSVersion >= 13 ? 'settings' : 'preferences';
      const appName = macOSVersion >= 13 ? 'System Settings' : 'System Preferences';

      return {
        version: macOSVersion,
        name: macOSName,
        darwinVersion: majorVersion,
        fullRelease: release,
        uiStyle,
        appName
      };
    }

    return {
      version: null,
      name: 'Not macOS',
      darwinVersion: 0,
      fullRelease: 'not-macos',
      uiStyle: 'settings',
      appName: 'System Settings'
    };
  } catch (error) {
    console.error('Error detecting macOS version:', error);
    return {
      version: 13,
      name: 'Unknown (Error)',
      darwinVersion: 0,
      fullRelease: 'unknown',
      uiStyle: 'settings',
      appName: 'System Settings'
    };
  }
});

// Check if app is running from /Applications folder
ipcMain.handle('check-app-location', async () => {
  try {
    // Only check on macOS
    if (process.platform !== 'darwin') {
      return {
        isInApplications: true, // Not applicable on other platforms
        shouldPrompt: false,
        appPath: app.getPath('exe')
      };
    }

    // Get the app executable path
    const appPath = app.getPath('exe');

    // Check if running from /Applications
    const isInApplications = appPath.includes('/Applications/');

    // Check if running from common temporary/download locations
    const isDmgOrDownloads = appPath.includes('/Volumes/') ||
                             appPath.includes('/Downloads') ||
                             appPath.includes('/Desktop') ||
                             appPath.includes('/private/var');

    // Should prompt if not in Applications AND is in a temporary location
    const shouldPrompt = !isInApplications && isDmgOrDownloads;

    return {
      isInApplications,
      shouldPrompt,
      appPath
    };
  } catch (error) {
    console.error('Error checking app location:', error);
    return {
      isInApplications: false,
      shouldPrompt: false,
      appPath: 'unknown'
    };
  }
});

// Trigger Full Disk Access request by attempting to read Messages database
// This will cause the app to appear in System Settings > Privacy & Security > Full Disk Access
ipcMain.handle('trigger-full-disk-access', async () => {
  try {
    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );

    // Attempt to read the database - this will fail without permission
    // but it will cause macOS to add this app to the Full Disk Access list
    await fs.access(messagesDbPath, fs.constants.R_OK);
    return { triggered: true, alreadyGranted: true };
  } catch (error) {
    return { triggered: true, alreadyGranted: false };
  }
});

// Check permissions for Messages database
ipcMain.handle('check-permissions', async () => {
  try {
    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );

    await fs.access(messagesDbPath, fs.constants.R_OK);
    return { hasPermission: true };
  } catch (error) {
    return { hasPermission: false, error: error.message };
  }
});

// Request Contacts permission - Note: Not available via Electron API
// Contacts access is handled by Full Disk Access which also grants Messages access
ipcMain.handle('request-contacts-permission', async () => {
  // Contacts permission isn't available via systemPreferences API
  // Full Disk Access will provide access to both contacts and messages
  return {
    granted: false,
    status: 'skip',
    message: 'Contacts access included with Full Disk Access'
  };
});

// Open System Settings to Full Disk Access panel
ipcMain.handle('open-system-settings', async () => {
  try {
    if (process.platform === 'darwin') {
      // Try to open directly to Full Disk Access settings
      // This uses AppleScript to navigate to the correct panel
      const script = `
        tell application "System Settings"
          activate
        end tell

        tell application "System Events"
          tell process "System Settings"
            try
              click menu item "Privacy & Security" of menu "View" of menu bar 1
              delay 0.5
            end try
          end tell
        end tell
      `;

      exec(`osascript -e '${script}'`, (error) => {
        if (error) {
          // Fallback: just open System Settings
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
        }
      });

      return { success: true };
    }

    return { success: false, message: 'Not supported on this platform' };
  } catch (error) {
    console.error('Error opening system settings:', error);
    return { success: false, error: error.message };
  }
});

// Request permissions (guide user)
ipcMain.handle('request-permissions', async () => {
  // On Mac, we need to guide the user to grant Full Disk Access
  return {
    success: false,
    message: 'Please grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access'
  };
});

// Note: Helper functions moved to services/contactsService.js and utils/

// Get conversations from Messages database
ipcMain.handle('get-conversations', async () => {
  try {
    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );

    const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    let db2 = null;
    let dbClose2 = null;

    try {
      // Get contact names from Contacts database
      const { contactMap, phoneToContactInfo } = await getContactNames();

      // Get all chats with their latest message
      // Filter to only show chats with at least 1 message
      const conversations = await dbAll(`
        SELECT
          chat.ROWID as chat_id,
          chat.chat_identifier,
          chat.display_name,
          handle.id as contact_id,
          MAX(message.date) as last_message_date,
          COUNT(message.ROWID) as message_count
        FROM chat
        LEFT JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
        LEFT JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        LEFT JOIN chat_message_join ON chat.ROWID = chat_message_join.chat_id
        LEFT JOIN message ON chat_message_join.message_id = message.ROWID
        GROUP BY chat.ROWID
        HAVING message_count > 0 AND last_message_date IS NOT NULL
        ORDER BY last_message_date DESC
      `);

      // Close first database connection - we're done with it
      await dbClose();

      // Re-open database to query group chat participants
      db2 = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
      const dbAll2 = promisify(db2.all.bind(db2));
      dbClose2 = promisify(db2.close.bind(db2));

      // Map conversations and deduplicate by contact NAME
      // This ensures that if a contact has multiple phone numbers or emails,
      // they appear as ONE contact with all their info
      const conversationMap = new Map();

      // Process conversations - track direct chats and group chats separately
      for (const conv of conversations) {
        const rawContactId = conv.contact_id || conv.chat_identifier;
        const displayName = resolveContactName(conv.contact_id, conv.chat_identifier, conv.display_name, contactMap);

        // Detect group chats - they have chat_identifier like "chat123456789"
        // Individual chats have phone numbers or emails as identifiers
        const isGroupChat = conv.chat_identifier && conv.chat_identifier.startsWith('chat') && !conv.chat_identifier.includes('@');

        if (isGroupChat) {
          // For group chats, we need to attribute the chat to all participants

          try {
            // Get all participants in this group chat
            const participants = await dbAll2(`
              SELECT DISTINCT handle.id as contact_id
              FROM chat_handle_join
              JOIN handle ON chat_handle_join.handle_id = handle.ROWID
              WHERE chat_handle_join.chat_id = ?
            `, [conv.chat_id]);

            // Add this group chat to each participant's statistics
            for (const participant of participants) {
              const participantName = resolveContactName(participant.contact_id, participant.contact_id, null, contactMap);
              const normalizedKey = participantName.toLowerCase().trim();

              // Get or create contact entry
              if (!conversationMap.has(normalizedKey)) {
                // Create new contact entry for this participant
                let contactInfo = null;
                let phones = [];
                let emails = [];

                if (participant.contact_id && participant.contact_id.includes('@')) {
                  const emailLower = participant.contact_id.toLowerCase();
                  for (const info of Object.values(phoneToContactInfo)) {
                    if (info.emails && info.emails.some(e => e.toLowerCase() === emailLower)) {
                      contactInfo = info;
                      break;
                    }
                  }
                  if (contactInfo) {
                    phones = contactInfo.phones || [];
                    emails = contactInfo.emails || [];
                  } else {
                    emails = [participant.contact_id];
                  }
                } else if (participant.contact_id) {
                  const normalized = participant.contact_id.replace(/\D/g, '');
                  contactInfo = phoneToContactInfo[normalized] || phoneToContactInfo[participant.contact_id];
                  if (contactInfo) {
                    phones = contactInfo.phones || [];
                    emails = contactInfo.emails || [];
                  } else {
                    phones = [participant.contact_id];
                  }
                }

                conversationMap.set(normalizedKey, {
                  id: `group-contact-${normalizedKey}`, // Generate unique ID for group-only contacts
                  name: participantName,
                  contactId: participant.contact_id,
                  phones: phones,
                  emails: emails,
                  showBothNameAndNumber: participantName !== participant.contact_id,
                  messageCount: 0,
                  lastMessageDate: 0,
                  directChatCount: 0,
                  directMessageCount: 0,
                  groupChatCount: 0,
                  groupMessageCount: 0
                });
              }

              // Add group chat stats to this participant
              const existing = conversationMap.get(normalizedKey);
              existing.groupChatCount += 1;
              existing.groupMessageCount += conv.message_count;
              existing.messageCount += conv.message_count;

              // Update last message date if this group chat is more recent
              if (conv.last_message_date > existing.lastMessageDate) {
                existing.lastMessageDate = conv.last_message_date;
              }
            }
          } catch (err) {
            console.error(`Error processing group chat ${conv.chat_identifier}:`, err);
          }

          continue; // Skip to next conversation (don't add group chat as its own contact)
        }

        // Get full contact info (all phones and emails)
        let contactInfo = null;
        let phones = [];
        let emails = [];

        if (rawContactId && rawContactId.includes('@')) {
          // contactId is an email - look up contact info by email
          const emailLower = rawContactId.toLowerCase();
          // Try to find this email in phoneToContactInfo
          for (const info of Object.values(phoneToContactInfo)) {
            if (info.emails && info.emails.some(e => e.toLowerCase() === emailLower)) {
              contactInfo = info;
              break;
            }
          }

          if (contactInfo) {
            phones = contactInfo.phones || [];
            emails = contactInfo.emails || [];
          } else {
            emails = [rawContactId];
          }
        } else if (rawContactId) {
          // contactId is a phone - look up full contact info
          const normalized = rawContactId.replace(/\D/g, '');
          contactInfo = phoneToContactInfo[normalized] || phoneToContactInfo[rawContactId];

          // If not found and number has country code 1 (11 digits starting with 1), try without it
          if (!contactInfo && normalized.startsWith('1') && normalized.length === 11) {
            const withoutCountryCode = normalized.substring(1);
            contactInfo = phoneToContactInfo[withoutCountryCode];
          }

          if (contactInfo) {
            phones = contactInfo.phones || [];
            emails = contactInfo.emails || [];
          } else {
            // No contact info found, just use the raw phone number
            phones = [rawContactId];
          }
        }

        // Use contact name as the deduplication key
        // This ensures all chats with the same person are merged
        const normalizedKey = displayName.toLowerCase().trim();

        const conversationData = {
          id: conv.chat_id,
          chatId: conv.chat_id, // CRITICAL: Set chatId field for exports
          name: displayName,
          contactId: rawContactId,
          phones: phones,
          emails: emails,
          showBothNameAndNumber: displayName !== rawContactId,
          messageCount: conv.message_count,
          lastMessageDate: conv.last_message_date,
          directChatCount: 1, // This is a direct chat
          directMessageCount: conv.message_count,
          groupChatCount: 0,
          groupMessageCount: 0
        };

        // If we already have this contact, merge the data
        if (conversationMap.has(normalizedKey)) {
          const existing = conversationMap.get(normalizedKey);

          // Merge phones (unique)
          const allPhones = [...new Set([...existing.phones, ...phones])];
          // Merge emails (unique)
          const allEmails = [...new Set([...existing.emails, ...emails])];

          // CRITICAL FIX: Always prefer a real chat ID over a generated group-contact-* ID
          // This ensures we can export 1:1 messages even if group chat is more recent
          const wasGeneratedId = typeof existing.id === 'string' && existing.id.startsWith('group-contact-');
          if (!existing.id || wasGeneratedId) {
            // Current ID is fake, use the real chat ID from this 1:1 conversation
            existing.id = conv.chat_id;
            existing.chatId = conv.chat_id; // Also set chatId field
          }

          // Update last message date if this chat is more recent
          if (conv.last_message_date > existing.lastMessageDate) {
            existing.lastMessageDate = conv.last_message_date;
          }

          // Add up message counts and direct chat counts
          existing.messageCount += conv.message_count;
          existing.directChatCount += 1;
          existing.directMessageCount += conv.message_count;
          existing.phones = allPhones;
          existing.emails = allEmails;
        } else {
          conversationMap.set(normalizedKey, conversationData);
        }
      }

      // Close the second database connection
      await dbClose2();

      // Convert map back to array
      const deduplicatedConversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessageDate - a.lastMessageDate);

      // Filter out contacts with no messages in the last 5 years
      const fiveYearsAgo = getYearsAgoTimestamp(5);
      const macEpoch = require('./constants').MAC_EPOCH;
      const fiveYearsAgoMacTime = (fiveYearsAgo - macEpoch) * 1000000; // Convert to Mac timestamp (nanoseconds)

      const recentConversations = deduplicatedConversations.filter(conv => {
        return conv.lastMessageDate > fiveYearsAgoMacTime;
      });

      return {
        success: true,
        conversations: recentConversations
      };
    } catch (error) {
      // Clean up db2 if it was opened
      if (dbClose2) {
        try {
          await dbClose2();
        } catch (closeError) {
          console.error('Error closing db2:', closeError);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting conversations:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Get messages for a specific conversation
ipcMain.handle('get-messages', async (event, chatId) => {
  try {
    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );

    const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    try {
      const messages = await dbAll(`
        SELECT
          message.ROWID as id,
          message.text,
          message.date,
          message.is_from_me,
          handle.id as sender
        FROM message
        JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
        LEFT JOIN handle ON message.handle_id = handle.ROWID
        WHERE chat_message_join.chat_id = ?
        ORDER BY message.date ASC
      `, [chatId]);

      await dbClose();

      return {
        success: true,
        messages: messages.map(msg => ({
          id: msg.id,
          text: msg.text || '',
          date: msg.date,
          isFromMe: msg.is_from_me === 1,
          sender: msg.sender
        }))
      };
    } catch (error) {
      await dbClose();
      throw error;
    }
  } catch (error) {
    console.error('Error getting messages:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Open folder in Finder
ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error('Error opening folder:', error);
    return { success: false, error: error.message };
  }
});

// Export conversations to files
ipcMain.handle('export-conversations', async (event, conversationIds) => {
  try {
    // Generate default folder name with timestamp
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[/:]/g, '-').replace(', ', ' ');

    const defaultFolderName = `Text Messages Export ${timestamp}`;

    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Choose Export Location',
      defaultPath: path.join(app.getPath('documents'), defaultFolderName),
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Create export directory
    await fs.mkdir(filePath, { recursive: true });

    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );

    const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Load contact names for resolving names in export
    const contactMap = await getContactNames();

    const exportedFiles = [];
    const exportedContactNames = [];

    try {
      for (const chatId of conversationIds) {
        // Get chat info
        const chatInfo = await dbAll(`
          SELECT
            chat.chat_identifier,
            chat.display_name,
            handle.id as contact_id
          FROM chat
          LEFT JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
          LEFT JOIN handle ON chat_handle_join.handle_id = handle.ROWID
          WHERE chat.ROWID = ?
          LIMIT 1
        `, [chatId]);

        if (chatInfo.length === 0) continue;

        // Resolve contact name using the same logic as conversation list
        const chatName = resolveContactName(
          chatInfo[0].contact_id,
          chatInfo[0].chat_identifier,
          chatInfo[0].display_name,
          contactMap
        );

        // Track contact names for folder renaming
        exportedContactNames.push(chatName);

        // Get messages with attachment info
        // Note: Some messages have text in 'attributedBody' blob field instead of 'text'
        const messages = await dbAll(`
          SELECT
            message.ROWID as id,
            message.text,
            message.date,
            message.is_from_me,
            handle.id as sender,
            message.cache_has_attachments,
            message.attributedBody
          FROM message
          JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
          LEFT JOIN handle ON message.handle_id = handle.ROWID
          WHERE chat_message_join.chat_id = ?
          ORDER BY message.date ASC
        `, [chatId]);

        // Format messages as text
        let exportContent = `Conversation with: ${chatName}\n`;
        exportContent += `Exported: ${new Date().toLocaleString()}\n`;
        exportContent += `Total Messages: ${messages.length}\n`;
        exportContent += '='.repeat(80) + '\n\n';

        for (const msg of messages) {
          // Convert Mac timestamp to readable date
          const messageDate = macTimestampToDate(msg.date);

          // Resolve sender name
          let sender;
          if (msg.is_from_me) {
            sender = 'Me';
          } else if (msg.sender) {
            // Try to resolve sender name from contacts
            const resolvedName = resolveContactName(msg.sender, null, null, contactMap);
            sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
          } else {
            sender = 'Unknown';
          }

          // Handle text content (using centralized message parser)
          const text = getMessageText(msg);

          exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
        }

        // Save file
        const fileName = createTimestampedFilename(chatName, 'txt');
        const exportFilePath = path.join(filePath, fileName);

        await fs.writeFile(exportFilePath, exportContent, 'utf8');
        exportedFiles.push(fileName);
      }

      await dbClose();

      // Rename folder if exporting a single contact
      let finalPath = filePath;
      if (exportedContactNames.length === 1) {
        const contactName = exportedContactNames[0];
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/[/:]/g, '-').replace(', ', ' ');

        // Format: "Name text messages export MM-DD-YYYY HH:MM:SS"
        const newFolderName = `${contactName} text messages export ${timestamp}`;
        const newPath = path.join(path.dirname(filePath), newFolderName);

        try {
          await fs.rename(filePath, newPath);
          finalPath = newPath;
        } catch (renameError) {
          console.error('Error renaming folder:', renameError);
          // Keep original path if rename fails
        }
      }

      return {
        success: true,
        exportPath: finalPath,
        filesCreated: exportedFiles
      };
    } catch (error) {
      await dbClose();
      throw error;
    }
  } catch (error) {
    console.error('Error exporting conversations:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Install update and restart
ipcMain.on('install-update', () => {
  log.info('Installing update...');

  // Ensure app relaunches after update
  // Parameters: isSilent, isForceRunAfter
  // false = show installer, true = force run after install
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    if (mainWindow) {
      mainWindow.removeAllListeners('close');
      mainWindow.close();
    }
    autoUpdater.quitAndInstall(false, true);
  });
});

// ===== OUTLOOK INTEGRATION IPC HANDLERS =====
// Now using redirect-based OAuth (no device code required!)

// Initialize Outlook service (no-op now, kept for compatibility)
ipcMain.handle('outlook-initialize', async () => {
  return { success: true };
});

// Authenticate with Outlook using redirect-based OAuth
ipcMain.handle('outlook-authenticate', async (event, userId) => {
  try {
    console.log('[Main] Starting Outlook authentication with redirect flow');

    // Get user info to use as login hint
    let loginHint = null;
    if (userId) {
      const user = await databaseService.getUserById(userId);
      if (user) {
        loginHint = user.email;
      }
    }

    // Start auth flow - returns authUrl and a promise for the code
    const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService.authenticateForMailbox(loginHint);

    // Open browser with auth URL
    await shell.openExternal(authUrl);

    // Wait for user to complete auth in browser (local server will catch redirect)
    const code = await codePromise;
    console.log('[Main] Received authorization code from redirect');

    // Exchange code for tokens
    const tokens = await microsoftAuthService.exchangeCodeForTokens(code, codeVerifier);

    // Get user info
    const userInfo = await microsoftAuthService.getUserInfo(tokens.access_token);

    // Encrypt tokens before saving
    const encryptedAccessToken = tokenEncryptionService.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? tokenEncryptionService.encrypt(tokens.refresh_token)
      : null;

    // Save mailbox token to database
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await databaseService.saveOAuthToken(userId, 'microsoft', 'mailbox', {
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: expiresAt,
      scopes_granted: tokens.scope,
      connected_email_address: userInfo.email
    });

    console.log('[Main] Outlook authentication completed successfully');

    return {
      success: true,
      userInfo: {
        username: userInfo.email,
        name: userInfo.name,
      }
    };
  } catch (error) {
    console.error('[Main] Outlook authentication failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check if authenticated
ipcMain.handle('outlook-is-authenticated', async (event, userId) => {
  try {
    if (!userId) return false;

    const token = await databaseService.getOAuthToken(userId, 'microsoft', 'mailbox');
    if (!token || !token.access_token) return false;

    // Check if token is expired
    const tokenExpiry = new Date(token.token_expires_at);
    const now = new Date();

    return tokenExpiry > now;
  } catch (error) {
    console.error('Error checking Outlook authentication:', error);
    return false;
  }
});

// Get user email
ipcMain.handle('outlook-get-user-email', async (event, userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'User ID required'
      };
    }

    const token = await databaseService.getOAuthToken(userId, 'microsoft', 'mailbox');
    if (!token || !token.connected_email_address) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    return {
      success: true,
      email: token.connected_email_address
    };
  } catch (error) {
    console.error('Error getting user email:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Export emails for multiple contacts
ipcMain.handle('outlook-export-emails', async (event, contacts) => {
  try {
    if (!outlookService || !outlookService.isAuthenticated()) {
      return {
        success: false,
        error: 'Not authenticated with Outlook'
      };
    }

    // Show dialog to select export location (folder picker)
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Folder for Audit Export',
      defaultPath: path.join(os.homedir(), 'Documents'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder'
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    // Auto-generate folder name: "Audit Export YYYY-MM-DD HH-MM-SS"
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[/:]/g, '-').replace(/,/g, '');

    const exportFolderName = `Audit Export ${timestamp}`;
    const exportPath = path.join(filePaths[0], exportFolderName);

    // Create base export directory
    await fs.mkdir(exportPath, { recursive: true });

    // Open Messages database for text message export
    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );
    const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Load contact names for resolving names in export
    const { contactMap } = await getContactNames();

    const results = [];

    // Export BOTH text messages AND emails for each contact
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Send progress update
      mainWindow.webContents.send('export-progress', {
        stage: 'contact',
        current: i + 1,
        total: contacts.length,
        contactName: contact.name
      });

      // Create contact folder
      const sanitizedName = sanitizeFilename(contact.name, true);
      const contactFolder = path.join(exportPath, sanitizedName);
      await fs.mkdir(contactFolder, { recursive: true });

      let textMessageCount = 0;
      let totalEmails = 0;
      let anySuccess = false;
      let errors = [];

      // 1. Export text messages (if chatId exists or if we have phone/email identifiers)
      if (contact.chatId || contact.phones?.length > 0 || contact.emails?.length > 0) {
        try {
          mainWindow.webContents.send('export-progress', {
            stage: 'text-messages',
            message: `Exporting text messages for ${contact.name}...`,
            current: i + 1,
            total: contacts.length,
            contactName: contact.name
          });

          let messages = [];
          const allChatIds = new Set();

          // Strategy: Fetch messages from ALL chats involving this contact
          // This includes both their primary 1:1 chat AND any group chats they're in

          // Step 1: If they have a primary chatId, add it
          if (contact.chatId && !(typeof contact.chatId === 'string' && contact.chatId.startsWith('group-contact-'))) {
            allChatIds.add(contact.chatId);
          }

          // Step 2: Find ALL chats where their phone numbers or emails appear
          // This will find group chats they're in
          const identifiers = [
            ...(contact.phones || []),
            ...(contact.emails || [])
          ];

          if (identifiers.length > 0) {
            const placeholders = identifiers.map(() => '?').join(',');
            const chatIds = await dbAll(`
              SELECT DISTINCT chat.ROWID as chat_id, chat.display_name, chat.chat_identifier
              FROM chat
              JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
              JOIN handle ON chat_handle_join.handle_id = handle.ROWID
              WHERE handle.id IN (${placeholders})
            `, identifiers);

            chatIds.forEach(c => {
              allChatIds.add(c.chat_id);
            });
          }

          // Step 3: Fetch messages from ALL identified chats
          if (allChatIds.size > 0) {
            const chatIdArray = Array.from(allChatIds);
            const chatIdPlaceholders = chatIdArray.map(() => '?').join(',');

            messages = await dbAll(`
              SELECT
                message.ROWID as id,
                message.text,
                message.date,
                message.is_from_me,
                handle.id as sender,
                message.cache_has_attachments,
                message.attributedBody,
                chat_message_join.chat_id
              FROM message
              JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
              LEFT JOIN handle ON message.handle_id = handle.ROWID
              WHERE chat_message_join.chat_id IN (${chatIdPlaceholders})
              ORDER BY message.date ASC
            `, chatIdArray);
          }

          textMessageCount = messages.length;

          if (messages.length > 0) {
            // Group messages by chat_id
            const messagesByChatId = {};
            for (const msg of messages) {
              const chatId = msg.chat_id || 'unknown';
              if (!messagesByChatId[chatId]) {
                messagesByChatId[chatId] = [];
              }
              messagesByChatId[chatId].push(msg);
            }

            // Get chat info for each chat_id
            const chatInfoMap = {};
            const chatIds = Object.keys(messagesByChatId).filter(id => id !== 'unknown');
            if (chatIds.length > 0) {
              const chatInfoQuery = `
                SELECT
                  chat.ROWID as chat_id,
                  chat.chat_identifier,
                  chat.display_name
                FROM chat
                WHERE chat.ROWID IN (${chatIds.map(() => '?').join(',')})
              `;
              const chatInfoResults = await dbAll(chatInfoQuery, chatIds);
              chatInfoResults.forEach(info => {
                chatInfoMap[info.chat_id] = info;
              });
            }

            // Separate group chats from 1:1 chats
            const groupChats = {};
            const oneOnOneMessages = [];

            for (const [chatId, chatMessages] of Object.entries(messagesByChatId)) {
              const chatInfo = chatInfoMap[chatId];

              if (!chatInfo) {
                oneOnOneMessages.push(...chatMessages);
                continue;
              }

              const isGroupChat = chatInfo.chat_identifier &&
                                  typeof chatInfo.chat_identifier === 'string' &&
                                  chatInfo.chat_identifier.startsWith('chat') &&
                                  !chatInfo.chat_identifier.includes('@');

              if (isGroupChat) {
                groupChats[chatId] = {
                  info: chatInfo,
                  messages: chatMessages
                };
              } else {
                oneOnOneMessages.push(...chatMessages);
              }
            }

            // Sort all 1:1 messages by date
            oneOnOneMessages.sort((a, b) => a.date - b.date);

            let filesCreated = 0;

            // Export all 1:1 messages to a single file
            if (oneOnOneMessages.length > 0) {
              let exportContent = `1-ON-1 MESSAGES\n`;
              exportContent += `Contact: ${contact.name}\n`;
              exportContent += `Exported: ${new Date().toLocaleString()}\n`;
              exportContent += `Total Messages: ${oneOnOneMessages.length}\n`;
              exportContent += '='.repeat(80) + '\n\n';

              for (const msg of oneOnOneMessages) {
                // Convert Mac timestamp to readable date
                const messageDate = macTimestampToDate(msg.date);

                // Resolve sender name
                let sender;
                if (msg.is_from_me) {
                  sender = 'Me';
                } else if (msg.sender) {
                  const resolvedName = resolveContactName(msg.sender, null, null, contactMap);
                  sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
                } else {
                  sender = 'Unknown';
                }

                // Handle text content (using centralized message parser)
                const text = getMessageText(msg);

                exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
              }

              // Save 1:1 messages file
              const oneOnOneFilePath = path.join(contactFolder, '1-on-1_messages.txt');
              await fs.writeFile(oneOnOneFilePath, exportContent, 'utf8');
              filesCreated++;
              anySuccess = true;
            }

            // Export each group chat to its own file
            for (const [chatId, groupChat] of Object.entries(groupChats)) {
              const chatName = groupChat.info.display_name || `Group Chat ${chatId}`;
              const sanitized = sanitizeFilename(chatName);
              const fileName = `group_chat_${sanitized}.txt`;

              let exportContent = `GROUP CHAT: ${chatName}\n`;
              exportContent += `Contact: ${contact.name}\n`;
              exportContent += `Exported: ${new Date().toLocaleString()}\n`;
              exportContent += `Messages in this chat: ${groupChat.messages.length}\n`;
              exportContent += '='.repeat(80) + '\n\n';

              for (const msg of groupChat.messages) {
                // Convert Mac timestamp to readable date
                const messageDate = macTimestampToDate(msg.date);

                // Resolve sender name
                let sender;
                if (msg.is_from_me) {
                  sender = 'Me';
                } else if (msg.sender) {
                  const resolvedName = resolveContactName(msg.sender, null, null, contactMap);
                  sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
                } else {
                  sender = 'Unknown';
                }

                // Handle text content (using centralized message parser)
                const text = getMessageText(msg);

                exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
              }

              // Save group chat file
              const groupFilePath = path.join(contactFolder, fileName);
              await fs.writeFile(groupFilePath, exportContent, 'utf8');
              filesCreated++;
              anySuccess = true;
            }
          }
        } catch (err) {
          console.error(`Error exporting text messages for ${contact.name}:`, err);
          errors.push(`Text messages: ${err.message}`);
        }
      }

      // 2. Export emails (if email addresses exist)
      if (contact.emails && contact.emails.length > 0) {
        for (const email of contact.emails) {
          try {
            const result = await outlookService.exportEmailsToAudit(
              contact.name,
              email,
              exportPath,
              (progress) => {
                // Forward progress to renderer
                mainWindow.webContents.send('export-progress', {
                  ...progress,
                  contactName: contact.name,
                  current: i + 1,
                  total: contacts.length
                });
              }
            );

            if (result.success) {
              anySuccess = true;
              totalEmails += result.emailCount || 0;
            } else if (result.error) {
              errors.push(`${email}: ${result.error}`);
            }
          } catch (err) {
            console.error(`  - Error exporting emails from ${email}:`, err);
            errors.push(`${email}: ${err.message}`);
          }
        }
      }

      results.push({
        contactName: contact.name,
        success: anySuccess,
        textMessageCount: textMessageCount,
        emailCount: totalEmails,
        error: errors.length > 0 ? errors.join('; ') : null
      });
    }

    // Close database
    await dbClose();

    // Show OS notification when complete
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    new Notification({
      title: 'Full Audit Export Complete',
      body: `Exported ${successCount} contact${successCount !== 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : ''}`,
    }).show();

    return {
      success: true,
      exportPath: exportPath,
      results: results
    };

  } catch (error) {
    console.error('Error exporting full audit:', error);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
});

// Sign out from Outlook
ipcMain.handle('outlook-signout', async () => {
  try {
    if (outlookService) {
      await outlookService.signOut();
    }
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
