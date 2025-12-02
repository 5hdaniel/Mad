/**
 * iPhone Data Types
 * Types for iPhone USB connection and data extraction
 */

// ============================================
// DEVICE TYPES
// ============================================

export interface iPhoneDevice {
  id: string;
  udid: string;
  name: string;
  productType?: string; // e.g., "iPhone14,2"
  productVersion?: string; // iOS version
  serialNumber?: string;
  connectionType: 'usb' | 'wifi';
  isLocked: boolean;
  isPaired: boolean;
}

export interface iPhoneBackup {
  id: string;
  udid: string;
  deviceName: string;
  productVersion?: string;
  lastBackupDate: Date;
  backupPath: string;
  isEncrypted: boolean;
  size?: number;
}

// ============================================
// CONTACT TYPES
// ============================================

export interface iPhoneContact {
  id: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  displayName: string;
  phoneNumbers: iPhonePhoneNumber[];
  emailAddresses: iPhoneEmailAddress[];
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface iPhonePhoneNumber {
  label?: string; // "mobile", "home", "work", etc.
  value: string;
}

export interface iPhoneEmailAddress {
  label?: string;
  value: string;
}

// ============================================
// MESSAGE TYPES
// ============================================

export interface iPhoneConversation {
  id: string;
  chatIdentifier: string;
  displayName?: string;
  participants: iPhoneParticipant[];
  isGroupChat: boolean;
  messageCount: number;
  lastMessageDate?: Date;
  unreadCount?: number;
}

export interface iPhoneParticipant {
  id: string;
  identifier: string; // phone number or email
  displayName?: string;
}

export interface iPhoneMessage {
  id: string;
  conversationId: string;
  text?: string;
  date: Date;
  isFromMe: boolean;
  sender?: string;
  senderName?: string;
  hasAttachments: boolean;
  attachmentCount?: number;
  isRead: boolean;
  messageType: 'sms' | 'imessage';
}

// ============================================
// SYNC STATUS TYPES
// ============================================

export type SyncStatus =
  | 'idle'
  | 'connecting'
  | 'scanning'
  | 'reading_contacts'
  | 'reading_messages'
  | 'streaming'
  | 'complete'
  | 'error';

export interface SyncProgress {
  status: SyncStatus;
  stage?: string;
  current?: number;
  total?: number;
  message?: string;
  error?: string;
}

// ============================================
// SELECTION TYPES
// ============================================

export interface ContactSelection {
  contactId: string;
  selected: boolean;
  includeMessages: boolean;
}

export interface ConversationSelection {
  conversationId: string;
  selected: boolean;
  participantIds: string[];
}

// ============================================
// IMPORT RESULT TYPES
// ============================================

export interface ImportResult {
  success: boolean;
  contactsImported: number;
  conversationsImported: number;
  messagesImported: number;
  errors: string[];
  warnings: string[];
}

export interface StreamChunk {
  type: 'contact' | 'conversation' | 'message' | 'progress' | 'complete' | 'error';
  data: any;
  index?: number;
  total?: number;
}

// ============================================
// BACKUP MANIFEST TYPES
// ============================================

export interface BackupManifest {
  isEncrypted: boolean;
  version: string;
  date: Date;
  systemVersion: string;
  deviceName: string;
  productType: string;
  productVersion: string;
  uniqueDeviceID: string;
  files: BackupFile[];
}

export interface BackupFile {
  fileID: string;
  domain: string;
  relativePath: string;
  flags: number;
  size?: number;
}

// ============================================
// KNOWN BACKUP FILE HASHES
// ============================================

/**
 * Known file hashes in iPhone backups
 * These are consistent across iOS versions
 */
export const BACKUP_FILE_HASHES = {
  // Address Book (Contacts)
  ADDRESS_BOOK: '31bb7ba8914766d4ba40d6dfb6113c8b614be442',
  ADDRESS_BOOK_IMAGES: 'cd6702cea29fe89cf280a76794405adb17f9a0ee',

  // SMS/iMessage Database
  SMS_DB: '3d0d7e5fb2ce288813306e4d4636395e047a3d28',

  // Call History
  CALL_HISTORY: '2b2b0084a1bc3a5ac8c27afdf14afb42c61a19ca',

  // Notes
  NOTES: 'ca3bc056d4da0bbf88b5fb3be254f3b7147e639c',

  // Calendar
  CALENDAR: '2041457d5fe04d39d0ab481178355df6781e6858',

  // Safari Bookmarks
  SAFARI_BOOKMARKS: 'e74113c185fd8297e140cfcf9c99436c5cc06b57',

  // Photos database
  PHOTOS_DB: '12b144c0bd44f2b3dffd9186d3f9c05b917571e3',
} as const;

// ============================================
// BACKUP LOCATIONS
// ============================================

/**
 * Default iTunes/Apple backup locations on different platforms
 */
export const BACKUP_LOCATIONS = {
  windows: [
    // Standard iTunes installation
    '%APPDATA%\\Apple Computer\\MobileSync\\Backup',
    // Microsoft Store version of iTunes
    '%USERPROFILE%\\Apple\\MobileSync\\Backup',
  ],
  darwin: [
    '~/Library/Application Support/MobileSync/Backup',
  ],
  linux: [
    '~/.config/libimobiledevice/backup',
  ],
} as const;
