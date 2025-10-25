const { app, BrowserWindow, ipcMain, dialog, shell, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const { exec } = require('child_process');
const os = require('os');

let mainWindow;

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
  }
}

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
    return contactMap;
  }
}

// Helper function to load contacts from a specific database
async function loadContactsFromDatabase(contactsDbPath) {
  const contactMap = {};

  try {
    await fs.access(contactsDbPath);
  } catch {
    console.log('Database not accessible:', contactsDbPath);
    return contactMap;
  }

  try {
    const db = new sqlite3.Database(contactsDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Query phone numbers and emails SEPARATELY to avoid Cartesian product
    // Use ZOWNER instead of Z22_OWNER - Z22_OWNER is for unified/linked contacts
    const phonesResult = await dbAll(`
      SELECT
        ZABCDRECORD.ZFIRSTNAME as first_name,
        ZABCDRECORD.ZLASTNAME as last_name,
        ZABCDRECORD.ZORGANIZATION as organization,
        ZABCDPHONENUMBER.ZFULLNUMBER as phone
      FROM ZABCDRECORD
      INNER JOIN ZABCDPHONENUMBER ON ZABCDRECORD.Z_PK = ZABCDPHONENUMBER.ZOWNER
      WHERE ZABCDPHONENUMBER.ZFULLNUMBER IS NOT NULL
    `);
    const emailsResult = await dbAll(`
      SELECT
        ZABCDRECORD.ZFIRSTNAME as first_name,
        ZABCDRECORD.ZLASTNAME as last_name,
        ZABCDRECORD.ZORGANIZATION as organization,
        ZABCDEMAILADDRESS.ZADDRESS as email
      FROM ZABCDRECORD
      INNER JOIN ZABCDEMAILADDRESS ON ZABCDRECORD.Z_PK = ZABCDEMAILADDRESS.ZOWNER
      WHERE ZABCDEMAILADDRESS.ZADDRESS IS NOT NULL
    `);

    // Combine results - each row is now either a phone OR an email, not both
    const contacts = [
      ...phonesResult.map(r => ({ ...r, email: null })),
      ...emailsResult.map(r => ({ ...r, phone: null }))
    ];

    // Build a map of phone numbers and emails to contact names

    contacts.forEach((contact, index) => {
      const firstName = contact.first_name || '';
      const lastName = contact.last_name || '';
      const organization = contact.organization || '';

      // Prefer "First Last", fallback to organization, then "First" or "Last"
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
        // Map phone numbers (normalize by removing non-digits)
        if (contact.phone) {
          const normalized = contact.phone.replace(/\D/g, '');
          contactMap[normalized] = displayName;
          contactMap[contact.phone] = displayName;
        }

        // Map emails (lowercase)
        if (contact.email) {
          const emailLower = contact.email.toLowerCase();
          contactMap[emailLower] = displayName;
        }
      }
    });

    console.log(`Loaded ${Object.keys(contactMap).length} contact entries from Contacts database`);
    await dbClose();
  } catch (error) {
    console.error('Error accessing contacts database:', error);
  }

  return contactMap;
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
      const contactMap = await getContactNames();

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

      // Map conversations and deduplicate by normalized phone number/identifier
      const conversationMap = new Map();

      conversations.forEach(conv => {
        const rawContactId = conv.contact_id || conv.chat_identifier;
        const displayName = resolveContactName(conv.contact_id, conv.chat_identifier, conv.display_name, contactMap);

        // Normalize the identifier (phone or email) for deduplication
        let normalizedKey;
        if (rawContactId && rawContactId.includes('@')) {
          // Email - normalize to lowercase
          normalizedKey = rawContactId.toLowerCase();
        } else if (rawContactId) {
          // Phone - normalize by keeping last 10 digits
          const digitsOnly = rawContactId.replace(/\D/g, '');
          normalizedKey = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
        } else {
          // Fallback to chat identifier
          normalizedKey = conv.chat_identifier || `chat_${conv.chat_id}`;
        }

        const conversationData = {
          id: conv.chat_id,
          name: displayName,
          contactId: rawContactId,
          showBothNameAndNumber: displayName !== rawContactId,
          messageCount: conv.message_count,
          lastMessageDate: conv.last_message_date
        };

        // If we already have this contact, keep the one with more recent messages
        if (conversationMap.has(normalizedKey)) {
          const existing = conversationMap.get(normalizedKey);
          if (conv.last_message_date > existing.lastMessageDate) {
            // This conversation is more recent, replace it
            conversationData.messageCount = existing.messageCount + conv.message_count;
            conversationMap.set(normalizedKey, conversationData);
          } else {
            // Keep existing, but add message count
            existing.messageCount += conv.message_count;
          }
        } else {
          conversationMap.set(normalizedKey, conversationData);
        }
      });

      // Convert map back to array
      const deduplicatedConversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessageDate - a.lastMessageDate);

      console.log(`Deduplicated ${conversations.length} conversations to ${deduplicatedConversations.length}`);

      return {
        success: true,
        conversations: deduplicatedConversations
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
                // Skip NSString and some bytes after it (usually 2-10 bytes of metadata)
                const afterNSString = bodyText.substring(nsStringIndex + 8);

                // Extract continuous printable text (excluding control characters)
                const textMatch = afterNSString.match(/[\x20-\x7E\u00A0-\uFFFF]{2,}/);
                if (textMatch) {
                  extractedText = textMatch[0]
                    .replace(/^[^\w\s]+/, '') // Remove leading non-alphanumeric chars
                    .trim();
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
