"use strict";
/**
 * Key Derivation Utilities
 * Provides cryptographic key derivation and verification functions
 * for database encryption
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_KEY_CONFIG = void 0;
exports.deriveKey = deriveKey;
exports.deriveKeyAsync = deriveKeyAsync;
exports.generateRandomKey = generateRandomKey;
exports.generateRandomKeyHex = generateRandomKeyHex;
exports.hexToBuffer = hexToBuffer;
exports.bufferToHex = bufferToHex;
exports.verifyKeyIntegrity = verifyKeyIntegrity;
exports.createKeySignature = createKeySignature;
exports.secureCompare = secureCompare;
exports.validateKeyStrength = validateKeyStrength;
exports.secureZeroBuffer = secureZeroBuffer;
exports.formatKeyForSQLCipher = formatKeyForSQLCipher;
exports.getKeyIdentifier = getKeyIdentifier;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Default configuration for PBKDF2 key derivation
 * Uses secure defaults recommended for password-based key derivation
 */
exports.DEFAULT_KEY_CONFIG = {
    saltLength: 32,
    keyLength: 32,
    iterations: 100000,
    digest: 'sha512',
};
/**
 * Derive a key from a password/passphrase using PBKDF2
 * @param password - The password or passphrase to derive from
 * @param salt - Optional salt (generated if not provided)
 * @param config - Optional key derivation configuration
 * @returns {DerivedKey} The derived key and salt
 */
function deriveKey(password, salt, config = exports.DEFAULT_KEY_CONFIG) {
    const actualSalt = salt || crypto_1.default.randomBytes(config.saltLength);
    const key = crypto_1.default.pbkdf2Sync(password, actualSalt, config.iterations, config.keyLength, config.digest);
    return { key, salt: actualSalt };
}
/**
 * Derive a key asynchronously (non-blocking)
 * @param password - The password or passphrase to derive from
 * @param salt - Optional salt (generated if not provided)
 * @param config - Optional key derivation configuration
 * @returns {Promise<DerivedKey>} The derived key and salt
 */
function deriveKeyAsync(password, salt, config = exports.DEFAULT_KEY_CONFIG) {
    return new Promise((resolve, reject) => {
        const actualSalt = salt || crypto_1.default.randomBytes(config.saltLength);
        crypto_1.default.pbkdf2(password, actualSalt, config.iterations, config.keyLength, config.digest, (err, key) => {
            if (err) {
                reject(err);
            }
            else {
                resolve({ key, salt: actualSalt });
            }
        });
    });
}
/**
 * Generate a random encryption key
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns {Buffer} Random key buffer
 */
function generateRandomKey(length = 32) {
    return crypto_1.default.randomBytes(length);
}
/**
 * Generate a random encryption key as hex string
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns {string} Random key as hex string
 */
function generateRandomKeyHex(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
/**
 * Convert a hex key string to Buffer
 * @param hexKey - Key as hex string
 * @returns {Buffer} Key as buffer
 */
function hexToBuffer(hexKey) {
    return Buffer.from(hexKey, 'hex');
}
/**
 * Convert a Buffer key to hex string
 * @param buffer - Key as buffer
 * @returns {string} Key as hex string
 */
function bufferToHex(buffer) {
    return buffer.toString('hex');
}
/**
 * Verify key integrity using HMAC
 * @param key - The key to verify
 * @param data - Data that was signed
 * @param signature - The HMAC signature to verify
 * @returns {boolean} True if signature is valid
 */
function verifyKeyIntegrity(key, data, signature) {
    const expectedSignature = crypto_1.default.createHmac('sha256', key).update(data).digest();
    return crypto_1.default.timingSafeEqual(expectedSignature, signature);
}
/**
 * Create HMAC signature for key verification
 * @param key - The key to use for signing
 * @param data - Data to sign
 * @returns {Buffer} HMAC signature
 */
function createKeySignature(key, data) {
    return crypto_1.default.createHmac('sha256', key).update(data).digest();
}
/**
 * Securely compare two buffers in constant time
 * @param a - First buffer
 * @param b - Second buffer
 * @returns {boolean} True if buffers are equal
 */
function secureCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(a, b);
}
/**
 * Validate that a key meets minimum security requirements
 * @param key - The key to validate (as hex string or buffer)
 * @param minBits - Minimum key size in bits (default: 256)
 * @returns {boolean} True if key meets requirements
 */
function validateKeyStrength(key, minBits = 256) {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    const keyBits = keyBuffer.length * 8;
    return keyBits >= minBits;
}
/**
 * Zero out a buffer for secure deletion
 * @param buffer - Buffer to zero out
 */
function secureZeroBuffer(buffer) {
    buffer.fill(0);
}
/**
 * Format key for SQLCipher PRAGMA command
 * SQLCipher expects the key in a specific format
 * @param key - The encryption key (hex string)
 * @returns {string} Formatted key for PRAGMA
 */
function formatKeyForSQLCipher(key) {
    // SQLCipher accepts hex keys prefixed with "x'"
    // e.g., x'2DD29CA851E7B56E4697B0E1F08507293D761A05CE4D1B628663F411A8086D99'
    return `x'${key.toUpperCase()}'`;
}
/**
 * Generate a key identifier (hash) without exposing the key
 * Useful for logging and diagnostics
 * @param key - The key to identify
 * @returns {string} Short identifier for the key
 */
function getKeyIdentifier(key) {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
    const hash = crypto_1.default.createHash('sha256').update(keyBuffer).digest('hex');
    return hash.substring(0, 8);
}
