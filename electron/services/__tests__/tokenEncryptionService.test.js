/**
 * Unit tests for Token Encryption Service
 * Tests encryption/decryption and fail-safe behavior when encryption is unavailable
 */

// Mock Electron's safeStorage before requiring the service
let mockEncryptionAvailable = true;
let mockEncryptString = jest.fn();
let mockDecryptString = jest.fn();

jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => mockEncryptionAvailable),
    encryptString: jest.fn((text) => mockEncryptString(text)),
    decryptString: jest.fn((buffer) => mockDecryptString(buffer)),
  },
}));

const { safeStorage } = require('electron');

describe('TokenEncryptionService', () => {
  let tokenEncryptionService;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();

    // Reset mock state
    mockEncryptionAvailable = true;

    // Setup default mock implementations
    mockEncryptString.mockImplementation((text) => {
      return Buffer.from(`encrypted:${text}`);
    });

    mockDecryptString.mockImplementation((buffer) => {
      const str = buffer.toString();
      return str.replace('encrypted:', '');
    });

    // Re-require the service to get fresh instance
    jest.resetModules();
    tokenEncryptionService = require('../tokenEncryptionService');
  });

  describe('isEncryptionAvailable', () => {
    it('should return true when encryption is available', () => {
      mockEncryptionAvailable = true;
      expect(tokenEncryptionService.isEncryptionAvailable()).toBe(true);
    });

    it('should return false when encryption is not available', () => {
      mockEncryptionAvailable = false;
      expect(tokenEncryptionService.isEncryptionAvailable()).toBe(false);
    });

    it('should return false when safeStorage throws an error', () => {
      safeStorage.isEncryptionAvailable.mockImplementation(() => {
        throw new Error('safeStorage error');
      });
      expect(tokenEncryptionService.isEncryptionAvailable()).toBe(false);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext when encryption is available', () => {
      const plaintext = 'my-secret-token';
      const result = tokenEncryptionService.encrypt(plaintext);

      expect(safeStorage.encryptString).toHaveBeenCalledWith(plaintext);
      expect(result).toBe(Buffer.from('encrypted:my-secret-token').toString('base64'));
    });

    it('should throw error when encryption is not available', () => {
      mockEncryptionAvailable = false;

      expect(() => {
        tokenEncryptionService.encrypt('my-secret-token');
      }).toThrow('Encryption not available. Token storage requires OS-level encryption support.');
    });

    it('should throw error when encryptString fails', () => {
      safeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => {
        tokenEncryptionService.encrypt('my-secret-token');
      }).toThrow('Failed to encrypt token');
    });

    it('should return base64-encoded encrypted data', () => {
      const plaintext = 'test-token-123';
      mockEncryptString.mockReturnValue(Buffer.from('encrypted-bytes'));

      const result = tokenEncryptionService.encrypt(plaintext);

      expect(result).toBe(Buffer.from('encrypted-bytes').toString('base64'));
    });
  });

  describe('decrypt', () => {
    it('should decrypt base64-encoded encrypted data when encryption is available', () => {
      const encrypted = Buffer.from('encrypted:my-secret-token').toString('base64');
      const result = tokenEncryptionService.decrypt(encrypted);

      expect(safeStorage.decryptString).toHaveBeenCalled();
      expect(result).toBe('my-secret-token');
    });

    it('should throw error when encryption is not available', () => {
      mockEncryptionAvailable = false;
      const encrypted = Buffer.from('some-data').toString('base64');

      expect(() => {
        tokenEncryptionService.decrypt(encrypted);
      }).toThrow('Encryption not available. Token decryption requires OS-level encryption support.');
    });

    it('should throw error when decryptString fails', () => {
      safeStorage.decryptString.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const encrypted = Buffer.from('some-data').toString('base64');

      expect(() => {
        tokenEncryptionService.decrypt(encrypted);
      }).toThrow('Failed to decrypt token');
    });

    it('should decode base64 before decrypting', () => {
      const plaintext = 'test-token';
      const encryptedBuffer = Buffer.from(`encrypted:${plaintext}`);
      const base64 = encryptedBuffer.toString('base64');

      tokenEncryptionService.decrypt(base64);

      // Verify that safeStorage.decryptString received the decoded buffer
      expect(safeStorage.decryptString).toHaveBeenCalledWith(
        Buffer.from(base64, 'base64')
      );
    });
  });

  describe('encryptObject', () => {
    it('should encrypt an object by converting to JSON', () => {
      const obj = { token: 'abc123', expires: 3600 };
      const result = tokenEncryptionService.encryptObject(obj);

      const jsonString = JSON.stringify(obj);
      expect(safeStorage.encryptString).toHaveBeenCalledWith(jsonString);
      expect(result).toBe(Buffer.from(`encrypted:${jsonString}`).toString('base64'));
    });

    it('should throw error when encryption is not available', () => {
      mockEncryptionAvailable = false;

      expect(() => {
        tokenEncryptionService.encryptObject({ token: 'test' });
      }).toThrow('Encryption not available. Token storage requires OS-level encryption support.');
    });
  });

  describe('decryptObject', () => {
    it('should decrypt and parse JSON object', () => {
      const obj = { token: 'abc123', expires: 3600 };
      const jsonString = JSON.stringify(obj);
      const encrypted = Buffer.from(`encrypted:${jsonString}`).toString('base64');

      const result = tokenEncryptionService.decryptObject(encrypted);

      expect(result).toEqual(obj);
    });

    it('should throw error when encryption is not available', () => {
      mockEncryptionAvailable = false;
      const encrypted = Buffer.from('some-data').toString('base64');

      expect(() => {
        tokenEncryptionService.decryptObject(encrypted);
      }).toThrow('Encryption not available. Token decryption requires OS-level encryption support.');
    });
  });

  describe('fail-safe behavior', () => {
    it('should never store tokens in plaintext when encryption is unavailable', () => {
      mockEncryptionAvailable = false;

      // Attempting to encrypt should throw, not fall back to plaintext
      expect(() => {
        tokenEncryptionService.encrypt('sensitive-token');
      }).toThrow('Encryption not available');

      // Verify safeStorage.encryptString was never called (no plaintext storage)
      expect(safeStorage.encryptString).not.toHaveBeenCalled();
    });

    it('should never retrieve tokens as plaintext when encryption is unavailable', () => {
      mockEncryptionAvailable = false;

      // Attempting to decrypt should throw, not fall back to plaintext
      expect(() => {
        tokenEncryptionService.decrypt('some-data');
      }).toThrow('Encryption not available');

      // Verify safeStorage.decryptString was never called (no plaintext retrieval)
      expect(safeStorage.decryptString).not.toHaveBeenCalled();
    });
  });
});
