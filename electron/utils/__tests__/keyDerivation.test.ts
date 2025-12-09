/**
 * @jest-environment node
 */

/**
 * Unit tests for Key Derivation Utilities
 * Tests cryptographic key derivation and verification functions
 */

import {
  deriveKey,
  deriveKeyAsync,
  generateRandomKey,
  generateRandomKeyHex,
  hexToBuffer,
  bufferToHex,
  verifyKeyIntegrity,
  createKeySignature,
  secureCompare,
  validateKeyStrength,
  secureZeroBuffer,
  formatKeyForSQLCipher,
  getKeyIdentifier,
  DEFAULT_KEY_CONFIG,
} from "../keyDerivation";

describe("Key Derivation Utilities", () => {
  describe("deriveKey", () => {
    it("should derive a key from password", () => {
      const password = "test-password-123";
      const result = deriveKey(password);

      expect(result.key).toBeInstanceOf(Buffer);
      expect(result.salt).toBeInstanceOf(Buffer);
      expect(result.key.length).toBe(DEFAULT_KEY_CONFIG.keyLength);
      expect(result.salt.length).toBe(DEFAULT_KEY_CONFIG.saltLength);
    });

    it("should derive consistent key with same password and salt", () => {
      const password = "consistent-password";
      const salt = Buffer.alloc(32).fill(1);

      const result1 = deriveKey(password, salt);
      const result2 = deriveKey(password, salt);

      expect(result1.key.equals(result2.key)).toBe(true);
    });

    it("should derive different keys with different passwords", () => {
      const salt = Buffer.alloc(32).fill(1);

      const result1 = deriveKey("password1", salt);
      const result2 = deriveKey("password2", salt);

      expect(result1.key.equals(result2.key)).toBe(false);
    });

    it("should derive different keys with different salts", () => {
      const password = "same-password";
      const salt1 = Buffer.alloc(32).fill(1);
      const salt2 = Buffer.alloc(32).fill(2);

      const result1 = deriveKey(password, salt1);
      const result2 = deriveKey(password, salt2);

      expect(result1.key.equals(result2.key)).toBe(false);
    });

    it("should use custom configuration", () => {
      const customConfig = {
        saltLength: 16,
        keyLength: 16,
        iterations: 1000,
        digest: "sha256",
      };

      const result = deriveKey("password", undefined, customConfig);

      expect(result.key.length).toBe(customConfig.keyLength);
    });
  });

  describe("deriveKeyAsync", () => {
    it("should derive a key asynchronously", async () => {
      const password = "async-test-password";
      const result = await deriveKeyAsync(password);

      expect(result.key).toBeInstanceOf(Buffer);
      expect(result.salt).toBeInstanceOf(Buffer);
      expect(result.key.length).toBe(DEFAULT_KEY_CONFIG.keyLength);
    });

    it("should produce same result as sync version", async () => {
      const password = "sync-async-test";
      const salt = Buffer.alloc(32).fill(5);

      const syncResult = deriveKey(password, salt);
      const asyncResult = await deriveKeyAsync(password, salt);

      expect(syncResult.key.equals(asyncResult.key)).toBe(true);
    });
  });

  describe("generateRandomKey", () => {
    it("should generate 32-byte key by default", () => {
      const key = generateRandomKey();

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it("should generate key of specified length", () => {
      const key = generateRandomKey(64);

      expect(key.length).toBe(64);
    });

    it("should generate unique keys each time", () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();

      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("generateRandomKeyHex", () => {
    it("should generate hex string of correct length", () => {
      const keyHex = generateRandomKeyHex();

      // 32 bytes = 64 hex characters
      expect(keyHex).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should generate key of specified length in hex", () => {
      const keyHex = generateRandomKeyHex(16);

      // 16 bytes = 32 hex characters
      expect(keyHex).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("hexToBuffer and bufferToHex", () => {
    it("should convert hex to buffer correctly", () => {
      const hex = "deadbeef";
      const buffer = hexToBuffer(hex);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(4);
      expect(buffer[0]).toBe(0xde);
      expect(buffer[1]).toBe(0xad);
      expect(buffer[2]).toBe(0xbe);
      expect(buffer[3]).toBe(0xef);
    });

    it("should convert buffer to hex correctly", () => {
      const buffer = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const hex = bufferToHex(buffer);

      expect(hex).toBe("deadbeef");
    });

    it("should be reversible", () => {
      const originalHex = "cafebabe12345678";
      const buffer = hexToBuffer(originalHex);
      const resultHex = bufferToHex(buffer);

      expect(resultHex).toBe(originalHex);
    });
  });

  describe("verifyKeyIntegrity and createKeySignature", () => {
    it("should create and verify valid signature", () => {
      const key = generateRandomKey();
      const data = Buffer.from("test data to sign");

      const signature = createKeySignature(key, data);
      const isValid = verifyKeyIntegrity(key, data, signature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid signature", () => {
      const key = generateRandomKey();
      const data = Buffer.from("test data");
      const wrongSignature = Buffer.alloc(32).fill(0);

      const isValid = verifyKeyIntegrity(key, data, wrongSignature);

      expect(isValid).toBe(false);
    });

    it("should reject tampered data", () => {
      const key = generateRandomKey();
      const originalData = Buffer.from("original data");
      const tamperedData = Buffer.from("tampered data");

      const signature = createKeySignature(key, originalData);
      const isValid = verifyKeyIntegrity(key, tamperedData, signature);

      expect(isValid).toBe(false);
    });

    it("should reject signature from different key", () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();
      const data = Buffer.from("test data");

      const signature = createKeySignature(key1, data);
      const isValid = verifyKeyIntegrity(key2, data, signature);

      expect(isValid).toBe(false);
    });
  });

  describe("secureCompare", () => {
    it("should return true for equal buffers", () => {
      const a = Buffer.from("equal data");
      const b = Buffer.from("equal data");

      expect(secureCompare(a, b)).toBe(true);
    });

    it("should return false for different buffers", () => {
      const a = Buffer.from("data a");
      const b = Buffer.from("data b");

      expect(secureCompare(a, b)).toBe(false);
    });

    it("should return false for buffers of different lengths", () => {
      const a = Buffer.from("short");
      const b = Buffer.from("longer buffer");

      expect(secureCompare(a, b)).toBe(false);
    });
  });

  describe("validateKeyStrength", () => {
    it("should accept 256-bit key by default", () => {
      const key256 = generateRandomKeyHex(32); // 32 bytes = 256 bits

      expect(validateKeyStrength(key256)).toBe(true);
    });

    it("should reject keys shorter than minimum", () => {
      const key128 = generateRandomKeyHex(16); // 16 bytes = 128 bits

      expect(validateKeyStrength(key128, 256)).toBe(false);
    });

    it("should accept keys meeting custom minimum", () => {
      const key128 = generateRandomKeyHex(16);

      expect(validateKeyStrength(key128, 128)).toBe(true);
    });

    it("should work with Buffer input", () => {
      const keyBuffer = generateRandomKey(32);

      expect(validateKeyStrength(keyBuffer, 256)).toBe(true);
    });
  });

  describe("secureZeroBuffer", () => {
    it("should zero out buffer contents", () => {
      const buffer = Buffer.from("sensitive data");
      secureZeroBuffer(buffer);

      // All bytes should be 0
      for (let i = 0; i < buffer.length; i++) {
        expect(buffer[i]).toBe(0);
      }
    });
  });

  describe("formatKeyForSQLCipher", () => {
    it("should format key correctly for SQLCipher PRAGMA", () => {
      const key = "deadbeef12345678";
      const formatted = formatKeyForSQLCipher(key);

      expect(formatted).toBe("x'DEADBEEF12345678'");
    });

    it("should handle lowercase hex", () => {
      const key = "abcdef";
      const formatted = formatKeyForSQLCipher(key);

      expect(formatted).toBe("x'ABCDEF'");
    });
  });

  describe("getKeyIdentifier", () => {
    it("should return 8-character identifier", () => {
      const key = generateRandomKeyHex();
      const id = getKeyIdentifier(key);

      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });

    it("should return same identifier for same key", () => {
      const key = "consistent-key-value";
      const id1 = getKeyIdentifier(key);
      const id2 = getKeyIdentifier(key);

      expect(id1).toBe(id2);
    });

    it("should return different identifiers for different keys", () => {
      const key1 = generateRandomKeyHex();
      const key2 = generateRandomKeyHex();

      const id1 = getKeyIdentifier(key1);
      const id2 = getKeyIdentifier(key2);

      expect(id1).not.toBe(id2);
    });

    it("should work with Buffer input", () => {
      const keyBuffer = generateRandomKey();
      const id = getKeyIdentifier(keyBuffer);

      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("DEFAULT_KEY_CONFIG", () => {
    it("should have secure defaults", () => {
      expect(DEFAULT_KEY_CONFIG.saltLength).toBeGreaterThanOrEqual(16);
      expect(DEFAULT_KEY_CONFIG.keyLength).toBeGreaterThanOrEqual(32);
      expect(DEFAULT_KEY_CONFIG.iterations).toBeGreaterThanOrEqual(10000);
      expect(DEFAULT_KEY_CONFIG.digest).toBe("sha512");
    });
  });
});
