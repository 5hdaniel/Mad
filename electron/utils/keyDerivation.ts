/**
 * Key Derivation Utilities
 * Provides cryptographic key derivation and verification functions
 * for database encryption
 */

import crypto from "crypto";

/**
 * Key derivation configuration
 */
export interface KeyDerivationConfig {
  saltLength: number;
  keyLength: number;
  iterations: number;
  digest: string;
}

/**
 * Default configuration for PBKDF2 key derivation
 * Uses secure defaults recommended for password-based key derivation
 */
export const DEFAULT_KEY_CONFIG: KeyDerivationConfig = {
  saltLength: 32,
  keyLength: 32,
  iterations: 100000,
  digest: "sha512",
};

/**
 * Derived key result including salt for storage
 */
export interface DerivedKey {
  key: Buffer;
  salt: Buffer;
}

/**
 * Derive a key from a password/passphrase using PBKDF2
 * @param password - The password or passphrase to derive from
 * @param salt - Optional salt (generated if not provided)
 * @param config - Optional key derivation configuration
 * @returns {DerivedKey} The derived key and salt
 */
export function deriveKey(
  password: string,
  salt?: Buffer,
  config: KeyDerivationConfig = DEFAULT_KEY_CONFIG,
): DerivedKey {
  const actualSalt = salt || crypto.randomBytes(config.saltLength);

  const key = crypto.pbkdf2Sync(
    password,
    actualSalt,
    config.iterations,
    config.keyLength,
    config.digest,
  );

  return { key, salt: actualSalt };
}

/**
 * Derive a key asynchronously (non-blocking)
 * @param password - The password or passphrase to derive from
 * @param salt - Optional salt (generated if not provided)
 * @param config - Optional key derivation configuration
 * @returns {Promise<DerivedKey>} The derived key and salt
 */
export function deriveKeyAsync(
  password: string,
  salt?: Buffer,
  config: KeyDerivationConfig = DEFAULT_KEY_CONFIG,
): Promise<DerivedKey> {
  return new Promise((resolve, reject) => {
    const actualSalt = salt || crypto.randomBytes(config.saltLength);

    crypto.pbkdf2(
      password,
      actualSalt,
      config.iterations,
      config.keyLength,
      config.digest,
      (err, key) => {
        if (err) {
          reject(err);
        } else {
          resolve({ key, salt: actualSalt });
        }
      },
    );
  });
}

/**
 * Generate a random encryption key
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns {Buffer} Random key buffer
 */
export function generateRandomKey(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Generate a random encryption key as hex string
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns {string} Random key as hex string
 */
export function generateRandomKeyHex(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Convert a hex key string to Buffer
 * @param hexKey - Key as hex string
 * @returns {Buffer} Key as buffer
 */
export function hexToBuffer(hexKey: string): Buffer {
  return Buffer.from(hexKey, "hex");
}

/**
 * Convert a Buffer key to hex string
 * @param buffer - Key as buffer
 * @returns {string} Key as hex string
 */
export function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

/**
 * Verify key integrity using HMAC
 * @param key - The key to verify
 * @param data - Data that was signed
 * @param signature - The HMAC signature to verify
 * @returns {boolean} True if signature is valid
 */
export function verifyKeyIntegrity(
  key: Buffer,
  data: Buffer,
  signature: Buffer,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", key)
    .update(data)
    .digest();
  return crypto.timingSafeEqual(expectedSignature, signature);
}

/**
 * Create HMAC signature for key verification
 * @param key - The key to use for signing
 * @param data - Data to sign
 * @returns {Buffer} HMAC signature
 */
export function createKeySignature(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/**
 * Securely compare two buffers in constant time
 * @param a - First buffer
 * @param b - Second buffer
 * @returns {boolean} True if buffers are equal
 */
export function secureCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validate that a key meets minimum security requirements
 * @param key - The key to validate (as hex string or buffer)
 * @param minBits - Minimum key size in bits (default: 256)
 * @returns {boolean} True if key meets requirements
 */
export function validateKeyStrength(
  key: string | Buffer,
  minBits: number = 256,
): boolean {
  const keyBuffer = typeof key === "string" ? Buffer.from(key, "hex") : key;
  const keyBits = keyBuffer.length * 8;
  return keyBits >= minBits;
}

/**
 * Zero out a buffer for secure deletion
 * @param buffer - Buffer to zero out
 */
export function secureZeroBuffer(buffer: Buffer): void {
  buffer.fill(0);
}

/**
 * Format key for SQLCipher PRAGMA command
 * SQLCipher expects the key in a specific format
 * @param key - The encryption key (hex string)
 * @returns {string} Formatted key for PRAGMA
 */
export function formatKeyForSQLCipher(key: string): string {
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
export function getKeyIdentifier(key: string | Buffer): string {
  const keyBuffer = typeof key === "string" ? Buffer.from(key, "hex") : key;
  const hash = crypto.createHash("sha256").update(keyBuffer).digest("hex");
  return hash.substring(0, 8);
}
