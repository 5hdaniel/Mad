/**
 * Token Encryption Service Tests
 * Tests secure token encryption and decryption
 */

const { safeStorage } = require('electron');

// Mock electron's safeStorage
jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(),
    encryptString: jest.fn(),
    decryptString: jest.fn(),
  },
}));

// Must require after mocking
const tokenEncryptionService = require('../tokenEncryptionService');

describe('TokenEncryptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isEncryptionAvailable', () => {
    it('should return true when encryption is available', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);

      const result = tokenEncryptionService.isEncryptionAvailable();

      expect(result).toBe(true);
      expect(safeStorage.isEncryptionAvailable).toHaveBeenCalled();
    });

    it('should return false when encryption is not available', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);

      const result = tokenEncryptionService.isEncryptionAvailable();

      expect(result).toBe(false);
    });

    it('should handle errors and return false', () => {
      safeStorage.isEncryptionAvailable.mockImplementation(() => {
        throw new Error('Encryption check failed');
      });

      const result = tokenEncryptionService.isEncryptionAvailable();

      expect(result).toBe(false);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext when encryption is available', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted-data'));

      const result = tokenEncryptionService.encrypt('my-secret-token');

      expect(safeStorage.encryptString).toHaveBeenCalledWith('my-secret-token');
      expect(result).toBe(Buffer.from('encrypted-data').toString('base64'));
    });

    it('should fallback to base64 encoding when encryption not available', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);

      const plaintext = 'my-secret-token';
      const result = tokenEncryptionService.encrypt(plaintext);

      expect(result).toBe(Buffer.from(plaintext).toString('base64'));
      expect(safeStorage.encryptString).not.toHaveBeenCalled();
    });

    it('should throw error when encryption fails', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption hardware error');
      });

      expect(() => tokenEncryptionService.encrypt('test')).toThrow('Failed to encrypt token');
    });

    it('should handle empty strings', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockReturnValue(Buffer.from(''));

      const result = tokenEncryptionService.encrypt('');

      expect(safeStorage.encryptString).toHaveBeenCalledWith('');
      expect(result).toBeDefined();
    });

    it('should handle special characters', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'));

      const specialChars = '!@#$%^&*()_+-={}[]|:";\'<>?,./`~';
      tokenEncryptionService.encrypt(specialChars);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(specialChars);
    });
  });

  describe('decrypt', () => {
    it('should decrypt base64-encoded encrypted data', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.decryptString.mockReturnValue('decrypted-token');

      const encrypted = Buffer.from('encrypted-data').toString('base64');
      const result = tokenEncryptionService.decrypt(encrypted);

      expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from(encrypted, 'base64'));
      expect(result).toBe('decrypted-token');
    });

    it('should fallback to base64 decoding when encryption not available', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);

      const plaintext = 'my-secret-token';
      const encoded = Buffer.from(plaintext).toString('base64');
      const result = tokenEncryptionService.decrypt(encoded);

      expect(result).toBe(plaintext);
      expect(safeStorage.decryptString).not.toHaveBeenCalled();
    });

    it('should throw error when decryption fails', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.decryptString.mockImplementation(() => {
        throw new Error('Invalid encrypted data');
      });

      expect(() => tokenEncryptionService.decrypt('invalid-data')).toThrow('Failed to decrypt token');
    });

    it('should handle corrupted base64 data gracefully', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      expect(() => tokenEncryptionService.decrypt('not-valid-base64!!!')).toThrow();
    });
  });

  describe('encryptObject', () => {
    it('should encrypt an object by converting to JSON', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted-json'));

      const obj = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
        expiresIn: 3600,
      };

      const result = tokenEncryptionService.encryptObject(obj);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify(obj));
      expect(result).toBe(Buffer.from('encrypted-json').toString('base64'));
    });

    it('should handle nested objects', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'));

      const obj = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          profile: {
            name: 'Test User',
          },
        },
      };

      tokenEncryptionService.encryptObject(obj);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify(obj));
    });

    it('should handle arrays', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'));

      const arr = ['token1', 'token2', 'token3'];

      tokenEncryptionService.encryptObject(arr);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify(arr));
    });
  });

  describe('decryptObject', () => {
    it('should decrypt and parse JSON object', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      const obj = {
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
      };
      safeStorage.decryptString.mockReturnValue(JSON.stringify(obj));

      const encrypted = Buffer.from('encrypted-json').toString('base64');
      const result = tokenEncryptionService.decryptObject(encrypted);

      expect(result).toEqual(obj);
      expect(result.accessToken).toBe('token-123');
    });

    it('should throw error for invalid JSON', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      safeStorage.decryptString.mockReturnValue('not-valid-json{{{');

      const encrypted = Buffer.from('encrypted').toString('base64');

      expect(() => tokenEncryptionService.decryptObject(encrypted)).toThrow();
    });

    it('should handle complex nested objects', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);
      const complexObj = {
        tokens: {
          access: 'token-123',
          refresh: 'refresh-456',
        },
        metadata: {
          createdAt: '2024-01-01',
          expiresAt: '2024-12-31',
        },
      };
      safeStorage.decryptString.mockReturnValue(JSON.stringify(complexObj));

      const result = tokenEncryptionService.decryptObject('encrypted-data');

      expect(result).toEqual(complexObj);
      expect(result.tokens.access).toBe('token-123');
    });
  });

  describe('round-trip encryption', () => {
    it('should encrypt and decrypt data successfully', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);

      const originalText = 'my-secret-token';
      const encryptedBuffer = Buffer.from('encrypted-data');

      // Encrypt
      safeStorage.encryptString.mockReturnValue(encryptedBuffer);
      const encrypted = tokenEncryptionService.encrypt(originalText);

      // Decrypt
      safeStorage.decryptString.mockReturnValue(originalText);
      const decrypted = tokenEncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it('should encrypt and decrypt objects successfully', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(true);

      const originalObj = {
        token: 'abc123',
        expires: 3600,
      };

      // Encrypt
      safeStorage.encryptString.mockReturnValue(Buffer.from('encrypted'));
      const encrypted = tokenEncryptionService.encryptObject(originalObj);

      // Decrypt
      safeStorage.decryptString.mockReturnValue(JSON.stringify(originalObj));
      const decrypted = tokenEncryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(originalObj);
    });
  });

  describe('fallback mode (development)', () => {
    it('should use base64 encoding/decoding when encryption unavailable', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);

      const originalText = 'development-token';
      const encrypted = tokenEncryptionService.encrypt(originalText);
      const decrypted = tokenEncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(originalText);
      expect(safeStorage.encryptString).not.toHaveBeenCalled();
      expect(safeStorage.decryptString).not.toHaveBeenCalled();
    });

    it('should handle objects in fallback mode', () => {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);

      const originalObj = { token: 'test' };
      const encrypted = tokenEncryptionService.encryptObject(originalObj);
      const decrypted = tokenEncryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(originalObj);
    });
  });
});
