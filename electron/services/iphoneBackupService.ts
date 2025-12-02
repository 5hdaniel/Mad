/**
 * iPhone Backup Service
 * Discovers and reads iPhone backups from iTunes/Apple backup locations
 * Works on Windows, macOS, and Linux
 */

import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import plist from 'simple-plist';

import {
  iPhoneBackup,
  iPhoneContact,
  iPhoneConversation,
  iPhoneMessage,
  iPhonePhoneNumber,
  iPhoneEmailAddress,
  iPhoneParticipant,
  BackupManifest,
  BACKUP_FILE_HASHES,
  BACKUP_LOCATIONS,
  SyncProgress,
} from '../types/iphone';

// ============================================
// BACKUP DISCOVERY
// ============================================

/**
 * Get all backup locations for the current platform
 */
function getBackupLocations(): string[] {
  const platform = process.platform;
  const homeDir = os.homedir();

  let locations: string[] = [];

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    const userProfile = process.env.USERPROFILE || homeDir;

    locations = [
      path.join(appData, 'Apple Computer', 'MobileSync', 'Backup'),
      path.join(userProfile, 'Apple', 'MobileSync', 'Backup'),
    ];
  } else if (platform === 'darwin') {
    locations = [
      path.join(homeDir, 'Library', 'Application Support', 'MobileSync', 'Backup'),
    ];
  } else {
    // Linux
    locations = [
      path.join(homeDir, '.config', 'libimobiledevice', 'backup'),
    ];
  }

  return locations;
}

/**
 * Discover all available iPhone backups
 */
async function discoverBackups(): Promise<iPhoneBackup[]> {
  const backups: iPhoneBackup[] = [];
  const locations = getBackupLocations();

  console.log('[iPhoneBackup] Searching for backups in:', locations);

  for (const location of locations) {
    try {
      const exists = await fs.access(location).then(() => true).catch(() => false);
      if (!exists) {
        console.log('[iPhoneBackup] Location does not exist:', location);
        continue;
      }

      const entries = await fs.readdir(location, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const backupPath = path.join(location, entry.name);
        const backup = await parseBackupInfo(backupPath, entry.name);

        if (backup) {
          backups.push(backup);
        }
      }
    } catch (error) {
      console.error(`[iPhoneBackup] Error scanning location ${location}:`, error);
    }
  }

  // Sort by last backup date (newest first)
  backups.sort((a, b) => b.lastBackupDate.getTime() - a.lastBackupDate.getTime());

  console.log(`[iPhoneBackup] Found ${backups.length} backups`);
  return backups;
}

/**
 * Parse backup info from Info.plist
 */
async function parseBackupInfo(backupPath: string, udid: string): Promise<iPhoneBackup | null> {
  try {
    const infoPlistPath = path.join(backupPath, 'Info.plist');
    const manifestPlistPath = path.join(backupPath, 'Manifest.plist');

    // Check if Info.plist exists
    const infoExists = await fs.access(infoPlistPath).then(() => true).catch(() => false);
    if (!infoExists) {
      console.log('[iPhoneBackup] No Info.plist found in:', backupPath);
      return null;
    }

    // Read Info.plist
    const infoPlistBuffer = await fs.readFile(infoPlistPath);
    const info = plist.parse(infoPlistBuffer) as any;

    // Check if encrypted by reading Manifest.plist
    let isEncrypted = false;
    const manifestExists = await fs.access(manifestPlistPath).then(() => true).catch(() => false);
    if (manifestExists) {
      const manifestBuffer = await fs.readFile(manifestPlistPath);
      const manifest = plist.parse(manifestBuffer) as any;
      isEncrypted = manifest.IsEncrypted === true;
    }

    // Get folder size (optional)
    let size: number | undefined;
    try {
      const stats = await fs.stat(backupPath);
      size = stats.size;
    } catch {
      // Ignore size errors
    }

    const backup: iPhoneBackup = {
      id: udid,
      udid: udid,
      deviceName: info['Device Name'] || info.DisplayName || 'Unknown Device',
      productVersion: info['Product Version'] || info.ProductVersion,
      lastBackupDate: new Date(info['Last Backup Date'] || Date.now()),
      backupPath: backupPath,
      isEncrypted: isEncrypted,
      size: size,
    };

    console.log('[iPhoneBackup] Parsed backup:', backup.deviceName, 'iOS', backup.productVersion);
    return backup;
  } catch (error) {
    console.error(`[iPhoneBackup] Error parsing backup at ${backupPath}:`, error);
    return null;
  }
}

/**
 * Get path to a specific file in the backup using its hash
 */
function getBackupFilePath(backupPath: string, fileHash: string): string {
  // Modern backups (iOS 10+) store files in subdirectories named by first 2 chars of hash
  const subdir = fileHash.substring(0, 2);
  return path.join(backupPath, subdir, fileHash);
}

/**
 * Check if a backup file exists (handles both old and new backup formats)
 */
async function findBackupFile(backupPath: string, fileHash: string): Promise<string | null> {
  // Try new format first (iOS 10+)
  const newPath = getBackupFilePath(backupPath, fileHash);
  if (await fs.access(newPath).then(() => true).catch(() => false)) {
    return newPath;
  }

  // Try old format (files directly in backup folder)
  const oldPath = path.join(backupPath, fileHash);
  if (await fs.access(oldPath).then(() => true).catch(() => false)) {
    return oldPath;
  }

  return null;
}

// ============================================
// CONTACT EXTRACTION
// ============================================

/**
 * Extract contacts from an iPhone backup
 */
async function extractContacts(
  backup: iPhoneBackup,
  onProgress?: (progress: SyncProgress) => void
): Promise<iPhoneContact[]> {
  if (backup.isEncrypted) {
    throw new Error('Cannot read contacts from encrypted backup. Please disable backup encryption in iTunes/Finder.');
  }

  const addressBookPath = await findBackupFile(backup.backupPath, BACKUP_FILE_HASHES.ADDRESS_BOOK);
  if (!addressBookPath) {
    throw new Error('Address book database not found in backup');
  }

  console.log('[iPhoneBackup] Reading contacts from:', addressBookPath);

  const db = new sqlite3.Database(addressBookPath, sqlite3.OPEN_READONLY);
  const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>;
  const dbClose = promisify(db.close.bind(db)) as () => Promise<void>;

  try {
    onProgress?.({
      status: 'reading_contacts',
      stage: 'Loading contacts...',
    });

    // Get all persons
    const persons = await dbAll(`
      SELECT
        ROWID as id,
        First as firstName,
        Last as lastName,
        Organization as organization,
        CreationDate as createdAt,
        ModificationDate as modifiedAt
      FROM ABPerson
      WHERE First IS NOT NULL OR Last IS NOT NULL OR Organization IS NOT NULL
    `) as any[];

    console.log(`[iPhoneBackup] Found ${persons.length} contacts`);

    const contacts: iPhoneContact[] = [];

    for (let i = 0; i < persons.length; i++) {
      const person = persons[i];

      onProgress?.({
        status: 'reading_contacts',
        stage: 'Processing contacts...',
        current: i + 1,
        total: persons.length,
      });

      // Get phone numbers for this person
      const phones = await dbAll(`
        SELECT
          c_label as label,
          c_value as value
        FROM ABMultiValue
        WHERE record_id = ? AND property = 3
      `, [person.id]) as any[];

      // Get email addresses for this person
      const emails = await dbAll(`
        SELECT
          c_label as label,
          c_value as value
        FROM ABMultiValue
        WHERE record_id = ? AND property = 4
      `, [person.id]) as any[];

      // Build display name
      const firstName = person.firstName || '';
      const lastName = person.lastName || '';
      const organization = person.organization || '';

      let displayName = '';
      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
      } else if (firstName) {
        displayName = firstName;
      } else if (lastName) {
        displayName = lastName;
      } else if (organization) {
        displayName = organization;
      } else {
        displayName = 'Unknown';
      }

      const phoneNumbers: iPhonePhoneNumber[] = phones.map((p: any) => ({
        label: parseLabel(p.label),
        value: p.value,
      }));

      const emailAddresses: iPhoneEmailAddress[] = emails.map((e: any) => ({
        label: parseLabel(e.label),
        value: e.value,
      }));

      // Only include contacts that have at least a phone or email
      if (phoneNumbers.length > 0 || emailAddresses.length > 0) {
        contacts.push({
          id: String(person.id),
          firstName: person.firstName,
          lastName: person.lastName,
          organization: person.organization,
          displayName,
          phoneNumbers,
          emailAddresses,
          createdAt: person.createdAt ? new Date(person.createdAt * 1000 + 978307200000) : undefined,
          modifiedAt: person.modifiedAt ? new Date(person.modifiedAt * 1000 + 978307200000) : undefined,
        });
      }
    }

    await dbClose();

    console.log(`[iPhoneBackup] Extracted ${contacts.length} contacts with contact info`);
    return contacts;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Parse iOS address book label format
 */
function parseLabel(label: string | null): string {
  if (!label) return 'other';

  // iOS stores labels like "_$!<Mobile>!$_" or "_$!<Home>!$_"
  const match = label.match(/_\$!<(.+)>!\$_/);
  if (match) {
    return match[1].toLowerCase();
  }

  return label.toLowerCase();
}

// ============================================
// MESSAGE EXTRACTION
// ============================================

/**
 * Extract conversations and messages from an iPhone backup
 */
async function extractConversations(
  backup: iPhoneBackup,
  onProgress?: (progress: SyncProgress) => void
): Promise<iPhoneConversation[]> {
  if (backup.isEncrypted) {
    throw new Error('Cannot read messages from encrypted backup. Please disable backup encryption in iTunes/Finder.');
  }

  const smsDbPath = await findBackupFile(backup.backupPath, BACKUP_FILE_HASHES.SMS_DB);
  if (!smsDbPath) {
    throw new Error('SMS database not found in backup');
  }

  console.log('[iPhoneBackup] Reading messages from:', smsDbPath);

  const db = new sqlite3.Database(smsDbPath, sqlite3.OPEN_READONLY);
  const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>;
  const dbClose = promisify(db.close.bind(db)) as () => Promise<void>;

  try {
    onProgress?.({
      status: 'reading_messages',
      stage: 'Loading conversations...',
    });

    // Get all chats with message counts
    const chats = await dbAll(`
      SELECT
        c.ROWID as id,
        c.chat_identifier as chatIdentifier,
        c.display_name as displayName,
        c.service_name as serviceName,
        COUNT(cm.message_id) as messageCount,
        MAX(m.date) as lastMessageDate
      FROM chat c
      LEFT JOIN chat_message_join cm ON c.ROWID = cm.chat_id
      LEFT JOIN message m ON cm.message_id = m.ROWID
      GROUP BY c.ROWID
      HAVING messageCount > 0
      ORDER BY lastMessageDate DESC
    `) as any[];

    console.log(`[iPhoneBackup] Found ${chats.length} conversations`);

    const conversations: iPhoneConversation[] = [];

    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i];

      onProgress?.({
        status: 'reading_messages',
        stage: 'Processing conversations...',
        current: i + 1,
        total: chats.length,
      });

      // Get participants
      const participants = await dbAll(`
        SELECT DISTINCT
          h.ROWID as id,
          h.id as identifier,
          h.uncanonicalized_id as displayName
        FROM chat_handle_join chj
        JOIN handle h ON chj.handle_id = h.ROWID
        WHERE chj.chat_id = ?
      `, [chat.id]) as any[];

      const isGroupChat = chat.chatIdentifier?.startsWith('chat') && !chat.chatIdentifier?.includes('@');

      const participantList: iPhoneParticipant[] = participants.map((p: any) => ({
        id: String(p.id),
        identifier: p.identifier,
        displayName: p.displayName || p.identifier,
      }));

      // Convert iOS timestamp to Date
      // iOS uses nanoseconds since 2001-01-01
      let lastMessageDate: Date | undefined;
      if (chat.lastMessageDate) {
        lastMessageDate = new Date(chat.lastMessageDate / 1000000 + 978307200000);
      }

      conversations.push({
        id: String(chat.id),
        chatIdentifier: chat.chatIdentifier,
        displayName: chat.displayName || undefined,
        participants: participantList,
        isGroupChat,
        messageCount: chat.messageCount,
        lastMessageDate,
      });
    }

    await dbClose();

    console.log(`[iPhoneBackup] Extracted ${conversations.length} conversations`);
    return conversations;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Extract messages for a specific conversation
 */
async function extractMessages(
  backup: iPhoneBackup,
  conversationId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<iPhoneMessage[]> {
  if (backup.isEncrypted) {
    throw new Error('Cannot read messages from encrypted backup');
  }

  const smsDbPath = await findBackupFile(backup.backupPath, BACKUP_FILE_HASHES.SMS_DB);
  if (!smsDbPath) {
    throw new Error('SMS database not found in backup');
  }

  const db = new sqlite3.Database(smsDbPath, sqlite3.OPEN_READONLY);
  const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>;
  const dbClose = promisify(db.close.bind(db)) as () => Promise<void>;

  try {
    onProgress?.({
      status: 'reading_messages',
      stage: 'Loading messages...',
    });

    const rawMessages = await dbAll(`
      SELECT
        m.ROWID as id,
        m.text,
        m.date,
        m.is_from_me as isFromMe,
        m.cache_has_attachments as hasAttachments,
        m.is_read as isRead,
        m.service as service,
        h.id as sender
      FROM message m
      JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE cmj.chat_id = ?
      ORDER BY m.date ASC
    `, [parseInt(conversationId)]) as any[];

    const messages: iPhoneMessage[] = rawMessages.map((msg: any) => {
      // Convert iOS timestamp
      const date = new Date(msg.date / 1000000 + 978307200000);

      return {
        id: String(msg.id),
        conversationId,
        text: msg.text || undefined,
        date,
        isFromMe: msg.isFromMe === 1,
        sender: msg.sender || undefined,
        hasAttachments: msg.hasAttachments === 1,
        isRead: msg.isRead === 1,
        messageType: msg.service === 'iMessage' ? 'imessage' : 'sms',
      };
    });

    await dbClose();

    console.log(`[iPhoneBackup] Extracted ${messages.length} messages for conversation ${conversationId}`);
    return messages;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Stream all messages for selected contacts
 */
async function streamMessagesForContacts(
  backup: iPhoneBackup,
  contacts: iPhoneContact[],
  onProgress?: (progress: SyncProgress) => void,
  onData?: (data: { contact: iPhoneContact; messages: iPhoneMessage[] }) => void
): Promise<void> {
  if (backup.isEncrypted) {
    throw new Error('Cannot read messages from encrypted backup');
  }

  const smsDbPath = await findBackupFile(backup.backupPath, BACKUP_FILE_HASHES.SMS_DB);
  if (!smsDbPath) {
    throw new Error('SMS database not found in backup');
  }

  const db = new sqlite3.Database(smsDbPath, sqlite3.OPEN_READONLY);
  const dbAll = promisify(db.all.bind(db)) as (sql: string, params?: any[]) => Promise<any[]>;
  const dbClose = promisify(db.close.bind(db)) as () => Promise<void>;

  try {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      onProgress?.({
        status: 'streaming',
        stage: `Processing ${contact.displayName}...`,
        current: i + 1,
        total: contacts.length,
        message: `Contact ${i + 1} of ${contacts.length}`,
      });

      // Build identifiers list (all phone numbers and emails)
      const identifiers: string[] = [
        ...contact.phoneNumbers.map(p => normalizePhoneNumber(p.value)),
        ...contact.emailAddresses.map(e => e.value.toLowerCase()),
      ];

      if (identifiers.length === 0) continue;

      // Find all chats involving any of these identifiers
      const placeholders = identifiers.map(() => '?').join(',');
      const chatIds = await dbAll(`
        SELECT DISTINCT cmj.chat_id as chatId
        FROM chat_message_join cmj
        JOIN message m ON cmj.message_id = m.ROWID
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE h.id IN (${placeholders})
      `, identifiers) as any[];

      if (chatIds.length === 0) {
        onData?.({ contact, messages: [] });
        continue;
      }

      // Get all messages from these chats
      const chatIdList = chatIds.map((c: any) => c.chatId);
      const chatIdPlaceholders = chatIdList.map(() => '?').join(',');

      const rawMessages = await dbAll(`
        SELECT
          m.ROWID as id,
          m.text,
          m.date,
          m.is_from_me as isFromMe,
          m.cache_has_attachments as hasAttachments,
          m.is_read as isRead,
          m.service as service,
          h.id as sender,
          cmj.chat_id as chatId
        FROM message m
        JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE cmj.chat_id IN (${chatIdPlaceholders})
        ORDER BY m.date ASC
      `, chatIdList) as any[];

      const messages: iPhoneMessage[] = rawMessages.map((msg: any) => ({
        id: String(msg.id),
        conversationId: String(msg.chatId),
        text: msg.text || undefined,
        date: new Date(msg.date / 1000000 + 978307200000),
        isFromMe: msg.isFromMe === 1,
        sender: msg.sender || undefined,
        hasAttachments: msg.hasAttachments === 1,
        isRead: msg.isRead === 1,
        messageType: msg.service === 'iMessage' ? 'imessage' as const : 'sms' as const,
      }));

      onData?.({ contact, messages });
    }

    await dbClose();
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Normalize phone number for matching
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with country code 1, include it
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // For 10-digit US numbers, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

// ============================================
// EXPORTS
// ============================================

export {
  discoverBackups,
  parseBackupInfo,
  findBackupFile,
  extractContacts,
  extractConversations,
  extractMessages,
  streamMessagesForContacts,
  getBackupLocations,
  normalizePhoneNumber,
};
