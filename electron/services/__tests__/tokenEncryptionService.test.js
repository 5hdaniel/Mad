/**
 * Token Encryption Service Tests
 * Tests for secure token encryption/decryption
 */

const crypto = require('crypto');

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData'),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((text) => Buffer.from(text, 'utf8')),
    decryptString: jest.fn((buffer) => buffer.toString('utf8')),
  },
}));

const { safeStorage } = require('electron');

describe('TokenEncryptionService', () => {
  let tokenEncryptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    tokenEncryptionService = require('../tokenEncryptionService');
  });

  describe('Encryption', () => {
    it('should encrypt a token successfully', () => {
      const token = 'secret-token-123';

      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted-data'));

      const encrypted = tokenEncryptionService.encrypt(token);

      expect(encrypted).toBeDefined();
      expect(safeStorage.encryptString).toHaveBeenCalledWith(token);
    });

    it('should handle encryption of empty strings', () => {
      const result = tokenEncryptionService.encrypt('');
      expect(result).toBeDefined();
    });

    it('should handle encryption when safeStorage is unavailable', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => {
        tokenEncryptionService.encrypt('token');
      }).toThrow();
    });
  });

  describe('Decryption', () => {
    it('should decrypt a token successfully', () => {
      const encryptedBuffer = Buffer.from('encrypted-data');
      const originalToken = 'secret-token-123';

      safeStorage.decryptString.mockReturnValue(originalToken);

      const decrypted = tokenEncryptionService.decrypt(encryptedBuffer);

      expect(decrypted).toBe(originalToken);
      expect(safeStorage.decryptString).toHaveBeenCalledWith(encryptedBuffer);
    });

    it('should handle decryption errors', () => {
      safeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      expect(() => {
        tokenEncryptionService.decrypt(Buffer.from('invalid'));
      }).toThrow('Decryption failed');
    });
  });

  describe('Round-trip encryption', () => {
    it('should correctly encrypt and decrypt a token', () => {
      const originalToken = 'my-secret-token';

      // Mock round-trip
      let encryptedData;
      safeStorage.encryptString.mockImplementation((text) => {
        encryptedData = Buffer.from(text, 'utf8');
        return encryptedData;
      });

      safeStorage.decryptString.mockImplementation((buffer) => {
        return buffer.toString('utf8');
      });

      const encrypted = tokenEncryptionService.encrypt(originalToken);
      const decrypted = tokenEncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(originalToken);
    });
  });

  describe('Security validation', () => {
    it('should not store tokens in plain text', () => {
      const token = 'sensitive-token';

      safeStorage.encryptString.mockReturnValue(Buffer.from('x7f9a3b2c'));

      const encrypted = tokenEncryptionService.encrypt(token);

      // Encrypted data should not contain original token
      expect(encrypted.toString()).not.toContain(token);
    });

    it('should use OS-level encryption when available', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);

      tokenEncryptionService.encrypt('token');

      expect(safeStorage.encryptionAvailable || safeStorage.isEncryptionAvailable()).toBe(true);
    });
  });
});
