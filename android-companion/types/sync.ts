/**
 * Sync Protocol Types (Android Companion)
 * Matches the Electron types in electron/types/localSync.ts.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 */

// ============================================
// MESSAGE TYPES
// ============================================

/**
 * A single SMS/MMS message to sync to the desktop.
 */
export interface SyncMessage {
  /** Phone number in E.164 format (e.g., +15551234567) */
  sender: string;
  /** Message text content */
  body: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Android thread ID for conversation grouping */
  threadId?: string;
  /** Message direction relative to the device owner */
  direction: "inbound" | "outbound";
}

// ============================================
// PAYLOAD TYPES
// ============================================

/**
 * The plaintext payload sent from Android to Electron.
 * This is encrypted before transmission.
 */
export interface SyncPayload {
  /** Unique device identifier from QR pairing */
  deviceId: string;
  /** Array of messages to sync */
  messages: SyncMessage[];
  /** Unix timestamp (ms) when this sync batch was created */
  syncTimestamp: number;
}

/**
 * The encrypted envelope transmitted over the network.
 * All fields are hex-encoded strings.
 */
export interface EncryptedPayload {
  /** Initialization vector (hex) — random per message */
  iv: string;
  /** AES-256-GCM encrypted ciphertext (hex) */
  encrypted: string;
  /** GCM authentication tag (hex) */
  tag: string;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of a sync operation returned by the desktop server.
 */
export interface SyncResult {
  success: boolean;
  /** Number of messages accepted */
  messagesReceived?: number;
  /** Error message if success is false */
  error?: string;
}

/**
 * Pairing information needed to connect to the desktop.
 * Generated during QR pairing (TASK-1428).
 */
export interface PairingInfo {
  /** Local network IP of the desktop */
  ip: string;
  /** Port the sync server is listening on */
  port: number;
  /** Shared secret (base64) for bearer auth + encryption key derivation */
  secret: string;
  /** Unique device identifier */
  deviceId: string;
}
