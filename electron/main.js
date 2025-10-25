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

    console.log('======= APP INFO =======');
    console.log('App Name:', appName);
    console.log('App Path:', appPath);
    console.log('Process ID:', process.pid);
    console.log('========================');

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
    console.log('======= ELECTRON: Detecting macOS version =======');
    console.log('Platform:', process.platform);

    if (process.platform === 'darwin') {
      const release = os.release(); // e.g., "21.6.0" for macOS 12.5
      console.log('Raw os.release():', release);

      const parts = release.split('.');
      const majorVersion = parseInt(parts[0], 10);
      console.log('Parsed Darwin major version:', majorVersion);

      // Convert Darwin version to macOS version
      // Darwin 20 = macOS 11 (Big Sur)
      // Darwin 21 = macOS 12 (Monterey)
      // Darwin 22 = macOS 13 (Ventura)
      // Darwin 23 = macOS 14 (Sonoma)
      // Darwin 24 = macOS 15 (Sequoia)
      // Darwin 25 = macOS 16 (future)

      let macOSVersion = 10;
      let macOSName = 'Unknown';

      if (majorVersion >= 20) {
        macOSVersion = majorVersion - 9; // Darwin 20 = macOS 11
      }
      console.log('Calculated macOS version:', macOSVersion);

      // Name the versions
      const versionNames = {
        11: 'Big Sur',
        12: 'Monterey',
        13: 'Ventura',
        14: 'Sonoma',
        15: 'Sequoia',
        16: 'Tahoe' // Future version
      };

      macOSName = versionNames[macOSVersion] || 'Unknown';
      console.log('Version name lookup:', macOSName);

      // Determine UI style
      // Pre-Ventura: Grid-style System Preferences
      // Ventura+: Sidebar-style System Settings
      const uiStyle = macOSVersion >= 13 ? 'settings' : 'preferences';
      const appName = macOSVersion >= 13 ? 'System Settings' : 'System Preferences';

      const result = {
        version: macOSVersion,
        name: macOSName,
        darwinVersion: majorVersion,
        fullRelease: release,
        uiStyle,
        appName
      };

      console.log('Returning version info:', result);
      console.log('=================================================');
      return result;
    }

    console.log('Platform is not macOS');
    return {
      version: null,
      name: 'Not macOS',
      darwinVersion: 0,
      fullRelease: 'not-macos',
      uiStyle: 'settings',
      appName: 'System Settings'
    };
  } catch (error) {
    console.error('======= ELECTRON: Error detecting macOS version =======');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('=======================================================');
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

    console.log('Attempting to access Messages database to trigger Full Disk Access prompt...');
    console.log('Path:', messagesDbPath);

    // Attempt to read the database - this will fail without permission
    // but it will cause macOS to add this app to the Full Disk Access list
    await fs.access(messagesDbPath, fs.constants.R_OK);

    console.log('✅ Full Disk Access already granted!');
    return { triggered: true, alreadyGranted: true };
  } catch (error) {
    console.log('❌ Access denied (expected) - app should now appear in Full Disk Access list');
    console.log('Error:', error.message);
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
    // macOS Contacts database location (varies by version)
    const contactsDbPath = path.join(
      process.env.HOME,
      'Library/Application Support/AddressBook/AddressBook-v22.abcddb'
    );

    console.log('Attempting to access Contacts database:', contactsDbPath);

    // Check if contacts database exists
    try {
      await fs.access(contactsDbPath);
    } catch {
      console.log('Contacts database not found at default location');
      return contactMap;
    }

    const db = new sqlite3.Database(contactsDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    try {
      // Query contacts with phone numbers and emails
      const contacts = await dbAll(`
        SELECT
          ZABCDRECORD.ZFIRSTNAME as first_name,
          ZABCDRECORD.ZLASTNAME as last_name,
          ZABCDRECORD.ZORGANIZATION as organization,
          ZABCDPHONENUMBER.ZFULLNUMBER as phone,
          ZABCDEMAILADDRESS.ZADDRESS as email
        FROM ZABCDRECORD
        LEFT JOIN ZABCDPHONENUMBER ON ZABCDRECORD.Z_PK = ZABCDPHONENUMBER.ZOWNER
        LEFT JOIN ZABCDEMAILADDRESS ON ZABCDRECORD.Z_PK = ZABCDEMAILADDRESS.ZOWNER
        WHERE ZABCDPHONENUMBER.ZFULLNUMBER IS NOT NULL
           OR ZABCDEMAILADDRESS.ZADDRESS IS NOT NULL
      `);

      console.log(`Found ${contacts.length} contact entries`);

      // Build a map of phone numbers and emails to contact names
      contacts.forEach(contact => {
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
            contactMap[contact.email.toLowerCase()] = displayName;
          }
        }
      });

      console.log(`Built contact map with ${Object.keys(contactMap).length} entries`);
      await dbClose();
    } catch (error) {
      console.error('Error querying contacts database:', error);
      await dbClose();
    }
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
        ORDER BY last_message_date DESC
      `);

      await dbClose();

      return {
        success: true,
        conversations: conversations.map(conv => ({
          id: conv.chat_id,
          name: resolveContactName(conv.contact_id, conv.chat_identifier, conv.display_name, contactMap),
          contactId: conv.contact_id || conv.chat_identifier,
          messageCount: conv.message_count,
          lastMessageDate: conv.last_message_date
        }))
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

// Export conversations to files
ipcMain.handle('export-conversations', async (event, conversationIds) => {
  try {
    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Choose Export Location',
      defaultPath: path.join(app.getPath('documents'), 'message-exports'),
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

    const exportedFiles = [];

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

        const chatName = chatInfo[0].display_name || chatInfo[0].contact_id || chatInfo[0].chat_identifier || 'Unknown';

        // Get messages
        const messages = await dbAll(`
          SELECT
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

          const sender = msg.is_from_me ? 'Me' : (msg.sender || 'Unknown');
          const text = msg.text || '[No text content]';

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

      return {
        success: true,
        exportPath: filePath,
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
