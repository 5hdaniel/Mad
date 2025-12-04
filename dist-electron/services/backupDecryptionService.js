"use strict";
/**
 * Backup Decryption Service
 * Handles decryption of iOS encrypted backups
 *
 * iOS backups use a multi-layer encryption scheme:
 * Password -> PBKDF2 -> Key Encryption Key (KEK) -> Unwrap Class Keys -> Decrypt Files
 *
 * Reference: https://github.com/jsharkey13/iphone_backup_decrypt
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupDecryptionService = exports.BackupDecryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const simple_plist_1 = __importDefault(require("simple-plist"));
const logService_1 = __importDefault(require("./logService"));
// Import better-sqlite3-multiple-ciphers for reading Manifest.db
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3-multiple-ciphers');
/**
 * Backup Decryption Service Class
 * Decrypts iOS encrypted backups to extract messages and contacts
 */
class BackupDecryptionService {
    constructor() {
        // Files we need to decrypt
        this.requiredFiles = [
            '3d0d7e5fb2ce288813306e4d4636395e047a3d28', // sms.db
            '31bb7ba8914766d4ba40d6dfb6113c8b614be442', // AddressBook.sqlitedb
        ];
    }
    /**
     * Decrypt an iOS backup using the provided password
     * @param backupPath - Path to the backup directory
     * @param password - User's backup password
     * @returns DecryptionResult with success status and decrypted path
     */
    async decryptBackup(backupPath, password) {
        try {
            await logService_1.default.info('Starting backup decryption', BackupDecryptionService.SERVICE_NAME, { backupPath });
            // 1. Read and parse Manifest.plist to get encryption info
            const manifestPath = path_1.default.join(backupPath, 'Manifest.plist');
            if (!fs_1.default.existsSync(manifestPath)) {
                return {
                    success: false,
                    error: 'Manifest.plist not found - invalid backup',
                    decryptedPath: null,
                };
            }
            const manifest = await this.readManifest(manifestPath);
            if (!manifest.IsEncrypted) {
                return {
                    success: false,
                    error: 'Backup is not encrypted',
                    decryptedPath: null,
                };
            }
            // 2. Parse the keybag from Manifest.plist
            const keybag = this.parseKeybag(manifest.BackupKeyBag);
            // 3. Derive decryption keys using PBKDF2
            const keys = await this.deriveKeys(password, keybag);
            // 4. Verify password is correct by attempting to unwrap class keys
            const classKeysUnwrapped = this.unwrapClassKeys(keybag, keys.keyEncryptionKey);
            if (!classKeysUnwrapped) {
                return {
                    success: false,
                    error: 'Incorrect password',
                    decryptedPath: null,
                };
            }
            keys.classKeys = classKeysUnwrapped;
            // 5. Decrypt Manifest.db to get file list
            const manifestDbPath = path_1.default.join(backupPath, 'Manifest.db');
            const decryptedManifestDb = await this.decryptManifestDb(manifestDbPath, manifest.ManifestKey, keys);
            // 6. Create output directory for decrypted files
            const outputPath = path_1.default.join(backupPath, 'decrypted');
            if (!fs_1.default.existsSync(outputPath)) {
                fs_1.default.mkdirSync(outputPath, { recursive: true });
            }
            // 7. Decrypt only the files we need
            await this.decryptRequiredFiles(backupPath, decryptedManifestDb, keys, outputPath);
            await logService_1.default.info('Backup decryption completed successfully', BackupDecryptionService.SERVICE_NAME, { outputPath });
            // Clear sensitive data from memory
            this.clearSensitiveData(keys);
            return {
                success: true,
                error: null,
                decryptedPath: outputPath,
            };
        }
        catch (error) {
            await logService_1.default.error('Decryption failed', BackupDecryptionService.SERVICE_NAME, { error: error instanceof Error ? error.message : String(error) });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown decryption error',
                decryptedPath: null,
            };
        }
    }
    /**
     * Check if a backup is encrypted
     * @param backupPath - Path to the backup directory
     * @returns true if backup is encrypted
     */
    async isBackupEncrypted(backupPath) {
        try {
            const manifestPath = path_1.default.join(backupPath, 'Manifest.plist');
            if (!fs_1.default.existsSync(manifestPath)) {
                return false;
            }
            const manifest = await this.readManifest(manifestPath);
            return manifest.IsEncrypted === true;
        }
        catch {
            return false;
        }
    }
    /**
     * Verify a backup password without fully decrypting
     * @param backupPath - Path to the backup directory
     * @param password - Password to verify
     * @returns true if password is correct
     */
    async verifyPassword(backupPath, password) {
        try {
            const manifestPath = path_1.default.join(backupPath, 'Manifest.plist');
            const manifest = await this.readManifest(manifestPath);
            if (!manifest.IsEncrypted || !manifest.BackupKeyBag) {
                return false;
            }
            const keybag = this.parseKeybag(manifest.BackupKeyBag);
            const keys = await this.deriveKeys(password, keybag);
            const classKeys = this.unwrapClassKeys(keybag, keys.keyEncryptionKey);
            // Clear sensitive data
            keys.keyEncryptionKey.fill(0);
            return classKeys !== null;
        }
        catch {
            return false;
        }
    }
    /**
     * Read and parse Manifest.plist
     */
    async readManifest(manifestPath) {
        const manifestData = fs_1.default.readFileSync(manifestPath);
        const parsed = simple_plist_1.default.parse(manifestData);
        return {
            IsEncrypted: parsed.IsEncrypted,
            ManifestKey: parsed.ManifestKey,
            BackupKeyBag: parsed.BackupKeyBag,
            Lockdown: parsed.Lockdown,
        };
    }
    /**
     * Parse the keybag from backup metadata
     * The keybag contains wrapped class keys that protect file data
     */
    parseKeybag(keybagData) {
        const keybag = {
            uuid: Buffer.alloc(0),
            type: 0,
            classKeys: new Map(),
        };
        let offset = 0;
        let currentClass = null;
        let currentItem = {};
        while (offset < keybagData.length) {
            if (offset + 8 > keybagData.length)
                break;
            // Read tag (4 bytes) and length (4 bytes)
            const tag = keybagData.toString('ascii', offset, offset + 4);
            const length = keybagData.readUInt32BE(offset + 4);
            offset += 8;
            if (offset + length > keybagData.length)
                break;
            const value = keybagData.subarray(offset, offset + length);
            offset += length;
            switch (tag) {
                case 'UUID':
                    if (currentClass === null) {
                        keybag.uuid = Buffer.from(value);
                    }
                    else {
                        currentItem.uuid = Buffer.from(value);
                    }
                    break;
                case 'TYPE':
                    keybag.type = value.readUInt32BE(0);
                    break;
                case 'HMCK':
                    keybag.hmck = Buffer.from(value);
                    break;
                case 'WRAP':
                    if (currentClass === null) {
                        keybag.wrap = value.readUInt32BE(0);
                    }
                    else {
                        currentItem.wrap = value.readUInt32BE(0);
                    }
                    break;
                case 'SALT':
                    if (currentClass === null) {
                        keybag.salt = Buffer.from(value);
                    }
                    else {
                        currentItem.salt = Buffer.from(value);
                    }
                    break;
                case 'ITER':
                    if (currentClass === null) {
                        keybag.iter = value.readUInt32BE(0);
                    }
                    else {
                        currentItem.iter = value.readUInt32BE(0);
                    }
                    break;
                case 'DPWT':
                    if (currentClass === null) {
                        keybag.dpwt = value.readUInt32BE(0);
                    }
                    else {
                        currentItem.dpwt = value.readUInt32BE(0);
                    }
                    break;
                case 'DPIC':
                    if (currentClass === null) {
                        keybag.dpic = value.readUInt32BE(0);
                    }
                    else {
                        currentItem.dpic = value.readUInt32BE(0);
                    }
                    break;
                case 'DPSL':
                    if (currentClass === null) {
                        keybag.dpsl = Buffer.from(value);
                    }
                    else {
                        currentItem.dpsl = Buffer.from(value);
                    }
                    break;
                case 'CLAS':
                    // Save previous class item if any
                    if (currentClass !== null && currentItem.wpky) {
                        keybag.classKeys.set(currentClass, currentItem);
                    }
                    currentClass = value.readUInt32BE(0);
                    currentItem = { clas: currentClass };
                    break;
                case 'KTYP':
                    currentItem.ktyp = value.readUInt32BE(0);
                    break;
                case 'WPKY':
                    currentItem.wpky = Buffer.from(value);
                    break;
                case 'PBKY':
                    currentItem.publicKey = Buffer.from(value);
                    break;
            }
        }
        // Save last class item
        if (currentClass !== null && currentItem.wpky) {
            keybag.classKeys.set(currentClass, currentItem);
        }
        return keybag;
    }
    /**
     * Derive encryption keys from password using PBKDF2
     * iOS uses double PBKDF2 for backup encryption
     */
    async deriveKeys(password, keybag) {
        // First round: derive key from password
        const iterations1 = keybag.dpic || 10000;
        const salt1 = keybag.dpsl || keybag.salt || Buffer.alloc(20);
        const derivedKey1 = crypto_1.default.pbkdf2Sync(password, salt1, iterations1, 32, 'sha256');
        // Second round: derive KEK from first derived key
        const iterations2 = keybag.iter || 1;
        const salt2 = keybag.salt || Buffer.alloc(20);
        const keyEncryptionKey = crypto_1.default.pbkdf2Sync(derivedKey1, salt2, iterations2, 32, 'sha1');
        // Clear intermediate key
        derivedKey1.fill(0);
        return {
            keyEncryptionKey,
            classKeys: new Map(),
        };
    }
    /**
     * Unwrap class keys using the Key Encryption Key
     * Uses RFC 3394 AES Key Wrap algorithm
     */
    unwrapClassKeys(keybag, kek) {
        const classKeys = new Map();
        for (const [classNum, item] of keybag.classKeys) {
            if (!item.wpky)
                continue;
            // Skip asymmetric keys (wrap type 2)
            if (item.wrap === 2)
                continue;
            try {
                const unwrappedKey = this.aesKeyUnwrap(kek, item.wpky);
                if (unwrappedKey) {
                    classKeys.set(classNum, unwrappedKey);
                }
            }
            catch {
                // If any key fails to unwrap, password is likely wrong
                return null;
            }
        }
        // We need at least one class key to succeed
        if (classKeys.size === 0) {
            return null;
        }
        return classKeys;
    }
    /**
     * AES Key Unwrap (RFC 3394)
     * Used to unwrap class keys protected by KEK
     */
    aesKeyUnwrap(kek, wrappedKey) {
        if (wrappedKey.length < 24 || wrappedKey.length % 8 !== 0) {
            return null;
        }
        const n = wrappedKey.length / 8 - 1;
        const a = Buffer.from(wrappedKey.subarray(0, 8));
        const r = Buffer.alloc(n * 8);
        wrappedKey.copy(r, 0, 8);
        // Create decipher
        const decipher = crypto_1.default.createDecipheriv('aes-256-ecb', kek, null);
        decipher.setAutoPadding(false);
        // Perform unwrap iterations
        for (let j = 5; j >= 0; j--) {
            for (let i = n; i >= 1; i--) {
                const t = BigInt(n * j + i);
                // A ^ t
                const tBuf = Buffer.alloc(8);
                tBuf.writeBigUInt64BE(t, 0);
                for (let k = 0; k < 8; k++) {
                    a[k] ^= tBuf[k];
                }
                // Decrypt A || R[i]
                const block = Buffer.concat([a, r.subarray((i - 1) * 8, i * 8)]);
                const decrypted = Buffer.concat([
                    decipher.update(block),
                ]);
                // Update A and R[i]
                decrypted.copy(a, 0, 0, 8);
                decrypted.copy(r, (i - 1) * 8, 8, 16);
            }
        }
        // Verify IV (should be 0xA6A6A6A6A6A6A6A6)
        const expectedIv = Buffer.from([0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6, 0xa6]);
        if (!a.equals(expectedIv)) {
            return null;
        }
        return r;
    }
    /**
     * Decrypt Manifest.db to get file metadata
     */
    async decryptManifestDb(manifestDbPath, manifestKey, keys) {
        // The manifest key has the class prepended (4 bytes)
        const protectionClass = manifestKey.readUInt32BE(0);
        const wrappedDbKey = manifestKey.subarray(4);
        // Get the class key for this protection class
        const classKey = keys.classKeys.get(protectionClass);
        if (!classKey) {
            throw new Error(`No class key for protection class ${protectionClass}`);
        }
        // Unwrap the database key
        const dbKey = this.aesKeyUnwrap(classKey, wrappedDbKey);
        if (!dbKey) {
            throw new Error('Failed to unwrap Manifest.db key');
        }
        // Decrypt Manifest.db
        const encryptedDb = fs_1.default.readFileSync(manifestDbPath);
        const decryptedDb = this.decryptAesCbc(dbKey, encryptedDb);
        // Write decrypted database to temp location
        const decryptedDbPath = manifestDbPath + '.decrypted';
        fs_1.default.writeFileSync(decryptedDbPath, decryptedDb);
        // Clear key
        dbKey.fill(0);
        return decryptedDbPath;
    }
    /**
     * Decrypt data using AES-256-CBC with zero IV
     */
    decryptAesCbc(key, data) {
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', key, iv);
        decipher.setAutoPadding(false);
        const decrypted = Buffer.concat([
            decipher.update(data),
            decipher.final(),
        ]);
        // Remove PKCS7 padding
        const paddingLength = decrypted[decrypted.length - 1];
        if (paddingLength > 0 && paddingLength <= 16) {
            return decrypted.subarray(0, decrypted.length - paddingLength);
        }
        return decrypted;
    }
    /**
     * Decrypt only the files we need from the backup
     */
    async decryptRequiredFiles(backupPath, manifestDbPath, keys, outputPath) {
        // Open decrypted Manifest.db
        const db = new Database(manifestDbPath, { readonly: true });
        try {
            for (const fileHash of this.requiredFiles) {
                await this.decryptFile(backupPath, fileHash, db, keys, outputPath);
            }
        }
        finally {
            db.close();
            // Clean up decrypted Manifest.db
            try {
                fs_1.default.unlinkSync(manifestDbPath);
            }
            catch {
                // Ignore cleanup errors
            }
        }
    }
    /**
     * Decrypt a single file from the backup
     */
    async decryptFile(backupPath, fileHash, manifestDb, keys, outputPath) {
        // Look up file in Manifest.db
        const row = manifestDb.prepare('SELECT fileID, domain, relativePath, file FROM Files WHERE fileID = ?').get(fileHash);
        if (!row) {
            await logService_1.default.warn(`File not found in manifest: ${fileHash}`, BackupDecryptionService.SERVICE_NAME);
            return;
        }
        // Parse the file metadata plist
        let fileMetadata;
        try {
            fileMetadata = simple_plist_1.default.parse(row.file);
        }
        catch {
            await logService_1.default.warn(`Failed to parse file metadata for ${fileHash}`, BackupDecryptionService.SERVICE_NAME);
            return;
        }
        const protectionClass = fileMetadata.ProtectionClass || 0;
        const encryptionKey = fileMetadata.EncryptionKey;
        if (!encryptionKey) {
            await logService_1.default.warn(`No encryption key for file ${fileHash}`, BackupDecryptionService.SERVICE_NAME);
            return;
        }
        // Get the class key
        const classKey = keys.classKeys.get(protectionClass);
        if (!classKey) {
            await logService_1.default.warn(`No class key for protection class ${protectionClass}`, BackupDecryptionService.SERVICE_NAME);
            return;
        }
        // The encryption key has the class prepended
        const wrappedFileKey = encryptionKey.subarray(4);
        const fileKey = this.aesKeyUnwrap(classKey, wrappedFileKey);
        if (!fileKey) {
            await logService_1.default.warn(`Failed to unwrap file key for ${fileHash}`, BackupDecryptionService.SERVICE_NAME);
            return;
        }
        // Read and decrypt the file
        // Files are stored in subdirectories based on first 2 chars of hash
        const encryptedFilePath = path_1.default.join(backupPath, fileHash.substring(0, 2), fileHash);
        if (!fs_1.default.existsSync(encryptedFilePath)) {
            await logService_1.default.warn(`Encrypted file not found: ${encryptedFilePath}`, BackupDecryptionService.SERVICE_NAME);
            fileKey.fill(0);
            return;
        }
        const encryptedData = fs_1.default.readFileSync(encryptedFilePath);
        const decryptedData = this.decryptAesCbc(fileKey, encryptedData);
        // Write decrypted file
        const outputFilePath = path_1.default.join(outputPath, path_1.default.basename(row.relativePath));
        fs_1.default.writeFileSync(outputFilePath, decryptedData);
        await logService_1.default.debug(`Decrypted file: ${row.relativePath}`, BackupDecryptionService.SERVICE_NAME, { outputPath: outputFilePath });
        // Clear file key
        fileKey.fill(0);
    }
    /**
     * Clear sensitive data from memory
     */
    clearSensitiveData(keys) {
        keys.keyEncryptionKey.fill(0);
        for (const key of keys.classKeys.values()) {
            key.fill(0);
        }
        keys.classKeys.clear();
    }
    /**
     * Clean up decrypted files after parsing is complete
     * @param decryptedPath - Path to the decrypted files directory
     */
    async cleanup(decryptedPath) {
        try {
            if (fs_1.default.existsSync(decryptedPath)) {
                // Securely overwrite files before deletion
                const files = fs_1.default.readdirSync(decryptedPath);
                for (const file of files) {
                    const filePath = path_1.default.join(decryptedPath, file);
                    const stats = fs_1.default.statSync(filePath);
                    if (stats.isFile()) {
                        // Overwrite with zeros
                        const zeros = Buffer.alloc(stats.size, 0);
                        fs_1.default.writeFileSync(filePath, zeros);
                        fs_1.default.unlinkSync(filePath);
                    }
                }
                fs_1.default.rmdirSync(decryptedPath);
                await logService_1.default.debug('Cleaned up decrypted files', BackupDecryptionService.SERVICE_NAME, { path: decryptedPath });
            }
        }
        catch (error) {
            await logService_1.default.warn('Failed to clean up decrypted files', BackupDecryptionService.SERVICE_NAME, { error: error instanceof Error ? error.message : String(error) });
        }
    }
}
exports.BackupDecryptionService = BackupDecryptionService;
BackupDecryptionService.SERVICE_NAME = 'BackupDecryptionService';
// Export singleton instance
exports.backupDecryptionService = new BackupDecryptionService();
exports.default = exports.backupDecryptionService;
