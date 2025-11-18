/**
 * Token Encryption Service
 * Uses Electron's safeStorage API to encrypt/decrypt OAuth tokens
 * Stores tokens securely in the OS keychain (macOS Keychain, Windows DPAPI, Linux Secret Service)
 */

const { safeStorage } = require('electron');

class TokenEncryptionService {
  /**
   * Check if encryption is available
   * @returns {boolean}
   */
  isEncryptionAvailable() {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch (error) {
      console.error('[TokenEncryption] Error checking encryption availability:', error);
      return false;
    }
  }

  /**
   * Encrypt a plaintext string
   * @param {string} plaintext - The string to encrypt
   * @returns {string} Base64-encoded encrypted data
   * @throws {Error} If encryption is not available or fails
   */
  encrypt(plaintext) {
    if (!this.isEncryptionAvailable()) {
      // SECURITY: Fail-safe instead of fallback to plaintext
      // This prevents tokens from being stored unencrypted
      console.error('[TokenEncryption] CRITICAL: Encryption not available. Cannot store tokens securely.');
      throw new Error(
        'Token encryption is not available. Please ensure your system supports secure storage (macOS Keychain, Windows DPAPI, or Linux Secret Service).'
      );
    }

    try {
      const buffer = safeStorage.encryptString(plaintext);
      return buffer.toString('base64');
    } catch (error) {
      console.error('[TokenEncryption] Encryption failed:', error);
      throw new Error('Failed to encrypt token: ' + error.message);
    }
  }

  /**
   * Decrypt base64-encoded encrypted data
   * @param {string} encryptedBase64 - Base64-encoded encrypted data
   * @returns {string} Decrypted plaintext
   * @throws {Error} If decryption is not available or fails
   */
  decrypt(encryptedBase64) {
    if (!this.isEncryptionAvailable()) {
      // SECURITY: Fail-safe instead of attempting plaintext decode
      // This prevents the application from running with unencrypted tokens
      console.error('[TokenEncryption] CRITICAL: Decryption not available. Cannot access encrypted tokens.');
      throw new Error(
        'Token decryption is not available. Please ensure your system supports secure storage.'
      );
    }

    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[TokenEncryption] Decryption failed:', error);
      throw new Error('Failed to decrypt token: ' + error.message);
    }
  }

  /**
   * Encrypt an object (converts to JSON first)
   * @param {Object} data - The object to encrypt
   * @returns {string} Base64-encoded encrypted data
   */
  encryptObject(data) {
    const json = JSON.stringify(data);
    return this.encrypt(json);
  }

  /**
   * Decrypt and parse JSON object
   * @param {string} encryptedBase64 - Base64-encoded encrypted data
   * @returns {Object} Decrypted object
   */
  decryptObject(encryptedBase64) {
    const json = this.decrypt(encryptedBase64);
    return JSON.parse(json);
  }
}

// Export singleton instance
module.exports = new TokenEncryptionService();
