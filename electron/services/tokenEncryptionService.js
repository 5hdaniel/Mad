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
   */
  encrypt(plaintext) {
    if (!this.isEncryptionAvailable()) {
      console.warn('[TokenEncryption] Encryption not available, storing as plaintext (DEVELOPMENT ONLY)');
      // In development, if encryption isn't available, encode as base64
      // This should NEVER happen in production on macOS/Windows
      return Buffer.from(plaintext).toString('base64');
    }

    try {
      const buffer = safeStorage.encryptString(plaintext);
      return buffer.toString('base64');
    } catch (error) {
      console.error('[TokenEncryption] Encryption failed:', error);
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt base64-encoded encrypted data
   * @param {string} encryptedBase64 - Base64-encoded encrypted data
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedBase64) {
    if (!this.isEncryptionAvailable()) {
      console.warn('[TokenEncryption] Encryption not available, decoding as plaintext (DEVELOPMENT ONLY)');
      // In development, decode from base64
      return Buffer.from(encryptedBase64, 'base64').toString('utf8');
    }

    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error('[TokenEncryption] Decryption failed:', error);
      throw new Error('Failed to decrypt token');
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
