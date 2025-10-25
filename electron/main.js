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
    // Search for ALL possible Contacts database files
    console.log('======= SEARCHING FOR ALL CONTACTS DATABASES =======');

    const baseDir = path.join(process.env.HOME, 'Library/Application Support/AddressBook');
    console.log('Searching in:', baseDir);

    // Use exec to find all .abcddb files
    const { exec: execCallback } = require('child_process');
    const execPromise = promisify(execCallback);

    try {
      const { stdout } = await execPromise(`find "${baseDir}" -name "*.abcddb" 2>/dev/null`);
      const dbFiles = stdout.trim().split('\n').filter(f => f);

      console.log(`Found ${dbFiles.length} database files:`);
      dbFiles.forEach(f => console.log(`  - ${f}`));

      // Try each database and count records
      for (const dbPath of dbFiles) {
        try {
          console.log(`\nChecking: ${dbPath}`);
          const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
          const dbAll = promisify(db.all.bind(db));
          const dbClose = promisify(db.close.bind(db));

          const recordCount = await dbAll(`SELECT COUNT(*) as count FROM ZABCDRECORD WHERE Z_ENT IS NOT NULL;`);
          console.log(`  Records: ${recordCount[0].count}`);

          await dbClose();

          // If this database has more records, use it
          if (recordCount[0].count > 10) {
            console.log(`  ✅ This looks like the main contacts database!`);
            return await loadContactsFromDatabase(dbPath);
          }
        } catch (err) {
          console.log(`  ❌ Error reading: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Error finding database files:', err.message);
    }

    // Fallback to old method
    console.log('\n⚠️  Could not find main contacts database, trying default location...');
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
    console.log('\n========= LOADING CONTACTS FROM DATABASE =========');
    console.log('Database path:', contactsDbPath);

    await fs.access(contactsDbPath);
  } catch {
    console.log('❌ Database not accessible');
    return contactMap;
  }

  try {
    console.log('Opening Contacts database...');
    const db = new sqlite3.Database(contactsDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // First, let's see what tables exist in the database
    console.log('Inspecting database schema...');
    const tables = await dbAll(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
    `);
    console.log('Available tables:', tables.map(t => t.name).join(', '));

    // Try to get the schema for common tables
    if (tables.find(t => t.name === 'ZABCDRECORD')) {
      const recordSchema = await dbAll(`PRAGMA table_info(ZABCDRECORD);`);
      console.log('ZABCDRECORD columns:', recordSchema.map(c => c.name).join(', '));
    }

    if (tables.find(t => t.name === 'ZABCDPHONENUMBER')) {
      const phoneSchema = await dbAll(`PRAGMA table_info(ZABCDPHONENUMBER);`);
      console.log('ZABCDPHONENUMBER columns:', phoneSchema.map(c => c.name).join(', '));
    }

    console.log('Querying contacts...');

    // === DEBUGGING: Check what's actually in the database ===
    console.log('\n========= DATABASE DIAGNOSTICS =========');

    // Check total phones in database
    const totalPhones = await dbAll(`SELECT COUNT(*) as count FROM ZABCDPHONENUMBER;`);
    console.log(`Total phone records in ZABCDPHONENUMBER table: ${totalPhones[0].count}`);

    // Check total emails in database
    const totalEmails = await dbAll(`SELECT COUNT(*) as count FROM ZABCDEMAILADDRESS;`);
    console.log(`Total email records in ZABCDEMAILADDRESS table: ${totalEmails[0].count}`);

    // Check which foreign key fields have values
    const phonesWithZ22 = await dbAll(`SELECT COUNT(*) as count FROM ZABCDPHONENUMBER WHERE Z22_OWNER IS NOT NULL;`);
    console.log(`Phone records with Z22_OWNER field: ${phonesWithZ22[0].count}`);

    const phonesWithZOWNER = await dbAll(`SELECT COUNT(*) as count FROM ZABCDPHONENUMBER WHERE ZOWNER IS NOT NULL;`);
    console.log(`Phone records with ZOWNER field: ${phonesWithZOWNER[0].count}`);

    const emailsWithZ22 = await dbAll(`SELECT COUNT(*) as count FROM ZABCDEMAILADDRESS WHERE Z22_OWNER IS NOT NULL;`);
    console.log(`Email records with Z22_OWNER field: ${emailsWithZ22[0].count}`);

    const emailsWithZOWNER = await dbAll(`SELECT COUNT(*) as count FROM ZABCDEMAILADDRESS WHERE ZOWNER IS NOT NULL;`);
    console.log(`Email records with ZOWNER field: ${emailsWithZOWNER[0].count}`);

    // Sample a few phone records to see the data
    const samplePhones = await dbAll(`SELECT Z_PK, ZFULLNUMBER, Z22_OWNER, ZOWNER FROM ZABCDPHONENUMBER LIMIT 5;`);
    console.log('\nSample phone records:');
    samplePhones.forEach(p => {
      console.log(`  Phone: ${p.ZFULLNUMBER}, Z22_OWNER: ${p.Z22_OWNER}, ZOWNER: ${p.ZOWNER}`);
    });

    console.log('========================================\n');

    // Query phone numbers and emails SEPARATELY to avoid Cartesian product
    // The problem: LEFT JOIN creates duplicate rows when contacts have multiple phones AND emails
    // IMPORTANT: Use ZOWNER instead of Z22_OWNER - Z22_OWNER is for unified/linked contacts
    console.log('Fetching phone numbers...');
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
    console.log(`✅ Found ${phonesResult.length} phone numbers`);

    console.log('Fetching emails...');
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
    console.log(`✅ Found ${emailsResult.length} emails`);

    // DEBUG: Check for duplicate emails
    const emailMap = {};
    emailsResult.forEach(r => {
      if (!emailMap[r.email]) {
        emailMap[r.email] = [];
      }
      emailMap[r.email].push(`${r.first_name} ${r.last_name}`);
    });

    const duplicateEmails = Object.entries(emailMap).filter(([email, names]) => names.length > 1);
    if (duplicateEmails.length > 0) {
      console.log(`⚠️  WARNING: Found ${duplicateEmails.length} duplicate emails in database!`);
      console.log('First 3 duplicates:');
      duplicateEmails.slice(0, 3).forEach(([email, names]) => {
        console.log(`  ${email} -> [${names.join(', ')}]`);
      });
    }

    // Check specifically for paul@pauljdorian.com
    const paulEmail = emailsResult.find(r => r.email === 'paul@pauljdorian.com');
    if (paulEmail) {
      console.log(`\nDEBUG paul@pauljdorian.com:`);
      console.log(`  Name: ${paulEmail.first_name} ${paulEmail.last_name}`);
      console.log(`  Organization: ${paulEmail.organization}`);
    }

    // Combine results - each row is now either a phone OR an email, not both
    const contacts = [
      ...phonesResult.map(r => ({ ...r, email: null })),
      ...emailsResult.map(r => ({ ...r, phone: null }))
    ];

    console.log(`✅ Total contact entries: ${contacts.length}`);

    // Let's also check the total count of records
    const totalRecords = await dbAll(`SELECT COUNT(*) as count FROM ZABCDRECORD;`);
    console.log(`Total records in ZABCDRECORD: ${totalRecords[0].count}`);

    // Build a map of phone numbers and emails to contact names
    console.log('\n========= BUILDING CONTACT MAP =========');
    const nameCount = {};

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
        // Count how many times each name appears
        nameCount[displayName] = (nameCount[displayName] || 0) + 1;

        // Map phone numbers (normalize by removing non-digits)
        if (contact.phone) {
          const normalized = contact.phone.replace(/\D/g, '');

          // Only log first 5 contacts for debugging
          if (index < 5) {
            console.log(`  Contact: ${displayName}`);
            console.log(`    Phone (raw): ${contact.phone}`);
            console.log(`    Phone (normalized): ${normalized}`);
          }

          contactMap[normalized] = displayName;
          contactMap[contact.phone] = displayName;
        }

        // Map emails (lowercase)
        if (contact.email) {
          const emailLower = contact.email.toLowerCase();

          // DEBUG: Check for overwrites
          if (contactMap[emailLower] && contactMap[emailLower] !== displayName) {
            console.log(`⚠️  OVERWRITE DETECTED!`);
            console.log(`  Email: ${contact.email}`);
            console.log(`  Old name: ${contactMap[emailLower]}`);
            console.log(`  New name: ${displayName}`);
          }

          contactMap[emailLower] = displayName;
        }
      }
    });

    console.log(`\nBuilt contact map with ${Object.keys(contactMap).length} entries`);
    console.log('Name frequency (top 10):');
    const sortedNames = Object.entries(nameCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    sortedNames.forEach(([name, count]) => {
      console.log(`  ${name}: ${count} phone numbers/emails`);
    });
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
let debugMatchCount = 0;
function resolveContactName(contactId, chatIdentifier, displayName, contactMap) {
  // If we have a display_name from Messages, use it
  if (displayName) return displayName;

  // Try to find contact name by contactId (phone or email)
  if (contactId) {
    // Try direct match
    if (contactMap[contactId]) {
      if (debugMatchCount < 5) {
        console.log(`\n[MATCH] Direct match: ${contactId} -> ${contactMap[contactId]}`);
        debugMatchCount++;
      }
      return contactMap[contactId];
    }

    // Try normalized phone number match
    const normalized = normalizePhoneNumber(contactId);
    if (normalized && contactMap[normalized]) {
      if (debugMatchCount < 5) {
        console.log(`\n[MATCH] Normalized match:`);
        console.log(`  Input: ${contactId}`);
        console.log(`  Normalized: ${normalized}`);
        console.log(`  Result: ${contactMap[normalized]}`);
        debugMatchCount++;
      }
      return contactMap[normalized];
    }

    // Try lowercase email match
    const lowerEmail = contactId.toLowerCase();
    if (contactMap[lowerEmail]) {
      if (debugMatchCount < 5) {
        console.log(`\n[MATCH] Email match: ${contactId} -> ${contactMap[lowerEmail]}`);
        debugMatchCount++;
      }
      return contactMap[lowerEmail];
    }
  }

  // Try chat_identifier as fallback
  if (chatIdentifier) {
    if (contactMap[chatIdentifier]) {
      if (debugMatchCount < 5) {
        console.log(`\n[MATCH] Chat identifier match: ${chatIdentifier} -> ${contactMap[chatIdentifier]}`);
        debugMatchCount++;
      }
      return contactMap[chatIdentifier];
    }

    const normalized = normalizePhoneNumber(chatIdentifier);
    if (normalized && contactMap[normalized]) {
      if (debugMatchCount < 5) {
        console.log(`\n[MATCH] Chat identifier normalized match:`);
        console.log(`  Input: ${chatIdentifier}`);
        console.log(`  Normalized: ${normalized}`);
        console.log(`  Result: ${contactMap[normalized]}`);
        debugMatchCount++;
      }
      return contactMap[normalized];
    }
  }

  // Final fallback: show the phone/email
  if (debugMatchCount < 5) {
    console.log(`\n[NO MATCH] No contact found for: ${contactId || chatIdentifier}`);
    debugMatchCount++;
  }
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

      return {
        success: true,
        conversations: conversations.map(conv => {
          const rawContactId = conv.contact_id || conv.chat_identifier;
          const displayName = resolveContactName(conv.contact_id, conv.chat_identifier, conv.display_name, contactMap);

          return {
            id: conv.chat_id,
            name: displayName,
            contactId: rawContactId,
            // Include both name and raw identifier for display
            showBothNameAndNumber: displayName !== rawContactId, // true if we resolved to a name
            messageCount: conv.message_count,
            lastMessageDate: conv.last_message_date
          };
        })
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
