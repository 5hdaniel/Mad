const { app, BrowserWindow, ipcMain, dialog, shell, systemPreferences, Notification } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const { exec } = require('child_process');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const OutlookService = require('./outlookService');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configure logging for auto-updater
log.transports.file.level = 'info';
autoUpdater.logger = log;

let mainWindow;
let outlookService = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff'
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

    // Check for updates 5 seconds after window loads (only in production)
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
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

app.whenReady().then(createWindow);

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

// Helper function to get contact names from macOS Contacts database
async function getContactNames() {
  const contactMap = {};
  const phoneToContactInfo = {};

  try {
    // Search for ALL possible Contacts database files
    const baseDir = path.join(process.env.HOME, 'Library/Application Support/AddressBook');

    // Use exec to find all .abcddb files
    const { exec: execCallback } = require('child_process');
    const execPromise = promisify(execCallback);

    try {
      const { stdout } = await execPromise(`find "${baseDir}" -name "*.abcddb" 2>/dev/null`);
      const dbFiles = stdout.trim().split('\n').filter(f => f);

      // Try each database and count records
      for (const dbPath of dbFiles) {
        try {
          const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
          const dbAll = promisify(db.all.bind(db));
          const dbClose = promisify(db.close.bind(db));

          const recordCount = await dbAll(`SELECT COUNT(*) as count FROM ZABCDRECORD WHERE Z_ENT IS NOT NULL;`);
          await dbClose();

          // If this database has more records, use it
          if (recordCount[0].count > 10) {
            console.log(`Found Contacts database with ${recordCount[0].count} contacts`);
            return await loadContactsFromDatabase(dbPath);
          }
        } catch (err) {
          // Silently skip unreadable databases
        }
      }
    } catch (err) {
      console.error('Error finding database files:', err.message);
    }

    // Fallback to old method
    console.log('Could not find main contacts database, trying default location...');
    const defaultPath = path.join(process.env.HOME, 'Library/Application Support/AddressBook/AddressBook-v22.abcddb');
    return await loadContactsFromDatabase(defaultPath);

  } catch (error) {
    console.error('Error accessing contacts database:', error);
    return { contactMap, phoneToContactInfo };
  }
}

// Helper function to load contacts from a specific database
async function loadContactsFromDatabase(contactsDbPath) {
  const contactMap = {};
  const phoneToContactInfo = {}; // Map phone numbers to full contact info (all phones & emails)

  try {
    await fs.access(contactsDbPath);
  } catch {
    console.log('Database not accessible:', contactsDbPath);
    return { contactMap, phoneToContactInfo };
  }

  try {
    const db = new sqlite3.Database(contactsDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Query to get contacts with both phone numbers and emails
    // Group by person to associate phones with emails
    const contactsResult = await dbAll(`
      SELECT
        ZABCDRECORD.Z_PK as person_id,
        ZABCDRECORD.ZFIRSTNAME as first_name,
        ZABCDRECORD.ZLASTNAME as last_name,
        ZABCDRECORD.ZORGANIZATION as organization
      FROM ZABCDRECORD
      WHERE ZABCDRECORD.Z_PK IS NOT NULL
    `);

    const phonesResult = await dbAll(`
      SELECT
        ZABCDPHONENUMBER.ZOWNER as person_id,
        ZABCDPHONENUMBER.ZFULLNUMBER as phone
      FROM ZABCDPHONENUMBER
      WHERE ZABCDPHONENUMBER.ZFULLNUMBER IS NOT NULL
    `);

    const emailsResult = await dbAll(`
      SELECT
        ZABCDEMAILADDRESS.ZOWNER as person_id,
        ZABCDEMAILADDRESS.ZADDRESS as email
      FROM ZABCDEMAILADDRESS
      WHERE ZABCDEMAILADDRESS.ZADDRESS IS NOT NULL
    `);

    await dbClose();

    // Build person map
    const personMap = {};
    contactsResult.forEach(person => {
      const firstName = person.first_name || '';
      const lastName = person.last_name || '';
      const organization = person.organization || '';

      let displayName = '';
      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
      } else if (organization) {
        displayName = organization;
      } else if (firstName) {
        displayName = firstName;
      } else if (lastName) {
        displayName = lastName;
      }

      if (displayName) {
        personMap[person.person_id] = {
          name: displayName,
          phones: [],
          emails: []
        };
      }
    });

    // Add phones to persons
    phonesResult.forEach(phone => {
      if (personMap[phone.person_id]) {
        personMap[phone.person_id].phones.push(phone.phone);
      }
    });

    // Add emails to persons
    emailsResult.forEach(email => {
      if (personMap[email.person_id]) {
        personMap[email.person_id].emails.push(email.email);
      }
    });

    console.log(`Loaded ${Object.keys(personMap).length} contact entries from Contacts database`);

    // Build maps
    Object.values(personMap).forEach(person => {
      // Map phone numbers to name
      person.phones.forEach(phone => {
        const normalized = phone.replace(/\D/g, '');
        contactMap[normalized] = person.name;
        contactMap[phone] = person.name;

        // Map phone to full contact info (ALL phones and emails)
        phoneToContactInfo[normalized] = {
          name: person.name,
          phones: person.phones,
          emails: person.emails
        };
        phoneToContactInfo[phone] = {
          name: person.name,
          phones: person.phones,
          emails: person.emails
        };
      });

      // Map emails to name
      person.emails.forEach(email => {
        const emailLower = email.toLowerCase();
        contactMap[emailLower] = person.name;
      });
    });
  } catch (error) {
    console.error('Error accessing contacts database:', error);
  }

  return { contactMap, phoneToContactInfo };
}

// Helper function to normalize phone numbers for matching
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Helper function to resolve contact name
function resolveContactName(contactId, chatIdentifier, displayName, contactMap) {
  // If we have a display_name from Messages, use it
  if (displayName) return displayName;

  // Try to find contact name by contactId (phone or email)
  if (contactId) {
    // Try direct match
    if (contactMap[contactId]) {
      return contactMap[contactId];
    }

    // Try normalized phone number match
    const normalized = normalizePhoneNumber(contactId);
    if (normalized && contactMap[normalized]) {
      return contactMap[normalized];
    }

    // Try lowercase email match
    const lowerEmail = contactId.toLowerCase();
    if (contactMap[lowerEmail]) {
      return contactMap[lowerEmail];
    }
  }

  // Try chat_identifier as fallback
  if (chatIdentifier) {
    if (contactMap[chatIdentifier]) {
      return contactMap[chatIdentifier];
    }

    const normalized = normalizePhoneNumber(chatIdentifier);
    if (normalized && contactMap[normalized]) {
      return contactMap[normalized];
    }
  }

  // Final fallback: show the phone/email
  return contactId || chatIdentifier || 'Unknown';
}

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

    try {
      // Get contact names from Contacts database
      console.log('Loading contact names...');
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

      await dbClose();

      // Map conversations and deduplicate by contact NAME
      // This ensures that if a contact has multiple phone numbers or emails,
      // they appear as ONE contact with all their info
      const conversationMap = new Map();

      conversations.forEach(conv => {
        const rawContactId = conv.contact_id || conv.chat_identifier;
        const displayName = resolveContactName(conv.contact_id, conv.chat_identifier, conv.display_name, contactMap);

        // Skip group chats - they have chat_identifier like "chat123456789"
        // Individual chats have phone numbers or emails as identifiers
        const isGroupChat = conv.chat_identifier && conv.chat_identifier.startsWith('chat') && !conv.chat_identifier.includes('@');
        if (isGroupChat) {
          console.log(`Skipping group chat: ${displayName} (${conv.chat_identifier})`);
          return; // Skip this conversation
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
          name: displayName,
          contactId: rawContactId,
          phones: phones,
          emails: emails,
          showBothNameAndNumber: displayName !== rawContactId,
          messageCount: conv.message_count,
          lastMessageDate: conv.last_message_date
        };

        // If we already have this contact, merge the data
        if (conversationMap.has(normalizedKey)) {
          const existing = conversationMap.get(normalizedKey);

          // Merge phones (unique)
          const allPhones = [...new Set([...existing.phones, ...phones])];
          // Merge emails (unique)
          const allEmails = [...new Set([...existing.emails, ...emails])];

          // Keep the chat ID with the most recent messages for text export
          if (conv.last_message_date > existing.lastMessageDate) {
            existing.id = conv.chat_id;
            existing.lastMessageDate = conv.last_message_date;
          }

          // Add up message counts
          existing.messageCount += conv.message_count;
          existing.phones = allPhones;
          existing.emails = allEmails;
        } else {
          conversationMap.set(normalizedKey, conversationData);
        }
      });

      // Convert map back to array
      const deduplicatedConversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessageDate - a.lastMessageDate);

      console.log(`Deduplicated ${conversations.length} conversations to ${deduplicatedConversations.length}`);

      // Filter out contacts with no messages in the last 5 years
      const fiveYearsAgo = Date.now() - (5 * 365 * 24 * 60 * 60 * 1000); // 5 years in milliseconds
      const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
      const fiveYearsAgoMacTime = (fiveYearsAgo - macEpoch) * 1000000; // Convert to Mac timestamp (nanoseconds)

      const recentConversations = deduplicatedConversations.filter(conv => {
        return conv.lastMessageDate > fiveYearsAgoMacTime;
      });

      console.log(`Filtered to ${recentConversations.length} contacts with messages in last 5 years (removed ${deduplicatedConversations.length - recentConversations.length} old contacts)`);

      return {
        success: true,
        conversations: recentConversations
      };
    } catch (error) {
      await dbClose();
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
    console.log('Loading contacts for export...');
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

        // DEBUG: Log first message to see what data we have
        if (messages.length > 0) {
          const firstMsg = messages[0];
          console.log('\n=== Sample Message Debug ===');
          console.log('Text field:', firstMsg.text);
          console.log('Has attachments:', firstMsg.cache_has_attachments);
          console.log('AttributedBody length:', firstMsg.attributedBody ? firstMsg.attributedBody.length : 0);

          if (firstMsg.attributedBody) {
            // Show first 200 characters of the blob in hex and text
            const sample = firstMsg.attributedBody.slice(0, 200);
            console.log('AttributedBody hex sample:', sample.toString('hex').substring(0, 100));
            console.log('AttributedBody text sample:', sample.toString('utf8').replace(/[\x00-\x1F\x7F-\x9F]/g, '·').substring(0, 100));
          }
          console.log('Date:', firstMsg.date);
          console.log('============================\n');
        }

        // Format messages as text
        let exportContent = `Conversation with: ${chatName}\n`;
        exportContent += `Exported: ${new Date().toLocaleString()}\n`;
        exportContent += `Total Messages: ${messages.length}\n`;
        exportContent += '='.repeat(80) + '\n\n';

        for (const msg of messages) {
          // Convert Mac timestamp to readable date
          // Mac timestamps are nanoseconds since 2001-01-01
          const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
          const messageDate = new Date(macEpoch + (msg.date / 1000000));

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

          // Handle text content
          let text;
          if (msg.text) {
            text = msg.text;
          } else if (msg.attributedBody) {
            // Extract text from attributedBody blob (NSKeyedArchiver format)
            // This contains NSAttributedString with the actual message text
            try {
              const bodyBuffer = msg.attributedBody;
              const bodyText = bodyBuffer.toString('utf8');

              // Extract readable text after NSString marker
              // Pattern: NSString is followed by some length bytes, then the actual text
              let extractedText = null;

              // Method 1: Look for text after NSString marker
              // The format is: ...NSString[binary][length markers]ACTUAL_TEXT
              const nsStringIndex = bodyText.indexOf('NSString');
              if (nsStringIndex !== -1) {
                // Skip NSString and more metadata bytes to get closer to actual text
                const afterNSString = bodyText.substring(nsStringIndex + 20);

                // Find ALL sequences of printable text
                const allMatches = afterNSString.match(/[\x20-\x7E\u00A0-\uFFFF]{3,}/g);
                if (allMatches && allMatches.length > 0) {
                  // Find the longest match that contains alphanumeric characters
                  for (const match of allMatches.sort((a, b) => b.length - a.length)) {
                    const cleaned = match
                      .replace(/^[^\w\s]+/, '') // Remove leading symbols
                      .replace(/[^\w\s]+$/, '') // Remove trailing symbols
                      .trim();

                    // Accept if it has alphanumeric content and is reasonable length
                    if (cleaned.length >= 2 && /[a-zA-Z0-9]/.test(cleaned)) {
                      extractedText = cleaned;
                      break;
                    }
                  }
                }
              }

              // Method 2: If method 1 failed, look for text after 'streamtyped'
              if (!extractedText) {
                const streamIndex = bodyText.indexOf('streamtyped');
                if (streamIndex !== -1) {
                  const afterStream = bodyText.substring(streamIndex + 11);
                  const textMatch = afterStream.match(/[\x20-\x7E\u00A0-\uFFFF]{2,}/);
                  if (textMatch) {
                    extractedText = textMatch[0]
                      .replace(/^[^\w\s]+/, '')
                      .trim();
                  }
                }
              }

              // Validate and clean extracted text
              if (extractedText && extractedText.length >= 1 && extractedText.length < 10000) {
                // Additional cleaning
                extractedText = extractedText
                  .replace(/\x00/g, '') // Remove null bytes
                  .replace(/[\x01-\x08\x0B-\x1F\x7F]/g, '') // Remove control chars
                  .trim();

                text = extractedText;
              } else {
                text = '[Message text - unable to extract from rich format]';
              }
            } catch (e) {
              console.error('Error parsing attributedBody:', e.message);
              text = '[Message text - parsing error]';
            }
          } else if (msg.cache_has_attachments === 1) {
            text = '[Attachment - Photo/Video/File]';
          } else {
            text = '[Reaction or system message]';
          }

          exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
        }

        // Save file
        const safeFileName = chatName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeFileName}_${Date.now()}.txt`;
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
          console.log(`Renamed export folder to: ${newFolderName}`);
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
  autoUpdater.quitAndInstall();
});

// ===== OUTLOOK INTEGRATION IPC HANDLERS =====

// Initialize Outlook service
ipcMain.handle('outlook-initialize', async () => {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

    if (!clientId) {
      return {
        success: false,
        error: 'Microsoft Client ID not configured. Please add MICROSOFT_CLIENT_ID to .env.local'
      };
    }

    if (!outlookService) {
      outlookService = new OutlookService();
    }

    await outlookService.initialize(clientId, tenantId);

    return { success: true };
  } catch (error) {
    console.error('Error initializing Outlook service:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Authenticate with Outlook
ipcMain.handle('outlook-authenticate', async () => {
  try {
    if (!outlookService) {
      return {
        success: false,
        error: 'Outlook service not initialized'
      };
    }

    const result = await outlookService.authenticate(mainWindow);
    return result;
  } catch (error) {
    console.error('Error authenticating with Outlook:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check if authenticated
ipcMain.handle('outlook-is-authenticated', async () => {
  return outlookService && outlookService.isAuthenticated();
});

// Get user email
ipcMain.handle('outlook-get-user-email', async () => {
  try {
    if (!outlookService || !outlookService.isAuthenticated()) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    const email = await outlookService.getUserEmail();
    return {
      success: true,
      email: email
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
    console.log(`Starting full audit export for ${contacts.length} contacts`);

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
    console.log(`Created export folder: ${exportPath}`);

    // Open Messages database for text message export
    const messagesDbPath = path.join(
      process.env.HOME,
      'Library/Messages/chat.db'
    );
    const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Load contact names for resolving names in export
    console.log('Loading contacts for export...');
    const { contactMap } = await getContactNames();

    const results = [];

    // Export BOTH text messages AND emails for each contact
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      console.log(`\n=== Processing contact ${i + 1}/${contacts.length}: ${contact.name} ===`);

      // Send progress update
      mainWindow.webContents.send('export-progress', {
        stage: 'contact',
        current: i + 1,
        total: contacts.length,
        contactName: contact.name
      });

      // Create contact folder
      const sanitizedName = contact.name.replace(/[^a-z0-9 ]/gi, '_');
      const contactFolder = path.join(exportPath, sanitizedName);
      await fs.mkdir(contactFolder, { recursive: true });
      console.log(`Created contact folder: ${contactFolder}`);

      let textMessageCount = 0;
      let totalEmails = 0;
      let anySuccess = false;
      let errors = [];

      // 1. Export text messages (if chatId exists)
      if (contact.chatId) {
        try {
          console.log(`Exporting text messages for ${contact.name} (chatId: ${contact.chatId})...`);
          mainWindow.webContents.send('export-progress', {
            stage: 'text-messages',
            message: `Exporting text messages for ${contact.name}...`,
            current: i + 1,
            total: contacts.length,
            contactName: contact.name
          });

          // Get messages for this chat
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
          `, [contact.chatId]);

          console.log(`Found ${messages.length} text messages for ${contact.name}`);
          textMessageCount = messages.length;

          if (messages.length > 0) {
            // Format messages as text
            let exportContent = `TEXT MESSAGES WITH: ${contact.name}\n`;
            exportContent += `Exported: ${new Date().toLocaleString()}\n`;
            exportContent += `Total Messages: ${messages.length}\n`;
            exportContent += '='.repeat(80) + '\n\n';

            for (const msg of messages) {
              // Convert Mac timestamp to readable date
              const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
              const messageDate = new Date(macEpoch + (msg.date / 1000000));

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

              // Handle text content (same logic as export-conversations)
              let text;

              // Check if text field has the special marker
              if (msg.text && msg.text !== '__kIMMessagePartAttributeName') {
                text = msg.text;
              } else if (msg.attributedBody) {
                // Text is in attributedBody (either no text field, or it has the marker)
                try {
                  const bodyBuffer = msg.attributedBody;
                  const bodyText = bodyBuffer.toString('utf8');
                  let extractedText = null;

                  const nsStringIndex = bodyText.indexOf('NSString');
                  if (nsStringIndex !== -1) {
                    // Look further into the buffer for the actual message content
                    const afterNSString = bodyText.substring(nsStringIndex + 8);

                    // Find all sequences of readable text
                    const allMatches = afterNSString.match(/[\x20-\x7E\u00A0-\uFFFF]{4,}/g);
                    if (allMatches && allMatches.length > 0) {
                      // Filter out the marker itself
                      const filtered = allMatches.filter(m => !m.includes('__kIMMessagePartAttributeName'));

                      // Find the best match - prefer longest with good content
                      for (const match of filtered.sort((a, b) => b.length - a.length)) {
                        // Clean up but preserve actual content - only remove control chars and nulls
                        const cleaned = match
                          .replace(/\x00/g, '') // Remove null bytes
                          .replace(/[\x01-\x08\x0B-\x1F\x7F]/g, '') // Remove control chars
                          .trim();

                        // Accept if it has real content (letters or numbers)
                        if (cleaned.length >= 2 && /[a-zA-Z0-9]/.test(cleaned)) {
                          extractedText = cleaned;
                          break;
                        }
                      }
                    }
                  }

                  if (!extractedText) {
                    const streamIndex = bodyText.indexOf('streamtyped');
                    if (streamIndex !== -1) {
                      const afterStream = bodyText.substring(streamIndex + 11);
                      const textMatch = afterStream.match(/[\x20-\x7E\u00A0-\uFFFF]{3,}/);
                      if (textMatch) {
                        const cleaned = textMatch[0]
                          .replace(/\x00/g, '')
                          .replace(/[\x01-\x08\x0B-\x1F\x7F]/g, '')
                          .trim();

                        // Filter out the marker
                        if (!cleaned.includes('__kIMMessagePartAttributeName')) {
                          extractedText = cleaned;
                        }
                      }
                    }
                  }

                  if (extractedText && extractedText.length >= 1 && extractedText.length < 10000) {
                    text = extractedText;
                  } else {
                    text = '[Message text - unable to extract from rich format]';
                  }
                } catch (e) {
                  text = '[Message text - parsing error]';
                }
              } else if (msg.cache_has_attachments === 1) {
                text = '[Attachment - Photo/Video/File]';
              } else {
                text = '[Reaction or system message]';
              }

              exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
            }

            // Save text messages file
            const textFilePath = path.join(contactFolder, 'text_messages.txt');
            await fs.writeFile(textFilePath, exportContent, 'utf8');
            console.log(`Saved text messages to: ${textFilePath}`);
            anySuccess = true;
          }
        } catch (err) {
          console.error(`Error exporting text messages for ${contact.name}:`, err);
          errors.push(`Text messages: ${err.message}`);
        }
      } else {
        console.log(`No chatId for ${contact.name}, skipping text messages`);
      }

      // 2. Export emails (if email addresses exist)
      if (contact.emails && contact.emails.length > 0) {
        console.log(`Exporting emails for ${contact.name} (${contact.emails.length} email addresses)...`);

        for (const email of contact.emails) {
          try {
            console.log(`  - Fetching emails from: ${email}`);
            const result = await outlookService.exportEmailsToAudit(
              contact.name,
              email,
              exportPath,
              (progress) => {
                console.log(`    Progress: ${progress.stage} - ${progress.message || ''}`);
                // Forward progress to renderer
                mainWindow.webContents.send('export-progress', {
                  ...progress,
                  contactName: contact.name,
                  current: i + 1,
                  total: contacts.length
                });
              }
            );

            console.log(`  - Result for ${email}:`, { success: result.success, emailCount: result.emailCount, error: result.error });

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
      } else {
        console.log(`No email addresses for ${contact.name}, skipping emails`);
      }

      results.push({
        contactName: contact.name,
        success: anySuccess,
        textMessageCount: textMessageCount,
        emailCount: totalEmails,
        error: errors.length > 0 ? errors.join('; ') : null
      });

      console.log(`=== Completed ${contact.name}: ${textMessageCount} texts, ${totalEmails} emails ===\n`);
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

    console.log('Export complete!');
    console.log('Results:', JSON.stringify(results, null, 2));

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

// Get email count for a contact
ipcMain.handle('outlook-get-email-count', async (event, contactEmail) => {
  try {
    if (!outlookService || !outlookService.isAuthenticated()) {
      return {
        success: true,
        count: 0
      };
    }

    const count = await outlookService.getEmailCount(contactEmail);
    return {
      success: true,
      count: count
    };
  } catch (error) {
    console.error('Error getting email count:', error);
    return {
      success: false,
      count: 0,
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
