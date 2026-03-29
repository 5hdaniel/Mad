/**
 * Sync Service (Android Companion)
 * HTTP client for sending encrypted SMS messages and contacts
 * to the Electron desktop app.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 * BACKLOG-1449: Android contacts sync
 */

import { encrypt } from "./encryption";
import { deriveTransportKeys } from "./keyDerivation";
import type {
  SyncMessage,
  SyncPayload,
  SyncResult,
  PairingInfo,
  ContactSyncPayload,
} from "../types/sync";
import type { SyncContact } from "../types/contacts";

/** HTTP request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10_000;

/** Ping timeout — shorter since it's a health check */
const PING_TIMEOUT_MS = 5_000;

/**
 * Perform a fetch request with a timeout.
 * AbortController is used to cancel the request if it exceeds the timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send a batch of messages to the desktop Electron app.
 *
 * Encrypts the payload using the shared secret from QR pairing,
 * then POSTs the encrypted envelope to the desktop's sync server.
 *
 * @param messages - Array of SMS messages to sync
 * @param pairingInfo - Connection details from QR pairing (TASK-1428)
 * @returns SyncResult indicating success/failure and message count
 */
export async function sendMessages(
  messages: SyncMessage[],
  pairingInfo: PairingInfo
): Promise<SyncResult> {
  const { ip, port, secret, deviceId } = pairingInfo;

  // Derive separate auth token and encryption key from the shared secret.
  // The auth token is sent as Bearer header; the encryption key is used
  // for AES-256-GCM. They are cryptographically independent so capturing
  // the bearer token on the wire does not reveal the encryption key.
  const { authToken, encryptionKey } = await deriveTransportKeys(secret);

  // Build the plaintext sync payload
  const payload: SyncPayload = {
    deviceId,
    messages,
    syncTimestamp: Date.now(),
  };

  // Encrypt the payload using the derived encryption key
  const encryptedPayload = await encrypt(JSON.stringify(payload), encryptionKey);

  const url = `http://${ip}:${port}/sync/messages`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(encryptedPayload),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Server responded with ${response.status}: ${errorBody}`,
      };
    }

    const result = (await response.json()) as SyncResult;
    return result;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { success: false, error: "Request timed out" };
      }
      // Network errors: unreachable, refused, etc.
      return { success: false, error: `Network error: ${err.message}` };
    }
    return { success: false, error: "Unknown error" };
  }
}

/**
 * Send a batch of contacts to the desktop Electron app.
 *
 * Encrypts the payload using the shared secret from QR pairing,
 * then POSTs the encrypted envelope to the desktop's contact sync endpoint.
 *
 * BACKLOG-1449: Android contacts sync
 *
 * @param contacts - Array of contacts to sync
 * @param pairingInfo - Connection details from QR pairing (TASK-1428)
 * @returns SyncResult indicating success/failure
 */
export async function sendContacts(
  contacts: SyncContact[],
  pairingInfo: PairingInfo
): Promise<SyncResult> {
  const { ip, port, secret, deviceId } = pairingInfo;

  const { authToken, encryptionKey } = await deriveTransportKeys(secret);

  const payload: ContactSyncPayload = {
    deviceId,
    contacts,
    syncTimestamp: Date.now(),
  };

  const encryptedPayload = await encrypt(JSON.stringify(payload), encryptionKey);

  const url = `http://${ip}:${port}/sync/contacts`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(encryptedPayload),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Server responded with ${response.status}: ${errorBody}`,
      };
    }

    const result = (await response.json()) as SyncResult;
    return result;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { success: false, error: "Request timed out" };
      }
      return { success: false, error: `Network error: ${err.message}` };
    }
    return { success: false, error: "Unknown error" };
  }
}

/**
 * Ping the desktop app to check if it's reachable and the sync server is running.
 *
 * @param pairingInfo - Connection details from QR pairing
 * @returns true if the desktop responds to the health check
 */
export async function pingDesktop(pairingInfo: PairingInfo): Promise<boolean> {
  const { ip, port } = pairingInfo;
  const url = `http://${ip}:${port}/ping`;

  try {
    const response = await fetchWithTimeout(
      url,
      { method: "GET" },
      PING_TIMEOUT_MS
    );

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}
