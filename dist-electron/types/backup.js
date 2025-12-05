"use strict";
/**
 * Types for the iPhone backup service
 * Used for extracting messages and contacts from iPhone via idevicebackup2
 * Includes encryption support types for encrypted backups (TASK-007)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRAP_TYPE = exports.KEYBAG_TYPE = exports.PROTECTION_CLASS = exports.REQUIRED_BACKUP_FILES = void 0;
/**
 * Files we need to decrypt for message/contact extraction
 */
exports.REQUIRED_BACKUP_FILES = {
    SMS_DB: {
        hash: '3d0d7e5fb2ce288813306e4d4636395e047a3d28',
        domain: 'HomeDomain',
        relativePath: 'Library/SMS/sms.db',
        description: 'iMessage/SMS database',
    },
    ADDRESS_BOOK: {
        hash: '31bb7ba8914766d4ba40d6dfb6113c8b614be442',
        domain: 'HomeDomain',
        relativePath: 'Library/AddressBook/AddressBook.sqlitedb',
        description: 'Contacts database',
    },
};
/**
 * Protection class constants for iOS Data Protection
 * See: https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web
 */
exports.PROTECTION_CLASS = {
    NSFileProtectionComplete: 1,
    NSFileProtectionCompleteUnlessOpen: 2,
    NSFileProtectionCompleteUntilFirstUserAuthentication: 3,
    NSFileProtectionNone: 4,
    NSFileProtectionRecovery: 5,
    kSecAttrAccessibleWhenUnlocked: 6,
    kSecAttrAccessibleAfterFirstUnlock: 7,
    kSecAttrAccessibleAlways: 8,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly: 9,
    kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly: 10,
    kSecAttrAccessibleAlwaysThisDeviceOnly: 11,
};
/**
 * Keybag type constants
 */
exports.KEYBAG_TYPE = {
    System: 0,
    Backup: 1,
    Escrow: 2,
    OTA: 3,
};
/**
 * Wrap type constants
 */
exports.WRAP_TYPE = {
    AES: 1,
    Curve25519: 2,
};
