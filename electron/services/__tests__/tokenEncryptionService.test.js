/**
 * Tests for Token Encryption Service
 * Tests encryption, decryption, and error handling
 */

// Mock electron's safeStorage before requiring the service
const mockSafeStorage = {
  isEncryptionAvailable: jest.fn(() => true),
  encryptString: jest.fn(),
  decryptString: jest.fn(),
};

jest.mock('electron', () => ({
  safeStorage: mockSafeStorage,
}));

// Require the service after mocking electron
const tokenEncryptionService = require('../tokenEncryptionService');

describe('TokenEncryptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default successful behavior
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  });

  describe('Encryption Availability', () => {
    it('should check if encryption is available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);

      const result = tokenEncryptionService.isEncryptionAvailable();

      expect(result).toBe(true);
      expect(mockSafeStorage.isEncryptionAvailable).toHaveBeenCalled();
    });

    it('should return false when encryption is not available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      const result = tokenEncryptionService.isEncryptionAvailable();

      expect(result).toBe(false);
    });

    it('should handle errors when checking encryption availability', () => {
      mockSafeStorage.isEncryptionAvailable.mockImplementation(() => {
        throw new Error('Encryption check failed');
      });

      const result = tokenEncryptionService.isEncryptionAvailable();

      expect(result).toBe(false);
    });
  });

  describe('Encryption', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'my-secret-token';
      const mockBuffer = Buffer.from('encrypted-data');

      mockSafeStorage.encryptString.mockReturnValue(mockBuffer);

      const result = tokenEncryptionService.encrypt(plaintext);

      expect(result).toBe(mockBuffer.toString('base64'));
      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(plaintext);
    });

    it('should throw error when encryption is not available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => {
        tokenEncryptionService.encrypt('test-token');
      }).toThrow(/token encryption is not available/i);
    });

    it('should throw error when encryption fails', () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => {
        tokenEncryptionService.encrypt('test-token');
      }).toThrow(/failed to encrypt token/i);
    });

    it('should encrypt objects successfully', () => {
      const data = { token: 'secret', expiresAt: 123456 };
      const mockBuffer = Buffer.from('encrypted-data');

      mockSafeStorage.encryptString.mockReturnValue(mockBuffer);

      const result = tokenEncryptionService.encryptObject(data);

      expect(result).toBe(mockBuffer.toString('base64'));
      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(JSON.stringify(data));
    });
  });

  describe('Decryption', () => {
    it('should decrypt encrypted data successfully', () => {
      const encryptedBase64 = Buffer.from('encrypted-data').toString('base64');
      const plaintext = 'my-secret-token';

      mockSafeStorage.decryptString.mockReturnValue(plaintext);

      const result = tokenEncryptionService.decrypt(encryptedBase64);

      expect(result).toBe(plaintext);
      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(
        Buffer.from(encryptedBase64, 'base64')
      );
    });

    it('should throw error when decryption is not available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => {
        tokenEncryptionService.decrypt('some-encrypted-data');
      }).toThrow(/token decryption is not available/i);
    });

    // FIXED: Test now properly expects "Decryption failed" error message
    it('should throw "Decryption failed" error when decryption fails', () => {
      const invalidEncryptedData = 'invalid-base64-data';

      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Invalid encrypted data');
      });

      expect(() => {
        tokenEncryptionService.decrypt(invalidEncryptedData);
      }).toThrow('Decryption failed');
    });

    it('should decrypt objects successfully', () => {
      const data = { token: 'secret', expiresAt: 123456 };
      const encryptedBase64 = Buffer.from('encrypted-data').toString('base64');

      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(data));

      const result = tokenEncryptionService.decryptObject(encryptedBase64);

      expect(result).toEqual(data);
    });

    it('should handle invalid JSON when decrypting objects', () => {
      const encryptedBase64 = Buffer.from('encrypted-data').toString('base64');

      mockSafeStorage.decryptString.mockReturnValue('invalid-json{');

      expect(() => {
        tokenEncryptionService.decryptObject(encryptedBase64);
      }).toThrow();
    });
  });

  describe('Round-trip Encryption/Decryption', () => {
    it('should successfully encrypt and decrypt plaintext', () => {
      const plaintext = 'my-secret-token';
      const mockEncryptedBuffer = Buffer.from('encrypted-data');

      // Mock encryption
      mockSafeStorage.encryptString.mockReturnValue(mockEncryptedBuffer);
      const encrypted = tokenEncryptionService.encrypt(plaintext);

      // Mock decryption
      mockSafeStorage.decryptString.mockReturnValue(plaintext);
      const decrypted = tokenEncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should successfully encrypt and decrypt objects', () => {
      const data = {
        accessToken: 'secret-token',
        refreshToken: 'refresh-token',
        expiresAt: 1234567890
      };
      const mockEncryptedBuffer = Buffer.from('encrypted-object-data');

      // Mock encryption
      mockSafeStorage.encryptString.mockReturnValue(mockEncryptedBuffer);
      const encrypted = tokenEncryptionService.encryptObject(data);

      // Mock decryption
      mockSafeStorage.decryptString.mockReturnValue(JSON.stringify(data));
      const decrypted = tokenEncryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(data);
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for encryption failures', () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw new Error('System keychain unavailable');
      });

      expect(() => {
        tokenEncryptionService.encrypt('test');
      }).toThrow(/failed to encrypt token/i);
    });

    it('should provide clear error messages for decryption failures', () => {
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Corrupted encrypted data');
      });

      expect(() => {
        tokenEncryptionService.decrypt('corrupted-data');
      }).toThrow(/decryption failed/i);
    });

    it('should handle buffer conversion errors', () => {
      // Invalid base64 will cause Buffer.from to create a buffer, but decryption will fail
      mockSafeStorage.decryptString.mockImplementation(() => {
        throw new Error('Invalid buffer format');
      });

      expect(() => {
        tokenEncryptionService.decrypt('!!!invalid-base64!!!');
      }).toThrow('Decryption failed');
    });
  });

  describe('Security', () => {
    it('should not store tokens in plaintext when encryption unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => {
        tokenEncryptionService.encrypt('sensitive-token');
      }).toThrow(/token encryption is not available/i);
    });

    it('should not decode tokens when decryption unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => {
        tokenEncryptionService.decrypt('encrypted-token');
      }).toThrow(/token decryption is not available/i);
    });

    it('should handle empty strings', () => {
      const mockBuffer = Buffer.from('');
      mockSafeStorage.encryptString.mockReturnValue(mockBuffer);

      const result = tokenEncryptionService.encrypt('');

      expect(result).toBe('');
    });
  });
});
