"use strict";
/**
 * Token Encryption Service
 * Uses Electron's safeStorage API to encrypt/decrypt OAuth tokens
 * Stores tokens securely in the OS keychain (macOS Keychain, Windows DPAPI, Linux Secret Service)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
class TokenEncryptionService {
    /**
     * Check if encryption is available
     * @returns {boolean}
     */
    isEncryptionAvailable() {
        try {
            return electron_1.safeStorage.isEncryptionAvailable();
        }
        catch (error) {
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
            console.error('[TokenEncryption] Encryption not available - cannot proceed');
            throw new Error('Encryption not available. Token storage requires OS-level encryption support.');
        }
        try {
            const buffer = electron_1.safeStorage.encryptString(plaintext);
            return buffer.toString('base64');
        }
        catch (error) {
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
            console.error('[TokenEncryption] Encryption not available - cannot proceed');
            throw new Error('Encryption not available. Token decryption requires OS-level encryption support.');
        }
        try {
            const buffer = Buffer.from(encryptedBase64, 'base64');
            return electron_1.safeStorage.decryptString(buffer);
        }
        catch (error) {
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
exports.default = new TokenEncryptionService();
