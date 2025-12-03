"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const sqlite3_1 = __importDefault(require("sqlite3"));
const util_1 = require("util");
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env.local') });
// Import services and utilities
const contactsService_1 = require("./services/contactsService");
const dateUtils_1 = require("./utils/dateUtils");
const fileUtils_1 = require("./utils/fileUtils");
const messageParser_1 = require("./utils/messageParser");
const constants_1 = require("./constants");
// Import new authentication services
const databaseService_1 = __importDefault(require("./services/databaseService"));
const microsoftAuthService_1 = __importDefault(require("./services/microsoftAuthService"));
// NOTE: tokenEncryptionService removed - using session-only OAuth
// Tokens stored in encrypted database, no additional keychain encryption needed
const auth_handlers_1 = require("./auth-handlers");
const transaction_handlers_1 = require("./transaction-handlers");
const contact_handlers_1 = require("./contact-handlers");
const address_handlers_1 = require("./address-handlers");
const feedback_handlers_1 = require("./feedback-handlers");
const system_handlers_1 = require("./system-handlers");
const preference_handlers_1 = require("./preference-handlers");
const outlookService_1 = __importDefault(require("./outlookService"));
// Configure logging for auto-updater
electron_log_1.default.transports.file.level = 'info';
electron_updater_1.autoUpdater.logger = electron_log_1.default;
let mainWindow = null;
const outlookService = new outlookService_1.default();
/**
 * Configure Content Security Policy for the application
 * This prevents the "unsafe-eval" security warning
 */
function setupContentSecurityPolicy() {
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const isDevelopment = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
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
                "worker-src 'self' blob:",
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
                "frame-ancestors 'none'",
                "worker-src 'self' blob:"
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
    mainWindow = new electron_1.BrowserWindow({
        width: constants_1.WINDOW_CONFIG.DEFAULT_WIDTH,
        height: constants_1.WINDOW_CONFIG.DEFAULT_HEIGHT,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js')
        },
        titleBarStyle: constants_1.WINDOW_CONFIG.TITLE_BAR_STYLE,
        backgroundColor: constants_1.WINDOW_CONFIG.BACKGROUND_COLOR
    });
    // Load the app
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        mainWindow.loadURL(constants_1.DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
        // Check for updates after window loads (only in production)
        setTimeout(() => {
            electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        }, constants_1.UPDATE_CHECK_DELAY);
    }
}
// Auto-updater event handlers
electron_updater_1.autoUpdater.on('checking-for-update', () => {
    electron_log_1.default.info('Checking for update...');
});
electron_updater_1.autoUpdater.on('update-available', (info) => {
    electron_log_1.default.info('Update available:', info);
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});
electron_updater_1.autoUpdater.on('update-not-available', (info) => {
    electron_log_1.default.info('Update not available:', info);
});
electron_updater_1.autoUpdater.on('error', (err) => {
    electron_log_1.default.error('Error in auto-updater:', err);
});
electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}%`;
    electron_log_1.default.info(message);
    if (mainWindow) {
        mainWindow.webContents.send('update-progress', progressObj);
    }
});
electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
    electron_log_1.default.info('Update downloaded:', info);
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
});
electron_1.app.whenReady().then(async () => {
    // Set up Content Security Policy
    setupContentSecurityPolicy();
    // Database initialization is now ALWAYS deferred to the renderer process
    // This allows us to show an explanation screen before the keychain prompt
    // for both new users (SecureStorageSetup) and returning users (KeychainExplanation)
    //
    // The renderer will call 'system:initialize-secure-storage' which handles:
    // 1. Database initialization (triggers keychain prompt)
    // 2. Clearing sessions/tokens for session-only OAuth
    createWindow();
    (0, auth_handlers_1.registerAuthHandlers)(mainWindow);
    (0, transaction_handlers_1.registerTransactionHandlers)(mainWindow);
    (0, contact_handlers_1.registerContactHandlers)();
    (0, address_handlers_1.registerAddressHandlers)();
    (0, feedback_handlers_1.registerFeedbackHandlers)();
    (0, system_handlers_1.registerSystemHandlers)();
    (0, preference_handlers_1.registerPreferenceHandlers)();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// IPC Handlers
// Get app information for Full Disk Access
electron_1.ipcMain.handle('get-app-info', () => {
    try {
        const appPath = electron_1.app.getPath('exe');
        const appName = electron_1.app.getName();
        return {
            name: appName,
            path: appPath,
            pid: process.pid
        };
    }
    catch (error) {
        console.error('Error getting app info:', error);
        return {
            name: 'Unknown',
            path: 'Unknown',
            pid: 0
        };
    }
});
// Get macOS version information
electron_1.ipcMain.handle('get-macos-version', () => {
    try {
        if (process.platform === 'darwin') {
            const release = os_1.default.release();
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
    }
    catch (error) {
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
electron_1.ipcMain.handle('check-app-location', async () => {
    try {
        // Only check on macOS
        if (process.platform !== 'darwin') {
            return {
                isInApplications: true, // Not applicable on other platforms
                shouldPrompt: false,
                appPath: electron_1.app.getPath('exe')
            };
        }
        // Get the app executable path
        const appPath = electron_1.app.getPath('exe');
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
    }
    catch (error) {
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
electron_1.ipcMain.handle('trigger-full-disk-access', async () => {
    try {
        const messagesDbPath = path_1.default.join(process.env.HOME, 'Library/Messages/chat.db');
        // Attempt to read the database - this will fail without permission
        // but it will cause macOS to add this app to the Full Disk Access list
        await fs_1.promises.access(messagesDbPath, fs_1.promises.constants.R_OK);
        return { triggered: true, alreadyGranted: true };
    }
    catch {
        return { triggered: true, alreadyGranted: false };
    }
});
// Check permissions for Messages database
electron_1.ipcMain.handle('check-permissions', async () => {
    try {
        const messagesDbPath = path_1.default.join(process.env.HOME, 'Library/Messages/chat.db');
        await fs_1.promises.access(messagesDbPath, fs_1.promises.constants.R_OK);
        return { hasPermission: true };
    }
    catch (error) {
        return { hasPermission: false, error: error.message };
    }
});
// Request Contacts permission - Note: Not available via Electron API
// Contacts access is handled by Full Disk Access which also grants Messages access
electron_1.ipcMain.handle('request-contacts-permission', async () => {
    // Contacts permission isn't available via systemPreferences API
    // Full Disk Access will provide access to both contacts and messages
    return {
        granted: false,
        status: 'skip',
        message: 'Contacts access included with Full Disk Access'
    };
});
// Open System Settings to Full Disk Access panel
electron_1.ipcMain.handle('open-system-settings', async () => {
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
            (0, child_process_1.exec)(`osascript -e '${script}'`, (error) => {
                if (error) {
                    // Fallback: just open System Settings
                    electron_1.shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
                }
            });
            return { success: true };
        }
        return { success: false, message: 'Not supported on this platform' };
    }
    catch (error) {
        console.error('Error opening system settings:', error);
        return { success: false, error: error.message };
    }
});
// Request permissions (guide user)
electron_1.ipcMain.handle('request-permissions', async () => {
    // On Mac, we need to guide the user to grant Full Disk Access
    return {
        success: false,
        message: 'Please grant Full Disk Access in System Preferences > Security & Privacy > Privacy > Full Disk Access'
    };
});
// Note: Helper functions moved to services/contactsService.js and utils/
// Get conversations from Messages database
electron_1.ipcMain.handle('get-conversations', async () => {
    try {
        const messagesDbPath = path_1.default.join(process.env.HOME, 'Library/Messages/chat.db');
        const db = new sqlite3_1.default.Database(messagesDbPath, sqlite3_1.default.OPEN_READONLY);
        const dbAll = (0, util_1.promisify)(db.all.bind(db));
        const dbClose = (0, util_1.promisify)(db.close.bind(db));
        let db2 = null;
        let dbClose2 = null;
        try {
            // Get contact names from Contacts database
            const { contactMap, phoneToContactInfo } = await (0, contactsService_1.getContactNames)();
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
            db2 = new sqlite3_1.default.Database(messagesDbPath, sqlite3_1.default.OPEN_READONLY);
            const dbAll2 = (0, util_1.promisify)(db2.all.bind(db2));
            dbClose2 = (0, util_1.promisify)(db2.close.bind(db2));
            // Map conversations and deduplicate by contact NAME
            // This ensures that if a contact has multiple phone numbers or emails,
            // they appear as ONE contact with all their info
            const conversationMap = new Map();
            // Process conversations - track direct chats and group chats separately
            for (const conv of conversations) {
                const rawContactId = conv.contact_id || conv.chat_identifier;
                const displayName = (0, contactsService_1.resolveContactName)(conv.contact_id, conv.chat_identifier, conv.display_name, contactMap);
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
                            const participantName = (0, contactsService_1.resolveContactName)(participant.contact_id, participant.contact_id, undefined, contactMap);
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
                                        const contactInfoTyped = info;
                                        if (contactInfoTyped.emails && contactInfoTyped.emails.some((e) => e.toLowerCase() === emailLower)) {
                                            contactInfo = contactInfoTyped;
                                            break;
                                        }
                                    }
                                    if (contactInfo) {
                                        phones = contactInfo.phones || [];
                                        emails = contactInfo.emails || [];
                                    }
                                    else {
                                        emails = [participant.contact_id];
                                    }
                                }
                                else if (participant.contact_id) {
                                    const normalized = participant.contact_id.replace(/\D/g, '');
                                    contactInfo = phoneToContactInfo[normalized] || phoneToContactInfo[participant.contact_id];
                                    if (contactInfo) {
                                        phones = contactInfo.phones || [];
                                        emails = contactInfo.emails || [];
                                    }
                                    else {
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
                    }
                    catch (err) {
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
                        const contactInfoTyped = info;
                        if (contactInfoTyped.emails && contactInfoTyped.emails.some((e) => e.toLowerCase() === emailLower)) {
                            contactInfo = contactInfoTyped;
                            break;
                        }
                    }
                    if (contactInfo) {
                        phones = contactInfo.phones || [];
                        emails = contactInfo.emails || [];
                    }
                    else {
                        emails = [rawContactId];
                    }
                }
                else if (rawContactId) {
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
                    }
                    else {
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
                }
                else {
                    conversationMap.set(normalizedKey, conversationData);
                }
            }
            // Close the second database connection
            await dbClose2();
            // Convert map back to array
            const deduplicatedConversations = Array.from(conversationMap.values())
                .sort((a, b) => b.lastMessageDate - a.lastMessageDate);
            // Filter out contacts with no messages in the last 5 years
            const fiveYearsAgo = (0, dateUtils_1.getYearsAgoTimestamp)(5);
            const macEpoch = constants_1.MAC_EPOCH;
            const fiveYearsAgoMacTime = (fiveYearsAgo - macEpoch) * 1000000; // Convert to Mac timestamp (nanoseconds)
            const recentConversations = deduplicatedConversations.filter(conv => {
                return conv.lastMessageDate > fiveYearsAgoMacTime;
            });
            return {
                success: true,
                conversations: recentConversations
            };
        }
        catch (error) {
            // Clean up db2 if it was opened
            if (dbClose2) {
                try {
                    await dbClose2();
                }
                catch (closeError) {
                    console.error('Error closing db2:', closeError);
                }
            }
            throw error;
        }
    }
    catch (error) {
        console.error('Error getting conversations:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
// Get messages for a specific conversation
electron_1.ipcMain.handle('get-messages', async (event, chatId) => {
    try {
        const messagesDbPath = path_1.default.join(process.env.HOME, 'Library/Messages/chat.db');
        const db = new sqlite3_1.default.Database(messagesDbPath, sqlite3_1.default.OPEN_READONLY);
        const dbAll = (0, util_1.promisify)(db.all.bind(db));
        const dbClose = (0, util_1.promisify)(db.close.bind(db));
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
        }
        catch (error) {
            await dbClose();
            throw error;
        }
    }
    catch (error) {
        console.error('Error getting messages:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
// Open folder in Finder
electron_1.ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        await electron_1.shell.openPath(folderPath);
        return { success: true };
    }
    catch (error) {
        console.error('Error opening folder:', error);
        return { success: false, error: error.message };
    }
});
// Export conversations to files
electron_1.ipcMain.handle('export-conversations', async (event, conversationIds) => {
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
        const { canceled, filePath } = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: 'Choose Export Location',
            defaultPath: path_1.default.join(electron_1.app.getPath('documents'), defaultFolderName),
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });
        if (canceled || !filePath) {
            return { success: false, canceled: true };
        }
        // Create export directory
        await fs_1.promises.mkdir(filePath, { recursive: true });
        const messagesDbPath = path_1.default.join(process.env.HOME, 'Library/Messages/chat.db');
        const db = new sqlite3_1.default.Database(messagesDbPath, sqlite3_1.default.OPEN_READONLY);
        const dbAll = (0, util_1.promisify)(db.all.bind(db));
        const dbClose = (0, util_1.promisify)(db.close.bind(db));
        // Load contact names for resolving names in export
        const { contactMap } = await (0, contactsService_1.getContactNames)();
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
                if (chatInfo.length === 0)
                    continue;
                // Resolve contact name using the same logic as conversation list
                const chatName = (0, contactsService_1.resolveContactName)(chatInfo[0].contact_id, chatInfo[0].chat_identifier, chatInfo[0].display_name, contactMap);
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
                    const messageDate = (0, dateUtils_1.macTimestampToDate)(msg.date);
                    // Resolve sender name
                    let sender;
                    if (msg.is_from_me) {
                        sender = 'Me';
                    }
                    else if (msg.sender) {
                        // Try to resolve sender name from contacts
                        const resolvedName = (0, contactsService_1.resolveContactName)(msg.sender, msg.sender, undefined, contactMap);
                        sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
                    }
                    else {
                        sender = 'Unknown';
                    }
                    // Handle text content (using centralized message parser)
                    const text = (0, messageParser_1.getMessageText)(msg);
                    exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                }
                // Save file
                const fileName = (0, fileUtils_1.createTimestampedFilename)(chatName, 'txt');
                const exportFilePath = path_1.default.join(filePath, fileName);
                await fs_1.promises.writeFile(exportFilePath, exportContent, 'utf8');
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
                const newPath = path_1.default.join(path_1.default.dirname(filePath), newFolderName);
                try {
                    await fs_1.promises.rename(filePath, newPath);
                    finalPath = newPath;
                }
                catch (renameError) {
                    console.error('Error renaming folder:', renameError);
                    // Keep original path if rename fails
                }
            }
            return {
                success: true,
                exportPath: finalPath,
                filesCreated: exportedFiles
            };
        }
        catch (error) {
            await dbClose();
            throw error;
        }
    }
    catch (error) {
        console.error('Error exporting conversations:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
// Install update and restart
electron_1.ipcMain.on('install-update', () => {
    electron_log_1.default.info('Installing update...');
    // Ensure app relaunches after update
    // Parameters: isSilent, isForceRunAfter
    // false = show installer, true = force run after install
    setImmediate(() => {
        electron_1.app.removeAllListeners('window-all-closed');
        if (mainWindow) {
            mainWindow.removeAllListeners('close');
            mainWindow.close();
        }
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
    });
});
// ===== OUTLOOK INTEGRATION IPC HANDLERS =====
// Now using redirect-based OAuth (no device code required!)
// Initialize Outlook service (no-op now, kept for compatibility)
electron_1.ipcMain.handle('outlook-initialize', async () => {
    return { success: true };
});
// Authenticate with Outlook using redirect-based OAuth
electron_1.ipcMain.handle('outlook-authenticate', async (event, userId) => {
    try {
        console.log('[Main] Starting Outlook authentication with redirect flow');
        // Get user info to use as login hint
        let loginHint = undefined;
        if (userId) {
            const user = await databaseService_1.default.getUserById(userId);
            if (user) {
                loginHint = user.email;
            }
        }
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, codeVerifier, scopes: _scopes } = await microsoftAuthService_1.default.authenticateForMailbox(loginHint);
        // Open browser with auth URL
        await electron_1.shell.openExternal(authUrl);
        // Wait for user to complete auth in browser (local server will catch redirect)
        const code = await codePromise;
        console.log('[Main] Received authorization code from redirect');
        // Exchange code for tokens
        const tokens = await microsoftAuthService_1.default.exchangeCodeForTokens(code, codeVerifier);
        // Get user info
        const userInfo = await microsoftAuthService_1.default.getUserInfo(tokens.access_token);
        // Session-only OAuth: no token encryption needed (database is already encrypted)
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token || undefined;
        // Save mailbox token to database
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
        await databaseService_1.default.saveOAuthToken(userId, 'microsoft', 'mailbox', {
            access_token: accessToken,
            refresh_token: refreshToken,
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
    }
    catch (error) {
        console.error('[Main] Outlook authentication failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
// Check if authenticated
electron_1.ipcMain.handle('outlook-is-authenticated', async (event, userId) => {
    try {
        if (!userId)
            return false;
        const token = await databaseService_1.default.getOAuthToken(userId, 'microsoft', 'mailbox');
        if (!token || !token.access_token || !token.token_expires_at)
            return false;
        // Check if token is expired
        const tokenExpiry = new Date(token.token_expires_at);
        const now = new Date();
        return tokenExpiry > now;
    }
    catch (error) {
        console.error('Error checking Outlook authentication:', error);
        return false;
    }
});
// Get user email
electron_1.ipcMain.handle('outlook-get-user-email', async (event, userId) => {
    try {
        if (!userId) {
            return {
                success: false,
                error: 'User ID required'
            };
        }
        const token = await databaseService_1.default.getOAuthToken(userId, 'microsoft', 'mailbox');
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
    }
    catch (error) {
        console.error('Error getting user email:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
// Export emails for multiple contacts
electron_1.ipcMain.handle('outlook-export-emails', async (event, contacts) => {
    try {
        if (!outlookService || !outlookService.isAuthenticated()) {
            return {
                success: false,
                error: 'Not authenticated with Outlook'
            };
        }
        // Show dialog to select export location (folder picker)
        const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'Select Folder for Audit Export',
            defaultPath: path_1.default.join(os_1.default.homedir(), 'Documents'),
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
        const exportPath = path_1.default.join(filePaths[0], exportFolderName);
        // Create base export directory
        await fs_1.promises.mkdir(exportPath, { recursive: true });
        // Open Messages database for text message export
        const messagesDbPath = path_1.default.join(process.env.HOME, 'Library/Messages/chat.db');
        const db = new sqlite3_1.default.Database(messagesDbPath, sqlite3_1.default.OPEN_READONLY);
        const dbAll = (0, util_1.promisify)(db.all.bind(db));
        const dbClose = (0, util_1.promisify)(db.close.bind(db));
        // Load contact names for resolving names in export
        const { contactMap } = await (0, contactsService_1.getContactNames)();
        const results = [];
        // Export BOTH text messages AND emails for each contact
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            // Send progress update
            mainWindow?.webContents.send('export-progress', {
                stage: 'contact',
                current: i + 1,
                total: contacts.length,
                contactName: contact.name
            });
            // Create contact folder
            const sanitizedName = (0, fileUtils_1.sanitizeFilename)(contact.name, true);
            const contactFolder = path_1.default.join(exportPath, sanitizedName);
            await fs_1.promises.mkdir(contactFolder, { recursive: true });
            let textMessageCount = 0;
            let totalEmails = 0;
            let anySuccess = false;
            const errors = [];
            // 1. Export text messages (if chatId exists or if we have phone/email identifiers)
            if (contact.chatId || contact.phones?.length > 0 || contact.emails?.length > 0) {
                try {
                    mainWindow?.webContents.send('export-progress', {
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
                        chatIds.forEach((c) => {
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
                            chatInfoResults.forEach((info) => {
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
                            }
                            else {
                                oneOnOneMessages.push(...chatMessages);
                            }
                        }
                        // Sort all 1:1 messages by date
                        oneOnOneMessages.sort((a, b) => a.date - b.date);
                        let _filesCreated = 0;
                        // Export all 1:1 messages to a single file
                        if (oneOnOneMessages.length > 0) {
                            let exportContent = `1-ON-1 MESSAGES\n`;
                            exportContent += `Contact: ${contact.name}\n`;
                            exportContent += `Exported: ${new Date().toLocaleString()}\n`;
                            exportContent += `Total Messages: ${oneOnOneMessages.length}\n`;
                            exportContent += '='.repeat(80) + '\n\n';
                            for (const msg of oneOnOneMessages) {
                                // Convert Mac timestamp to readable date
                                const messageDate = (0, dateUtils_1.macTimestampToDate)(msg.date);
                                // Resolve sender name
                                let sender;
                                if (msg.is_from_me) {
                                    sender = 'Me';
                                }
                                else if (msg.sender) {
                                    const resolvedName = (0, contactsService_1.resolveContactName)(msg.sender, msg.sender, undefined, contactMap);
                                    sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
                                }
                                else {
                                    sender = 'Unknown';
                                }
                                // Handle text content (using centralized message parser)
                                const text = (0, messageParser_1.getMessageText)(msg);
                                exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                            }
                            // Save 1:1 messages file
                            const oneOnOneFilePath = path_1.default.join(contactFolder, '1-on-1_messages.txt');
                            await fs_1.promises.writeFile(oneOnOneFilePath, exportContent, 'utf8');
                            _filesCreated++;
                            anySuccess = true;
                        }
                        // Export each group chat to its own file
                        for (const [chatId, groupChat] of Object.entries(groupChats)) {
                            const chatName = groupChat.info.display_name || `Group Chat ${chatId}`;
                            const sanitized = (0, fileUtils_1.sanitizeFilename)(chatName);
                            const fileName = `group_chat_${sanitized}.txt`;
                            let exportContent = `GROUP CHAT: ${chatName}\n`;
                            exportContent += `Contact: ${contact.name}\n`;
                            exportContent += `Exported: ${new Date().toLocaleString()}\n`;
                            exportContent += `Messages in this chat: ${groupChat.messages.length}\n`;
                            exportContent += '='.repeat(80) + '\n\n';
                            for (const msg of groupChat.messages) {
                                // Convert Mac timestamp to readable date
                                const messageDate = (0, dateUtils_1.macTimestampToDate)(msg.date);
                                // Resolve sender name
                                let sender;
                                if (msg.is_from_me) {
                                    sender = 'Me';
                                }
                                else if (msg.sender) {
                                    const resolvedName = (0, contactsService_1.resolveContactName)(msg.sender, msg.sender, undefined, contactMap);
                                    sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
                                }
                                else {
                                    sender = 'Unknown';
                                }
                                // Handle text content (using centralized message parser)
                                const text = (0, messageParser_1.getMessageText)(msg);
                                exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                            }
                            // Save group chat file
                            const groupFilePath = path_1.default.join(contactFolder, fileName);
                            await fs_1.promises.writeFile(groupFilePath, exportContent, 'utf8');
                            _filesCreated++;
                            anySuccess = true;
                        }
                    }
                }
                catch (err) {
                    console.error(`Error exporting text messages for ${contact.name}:`, err);
                    errors.push(`Text messages: ${err.message}`);
                }
            }
            // 2. Export emails (if email addresses exist)
            if (contact.emails && contact.emails.length > 0) {
                for (const email of contact.emails) {
                    try {
                        const result = await outlookService.exportEmailsToAudit(contact.name, email, exportPath, (progress) => {
                            // Forward progress to renderer
                            mainWindow?.webContents.send('export-progress', {
                                ...progress,
                                contactName: contact.name,
                                current: i + 1,
                                total: contacts.length
                            });
                        });
                        if (result.success) {
                            anySuccess = true;
                            totalEmails += result.emailCount || 0;
                        }
                        else if (result.error) {
                            errors.push(`${email}: ${result.error}`);
                        }
                    }
                    catch (err) {
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
        new electron_1.Notification({
            title: 'Full Audit Export Complete',
            body: `Exported ${successCount} contact${successCount !== 1 ? 's' : ''}${failCount > 0 ? `. ${failCount} failed.` : ''}`,
        }).show();
        return {
            success: true,
            exportPath: exportPath,
            results: results
        };
    }
    catch (error) {
        console.error('Error exporting full audit:', error);
        console.error('Stack trace:', error.stack);
        return {
            success: false,
            error: error.message
        };
    }
});
// Sign out from Outlook
electron_1.ipcMain.handle('outlook-signout', async () => {
    try {
        if (outlookService) {
            await outlookService.signOut();
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error signing out:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
