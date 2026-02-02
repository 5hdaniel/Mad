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
  attachmentsUpdated: number; // TASK-1122: Count of attachments with updated message_id after re-sync
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
const BATCH_SIZE = 500; // Messages per batch for storing
const DELETE_BATCH_SIZE = 5000; // Messages per delete batch (larger for efficiency)
const YIELD_INTERVAL = 1; // Yield every N batches (reduced from 2 for better UI responsiveness)
const MIN_QUERY_BATCH_SIZE = 10000; // Minimum query batch size

/**
 * Calculate dynamic query batch size based on total message count.
 * Larger imports use larger batches to reduce overhead from yielding/progress updates.
 *
 * - Under 100K messages: 10% of total (min 10K)
 * - 100K - 200K messages: 15% of total
 * - Over 200K messages: 20% of total
 */
function calculateQueryBatchSize(totalMessages: number): number {
  let percentage: number;
  if (totalMessages < 100000) {
    percentage = 0.10; // 10%
  } else if (totalMessages <= 200000) {
    percentage = 0.15; // 15%
  } else {
    percentage = 0.20; // 20%
  }

  const calculated = Math.floor(totalMessages * percentage);
  return Math.max(calculated, MIN_QUERY_BATCH_SIZE);
}

// Attachment constants (TASK-1012, expanded TASK-1122 to include videos)
const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".heic", ".webp", ".bmp", ".tiff", ".tif"];
const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"];
const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".caf"]; // caf = Core Audio Format (iOS voice messages)
const SUPPORTED_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf"];
const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
];
const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB max per attachment (increased for videos)
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
 * Chat account info - maps chat to user's identifier (phone/Apple ID)
 */
interface ChatAccountRow {
  chat_id: number;
  account_login: string | null;
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
 * Check if a file extension is a supported media type
 * TASK-1122: Expanded to include videos, audio, and documents
 */
function isSupportedMediaType(filename: string | null): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Check if a file extension is a supported image type (for inline display)
 */
function isSupportedImageType(filename: string | null): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Get MIME type from filename
 * TASK-1122: Expanded to support videos, audio, and documents
 */
function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    // Videos
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    // Audio
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".caf": "audio/x-caf",
    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
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
        attachmentsUpdated: 0,
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
        attachmentsUpdated: 0,
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
   * Request cancellation of the current import (TASK-1710)
   * The import will stop at the next batch boundary, preserving partial data
   */
  requestCancellation(): void {
    if (this.isImporting) {
      logService.info(
        "Import cancellation requested",
        MacOSMessagesImportService.SERVICE_NAME
      );
      this.cancelCurrentImport = true;
    }
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
        attachmentsUpdated: 0,
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
        attachmentsUpdated: 0,
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

        // Calculate dynamic batch size based on total messages
        const queryBatchSize = calculateQueryBatchSize(totalMessageCount);

        logService.info(
          `Found ${totalMessageCount} messages in macOS Messages, fetching in batches of ${queryBatchSize}`,
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

        // Query chat account_login to get user's identifier (phone/Apple ID) for each chat
        // This tells us which of the user's identifiers they're using in each conversation
        const chatAccountRows = await dbAll<ChatAccountRow>(`
          SELECT
            ROWID as chat_id,
            account_login
          FROM chat
          WHERE account_login IS NOT NULL
        `);

        // Build a map of chat_id -> user's account_login (phone number or email)
        // account_login has prefixes: "P:" for phone, "E:" for email - strip them
        const chatAccountMap = new Map<number, string>();
        for (const row of chatAccountRows) {
          if (row.account_login) {
            // Strip "P:" or "E:" prefix from account_login
            let identifier = row.account_login;
            if (identifier.startsWith("P:") || identifier.startsWith("E:")) {
              identifier = identifier.substring(2);
            }
            if (identifier) {
              chatAccountMap.set(row.chat_id, identifier);
            }
          }
        }

        logService.info(
          `Loaded ${chatAccountMap.size} chat account mappings`,
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
              attachmentsUpdated: 0,
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
          `, [lastRowId, queryBatchSize]);

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
        const messageResult = await this.storeMessages(userId, allMessages, chatMembersMap, chatAccountMap, onProgress);

        // Store attachments (TASK-1012)
        const attachmentResult = await this.storeAttachments(userId, attachments, messageResult.messageIdMap, onProgress);

        const duration = Date.now() - startTime;

        // TASK-1050: Enhanced summary logging with thread_id validation stats
        // TASK-1122: Include attachments updated count for re-sync scenarios
        logService.info(
          "Import summary",
          MacOSMessagesImportService.SERVICE_NAME,
          {
            totalMessages: messageResult.stored + messageResult.skipped,
            imported: messageResult.stored,
            skipped: messageResult.skipped,
            nullThreadIdCount: messageResult.nullThreadIdCount,
            attachmentsImported: attachmentResult.stored,
            attachmentsUpdated: attachmentResult.updated,
            attachmentsSkipped: attachmentResult.skipped,
            duration,
          }
        );

        // Log warning if significant NULL thread_id count
        if (messageResult.nullThreadIdCount > 0) {
          const percentNull = ((messageResult.nullThreadIdCount / (messageResult.stored + messageResult.skipped)) * 100).toFixed(2);
          logService.warn(
            `Import found ${messageResult.nullThreadIdCount} messages with NULL thread_id (${percentNull}% of total)`,
            MacOSMessagesImportService.SERVICE_NAME
          );
        }

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
          attachmentsUpdated: attachmentResult.updated,
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
        attachmentsUpdated: 0,
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
    chatAccountMap: Map<number, string>,
    onProgress?: ImportProgressCallback
  ): Promise<{ stored: number; skipped: number; nullThreadIdCount: number; messageIdMap: Map<string, string> }> {
    // Map of macOS message GUID -> internal message ID (TASK-1012)
    const messageIdMap = new Map<string, string>();

    if (messages.length === 0) {
      return { stored: 0, skipped: 0, nullThreadIdCount: 0, messageIdMap };
    }

    let stored = 0;
    let skipped = 0;
    let nullThreadIdCount = 0;

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
      // TASK-PERF: Wrap each message parsing in try-catch to prevent stack overflow
      // from a single malformed message killing the entire import
      const messageTexts = new Map<string, string>();
      for (const msg of batch) {
        if (msg.guid && isValidGuid(msg.guid) && !existingIds.has(msg.guid)) {
          try {
            const text = await getMessageText({
              text: msg.text,
              attributedBody: msg.attributedBody,
              cache_has_attachments: msg.cache_has_attachments,
            });
            messageTexts.set(msg.guid, text);
          } catch (parseError) {
            // Log but don't fail the entire import for one malformed message
            // This catches stack overflow errors from malformed plist/typedstream data
            logService.warn(
              `Failed to parse message text, using fallback`,
              MacOSMessagesImportService.SERVICE_NAME,
              {
                guid: msg.guid,
                error: parseError instanceof Error ? parseError.message : "Unknown error",
                hasAttributedBody: !!msg.attributedBody,
                attributedBodyLength: msg.attributedBody?.length ?? 0,
              }
            );
            // Use empty string - the message will be skipped later due to content filter
            messageTexts.set(msg.guid, "[Unable to parse message]");
          }
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

          // TASK-1050: Track messages with NULL thread_id for debugging
          if (!threadId) {
            nullThreadIdCount++;
            logService.warn(
              "Message has NULL chat_id, will have NULL thread_id",
              MacOSMessagesImportService.SERVICE_NAME,
              {
                messageGuid: msg.guid,
                handleId: msg.handle_id,
                sentAt: macTimestampToDate(msg.date).toISOString(),
                // Don't log text content for privacy
              }
            );
          }

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

          // Get user's identifier for this chat (phone number or Apple ID like "magicauditwa")
          // This is what the user actually appears as in the conversation
          const userAccountLogin = msg.chat_id ? chatAccountMap.get(msg.chat_id) : undefined;

          // Build participants JSON with actual chat members
          // For outbound messages, use the user's actual identifier instead of "me"
          const participantsObj = {
            from: msg.is_from_me === 1 ? (userAccountLogin || "me") : sanitizedHandle,
            to: msg.is_from_me === 1 ? [sanitizedHandle] : [(userAccountLogin || "me")],
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

      // Report progress to UI - throttle to every 10 batches to reduce IPC overhead
      if (batchNum % 10 === 0 || batchNum === totalBatches - 1) {
        onProgress?.({
          phase: "importing",
          current: end,
          total: messages.length,
          percent: Math.round((end / messages.length) * 100),
        });
      }

      // Yield to event loop every N batches
      if ((batchNum + 1) % YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    // Stop progress bar
    msgProgressBar.stop();

    return { stored, skipped, nullThreadIdCount, messageIdMap };
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
  ): Promise<{ stored: number; skipped: number; updated: number }> {
    if (attachments.length === 0) {
      return { stored: 0, skipped: 0, updated: 0 };
    }

    let stored = 0;
    let skipped = 0;
    let updated = 0;

    // Get database instance
    const db = databaseService.getRawDatabase();

    // Create attachments directory if it doesn't exist
    const attachmentsDir = path.join(app.getPath("userData"), ATTACHMENTS_DIR);
    await fs.promises.mkdir(attachmentsDir, { recursive: true });

    // Load existing attachment hashes for deduplication (file content)
    const existingHashes = new Set<string>();
    const existingHashRows = db
      .prepare(`SELECT storage_path FROM attachments WHERE storage_path IS NOT NULL`)
      .all() as { storage_path: string }[];

    // Extract hash from storage path (filename is the hash)
    for (const row of existingHashRows) {
      const filename = path.basename(row.storage_path, path.extname(row.storage_path));
      existingHashes.add(filename);
    }

    // Load existing attachment records for deduplication (message_id + filename)
    const existingAttachmentRecords = new Set<string>();
    const existingAttachRows = db
      .prepare(`SELECT message_id, filename FROM attachments WHERE message_id IS NOT NULL`)
      .all() as { message_id: string; filename: string }[];

    for (const row of existingAttachRows) {
      existingAttachmentRecords.add(`${row.message_id}:${row.filename}`);
    }

    // TASK-1122: Load existing attachments by external_message_id for stable deduplication
    // This allows us to find and UPDATE attachments with stale message_ids after re-sync
    const existingByExternalId = new Map<string, { id: string; message_id: string }>();
    const existingExternalRows = db
      .prepare(`SELECT id, message_id, external_message_id, filename FROM attachments WHERE external_message_id IS NOT NULL`)
      .all() as { id: string; message_id: string; external_message_id: string; filename: string }[];

    for (const row of existingExternalRows) {
      // Key: external_message_id:filename for unique identification
      existingByExternalId.set(`${row.external_message_id}:${row.filename}`, {
        id: row.id,
        message_id: row.message_id,
      });
    }

    logService.info(
      `Processing ${attachments.length} attachments, ${existingHashes.size} already stored`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // Create progress bar for attachments
    const attachProgressBar = createProgressBar("Attachments");
    attachProgressBar.start(attachments.length, 0);

    // Prepare insert statement (TASK-1110: include external_message_id for stable linking)
    const insertAttachmentStmt = db.prepare(`
      INSERT OR IGNORE INTO attachments (
        id, message_id, external_message_id, filename, mime_type, file_size_bytes, storage_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // TASK-1122: Prepare update statement for fixing stale message_ids
    const updateMessageIdStmt = db.prepare(`
      UPDATE attachments SET message_id = ? WHERE id = ?
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
        // Skip unsupported attachment types (TASK-1122: expanded to include videos, audio, documents)
        const filename = attachment.transfer_name || attachment.filename;
        if (!isSupportedMediaType(filename)) {
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

        // Check if attachment record already exists for this message + filename
        const attachmentKey = `${internalMessageId}:${filename}`;
        if (existingAttachmentRecords.has(attachmentKey)) {
          // Attachment record already exists with correct message_id, skip
          skipped++;
          processed++;
          continue;
        }

        // TASK-1122: Check if attachment exists by external_message_id (stable identifier)
        // If so, update its message_id to the new internal ID (fixes stale references after re-sync)
        const externalKey = `${attachment.message_guid}:${filename}`;
        const existingByExternal = existingByExternalId.get(externalKey);
        if (existingByExternal) {
          // Attachment exists but may have stale message_id
          if (existingByExternal.message_id !== internalMessageId) {
            // Update the stale message_id to the new internal ID
            updateMessageIdStmt.run(internalMessageId, existingByExternal.id);
            updated++;
            logService.debug(
              `Updated stale attachment message_id: ${existingByExternal.id}`,
              MacOSMessagesImportService.SERVICE_NAME,
              { oldMessageId: existingByExternal.message_id, newMessageId: internalMessageId }
            );
          } else {
            // message_id is already correct, count as skipped
            skipped++;
          }
          // Update our tracking sets
          existingAttachmentRecords.add(attachmentKey);
          processed++;
          continue;
        }

        // Skip if we already have this content
        if (existingHashes.has(contentHash)) {
          // File already exists - just link to existing file
          const ext = path.extname(filename!);
          const existingPath = path.join(attachmentsDir, `${contentHash}${ext}`);

          // Create attachment record linking to existing file
          // TASK-1110: Include external_message_id (macOS message GUID) for stable linking
          const attachmentId = crypto.randomUUID();
          insertAttachmentStmt.run(
            attachmentId,
            internalMessageId,
            attachment.message_guid, // external_message_id for stable linking
            filename,
            attachment.mime_type || getMimeTypeFromFilename(filename!),
            attachment.total_bytes,
            existingPath
          );
          existingAttachmentRecords.add(attachmentKey);
          stored++;
          processed++;
          continue;
        }

        // Copy file to app data directory with hash as filename (async)
        const ext = path.extname(filename!);
        const destPath = path.join(attachmentsDir, `${contentHash}${ext}`);
        await fs.promises.copyFile(sourcePath, destPath);

        // Insert attachment record
        // TASK-1110: Include external_message_id (macOS message GUID) for stable linking
        const attachmentId = crypto.randomUUID();
        insertAttachmentStmt.run(
          attachmentId,
          internalMessageId,
          attachment.message_guid, // external_message_id for stable linking
          filename,
          attachment.mime_type || getMimeTypeFromFilename(filename!),
          attachment.total_bytes,
          destPath
        );

        existingAttachmentRecords.add(attachmentKey);
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
      `Attachments: ${stored} imported, ${updated} updated, ${skipped} skipped`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    return { stored, skipped, updated };
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
    // Delete by message_id for currently-linked attachments
    const attachResult1 = db
      .prepare(
        `
      DELETE FROM attachments
      WHERE message_id IN (
        SELECT id FROM messages WHERE user_id = ? AND external_id IS NOT NULL
      )
    `
      )
      .run(userId);

    // Also delete orphaned attachments by external_message_id
    // This catches attachments from previous imports where message_id is now stale
    const attachResult2 = db
      .prepare(
        `
      DELETE FROM attachments
      WHERE external_message_id IN (
        SELECT external_id FROM messages WHERE user_id = ? AND external_id IS NOT NULL
      )
    `
      )
      .run(userId);

    const attachmentsDeleted = attachResult1.changes + attachResult2.changes;
    logService.info(
      `Deleted ${attachmentsDeleted} attachments (${attachResult1.changes} by message_id, ${attachResult2.changes} by external_id)`,
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
   * TASK-1110: Query by both message_id and external_message_id for backward compatibility
   */
  getAttachmentsByMessageId(messageId: string): MessageAttachment[] {
    const db = databaseService.getRawDatabase();

    // First try direct message_id lookup
    let rows = db
      .prepare(
        `
        SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
        FROM attachments
        WHERE message_id = ?
      `
      )
      .all(messageId) as MessageAttachment[];

    // If no results and this is a valid message, try external_message_id fallback
    // TASK-1110: This handles the case where attachments have stale message_id but valid external_message_id
    if (rows.length === 0) {
      // Look up the message's external_id (macOS GUID)
      const message = db
        .prepare(`SELECT external_id FROM messages WHERE id = ?`)
        .get(messageId) as { external_id: string } | undefined;

      if (message?.external_id) {
        rows = db
          .prepare(
            `
            SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
            FROM attachments
            WHERE external_message_id = ?
          `
          )
          .all(message.external_id) as MessageAttachment[];

        // If found via external_message_id, update the message_id for future queries
        if (rows.length > 0) {
          logService.info(
            `[Attachments] Found ${rows.length} attachments via external_message_id fallback, updating message_id`,
            MacOSMessagesImportService.SERVICE_NAME
          );
          const updateStmt = db.prepare(`UPDATE attachments SET message_id = ? WHERE external_message_id = ?`);
          updateStmt.run(messageId, message.external_id);
          // Update the returned rows to reflect the corrected message_id
          rows = rows.map(row => ({ ...row, message_id: messageId }));
        }
      }
    }

    return rows;
  }

  /**
   * Get attachments for multiple messages at once (TASK-1012)
   * TASK-1110: Query by both message_id and external_message_id for backward compatibility
   */
  getAttachmentsByMessageIds(messageIds: string[]): Map<string, MessageAttachment[]> {
    if (messageIds.length === 0) {
      return new Map();
    }

    const db = databaseService.getRawDatabase();
    const result = new Map<string, MessageAttachment[]>();

    // Debug: Log total attachments in DB and sample message_ids
    const totalCount = db.prepare(`SELECT COUNT(*) as count FROM attachments`).get() as { count: number };
    logService.debug(
      `[Attachments Debug] Total: ${totalCount.count}, Querying: ${messageIds.length} IDs`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // First, try direct message_id lookup
    const placeholders = messageIds.map(() => "?").join(", ");
    const directRows = db
      .prepare(
        `
        SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
        FROM attachments
        WHERE message_id IN (${placeholders})
      `
      )
      .all(...messageIds) as MessageAttachment[];

    // Group direct results by message_id
    for (const row of directRows) {
      const existing = result.get(row.message_id) || [];
      existing.push(row);
      result.set(row.message_id, existing);
    }

    // TASK-1110: For messages without direct results, try external_message_id fallback
    const missingMessageIds = messageIds.filter(id => !result.has(id));

    if (missingMessageIds.length > 0) {
      // Look up external_ids for messages that didn't have direct matches
      const missingPlaceholders = missingMessageIds.map(() => "?").join(", ");
      const messageExternalIds = db
        .prepare(
          `SELECT id, external_id FROM messages WHERE id IN (${missingPlaceholders}) AND external_id IS NOT NULL`
        )
        .all(...missingMessageIds) as { id: string; external_id: string }[];

      if (messageExternalIds.length > 0) {
        // Query attachments by external_message_id
        const externalIds = messageExternalIds.map(m => m.external_id);
        const externalPlaceholders = externalIds.map(() => "?").join(", ");
        const fallbackRows = db
          .prepare(
            `
            SELECT id, message_id, external_message_id, filename, mime_type, file_size_bytes, storage_path
            FROM attachments
            WHERE external_message_id IN (${externalPlaceholders})
          `
          )
          .all(...externalIds) as (MessageAttachment & { external_message_id: string })[];

        // Build a map of external_id -> internal message id for updating
        const externalToInternalMap = new Map<string, string>();
        for (const msg of messageExternalIds) {
          externalToInternalMap.set(msg.external_id, msg.id);
        }

        // Group fallback results and update stale message_ids
        const attachmentsToUpdate: { attachmentId: string; newMessageId: string; externalMessageId: string }[] = [];

        for (const row of fallbackRows) {
          const internalMessageId = externalToInternalMap.get(row.external_message_id);
          if (internalMessageId) {
            // Update the row's message_id to the correct internal ID
            const correctedRow: MessageAttachment = {
              id: row.id,
              message_id: internalMessageId,
              filename: row.filename,
              mime_type: row.mime_type,
              file_size_bytes: row.file_size_bytes,
              storage_path: row.storage_path,
            };

            const existing = result.get(internalMessageId) || [];
            existing.push(correctedRow);
            result.set(internalMessageId, existing);

            // Track for batch update
            attachmentsToUpdate.push({
              attachmentId: row.id,
              newMessageId: internalMessageId,
              externalMessageId: row.external_message_id,
            });
          }
        }

        // Batch update stale message_ids for future queries
        if (attachmentsToUpdate.length > 0) {
          logService.info(
            `[Attachments] Found ${attachmentsToUpdate.length} attachments via external_message_id fallback, updating message_ids`,
            MacOSMessagesImportService.SERVICE_NAME
          );
          const updateStmt = db.prepare(`UPDATE attachments SET message_id = ? WHERE id = ?`);
          const updateMany = db.transaction((updates: typeof attachmentsToUpdate) => {
            for (const update of updates) {
              updateStmt.run(update.newMessageId, update.attachmentId);
            }
          });
          updateMany(attachmentsToUpdate);
        }
      }
    }

    logService.debug(
      `[Attachments Debug] Found ${Array.from(result.values()).reduce((sum, arr) => sum + arr.length, 0)} attachments total`,
      MacOSMessagesImportService.SERVICE_NAME
    );

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

  /**
   * Repair attachment message_id mappings without full re-import.
   * Looks up correct message IDs via external_id (iMessage GUID) from macOS Messages DB.
   * @returns Stats on repaired/orphaned attachments
   */
  async repairAttachmentMessageIds(): Promise<{
    total: number;
    repaired: number;
    orphaned: number;
    alreadyCorrect: number;
  }> {
    const db = databaseService.getRawDatabase();
    const stats = { total: 0, repaired: 0, orphaned: 0, alreadyCorrect: 0 };

    // Get all attachments with their storage paths
    const attachments = db
      .prepare(`SELECT id, message_id, storage_path FROM attachments`)
      .all() as { id: string; message_id: string; storage_path: string | null }[];

    stats.total = attachments.length;

    if (attachments.length === 0) {
      logService.info(
        `[Repair] No attachments to repair`,
        MacOSMessagesImportService.SERVICE_NAME
      );
      return stats;
    }

    // Build message external_id -> internal id map
    const messageMap = new Map<string, string>();
    const messageRows = db
      .prepare(`SELECT id, external_id FROM messages WHERE external_id IS NOT NULL`)
      .all() as { id: string; external_id: string }[];
    for (const row of messageRows) {
      messageMap.set(row.external_id, row.id);
    }

    logService.info(
      `[Repair] Checking ${attachments.length} attachments against ${messageMap.size} messages`,
      MacOSMessagesImportService.SERVICE_NAME
    );

    // Query macOS Messages DB to get attachment -> message_guid mapping
    const messagesDbPath = path.join(process.env.HOME!, "Library/Messages/chat.db");
    if (!fs.existsSync(messagesDbPath)) {
      logService.error(
        `[Repair] Cannot access macOS Messages database`,
        MacOSMessagesImportService.SERVICE_NAME
      );
      return stats;
    }

    try {
      // Open macOS Messages database using sqlite3 (same as import)
      const macDb = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
      const dbAll = promisify(macDb.all.bind(macDb)) as <T>(sql: string) => Promise<T[]>;

      // Build attachment filename -> message_guid map from macOS Messages DB
      const macAttachments = await dbAll<{ filename: string; message_guid: string }>(`
        SELECT
          attachment.filename,
          message.guid as message_guid
        FROM attachment
        JOIN message_attachment_join ON attachment.ROWID = message_attachment_join.attachment_id
        JOIN message ON message.ROWID = message_attachment_join.message_id
        WHERE attachment.filename IS NOT NULL AND message.guid IS NOT NULL
      `);

      // Map by basename for matching (our storage uses content hash, but original filename is in the path)
      const filenameToGuid = new Map<string, string>();
      for (const att of macAttachments) {
        // Extract just the filename from the full path
        const basename = path.basename(att.filename);
        filenameToGuid.set(basename, att.message_guid);
      }

      logService.info(
        `[Repair] Found ${filenameToGuid.size} attachment mappings in macOS Messages DB`,
        MacOSMessagesImportService.SERVICE_NAME
      );

      // Close macOS database
      await promisify(macDb.close.bind(macDb))();

      // Prepare update statement
      const updateStmt = db.prepare(`UPDATE attachments SET message_id = ? WHERE id = ?`);

      // Check each attachment
      for (const att of attachments) {
        // First check if current message_id is valid
        const currentMsgExists = db
          .prepare(`SELECT 1 FROM messages WHERE id = ?`)
          .get(att.message_id);

        if (currentMsgExists) {
          stats.alreadyCorrect++;
          continue;
        }

        // Current message_id is invalid - try to find correct one
        // Extract original filename from storage path (stored files keep original name in metadata)
        // Our storage uses hash as filename, so we need to look at the attachment record's original filename
        const originalFilename = db
          .prepare(`SELECT filename FROM attachments WHERE id = ?`)
          .get(att.id) as { filename: string } | undefined;

        if (!originalFilename?.filename) {
          stats.orphaned++;
          continue;
        }

        // Look up the message GUID for this attachment
        const messageGuid = filenameToGuid.get(originalFilename.filename);
        if (!messageGuid) {
          stats.orphaned++;
          continue;
        }

        // Look up our internal message ID
        const internalId = messageMap.get(messageGuid);
        if (!internalId) {
          stats.orphaned++;
          continue;
        }

        // Update the attachment's message_id
        updateStmt.run(internalId, att.id);
        stats.repaired++;
      }

      logService.info(
        `[Repair] Complete: ${stats.repaired} repaired, ${stats.alreadyCorrect} already correct, ${stats.orphaned} orphaned`,
        MacOSMessagesImportService.SERVICE_NAME
      );
    } catch (error) {
      logService.error(
        `[Repair] Error: ${error instanceof Error ? error.message : "Unknown"}`,
        MacOSMessagesImportService.SERVICE_NAME
      );
    }

    return stats;
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
