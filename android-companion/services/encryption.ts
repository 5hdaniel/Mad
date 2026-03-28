/**
 * Encryption Service (Android Companion)
 * AES-256-GCM encryption/decryption for the local HTTP transport layer.
 *
 * Uses expo-crypto for native crypto operations on Android.
 * API matches the Electron implementation in electron/services/localSyncEncryption.ts.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 *
 * NOTE: This module requires expo-crypto to be installed:
 *   npx expo install expo-crypto
 * The actual crypto implementation will use expo-crypto's getRandomBytes
 * for IV generation and the Web Crypto API (SubtleCrypto) for AES-GCM,
 * which is available in React Native's Hermes engine.
 *
 * SECURITY: The encryption key must be derived via deriveTransportKeys()
 * from keyDerivation.ts — never use the raw shared secret directly.
 */

import type { EncryptedPayload } from "../types/sync";

/** AES-256-GCM key length: 32 bytes */
const KEY_LENGTH = 32;

/** GCM standard IV length: 12 bytes */
const IV_LENGTH = 12;

/**
 * Convert a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Import a raw key buffer as a CryptoKey for AES-GCM.
 */
async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param data - The plaintext string to encrypt (typically JSON)
 * @param encryptionKey - 32-byte derived encryption key (from deriveTransportKeys)
 * @returns EncryptedPayload with hex-encoded iv, ciphertext, and auth tag
 */
export async function encrypt(
  data: string,
  encryptionKey: Uint8Array
): Promise<EncryptedPayload> {
  if (encryptionKey.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${encryptionKey.length}`
    );
  }

  // Generate random IV using Web Crypto API
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const cryptoKey = await importKey(encryptionKey);

  // AES-GCM encrypt — returns ciphertext + tag concatenated
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(data)
  );

  const result = new Uint8Array(ciphertextWithTag);

  // GCM appends the 16-byte auth tag to the ciphertext
  const encrypted = result.slice(0, result.length - 16);
  const tag = result.slice(result.length - 16);

  return {
    iv: bytesToHex(iv),
    encrypted: bytesToHex(encrypted),
    tag: bytesToHex(tag),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 *
 * @param payload - EncryptedPayload with hex-encoded iv, ciphertext, and auth tag
 * @param encryptionKey - 32-byte derived encryption key (from deriveTransportKeys)
 * @returns The decrypted plaintext string
 */
export async function decrypt(
  payload: EncryptedPayload,
  encryptionKey: Uint8Array
): Promise<string> {
  if (encryptionKey.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${encryptionKey.length}`
    );
  }

  const iv = hexToBytes(payload.iv);
  const encrypted = hexToBytes(payload.encrypted);
  const tag = hexToBytes(payload.tag);

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`
    );
  }

  const cryptoKey = await importKey(encryptionKey);

  // Reconstruct the ciphertext + tag buffer that WebCrypto expects
  const ciphertextWithTag = new Uint8Array(encrypted.length + tag.length);
  ciphertextWithTag.set(encrypted);
  ciphertextWithTag.set(tag, encrypted.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    cryptoKey,
    ciphertextWithTag.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}
