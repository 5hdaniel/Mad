/**
 * Key Derivation Service (Android Companion)
 * Derives separate auth token and encryption key from the shared pairing secret.
 *
 * Uses Web Crypto HMAC-SHA256 to produce domain-separated keys so the bearer
 * token (sent in plaintext over HTTP) cannot be used to decrypt payloads.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 */

/**
 * Convert a base64 string to a Uint8Array.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
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
 * Derive separate auth token and encryption key from the shared secret.
 *
 * - authToken:     HMAC-SHA256(secret, "auth")       -> hex string (for Bearer header)
 * - encryptionKey: HMAC-SHA256(secret, "encryption")  -> Uint8Array (32 bytes, for AES-256-GCM)
 *
 * @param secretBase64 - Base64-encoded shared secret from QR pairing
 * @returns { authToken, encryptionKey }
 */
export async function deriveTransportKeys(secretBase64: string): Promise<{
  authToken: string;
  encryptionKey: Uint8Array;
}> {
  const secretBytes = base64ToBytes(secretBase64);
  if (secretBytes.length < 16) {
    throw new Error(
      `Shared secret too short: expected at least 16 bytes, got ${secretBytes.length}`
    );
  }

  // Import the shared secret as an HMAC key
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Derive auth token: HMAC-SHA256(secret, "auth") -> hex
  const authRaw = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode("auth")
  );
  const authToken = bytesToHex(new Uint8Array(authRaw));

  // Derive encryption key: HMAC-SHA256(secret, "encryption") -> 32 bytes
  const encRaw = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode("encryption")
  );
  const encryptionKey = new Uint8Array(encRaw);

  return { authToken, encryptionKey };
}
