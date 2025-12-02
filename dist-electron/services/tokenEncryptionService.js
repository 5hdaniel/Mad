"use strict";
/**
 * Token Encryption Service
 * Uses Electron's safeStorage API to encrypt/decrypt OAuth tokens
 * Stores tokens securely in the OS keychain (macOS Keychain, Windows DPAPI, Linux Secret Service)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionError = void 0;
const electron_1 = require("electron");
const os = __importStar(require("os"));
const logService_1 = __importDefault(require("./logService"));
/**
 * Error class for encryption-related failures with platform-specific guidance
 */
class EncryptionError extends Error {
    constructor(message, guidance) {
        super(message);
        this.name = 'EncryptionError';
        this.platform = os.platform();
        this.guidance = guidance;
    }
}
exports.EncryptionError = EncryptionError;
/**
 * Platform-specific guidance for encryption issues
 */
const PLATFORM_GUIDANCE = {
    linux: `Linux requires a secret service (like gnome-keyring or KWallet) to be running.
To fix this:
1. Install gnome-keyring: sudo apt install gnome-keyring
2. Ensure it's running: eval $(gnome-keyring-daemon --start --components=secrets)
3. Or install KWallet if using KDE: sudo apt install kwalletmanager`,
    darwin: `macOS Keychain should be available by default.
If you're seeing this error:
1. Open Keychain Access app
2. Check if your login keychain is unlocked
3. Try locking and unlocking the keychain`,
    win32: `Windows DPAPI should be available by default.
If you're seeing this error:
1. Try restarting the application
2. Run as administrator if the issue persists
3. Check Windows Event Viewer for credential-related errors`,
    default: `Secure storage is not available on this platform.
Please ensure your operating system's credential storage service is running.`,
};
class TokenEncryptionService {
    constructor() {
        this._encryptionChecked = false;
        this._encryptionAvailable = false;
    }
    /**
     * Reset internal state (for testing purposes only)
     * @internal
     */
    _resetState() {
        this._encryptionChecked = false;
        this._encryptionAvailable = false;
    }
    /**
     * Get platform-specific guidance for encryption issues
     */
    getPlatformGuidance() {
        const platform = os.platform();
        return PLATFORM_GUIDANCE[platform] || PLATFORM_GUIDANCE.default;
    }
    /**
     * Check if encryption is available
     * @returns {boolean}
     */
    isEncryptionAvailable() {
        try {
            this._encryptionAvailable = electron_1.safeStorage.isEncryptionAvailable();
            this._encryptionChecked = true;
            return this._encryptionAvailable;
        }
        catch (error) {
            logService_1.default.error('Error checking encryption availability', 'TokenEncryption', {
                error: error instanceof Error ? error.message : String(error),
            });
            this._encryptionChecked = true;
            this._encryptionAvailable = false;
            return false;
        }
    }
    /**
     * Get detailed status about encryption availability
     * Useful for diagnostics and user-facing error messages
     */
    getEncryptionStatus() {
        // Ensure we've checked availability
        if (!this._encryptionChecked) {
            this.isEncryptionAvailable();
        }
        return {
            available: this._encryptionAvailable,
            platform: os.platform(),
            guidance: this._encryptionAvailable ? '' : this.getPlatformGuidance(),
            checked: this._encryptionChecked,
        };
    }
    /**
     * Create an appropriate error for encryption unavailability
     */
    createUnavailableError(operation) {
        const platform = os.platform();
        const guidance = this.getPlatformGuidance();
        let message;
        if (platform === 'linux') {
            message = `Cannot ${operation} token: No Linux secret service available (gnome-keyring or KWallet required).`;
        }
        else if (platform === 'darwin') {
            message = `Cannot ${operation} token: macOS Keychain is not accessible.`;
        }
        else if (platform === 'win32') {
            message = `Cannot ${operation} token: Windows DPAPI is not available.`;
        }
        else {
            message = `Cannot ${operation} token: OS-level encryption is not available on this platform.`;
        }
        return new EncryptionError(message, guidance);
    }
    /**
     * Encrypt a plaintext string
     * @param {string} plaintext - The string to encrypt
     * @returns {string} Base64-encoded encrypted data
     * @throws {EncryptionError} If encryption is not available or fails
     */
    encrypt(plaintext) {
        if (!this.isEncryptionAvailable()) {
            const error = this.createUnavailableError('encrypt');
            logService_1.default.error('Encryption not available', 'TokenEncryption', {
                message: error.message,
                platform: error.platform,
                guidance: error.guidance,
            });
            throw error;
        }
        try {
            const buffer = electron_1.safeStorage.encryptString(plaintext);
            return buffer.toString('base64');
        }
        catch (error) {
            logService_1.default.error('Encryption operation failed', 'TokenEncryption', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new EncryptionError('Failed to encrypt token', 'The encryption operation failed unexpectedly. Please try again or restart the application.');
        }
    }
    /**
     * Decrypt base64-encoded encrypted data
     * @param {string} encryptedBase64 - Base64-encoded encrypted data
     * @returns {string} Decrypted plaintext
     * @throws {EncryptionError} If decryption is not available or fails
     */
    decrypt(encryptedBase64) {
        if (!this.isEncryptionAvailable()) {
            const error = this.createUnavailableError('decrypt');
            logService_1.default.error('Decryption not available', 'TokenEncryption', {
                message: error.message,
                platform: error.platform,
                guidance: error.guidance,
            });
            throw error;
        }
        try {
            const buffer = Buffer.from(encryptedBase64, 'base64');
            return electron_1.safeStorage.decryptString(buffer);
        }
        catch (error) {
            logService_1.default.error('Decryption operation failed', 'TokenEncryption', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new EncryptionError('Failed to decrypt token', 'The decryption operation failed. The token may be corrupted or the encryption key has changed.');
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
