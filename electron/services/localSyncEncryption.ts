/**
 * Local Sync Encryption Service
 * AES-256-GCM encryption/decryption for the local HTTP transport layer.
 * Uses Node built-in crypto module only — no external dependencies.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 */

import crypto from "crypto";
import type { EncryptedPayload } from "../types/localSync";

/** AES-256-GCM requires a 256-bit (32-byte) key */
const KEY_LENGTH = 32;

/** GCM standard IV length: 96 bits (12 bytes) */
const IV_LENGTH = 12;

/** GCM authentication tag length: 128 bits (16 bytes) */
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param data - The plaintext string to encrypt (typically JSON)
 * @param key - 32-byte encryption key (from shared secret)
 * @returns EncryptedPayload with hex-encoded iv, ciphertext, and auth tag
 * @throws If key length is not 32 bytes
 */
export function encrypt(data: string, key: Buffer): EncryptedPayload {
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`
    );
  }

  // Generate a random IV for each message (critical for GCM security)
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    encrypted: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 *
 * @param payload - EncryptedPayload with hex-encoded iv, ciphertext, and auth tag
 * @param key - 32-byte encryption key (same key used for encryption)
 * @returns The decrypted plaintext string
 * @throws If key length is invalid, auth tag verification fails, or payload is malformed
 */
export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`
    );
  }

  const iv = Buffer.from(payload.iv, "hex");
  const encrypted = Buffer.from(payload.encrypted, "hex");
  const tag = Buffer.from(payload.tag, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`
    );
  }

  if (tag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${tag.length}`
    );
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
