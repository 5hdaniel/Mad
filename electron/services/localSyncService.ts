/**
 * Local Sync HTTP Server Service
 * Runs a temporary HTTP server on the local network for receiving encrypted
 * SMS sync payloads from the Android companion app.
 *
 * Modeled after the OAuth callback server pattern in googleAuthService.ts
 * and microsoftAuthService.ts. Uses Node built-in http module (NOT Express).
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 */

import crypto from "crypto";
import http from "http";
import os from "os";
import logService from "./logService";
import { decrypt } from "./localSyncEncryption";
import { secureCompare } from "../utils/keyDerivation";
import type {
  EncryptedPayload,
  SyncPayload,
  LocalSyncResult,
  LocalSyncServerStatus,
} from "../types/localSync";

const LOG_TAG = "LocalSync";

/**
 * Get the first non-internal IPv4 address on the local network.
 * Binds to a specific interface rather than 0.0.0.0 for security.
 */
function getLocalNetworkIP(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (!addr.internal && addr.family === "IPv4") {
        return addr.address;
      }
    }
  }
  return null;
}

/**
 * Read the full request body as a string.
 */
function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB limit

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Send a JSON response.
 */
function sendJSON(
  res: http.ServerResponse,
  statusCode: number,
  body: Record<string, unknown>
): void {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

// ============================================
// SERVICE CLASS
// ============================================

/**
 * Derive separate auth token and encryption key from the shared secret.
 * Uses HMAC-SHA256 with domain-specific labels so the bearer token (sent
 * in plaintext over HTTP) cannot be used to decrypt payloads.
 *
 * @param secretBase64 - Base64-encoded shared secret from QR pairing
 * @returns { authToken, encryptionKey } — hex auth token + 32-byte key buffer
 */
export function deriveTransportKeys(secretBase64: string): {
  authToken: string;
  encryptionKey: Buffer;
} {
  const secretBuf = Buffer.from(secretBase64, "base64");
  if (secretBuf.length < 16) {
    throw new Error(
      `Shared secret too short: expected at least 16 bytes, got ${secretBuf.length}`
    );
  }

  // Auth token: HMAC-SHA256(secret, "auth") → hex string (for Bearer header)
  const authToken = crypto
    .createHmac("sha256", secretBuf)
    .update("auth")
    .digest("hex");

  // Encryption key: HMAC-SHA256(secret, "encryption") → 32-byte Buffer
  const encryptionKey = crypto
    .createHmac("sha256", secretBuf)
    .update("encryption")
    .digest();

  return { authToken, encryptionKey };
}

class LocalSyncService {
  private server: http.Server | null = null;
  private authToken: string | null = null;
  private encryptionKey: Buffer | null = null;
  private boundAddress: string | null = null;
  private boundPort: number | null = null;

  /** Callback invoked when a valid sync payload is received */
  private onMessagesReceived:
    | ((payload: SyncPayload) => void)
    | null = null;

  /**
   * Start the local sync HTTP server.
   *
   * @param port - Port to listen on (0 for OS-assigned)
   * @param secret - Base64-encoded shared secret from QR pairing
   * @param onMessages - Callback for received message payloads
   * @returns The actual port and address the server is bound to
   */
  async startServer(
    port: number,
    secret: string,
    onMessages?: (payload: SyncPayload) => void
  ): Promise<{ port: number; address: string }> {
    if (this.server) {
      logService.warn(
        "[LocalSync] Server already running, stopping first",
        LOG_TAG
      );
      await this.stopServer();
    }

    // Derive separate auth token and encryption key from the shared secret.
    // The auth token is used for bearer authentication; the encryption key
    // is used for AES-256-GCM. They are cryptographically independent so
    // capturing the bearer token on the wire does not reveal the encryption key.
    const derived = deriveTransportKeys(secret);
    this.authToken = derived.authToken;
    this.encryptionKey = derived.encryptionKey;
    this.onMessagesReceived = onMessages ?? null;

    const localIP = getLocalNetworkIP();
    if (!localIP) {
      throw new Error(
        "No local network interface found. Ensure WiFi or Ethernet is connected."
      );
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err) => {
        logService.error(
          `[LocalSync] Server error: ${err.message}`,
          LOG_TAG
        );
        reject(err);
      });

      // Bind to specific local network IP (not 0.0.0.0)
      this.server.listen(port, localIP, () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr) {
          this.boundPort = addr.port;
          this.boundAddress = addr.address;
          logService.info(
            `[LocalSync] Server listening on ${this.boundAddress}:${this.boundPort}`,
            LOG_TAG
          );
          resolve({ port: this.boundPort, address: this.boundAddress });
        } else {
          reject(new Error("Failed to get server address"));
        }
      });
    });
  }

  /**
   * Stop the local sync HTTP server.
   */
  async stopServer(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        logService.info("[LocalSync] Server stopped", LOG_TAG);
        this.server = null;
        this.authToken = null;
        this.encryptionKey = null;
        this.boundAddress = null;
        this.boundPort = null;
        this.onMessagesReceived = null;
        resolve();
      });
    });
  }

  /**
   * Get the current server status.
   */
  getStatus(): LocalSyncServerStatus {
    return {
      running: this.server !== null,
      port: this.boundPort,
      address: this.boundAddress,
    };
  }

  /**
   * Route incoming HTTP requests.
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const urlPath = req.url?.split("?")[0] ?? "";
    const method = req.method?.toUpperCase() ?? "";

    logService.debug(
      `[LocalSync] ${method} ${urlPath}`,
      LOG_TAG
    );

    if (method === "GET" && urlPath === "/ping") {
      this.handlePing(res);
      return;
    }

    if (method === "POST" && urlPath === "/sync/messages") {
      this.handleSyncMessages(req, res);
      return;
    }

    // Unknown route
    sendJSON(res, 404, { error: "Not found" });
  }

  /**
   * GET /ping — connection health check.
   * No authentication required (used for discovery).
   */
  private handlePing(res: http.ServerResponse): void {
    sendJSON(res, 200, { status: "ok", timestamp: Date.now() });
  }

  /**
   * POST /sync/messages — receive encrypted message batch.
   * Requires bearer token authentication + AES-256-GCM decryption.
   */
  private async handleSyncMessages(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      // Validate bearer token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        logService.warn("[LocalSync] Missing or invalid Authorization header", LOG_TAG);
        sendJSON(res, 401, { error: "Unauthorized" });
        return;
      }

      const token = authHeader.substring(7); // Remove "Bearer "
      if (
        !this.authToken ||
        !secureCompare(Buffer.from(token, "utf8"), Buffer.from(this.authToken, "utf8"))
      ) {
        logService.warn("[LocalSync] Invalid bearer token", LOG_TAG);
        sendJSON(res, 401, { error: "Unauthorized" });
        return;
      }

      // Read and parse request body
      let body: string;
      try {
        body = await readRequestBody(req);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to read body";
        logService.error(`[LocalSync] Body read error: ${message}`, LOG_TAG);
        sendJSON(res, 400, { error: message });
        return;
      }

      let encryptedPayload: EncryptedPayload;
      try {
        encryptedPayload = JSON.parse(body) as EncryptedPayload;
      } catch {
        logService.warn("[LocalSync] Invalid JSON in request body", LOG_TAG);
        sendJSON(res, 400, { error: "Invalid JSON" });
        return;
      }

      // Validate encrypted payload structure
      if (!encryptedPayload.iv || !encryptedPayload.encrypted || !encryptedPayload.tag) {
        logService.warn("[LocalSync] Missing encrypted payload fields", LOG_TAG);
        sendJSON(res, 400, { error: "Invalid payload: missing iv, encrypted, or tag" });
        return;
      }

      // Decrypt
      if (!this.encryptionKey) {
        logService.error("[LocalSync] Encryption key not set", LOG_TAG);
        sendJSON(res, 500, { error: "Server not configured" });
        return;
      }

      let decryptedJson: string;
      try {
        decryptedJson = decrypt(encryptedPayload, this.encryptionKey);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Decryption failed";
        logService.warn(`[LocalSync] Decryption failed: ${message}`, LOG_TAG);
        sendJSON(res, 400, { error: "Decryption failed" });
        return;
      }

      // Parse decrypted payload
      let syncPayload: SyncPayload;
      try {
        syncPayload = JSON.parse(decryptedJson) as SyncPayload;
      } catch {
        logService.warn("[LocalSync] Invalid JSON in decrypted payload", LOG_TAG);
        sendJSON(res, 400, { error: "Invalid decrypted payload" });
        return;
      }

      // Validate sync payload structure
      if (!syncPayload.deviceId || !Array.isArray(syncPayload.messages)) {
        logService.warn("[LocalSync] Invalid sync payload structure", LOG_TAG);
        sendJSON(res, 400, { error: "Invalid sync payload: missing deviceId or messages" });
        return;
      }

      logService.info(
        `[LocalSync] Received ${syncPayload.messages.length} messages from device ${syncPayload.deviceId}`,
        LOG_TAG
      );

      // Invoke callback if registered
      if (this.onMessagesReceived) {
        this.onMessagesReceived(syncPayload);
      }

      const result: LocalSyncResult = {
        success: true,
        messagesReceived: syncPayload.messages.length,
      };

      sendJSON(res, 200, result as unknown as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      logService.error(`[LocalSync] Unhandled error: ${message}`, LOG_TAG);
      sendJSON(res, 500, { error: "Internal server error" });
    }
  }
}

// Export singleton instance
const localSyncService = new LocalSyncService();
export default localSyncService;
