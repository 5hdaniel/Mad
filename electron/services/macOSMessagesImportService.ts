/**
 * macOS Messages Import Service
 *
 * Imports messages from macOS Messages app (~/Library/Messages/chat.db)
 * into the app's local database, enabling message-to-transaction linking on macOS.
 *
 * This service:
 * 1. Checks Full Disk Access permission
 * 2. Reads from the macOS Messages SQLite database
 * 3. Parses attributedBody blobs for message text
 * 4. Deduplicates messages using message GUID
 * 5. Stores messages in the app's messages table
 */

import crypto from "crypto";
import path from "path";
import os from "os";
import sqlite3 from "sqlite3";
import { promisify } from "util";

import databaseService from "./databaseService";
import permissionService from "./permissionService";
import logService from "./logService";
import { getMessageText } from "../utils/messageParser";
import { macTimestampToDate } from "../utils/dateUtils";

/**
 * Result of importing macOS messages
 */
export interface MacOSImportResult {
  success: boolean;
  messagesImported: number;
  messagesSkipped: number;
  duration: number;
  error?: string;
}

/**
 * Progress callback for import operations
 */
export type ImportProgressCallback = (progress: {
  current: number;
  total: number;
  percent: number;
}) => void;

// Input validation constants
const MAX_MESSAGE_TEXT_LENGTH = 100000; // 100KB - truncate extremely long messages
const MAX_HANDLE_LENGTH = 500; // Phone numbers, emails, etc.
const MAX_GUID_LENGTH = 100; // Message GUID format
const BATCH_SIZE = 500; // Messages per batch
const YIELD_INTERVAL = 2; // Yield every N batches

/**
 * Yield to event loop - allows UI to remain responsive
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Sanitize and validate a string field
 */
function sanitizeString(
  value: string | null | undefined,
  maxLength: number,
  defaultValue = ""
): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  const str = String(value);
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

/**
 * Validate a GUID/external ID format
 */
function isValidGuid(guid: string | null | undefined): boolean {
  if (!guid || typeof guid !== "string") return false;
  // Allow alphanumeric, hyphens, underscores, colons, and dots
  // macOS message GUIDs can be various formats
  return (
    guid.length > 0 && guid.length <= MAX_GUID_LENGTH && /^[\w\-:.]+$/.test(guid)
  );
}

/**
 * Raw message from macOS Messages database
 */
interface RawMacMessage {
  id: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  date: number; // Mac timestamp (nanoseconds since 2001-01-01)
  is_from_me: number;
  handle_id: string | null;
  service: string | null;
  chat_id: number;
  cache_has_attachments: number;
}

/**
 * macOS Messages Import Service
 * Handles importing messages from the macOS Messages app
 */
class MacOSMessagesImportService {
  private static readonly SERVICE_NAME = "MacOSMessagesImportService";

  /** Flag to prevent concurrent imports */
  private isImporting = false;

  /**
   * Import messages from macOS Messages app
   */
  async importMessages(
    userId: string,
    onProgress?: ImportProgressCallback
  ): Promise<MacOSImportResult> {
    const startTime = Date.now();

    // Prevent concurrent imports - only one at a time
    if (this.isImporting) {
      logService.warn(
        "Import already in progress, skipping duplicate request",
        MacOSMessagesImportService.SERVICE_NAME
      );
      return {
        success: false,
        messagesImported: 0,
        messagesSkipped: 0,
        duration: 0,
        error: "Import already in progress",
      };
    }

    this.isImporting = true;

    try {
      return await this.doImport(userId, onProgress, startTime);
    } finally {
      this.isImporting = false;
    }
  }

  /**
   * Internal import implementation
   */
  private async doImport(
    userId: string,
    onProgress: ImportProgressCallback | undefined,
    startTime: number
  ): Promise<MacOSImportResult> {
    // Check platform - macOS only
    if (os.platform() !== "darwin") {
      return {
        success: false,
        messagesImported: 0,
        messagesSkipped: 0,
        duration: Date.now() - startTime,
        error: "macOS Messages import is only available on macOS",
      };
    }

    // Check Full Disk Access permission
    const permissionCheck = await permissionService.checkFullDiskAccess();
    if (!permissionCheck.hasPermission) {
      return {
        success: false,
        messagesImported: 0,
        messagesSkipped: 0,
        duration: Date.now() - startTime,
        error:
          permissionCheck.userMessage ||
          "Full Disk Access permission is required to read iMessages",
      };
    }

    try {
      // Open macOS Messages database
      const messagesDbPath = path.join(
        process.env.HOME!,
        "Library/Messages/chat.db"
      );

      logService.info(
        `Opening macOS Messages database`,
        MacOSMessagesImportService.SERVICE_NAME
      );

      const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
      const dbAll = promisify(db.all.bind(db)) as (
        sql: string,
        params?: unknown
      ) => Promise<RawMacMessage[]>;
      const dbClose = promisify(db.close.bind(db));

      try {
        // Query all messages with their handles and chat info
        const messages = await dbAll(`
          SELECT
            message.ROWID as id,
            message.guid,
            message.text,
            message.attributedBody,
            message.date,
            message.is_from_me,
            handle.id as handle_id,
            message.service,
            chat_message_join.chat_id,
            message.cache_has_attachments
          FROM message
          LEFT JOIN handle ON message.handle_id = handle.ROWID
          LEFT JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
          WHERE message.guid IS NOT NULL
          ORDER BY message.date ASC
        `);

        await dbClose();

        logService.info(
          `Found ${messages.length} messages in macOS Messages`,
          MacOSMessagesImportService.SERVICE_NAME
        );

        // Store messages to app database
        const result = await this.storeMessages(userId, messages, onProgress);

        const duration = Date.now() - startTime;

        logService.info(
          `Import complete: ${result.stored} imported, ${result.skipped} skipped`,
          MacOSMessagesImportService.SERVICE_NAME,
          { duration }
        );

        return {
          success: true,
          messagesImported: result.stored,
          messagesSkipped: result.skipped,
          duration,
        };
      } catch (error) {
        await dbClose();
        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logService.error(
        `Import failed: ${errorMessage}`,
        MacOSMessagesImportService.SERVICE_NAME,
        { duration }
      );

      return {
        success: false,
        messagesImported: 0,
        messagesSkipped: 0,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Store messages to the app database with deduplication
   */
  private async storeMessages(
    userId: string,
    messages: RawMacMessage[],
    onProgress?: ImportProgressCallback
  ): Promise<{ stored: number; skipped: number }> {
    if (messages.length === 0) {
      return { stored: 0, skipped: 0 };
    }

    let stored = 0;
    let skipped = 0;

    // Get database instance
    const db = databaseService.getRawDatabase();

    // Load existing external_ids for deduplication (O(1) lookup)
    logService.info(
      `Loading existing message IDs for deduplication...`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    const existingIds = new Set<string>();
    const existingRows = db
      .prepare(
        `
      SELECT external_id FROM messages
      WHERE user_id = ? AND external_id IS NOT NULL
    `
      )
      .all(userId) as { external_id: string }[];

    for (const row of existingRows) {
      existingIds.add(row.external_id);
    }

    logService.info(
      `Found ${existingIds.size} existing messages`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // Prepare insert statement for messages table only
    // Note: We no longer need to insert into communications table - that's only for
    // messages that are linked to transactions. The UI now queries messages directly.
    const insertMessageStmt = db.prepare(`
      INSERT OR IGNORE INTO messages (
        id, user_id, channel, external_id, direction,
        body_text, participants, thread_id, sent_at,
        has_attachments, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Process in batches
    const totalBatches = Math.ceil(messages.length / BATCH_SIZE);

    logService.info(
      `Processing ${messages.length} messages in ${totalBatches} batches`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const start = batchNum * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, messages.length);
      const batch = messages.slice(start, end);

      // Use a transaction for each batch
      const insertBatch = db.transaction((msgs: RawMacMessage[]) => {
        for (const msg of msgs) {
          // Validate GUID
          if (!isValidGuid(msg.guid)) {
            skipped++;
            continue;
          }

          // Check for duplicate using Set (O(1))
          if (existingIds.has(msg.guid)) {
            skipped++;
            continue;
          }

          // Get message text (handle attributedBody parsing)
          const messageText = getMessageText({
            text: msg.text,
            attributedBody: msg.attributedBody,
            cache_has_attachments: msg.cache_has_attachments,
          });

          // Skip messages with no useful content
          if (!messageText || messageText.startsWith("[")) {
            // Skip system messages like "[Reaction]", "[Attachment]", etc.
            skipped++;
            continue;
          }

          // Determine channel
          const channel = msg.service === "iMessage" ? "imessage" : "sms";

          // Determine direction
          const direction = msg.is_from_me === 1 ? "outbound" : "inbound";

          // Build thread ID from chat
          const threadId = msg.chat_id ? `macos-chat-${msg.chat_id}` : null;

          // Convert Mac timestamp to ISO date
          const sentAt = macTimestampToDate(msg.date);

          // Sanitize handle
          const sanitizedHandle = sanitizeString(
            msg.handle_id,
            MAX_HANDLE_LENGTH,
            "unknown"
          );

          // Build participants JSON
          const participants = JSON.stringify({
            from: msg.is_from_me === 1 ? "me" : sanitizedHandle,
            to: msg.is_from_me === 1 ? [sanitizedHandle] : ["me"],
          });

          // Sanitize message text
          const sanitizedText = sanitizeString(
            messageText,
            MAX_MESSAGE_TEXT_LENGTH,
            ""
          );

          // Build metadata
          const metadata = JSON.stringify({
            source: "macos_messages",
            originalId: msg.id,
            service: msg.service,
          });

          try {
            // Generate ID for message
            const messageId = crypto.randomUUID();

            // Insert into messages table only
            insertMessageStmt.run(
              messageId, // id
              userId, // user_id
              channel, // channel
              msg.guid, // external_id (for deduplication)
              direction, // direction
              sanitizedText, // body_text
              participants, // participants JSON
              threadId, // thread_id
              sentAt.toISOString(), // sent_at
              msg.cache_has_attachments > 0 ? 1 : 0, // has_attachments
              metadata // metadata
            );

            stored++;
            // Add to set to catch duplicates within same batch
            existingIds.add(msg.guid);
          } catch (insertError) {
            const errMsg =
              insertError instanceof Error
                ? insertError.message
                : "Unknown error";
            if (!errMsg.includes("UNIQUE constraint")) {
              logService.warn(
                `Failed to insert message`,
                MacOSMessagesImportService.SERVICE_NAME,
                { guid: msg.guid, error: errMsg }
              );
            }
            skipped++;
          }
        }
      });

      // Execute batch
      insertBatch(batch);

      // Report progress
      onProgress?.({
        current: end,
        total: messages.length,
        percent: Math.round((end / messages.length) * 100),
      });

      // Yield to event loop every N batches
      if ((batchNum + 1) % YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }

      // Log progress every 10 batches
      if ((batchNum + 1) % 10 === 0) {
        logService.info(
          `Progress: ${end}/${messages.length} messages (${Math.round((end / messages.length) * 100)}%)`,
          MacOSMessagesImportService.SERVICE_NAME
        );
      }
    }

    return { stored, skipped };
  }

  /**
   * Get count of messages available for import
   */
  async getAvailableMessageCount(): Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }> {
    // Check platform
    if (os.platform() !== "darwin") {
      return {
        success: false,
        error: "macOS Messages import is only available on macOS",
      };
    }

    // Check permission
    const permissionCheck = await permissionService.checkFullDiskAccess();
    if (!permissionCheck.hasPermission) {
      return {
        success: false,
        error: permissionCheck.userMessage || "Full Disk Access required",
      };
    }

    try {
      const messagesDbPath = path.join(
        process.env.HOME!,
        "Library/Messages/chat.db"
      );

      const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
      const dbGet = promisify(db.get.bind(db)) as (
        sql: string
      ) => Promise<{ count: number } | undefined>;
      const dbClose = promisify(db.close.bind(db));

      try {
        const result = await dbGet(`
          SELECT COUNT(*) as count FROM message WHERE guid IS NOT NULL
        `);

        await dbClose();

        return {
          success: true,
          count: result?.count || 0,
        };
      } catch (error) {
        await dbClose();
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const macOSMessagesImportService = new MacOSMessagesImportService();
export default macOSMessagesImportService;
