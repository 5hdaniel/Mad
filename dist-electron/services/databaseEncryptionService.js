"use strict";
/**
 * Database Encryption Service
 * Manages encryption keys for SQLite database using Electron's safeStorage API
 * Keys are stored securely in the OS keychain (macOS Keychain, Windows DPAPI, Linux Secret Service)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseEncryptionService = void 0;
const electron_1 = require("electron");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logService_1 = __importDefault(require("./logService"));
/**
 * Database Encryption Service Class
 * Handles encryption key generation, storage, and retrieval for database encryption
 */
class DatabaseEncryptionService {
    constructor() {
        this.KEY_STORE_FILENAME = 'db-key-store.json';
        this.KEY_VERSION = 1;
        this.keyStorePath = null;
        this.cachedKey = null;
    }
    /**
     * Initialize the encryption service
     * Must be called after Electron app is ready
     */
    async initialize() {
        try {
            const userDataPath = electron_1.app.getPath('userData');
            this.keyStorePath = path_1.default.join(userDataPath, this.KEY_STORE_FILENAME);
            await logService_1.default.info('Database encryption service initialized', 'DatabaseEncryptionService');
        }
        catch (error) {
            await logService_1.default.error('Failed to initialize encryption service', 'DatabaseEncryptionService', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Check if encryption is available on this system
     * @returns {boolean} True if OS-level encryption is available
     */
    isEncryptionAvailable() {
        try {
            return electron_1.safeStorage.isEncryptionAvailable();
        }
        catch (error) {
            logService_1.default.error('Error checking encryption availability', 'DatabaseEncryptionService', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    /**
     * Get or create database encryption key
     * Key is stored in OS keychain via Electron safeStorage
     * @returns {Promise<string>} The encryption key (hex encoded)
     */
    async getEncryptionKey() {
        // Return cached key if available
        if (this.cachedKey) {
            return this.cachedKey;
        }
        if (!this.isEncryptionAvailable()) {
            const error = new Error('Encryption not available. Database encryption requires OS-level encryption support.');
            await logService_1.default.error('Encryption not available on this system', 'DatabaseEncryptionService');
            throw error;
        }
        const existingKey = await this.getKeyFromStore();
        if (existingKey) {
            this.cachedKey = existingKey;
            return existingKey;
        }
        // Generate new key
        const newKey = await this.generateNewKey();
        this.cachedKey = newKey;
        return newKey;
    }
    /**
     * Generate a new encryption key and store it
     * @returns {Promise<string>} The new encryption key (hex encoded)
     */
    async generateNewKey() {
        try {
            // Generate 256-bit (32 bytes) key using cryptographically secure random
            const keyBuffer = crypto_1.default.randomBytes(32);
            const keyHex = keyBuffer.toString('hex');
            // Encrypt and store the key
            await this.saveKeyToStore(keyHex);
            await logService_1.default.info('Generated new database encryption key', 'DatabaseEncryptionService');
            return keyHex;
        }
        catch (error) {
            await logService_1.default.error('Failed to generate encryption key', 'DatabaseEncryptionService', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Retrieve encryption key from storage
     * @returns {Promise<string | null>} The decrypted key or null if not found
     */
    async getKeyFromStore() {
        if (!this.keyStorePath) {
            throw new Error('Encryption service not initialized');
        }
        try {
            if (!fs_1.default.existsSync(this.keyStorePath)) {
                return null;
            }
            const storeContent = fs_1.default.readFileSync(this.keyStorePath, 'utf8');
            const keyStore = JSON.parse(storeContent);
            if (!keyStore.encryptedKey) {
                await logService_1.default.warn('Key store exists but contains no encrypted key', 'DatabaseEncryptionService');
                return null;
            }
            // Decrypt the key using OS keychain
            const encryptedBuffer = Buffer.from(keyStore.encryptedKey, 'base64');
            const decryptedKey = electron_1.safeStorage.decryptString(encryptedBuffer);
            await logService_1.default.debug('Retrieved encryption key from store', 'DatabaseEncryptionService', { keyId: keyStore.metadata.keyId, version: keyStore.metadata.version });
            return decryptedKey;
        }
        catch (error) {
            await logService_1.default.error('Failed to retrieve encryption key from store', 'DatabaseEncryptionService', { error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    /**
     * Save encryption key to storage (encrypted with OS keychain)
     * @param {string} key - The encryption key to store
     */
    async saveKeyToStore(key) {
        if (!this.keyStorePath) {
            throw new Error('Encryption service not initialized');
        }
        try {
            // Encrypt the key using OS keychain
            const encryptedBuffer = electron_1.safeStorage.encryptString(key);
            const encryptedBase64 = encryptedBuffer.toString('base64');
            const keyStore = {
                encryptedKey: encryptedBase64,
                metadata: {
                    keyId: crypto_1.default.randomUUID(),
                    createdAt: new Date().toISOString(),
                    version: this.KEY_VERSION,
                },
            };
            // Ensure directory exists
            const dir = path_1.default.dirname(this.keyStorePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            // Write key store to disk
            fs_1.default.writeFileSync(this.keyStorePath, JSON.stringify(keyStore, null, 2), {
                encoding: 'utf8',
                mode: 0o600, // Read/write only for owner
            });
            await logService_1.default.info('Saved encryption key to store', 'DatabaseEncryptionService', { keyId: keyStore.metadata.keyId });
        }
        catch (error) {
            await logService_1.default.error('Failed to save encryption key to store', 'DatabaseEncryptionService', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Check if a database file is encrypted
     * SQLite encrypted databases don't have the standard SQLite header
     * @param {string} dbPath - Path to the database file
     * @returns {Promise<boolean>} True if the database appears to be encrypted
     */
    async isDatabaseEncrypted(dbPath) {
        try {
            if (!fs_1.default.existsSync(dbPath)) {
                return false; // New database, will be created encrypted
            }
            // Read the first 16 bytes of the file
            const fd = fs_1.default.openSync(dbPath, 'r');
            const buffer = Buffer.alloc(16);
            fs_1.default.readSync(fd, buffer, 0, 16, 0);
            fs_1.default.closeSync(fd);
            // SQLite files start with "SQLite format 3\0"
            const sqliteHeader = 'SQLite format 3\0';
            const headerMatch = buffer.toString('utf8', 0, 16) === sqliteHeader;
            // If it matches SQLite header, it's NOT encrypted
            // If it doesn't match, it's either encrypted or not a SQLite file
            return !headerMatch;
        }
        catch (error) {
            await logService_1.default.warn('Could not check database encryption status', 'DatabaseEncryptionService', { dbPath, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    /**
     * Rotate the encryption key (for future implementation)
     * This creates a new key while keeping the old one for migration
     * @returns {Promise<{ oldKey: string; newKey: string }>} The old and new keys
     */
    async rotateKey() {
        if (!this.keyStorePath) {
            throw new Error('Encryption service not initialized');
        }
        const oldKey = await this.getEncryptionKey();
        // Generate new key
        const newKeyBuffer = crypto_1.default.randomBytes(32);
        const newKey = newKeyBuffer.toString('hex');
        // Update key store with new key and rotation timestamp
        const encryptedBuffer = electron_1.safeStorage.encryptString(newKey);
        const encryptedBase64 = encryptedBuffer.toString('base64');
        const keyStore = {
            encryptedKey: encryptedBase64,
            metadata: {
                keyId: crypto_1.default.randomUUID(),
                createdAt: new Date().toISOString(),
                rotatedAt: new Date().toISOString(),
                version: this.KEY_VERSION,
            },
        };
        fs_1.default.writeFileSync(this.keyStorePath, JSON.stringify(keyStore, null, 2), {
            encoding: 'utf8',
            mode: 0o600,
        });
        // Clear cached key
        this.cachedKey = newKey;
        await logService_1.default.info('Encryption key rotated successfully', 'DatabaseEncryptionService', { newKeyId: keyStore.metadata.keyId });
        return { oldKey, newKey };
    }
    /**
     * Clear cached key (useful for testing)
     */
    clearCache() {
        this.cachedKey = null;
    }
    /**
     * Check if the encryption key store file exists
     * This does NOT trigger any keychain prompts - it just checks file existence
     * Useful for determining if this is a new user vs returning user
     * @returns {boolean} True if key store file exists
     */
    hasKeyStore() {
        if (!this.keyStorePath) {
            // Service not initialized yet, check default path
            try {
                const userDataPath = electron_1.app.getPath('userData');
                const defaultKeyStorePath = path_1.default.join(userDataPath, this.KEY_STORE_FILENAME);
                return fs_1.default.existsSync(defaultKeyStorePath);
            }
            catch {
                return false;
            }
        }
        return fs_1.default.existsSync(this.keyStorePath);
    }
    /**
     * Get key metadata for diagnostics (does not expose key)
     * @returns {Promise<KeyMetadata | null>} Key metadata or null if not found
     */
    async getKeyMetadata() {
        if (!this.keyStorePath || !fs_1.default.existsSync(this.keyStorePath)) {
            return null;
        }
        try {
            const storeContent = fs_1.default.readFileSync(this.keyStorePath, 'utf8');
            const keyStore = JSON.parse(storeContent);
            return keyStore.metadata;
        }
        catch (error) {
            await logService_1.default.error('Failed to read key metadata', 'DatabaseEncryptionService', { error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
}
// Export singleton instance
exports.databaseEncryptionService = new DatabaseEncryptionService();
exports.default = exports.databaseEncryptionService;
