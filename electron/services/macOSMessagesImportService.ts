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
 * 6. Imports and stores image/GIF attachments (TASK-1012)
 */

import crypto from "crypto";
import path from "path";
import os from "os";
import fs from "fs";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { app } from "electron";
import cliProgress from "cli-progress";

import databaseService from "./databaseService";
import permissionService from "./permissionService";
import logService from "./logService";
import { getMessageText } from "../utils/messageParser";
import { macTimestampToDate } from "../utils/dateUtils";

/**
 * Create a tqdm-style progress bar for console output
 */
function createProgressBar(label: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar({
    format: `${label} |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s`,
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
    clearOnComplete: true,
  }, cliProgress.Presets.shades_classic);
}

/**
 * Result of importing macOS messages
 */
export interface MacOSImportResult {
  success: boolean;
  messagesImported: number;
  messagesSkipped: number;
  attachmentsImported: number;
  attachmentsSkipped: number;
  duration: number;
  error?: string;
}

/**
 * Progress callback for import operations
 */
export type ImportProgressCallback = (progress: {
  phase: "querying" | "deleting" | "importing" | "attachments";
  current: number;
  total: number;
  percent: number;
}) => void;

// Input validation constants
const MAX_MESSAGE_TEXT_LENGTH = 100000; // 100KB - truncate extremely long messages
const MAX_HANDLE_LENGTH = 500; // Phone numbers, emails, etc.
const MAX_GUID_LENGTH = 100; // Message GUID format
const BATCH_SIZE = 500; // Messages per batch
const DELETE_BATCH_SIZE = 5000; // Messages per delete batch (larger for efficiency)
const YIELD_INTERVAL = 1; // Yield every N batches (reduced from 2 for better UI responsiveness)
const QUERY_BATCH_SIZE = 10000; // Messages per query batch (for pagination)

// Attachment constants (TASK-1012)
const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".heic"];
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB max per attachment
const ATTACHMENTS_DIR = "message-attachments"; // Directory name in app data

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
 * Chat member info from chat_handle_join
 */
interface ChatMemberRow {
  chat_id: number;
  handle_id: string;
}

/**
 * Raw attachment from macOS Messages database (TASK-1012)
 */
interface RawMacAttachment {
  attachment_id: number;
  message_id: number;
  message_guid: string;
  guid: string;
  filename: string | null;
  mime_type: string | null;
  transfer_name: string | null;
  total_bytes: number;
  is_outgoing: number;
}

/**
 * Check if a file extension is a supported image type
 */
function isSupportedImageType(filename: string | null): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Get MIME type from filename
 */
function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".heic": "image/heic",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Generate a content hash for deduplication (async to avoid blocking)
 */
async function generateContentHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.promises.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * macOS Messages Import Service
 * Handles importing messages from the macOS Messages app
 */
class MacOSMessagesImportService {
  private static readonly SERVICE_NAME = "MacOSMessagesImportService";

  /** Flag to prevent concurrent imports */
  private isImporting = false;
  /** Timestamp when import started (for stuck flag detection) */
  private importStartedAt: number | null = null;
  /** Flag to signal that current import should be cancelled */
  private cancelCurrentImport = false;
  /** Flag to indicate force reimport is in progress (blocks all other imports) */
  private forceReimportInProgress = false;
  /** Max import duration before auto-reset (10 minutes) */
  private static readonly MAX_IMPORT_DURATION_MS = 10 * 60 * 1000;

  /**
   * Import messages from macOS Messages app
   * @param userId - User ID
   * @param onProgress - Progress callback
   * @param forceReimport - If true, delete existing messages first and re-import all
   */
  async importMessages(
    userId: string,
    onProgress?: ImportProgressCallback,
    forceReimport = false
  ): Promise<MacOSImportResult> {
    const startTime = Date.now();

    // If force reimport is in progress, block ALL other imports
    if (this.forceReimportInProgress && !forceReimport) {
      logService.warn(
        "Force reimport in progress, blocking regular import",
        MacOSMessagesImportService.SERVICE_NAME
      );
      return {
        success: false,
        messagesImported: 0,
        messagesSkipped: 0,
        attachmentsImported: 0,
        attachmentsSkipped: 0,
        duration: 0,
        error: "Force reimport in progress",
      };
    }

    // Force reimport takes priority - cancel any running import
    if (forceReimport && this.isImporting) {
      logService.warn(
        "Force reimport requested, cancelling current import",
        MacOSMessagesImportService.SERVICE_NAME
      );
      this.cancelCurrentImport = true;
      // Wait a bit for the current import to notice the cancellation
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.isImporting = false;
      this.importStartedAt = null;
      this.cancelCurrentImport = false;
    }

    // Check if import flag is stuck (been true for too long)
    if (this.isImporting && this.importStartedAt) {
      const elapsed = Date.now() - this.importStartedAt;
      if (elapsed > MacOSMessagesImportService.MAX_IMPORT_DURATION_MS) {
        logService.warn(
          `Import flag stuck for ${Math.round(elapsed / 1000)}s, auto-resetting`,
          MacOSMessagesImportService.SERVICE_NAME
        );
        this.isImporting = false;
        this.importStartedAt = null;
      }
    }

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
        attachmentsImported: 0,
        attachmentsSkipped: 0,
        duration: 0,
        error: "Import already in progress",
      };
    }

    this.isImporting = true;
    this.importStartedAt = Date.now();
    if (forceReimport) {
      this.forceReimportInProgress = true;
    }

    try {
      return await this.doImport(userId, onProgress, startTime, forceReimport);
    } finally {
      this.isImporting = false;
      this.importStartedAt = null;
      if (forceReimport) {
        this.forceReimportInProgress = false;
      }
    }
  }

  /**
   * Force reset the import lock (for debugging stuck state)
   */
  resetImportLock(): void {
    logService.info(
      "Manually resetting import lock",
      MacOSMessagesImportService.SERVICE_NAME
    );
    this.isImporting = false;
    this.importStartedAt = null;
  }

  /**
   * Internal import implementation
   */
  private async doImport(
    userId: string,
    onProgress: ImportProgressCallback | undefined,
    startTime: number,
    forceReimport: boolean
  ): Promise<MacOSImportResult> {
    // Check platform - macOS only
    if (os.platform() !== "darwin") {
      return {
        success: false,
        messagesImported: 0,
        messagesSkipped: 0,
        attachmentsImported: 0,
        attachmentsSkipped: 0,
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
        attachmentsImported: 0,
        attachmentsSkipped: 0,
        duration: Date.now() - startTime,
        error:
          permissionCheck.userMessage ||
          "Full Disk Access permission is required to read iMessages",
      };
    }

    try {
      // If force reimport, delete existing macOS messages first
      if (forceReimport) {
        logService.info(
          `Force reimport: clearing existing macOS messages`,
          MacOSMessagesImportService.SERVICE_NAME
        );
        await this.clearMacOSMessages(userId, onProgress);
      }

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
      const dbAll = promisify(db.all.bind(db)) as <T>(
        sql: string,
        params?: unknown
      ) => Promise<T[]>;
      const dbClose = promisify(db.close.bind(db));

      try {
        // First, get total message count for progress reporting
        const countResult = await dbAll<{ count: number }>(`
          SELECT COUNT(*) as count FROM message WHERE guid IS NOT NULL
        `);
        const totalMessageCount = countResult[0]?.count || 0;

        logService.info(
          `Found ${totalMessageCount} messages in macOS Messages, fetching in batches of ${QUERY_BATCH_SIZE}`,
          MacOSMessagesImportService.SERVICE_NAME
        );

        // Report initial querying progress
        onProgress?.({
          phase: "querying",
          current: 0,
          total: totalMessageCount,
          percent: 0,
        });

        // Query actual chat members from chat_handle_join (small table, load all at once)
        // This gives us the real participant list for group chats
        const chatMemberRows = await dbAll<ChatMemberRow>(`
          SELECT
            chat_handle_join.chat_id,
            handle.id as handle_id
          FROM chat_handle_join
          JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        `);

        // Build a map of chat_id -> array of member handles
        const chatMembersMap = new Map<number, string[]>();
        for (const row of chatMemberRows) {
          const members = chatMembersMap.get(row.chat_id) || [];
          members.push(row.handle_id);
          chatMembersMap.set(row.chat_id, members);
        }

        logService.info(
          `Loaded ${chatMembersMap.size} chat member lists`,
          MacOSMessagesImportService.SERVICE_NAME
        );

        await yieldToEventLoop();

        // Fetch messages using cursor-based pagination to avoid loading all 600K+ at once
        // This prevents the UI from freezing during the initial query
        const allMessages: RawMacMessage[] = [];
        let lastRowId = 0;
        let fetchedCount = 0;

        const queryProgressBar = createProgressBar("Querying");
        queryProgressBar.start(totalMessageCount, 0);

        while (fetchedCount < totalMessageCount) {
          // Check for cancellation
          if (this.cancelCurrentImport) {
            queryProgressBar.stop();
            logService.warn(
              `Import cancelled during query phase at ${fetchedCount}/${totalMessageCount}`,
              MacOSMessagesImportService.SERVICE_NAME
            );
            await dbClose();
            return {
              success: false,
              messagesImported: 0,
              messagesSkipped: 0,
              attachmentsImported: 0,
              attachmentsSkipped: 0,
              duration: Date.now() - startTime,
              error: "Import cancelled",
            };
          }

          // Fetch next batch using cursor-based pagination (ROWID for efficient indexing)
          const messageBatch = await dbAll<RawMacMessage>(`
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
            WHERE message.guid IS NOT NULL AND message.ROWID > ?
            ORDER BY message.ROWID ASC
            LIMIT ?
          `, [lastRowId, QUERY_BATCH_SIZE]);

          if (messageBatch.length === 0) {
            break; // No more messages
          }

          allMessages.push(...messageBatch);
          lastRowId = messageBatch[messageBatch.length - 1].id;
          fetchedCount += messageBatch.length;

          // Update progress
          queryProgressBar.update(fetchedCount);
          onProgress?.({
            phase: "querying",
            current: fetchedCount,
            total: totalMessageCount,
            percent: Math.round((fetchedCount / totalMessageCount) * 100),
          });

          // Yield to event loop to keep UI responsive
          await yieldToEventLoop();
        }

        queryProgressBar.stop();

        // Query attachments linked to messages (TASK-1012)
        // We join through message_attachment_join to get the message relationship
        const attachments = await dbAll<RawMacAttachment>(`
          SELECT
            attachment.ROWID as attachment_id,
            message.ROWID as message_id,
            message.guid as message_guid,
            attachment.guid,
            attachment.filename,
            attachment.mime_type,
            attachment.transfer_name,
            attachment.total_bytes,
            attachment.is_outgoing
          FROM attachment
          JOIN message_attachment_join ON attachment.ROWID = message_attachment_join.attachment_id
          JOIN message ON message.ROWID = message_attachment_join.message_id
          WHERE message.guid IS NOT NULL
            AND attachment.filename IS NOT NULL
        `);

        await dbClose();

        logService.info(
          `Fetched ${allMessages.length} messages and ${attachments.length} attachments in macOS Messages`,
          MacOSMessagesImportService.SERVICE_NAME
        );

        // Store messages to app database
        const messageResult = await this.storeMessages(userId, allMessages, chatMembersMap, onProgress);

        // Store attachments (TASK-1012)
        const attachmentResult = await this.storeAttachments(userId, attachments, messageResult.messageIdMap, onProgress);

        const duration = Date.now() - startTime;

        logService.info(
          `Import complete: ${messageResult.stored} messages imported, ${messageResult.skipped} skipped, ${attachmentResult.stored} attachments imported, ${attachmentResult.skipped} skipped`,
          MacOSMessagesImportService.SERVICE_NAME,
          { duration }
        );

        // Send final 100% progress to update UI
        onProgress?.({
          phase: "importing",
          current: allMessages.length,
          total: allMessages.length,
          percent: 100,
        });

        return {
          success: true,
          messagesImported: messageResult.stored,
          messagesSkipped: messageResult.skipped,
          attachmentsImported: attachmentResult.stored,
          attachmentsSkipped: attachmentResult.skipped,
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
        attachmentsImported: 0,
        attachmentsSkipped: 0,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Store messages to the app database with deduplication
   * Returns a map of macOS message GUID -> internal message ID for attachment linking
   */
  private async storeMessages(
    userId: string,
    messages: RawMacMessage[],
    chatMembersMap: Map<number, string[]>,
    onProgress?: ImportProgressCallback
  ): Promise<{ stored: number; skipped: number; messageIdMap: Map<string, string> }> {
    // Map of macOS message GUID -> internal message ID (TASK-1012)
    const messageIdMap = new Map<string, string>();

    if (messages.length === 0) {
      return { stored: 0, skipped: 0, messageIdMap };
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
        body_text, participants, participants_flat, thread_id, sent_at,
        has_attachments, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Process in batches
    const totalBatches = Math.ceil(messages.length / BATCH_SIZE);

    logService.info(
      `Processing ${messages.length} messages in ${totalBatches} batches`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // Create progress bar for console output
    const msgProgressBar = createProgressBar("Messages");
    msgProgressBar.start(messages.length, 0);

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      // Check for cancellation at start of each batch
      if (this.cancelCurrentImport) {
        msgProgressBar.stop();
        logService.warn(
          `Import cancelled at batch ${batchNum}/${totalBatches}`,
          MacOSMessagesImportService.SERVICE_NAME
        );
        break;
      }

      const start = batchNum * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, messages.length);
      const batch = messages.slice(start, end);

      // Pre-process: Extract text from attributedBody for all messages in batch
      // This must be done BEFORE the transaction since getMessageText is async
      const messageTexts = new Map<string, string>();
      for (const msg of batch) {
        if (msg.guid && isValidGuid(msg.guid) && !existingIds.has(msg.guid)) {
          const text = await getMessageText({
            text: msg.text,
            attributedBody: msg.attributedBody,
            cache_has_attachments: msg.cache_has_attachments,
          });
          messageTexts.set(msg.guid, text);
        }
      }

      // Use a transaction for each batch (synchronous)
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

          // Get pre-computed message text
          const messageText = messageTexts.get(msg.guid) || "";

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

          // Get actual chat members for this chat (for group chats)
          const chatMembers = msg.chat_id ? chatMembersMap.get(msg.chat_id) : undefined;

          // Build participants JSON with actual chat members
          const participantsObj = {
            from: msg.is_from_me === 1 ? "me" : sanitizedHandle,
            to: msg.is_from_me === 1 ? [sanitizedHandle] : ["me"],
            // Include actual chat members for group chats (more than 1 member)
            ...(chatMembers && chatMembers.length > 1 ? { chat_members: chatMembers } : {}),
          };
          const participants = JSON.stringify(participantsObj);

          // Build participants_flat for fast phone number search
          // Include from, to, and all chat_members (for group chats)
          const allParticipantPhones: string[] = [];
          if (participantsObj.from && participantsObj.from !== "me") {
            allParticipantPhones.push(participantsObj.from.replace(/\D/g, ""));
          }
          for (const toPhone of participantsObj.to) {
            if (toPhone !== "me") {
              allParticipantPhones.push(toPhone.replace(/\D/g, ""));
            }
          }
          if (chatMembers) {
            for (const member of chatMembers) {
              allParticipantPhones.push(member.replace(/\D/g, ""));
            }
          }
          const participantsFlat = allParticipantPhones.join(",");

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
              participantsFlat, // participants_flat for search
              threadId, // thread_id
              sentAt.toISOString(), // sent_at
              msg.cache_has_attachments > 0 ? 1 : 0, // has_attachments
              metadata // metadata
            );

            stored++;
            // Add to set to catch duplicates within same batch
            existingIds.add(msg.guid);

            // Track GUID -> internal ID mapping for attachment linking (TASK-1012)
            messageIdMap.set(msg.guid, messageId);
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

      // Update progress bar
      msgProgressBar.update(end);

      // Report progress to UI
      onProgress?.({
        phase: "importing",
        current: end,
        total: messages.length,
        percent: Math.round((end / messages.length) * 100),
      });

      // Yield to event loop every N batches
      if ((batchNum + 1) % YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    // Stop progress bar
    msgProgressBar.stop();

    return { stored, skipped, messageIdMap };
  }

  /**
   * Store attachments to the app database and file system (TASK-1012)
   * Copies supported image files to app data directory with deduplication
   * Uses async operations to avoid blocking the main thread
   */
  private async storeAttachments(
    userId: string,
    attachments: RawMacAttachment[],
    messageIdMap: Map<string, string>,
    onProgress?: ImportProgressCallback
  ): Promise<{ stored: number; skipped: number }> {
    if (attachments.length === 0) {
      return { stored: 0, skipped: 0 };
    }

    let stored = 0;
    let skipped = 0;

    // Get database instance
    const db = databaseService.getRawDatabase();

    // Create attachments directory if it doesn't exist
    const attachmentsDir = path.join(app.getPath("userData"), ATTACHMENTS_DIR);
    await fs.promises.mkdir(attachmentsDir, { recursive: true });

    // Load existing attachment hashes for deduplication
    const existingHashes = new Set<string>();
    const existingHashRows = db
      .prepare(`SELECT storage_path FROM attachments WHERE storage_path IS NOT NULL`)
      .all() as { storage_path: string }[];

    // Extract hash from storage path (filename is the hash)
    for (const row of existingHashRows) {
      const filename = path.basename(row.storage_path, path.extname(row.storage_path));
      existingHashes.add(filename);
    }

    logService.info(
      `Processing ${attachments.length} attachments, ${existingHashes.size} already stored`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // Create progress bar for attachments
    const attachProgressBar = createProgressBar("Attachments");
    attachProgressBar.start(attachments.length, 0);

    // Prepare insert statement
    const insertAttachmentStmt = db.prepare(`
      INSERT OR IGNORE INTO attachments (
        id, message_id, filename, mime_type, file_size_bytes, storage_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // Also need to query existing message IDs from DB for messages imported in previous runs
    const existingMessageIdMap = new Map<string, string>();
    const existingMsgRows = db
      .prepare(`SELECT id, external_id FROM messages WHERE external_id IS NOT NULL`)
      .all() as { id: string; external_id: string }[];
    for (const row of existingMsgRows) {
      existingMessageIdMap.set(row.external_id, row.id);
    }

    // Process attachments with progress reporting and event loop yielding
    const totalAttachments = attachments.length;
    let processed = 0;

    for (const attachment of attachments) {
      // Check for cancellation
      if (this.cancelCurrentImport) {
        attachProgressBar.stop();
        logService.warn(
          `Attachment import cancelled at ${processed}/${totalAttachments}`,
          MacOSMessagesImportService.SERVICE_NAME
        );
        break;
      }

      try {
        // Skip non-image attachments
        const filename = attachment.transfer_name || attachment.filename;
        if (!isSupportedImageType(filename)) {
          skipped++;
          processed++;
          continue;
        }

        // Skip oversized attachments
        if (attachment.total_bytes > MAX_ATTACHMENT_SIZE) {
          logService.warn(
            `Skipping oversized attachment: ${attachment.total_bytes} bytes`,
            MacOSMessagesImportService.SERVICE_NAME
          );
          skipped++;
          processed++;
          continue;
        }

        // Get the internal message ID for this attachment's message
        // First check the current import batch, then existing messages
        let internalMessageId = messageIdMap.get(attachment.message_guid);
        if (!internalMessageId) {
          internalMessageId = existingMessageIdMap.get(attachment.message_guid);
        }
        if (!internalMessageId) {
          // Message not found - skip this attachment
          skipped++;
          processed++;
          continue;
        }

        // Resolve the source file path
        // macOS Messages stores attachments with paths like:
        // ~/Library/Messages/Attachments/xx/yy/guid/filename
        // The filename column contains the full path with ~ prefix
        let sourcePath = attachment.filename;
        if (!sourcePath) {
          skipped++;
          processed++;
          continue;
        }

        // Resolve ~ to home directory
        if (sourcePath.startsWith("~")) {
          sourcePath = path.join(process.env.HOME!, sourcePath.slice(1));
        }

        // Check if source file exists (async)
        try {
          await fs.promises.access(sourcePath, fs.constants.R_OK);
        } catch {
          logService.debug(
            `Attachment file not found: ${sourcePath}`,
            MacOSMessagesImportService.SERVICE_NAME
          );
          skipped++;
          processed++;
          continue;
        }

        // Generate content hash for deduplication (async)
        const contentHash = await generateContentHash(sourcePath);

        // Skip if we already have this content
        if (existingHashes.has(contentHash)) {
          // File already exists - just link to existing file
          const ext = path.extname(filename!);
          const existingPath = path.join(attachmentsDir, `${contentHash}${ext}`);

          // Still create a new attachment record linking to existing file
          const attachmentId = crypto.randomUUID();
          insertAttachmentStmt.run(
            attachmentId,
            internalMessageId,
            filename,
            attachment.mime_type || getMimeTypeFromFilename(filename!),
            attachment.total_bytes,
            existingPath
          );
          stored++;
          processed++;
          continue;
        }

        // Copy file to app data directory with hash as filename (async)
        const ext = path.extname(filename!);
        const destPath = path.join(attachmentsDir, `${contentHash}${ext}`);
        await fs.promises.copyFile(sourcePath, destPath);

        // Insert attachment record
        const attachmentId = crypto.randomUUID();
        insertAttachmentStmt.run(
          attachmentId,
          internalMessageId,
          filename,
          attachment.mime_type || getMimeTypeFromFilename(filename!),
          attachment.total_bytes,
          destPath
        );

        stored++;
        processed++;
        existingHashes.add(contentHash);
      } catch (error) {
        // Silently skip FOREIGN KEY errors (expected for messages that were skipped)
        // Only log other errors
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        if (!errMsg.includes("FOREIGN KEY")) {
          logService.warn(
            `Failed to import attachment: ${errMsg}`,
            MacOSMessagesImportService.SERVICE_NAME,
            { guid: attachment.guid }
          );
        }
        skipped++;
        processed++;
      }

      // Update progress bar
      attachProgressBar.update(processed);

      // Report progress to UI every 500 attachments
      if (processed % 500 === 0) {
        const percent = Math.round((processed / totalAttachments) * 100);
        onProgress?.({
          phase: "attachments",
          current: processed,
          total: totalAttachments,
          percent,
        });
      }

      // Yield to event loop every 100 attachments to prevent UI freeze
      if (processed % 100 === 0) {
        await yieldToEventLoop();
      }
    }

    // Stop progress bar
    attachProgressBar.stop();

    logService.info(
      `Attachments: ${stored} imported, ${skipped} skipped`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    return { stored, skipped };
  }

  /**
   * Clear all macOS messages for a user (for force reimport)
   * Uses batched deletes with progress reporting to keep UI responsive
   */
  private async clearMacOSMessages(
    userId: string,
    onProgress?: ImportProgressCallback
  ): Promise<void> {
    const db = databaseService.getRawDatabase();

    // Count messages to delete
    const countResult = db
      .prepare(
        `SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND external_id IS NOT NULL`
      )
      .get(userId) as { count: number };

    const messageCount = countResult?.count || 0;

    if (messageCount === 0) {
      logService.info(
        `No existing macOS messages to clear`,
        MacOSMessagesImportService.SERVICE_NAME
      );
      return;
    }

    logService.info(
      `Clearing ${messageCount} existing macOS messages and attachments`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // Report initial progress
    onProgress?.({
      phase: "deleting",
      current: 0,
      total: messageCount,
      percent: 0,
    });

    // Delete attachments first (in one go - usually much fewer than messages)
    const attachResult = db
      .prepare(
        `
      DELETE FROM attachments
      WHERE message_id IN (
        SELECT id FROM messages WHERE user_id = ? AND external_id IS NOT NULL
      )
    `
      )
      .run(userId);

    logService.info(
      `Deleted ${attachResult.changes} attachments`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    await yieldToEventLoop();

    // Create progress bar for delete
    const deleteProgressBar = createProgressBar("Deleting");
    deleteProgressBar.start(messageCount, 0);

    // Delete messages in batches to keep UI responsive
    let totalDeleted = 0;
    const deleteStmt = db.prepare(`
      DELETE FROM messages
      WHERE id IN (
        SELECT id FROM messages
        WHERE user_id = ? AND external_id IS NOT NULL
        LIMIT ?
      )
    `);

    while (totalDeleted < messageCount) {
      const result = deleteStmt.run(userId, DELETE_BATCH_SIZE);
      totalDeleted += result.changes;

      // Update progress bar
      deleteProgressBar.update(totalDeleted);

      // Report progress to UI
      const percent = Math.round((totalDeleted / messageCount) * 100);
      onProgress?.({
        phase: "deleting",
        current: totalDeleted,
        total: messageCount,
        percent,
      });

      // Yield to event loop
      await yieldToEventLoop();

      // If no rows were deleted, we're done
      if (result.changes === 0) break;
    }

    // Stop progress bar
    deleteProgressBar.stop();

    logService.info(
      `Cleared ${totalDeleted} messages`,
      MacOSMessagesImportService.SERVICE_NAME
    );
  }

  /**
   * Get the directory path for message attachments
   */
  getAttachmentsDirectory(): string {
    return path.join(app.getPath("userData"), ATTACHMENTS_DIR);
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

  /**
   * Get attachments for a specific message (TASK-1012)
   */
  getAttachmentsByMessageId(messageId: string): MessageAttachment[] {
    const db = databaseService.getRawDatabase();
    const rows = db
      .prepare(
        `
        SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
        FROM attachments
        WHERE message_id = ?
      `
      )
      .all(messageId) as MessageAttachment[];
    return rows;
  }

  /**
   * Get attachments for multiple messages at once (TASK-1012)
   */
  getAttachmentsByMessageIds(messageIds: string[]): Map<string, MessageAttachment[]> {
    if (messageIds.length === 0) {
      return new Map();
    }

    const db = databaseService.getRawDatabase();
    const placeholders = messageIds.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `
        SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
        FROM attachments
        WHERE message_id IN (${placeholders})
      `
      )
      .all(...messageIds) as MessageAttachment[];

    // Group by message_id
    const result = new Map<string, MessageAttachment[]>();
    for (const row of rows) {
      const existing = result.get(row.message_id) || [];
      existing.push(row);
      result.set(row.message_id, existing);
    }
    return result;
  }

  /**
   * Read an attachment file as base64 for display (TASK-1012)
   * Returns null if file doesn't exist
   */
  getAttachmentAsBase64(storagePath: string): string | null {
    try {
      if (!fs.existsSync(storagePath)) {
        return null;
      }
      const buffer = fs.readFileSync(storagePath);
      return buffer.toString("base64");
    } catch (error) {
      logService.warn(
        `Failed to read attachment: ${error instanceof Error ? error.message : "Unknown"}`,
        MacOSMessagesImportService.SERVICE_NAME
      );
      return null;
    }
  }
}

/**
 * Attachment info returned from database (TASK-1012)
 */
export interface MessageAttachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}

// Export singleton instance
export const macOSMessagesImportService = new MacOSMessagesImportService();
export default macOSMessagesImportService;
