/**
 * Unit tests for Local Sync Encryption Service
 * Verifies AES-256-GCM encryption/decryption roundtrip.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 */

import crypto from "crypto";
import { encrypt, decrypt } from "../localSyncEncryption";
import type { EncryptedPayload } from "../../types/localSync";

describe("localSyncEncryption", () => {
  // Generate a valid 32-byte key for testing
  const testKey = crypto.randomBytes(32);

  describe("encrypt/decrypt roundtrip", () => {
    it("should encrypt and decrypt a simple string", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt a JSON payload", () => {
      const payload = {
        deviceId: "device-123",
        messages: [
          {
            sender: "+15551234567",
            body: "Test message",
            timestamp: Date.now(),
            direction: "inbound",
          },
        ],
        syncTimestamp: Date.now(),
      };

      const plaintext = JSON.stringify(payload);
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(JSON.parse(decrypted)).toEqual(payload);
    });

    it("should encrypt and decrypt empty string", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt unicode content", () => {
      const plaintext = "Hello! Emojis and unicode: cafe\u0301";
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt a large payload", () => {
      // Simulate a large batch of messages (~100KB)
      const largePayload = JSON.stringify({
        deviceId: "device-456",
        messages: Array.from({ length: 500 }, (_, i) => ({
          sender: "+15551234567",
          body: `Message ${i}: ${"x".repeat(100)}`,
          timestamp: Date.now() - i * 1000,
          direction: i % 2 === 0 ? "inbound" : "outbound",
        })),
        syncTimestamp: Date.now(),
      });

      const encrypted = encrypt(largePayload, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(largePayload);
    });
  });

  describe("encrypted payload format", () => {
    it("should produce hex-encoded iv, encrypted, and tag fields", () => {
      const encrypted = encrypt("test", testKey);

      // IV should be 12 bytes = 24 hex chars
      expect(encrypted.iv).toMatch(/^[0-9a-f]{24}$/);

      // Tag should be 16 bytes = 32 hex chars
      expect(encrypted.tag).toMatch(/^[0-9a-f]{32}$/);

      // Encrypted should be non-empty hex
      expect(encrypted.encrypted).toMatch(/^[0-9a-f]+$/);
    });

    it("should produce unique IVs for each encryption", () => {
      const encrypted1 = encrypt("same data", testKey);
      const encrypted2 = encrypt("same data", testKey);

      // IVs must differ (random per message)
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // Both should still decrypt correctly
      expect(decrypt(encrypted1, testKey)).toBe("same data");
      expect(decrypt(encrypted2, testKey)).toBe("same data");
    });
  });

  describe("error handling", () => {
    it("should throw on invalid key length (too short)", () => {
      const shortKey = crypto.randomBytes(16);
      expect(() => encrypt("test", shortKey)).toThrow("Invalid key length");
    });

    it("should throw on invalid key length (too long)", () => {
      const longKey = crypto.randomBytes(64);
      expect(() => encrypt("test", longKey)).toThrow("Invalid key length");
    });

    it("should throw when decrypting with wrong key", () => {
      const encrypted = encrypt("secret data", testKey);
      const wrongKey = crypto.randomBytes(32);

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("should throw when auth tag is tampered with", () => {
      const encrypted = encrypt("secret data", testKey);
      // Flip a byte in the tag
      const tamperedTag =
        encrypted.tag.substring(0, 2) +
        ((parseInt(encrypted.tag.substring(2, 4), 16) ^ 0xff)
          .toString(16)
          .padStart(2, "0")) +
        encrypted.tag.substring(4);

      const tampered: EncryptedPayload = {
        ...encrypted,
        tag: tamperedTag,
      };

      expect(() => decrypt(tampered, testKey)).toThrow();
    });

    it("should throw when ciphertext is tampered with", () => {
      const encrypted = encrypt("secret data", testKey);
      // Flip a byte in the ciphertext
      const tamperedEncrypted =
        encrypted.encrypted.substring(0, 2) +
        ((parseInt(encrypted.encrypted.substring(2, 4), 16) ^ 0xff)
          .toString(16)
          .padStart(2, "0")) +
        encrypted.encrypted.substring(4);

      const tampered: EncryptedPayload = {
        ...encrypted,
        encrypted: tamperedEncrypted,
      };

      expect(() => decrypt(tampered, testKey)).toThrow();
    });

    it("should throw on invalid IV length", () => {
      const encrypted = encrypt("test", testKey);
      const tampered: EncryptedPayload = {
        ...encrypted,
        iv: "aabbccdd", // 4 bytes instead of 12
      };

      expect(() => decrypt(tampered, testKey)).toThrow("Invalid IV length");
    });

    it("should throw on invalid auth tag length", () => {
      const encrypted = encrypt("test", testKey);
      const tampered: EncryptedPayload = {
        ...encrypted,
        tag: "aabbccdd", // 4 bytes instead of 16
      };

      expect(() => decrypt(tampered, testKey)).toThrow("Invalid auth tag length");
    });
  });
});
