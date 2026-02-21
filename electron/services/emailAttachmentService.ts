/**
 * Email Attachment Service
 *
 * Downloads and stores email attachments from Gmail/Outlook APIs.
 * Follows the same pattern as macOSMessagesImportService for consistency.
 *
 * TASK-1775: Foundation service for email attachment handling
 *
 * Features:
 * - Download attachments from Gmail API
 * - Download attachments from Outlook/Graph API
 * - Content hash deduplication (same file = one copy)
 * - Storage in ~/Library/Application Support/Magic Audit/attachments/
 * - Database records in attachments table with email_id FK
 * - Path traversal protection via filename sanitization
 * - Per-attachment timeout (30s) to prevent hangs
 * - Non-blocking: failed downloads don't break email linking flow
 */

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { app } from "electron";
import databaseService from "./databaseService";
import gmailFetchService from "./gmailFetchService";
import outlookFetchService from "./outlookFetchService";
import logService from "./logService";
import { sanitizeFileSystemName } from "../utils/fileUtils";

// Constants
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB max per attachment
const ATTACHMENTS_DIR = "attachments"; // Directory name in app data (separate from message-attachments)
const DOWNLOAD_TIMEOUT_MS = 30000; // 30 second timeout per attachment

/**
 * Email attachment metadata from Gmail/Outlook APIs
 */
export interface EmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string; // Gmail attachment ID or Outlook attachment ID
}

/**
 * Result of downloading attachments for an email
 */
export interface DownloadResult {
  success: boolean;
  stored: number;
  skipped: number;
  errors: number;
  details: {
    filename: string;
    status: "stored" | "skipped" | "error";
    reason?: string;
  }[];
}



/**
 * Generate content hash for deduplication
 * Uses SHA-256 for consistency with macOS messages import
 */
function generateContentHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Guess file extension from MIME type
 */
function guessExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ".pptx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "text/plain": ".txt",
    "text/html": ".html",
    "text/csv": ".csv",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
    "application/octet-stream": ".bin",
  };
  return mimeToExt[mimeType] || ".bin";
}

/**
 * Download with timeout using AbortController
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Email Attachment Service
 * Downloads and stores email attachments from Gmail/Outlook
 */
class EmailAttachmentService {
  private static readonly SERVICE_NAME = "EmailAttachmentService";

  /**
   * Download and store attachments for an email
   *
   * @param userId - User ID for database records
   * @param emailId - Internal email ID (from emails table)
   * @param externalEmailId - External email ID (Gmail/Outlook message ID)
   * @param source - Email source ("gmail" or "outlook")
   * @param attachments - Array of attachment metadata from the email
   * @returns Download result with counts and details
   */
  async downloadEmailAttachments(
    userId: string,
    emailId: string,
    externalEmailId: string,
    source: "gmail" | "outlook",
    attachments: EmailAttachmentMeta[]
  ): Promise<DownloadResult> {
    const result: DownloadResult = {
      success: true,
      stored: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    if (!attachments || attachments.length === 0) {
      return result;
    }

    await logService.info(
      `Downloading ${attachments.length} attachments for email ${emailId}`,
      EmailAttachmentService.SERVICE_NAME,
      { source, externalEmailId }
    );

    // Ensure attachments directory exists
    const attachmentsDir = path.join(app.getPath("userData"), ATTACHMENTS_DIR);
    await fs.mkdir(attachmentsDir, { recursive: true });

    // Load existing content hashes for deduplication
    const existingHashes = await this.loadExistingHashes();

    for (const attachment of attachments) {
      try {
        const downloadResult = await this.processAttachment(
          userId,
          emailId,
          externalEmailId,
          source,
          attachment,
          attachmentsDir,
          existingHashes
        );

        result.details.push(downloadResult);

        if (downloadResult.status === "stored") {
          result.stored++;
        } else if (downloadResult.status === "skipped") {
          result.skipped++;
        } else {
          result.errors++;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        await logService.warn(
          `Failed to process attachment: ${attachment.filename}`,
          EmailAttachmentService.SERVICE_NAME,
          { error: errorMsg, emailId }
        );
        result.errors++;
        result.details.push({
          filename: attachment.filename,
          status: "error",
          reason: errorMsg,
        });
      }
    }

    await logService.info(
      `Attachment download complete: ${result.stored} stored, ${result.skipped} skipped, ${result.errors} errors`,
      EmailAttachmentService.SERVICE_NAME,
      { emailId }
    );

    return result;
  }

  /**
   * Process a single attachment: download, deduplicate, store
   */
  private async processAttachment(
    userId: string,
    emailId: string,
    externalEmailId: string,
    source: "gmail" | "outlook",
    attachment: EmailAttachmentMeta,
    attachmentsDir: string,
    existingHashes: Set<string>
  ): Promise<{ filename: string; status: "stored" | "skipped" | "error"; reason?: string }> {
    const sanitizedFilename = sanitizeFileSystemName(attachment.filename, "attachment");

    // Skip oversized attachments
    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      await logService.warn(
        `Skipping oversized attachment: ${sanitizedFilename} (${Math.round(attachment.size / 1024 / 1024)}MB)`,
        EmailAttachmentService.SERVICE_NAME
      );
      return {
        filename: sanitizedFilename,
        status: "skipped",
        reason: `Size ${Math.round(attachment.size / 1024 / 1024)}MB exceeds ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB limit`,
      };
    }

    // Check if attachment already exists for this email
    const existingAttachment = await this.getExistingAttachment(
      emailId,
      sanitizedFilename
    );
    if (existingAttachment) {
      return {
        filename: sanitizedFilename,
        status: "skipped",
        reason: "Attachment already exists for this email",
      };
    }

    // Download attachment with timeout
    let data: Buffer;
    try {
      data = await withTimeout(
        this.downloadAttachment(source, externalEmailId, attachment.attachmentId),
        DOWNLOAD_TIMEOUT_MS,
        `Download ${sanitizedFilename}`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Download failed";
      return {
        filename: sanitizedFilename,
        status: "error",
        reason: errorMsg,
      };
    }

    // Generate content hash for deduplication
    const contentHash = generateContentHash(data);

    // Determine storage path
    const ext =
      path.extname(sanitizedFilename) ||
      guessExtensionFromMimeType(attachment.mimeType);
    const storagePath = path.join(attachmentsDir, `${contentHash}${ext}`);

    // Check if file already exists (deduplication)
    const fileExists = existingHashes.has(contentHash);

    if (!fileExists) {
      // Write file to disk
      await fs.writeFile(storagePath, data);
      existingHashes.add(contentHash);
    }

    // Create database record
    await this.createAttachmentRecord(
      userId,
      emailId,
      externalEmailId,
      sanitizedFilename,
      attachment.mimeType,
      data.length,
      storagePath
    );

    return {
      filename: sanitizedFilename,
      status: "stored",
      reason: fileExists ? "File deduplicated, record created" : undefined,
    };
  }

  /**
   * Download attachment from Gmail or Outlook API
   */
  private async downloadAttachment(
    source: "gmail" | "outlook",
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    if (source === "gmail") {
      return gmailFetchService.getAttachment(messageId, attachmentId);
    } else {
      return outlookFetchService.getAttachment(messageId, attachmentId);
    }
  }

  /**
   * Load existing content hashes for deduplication
   */
  private async loadExistingHashes(): Promise<Set<string>> {
    const existingHashes = new Set<string>();

    try {
      const db = databaseService.getRawDatabase();
      const rows = db
        .prepare(
          `SELECT storage_path FROM attachments WHERE storage_path IS NOT NULL`
        )
        .all() as { storage_path: string }[];

      for (const row of rows) {
        // Extract hash from storage path (filename is the hash)
        const filename = path.basename(
          row.storage_path,
          path.extname(row.storage_path)
        );
        existingHashes.add(filename);
      }
    } catch (error) {
      await logService.warn(
        "Failed to load existing hashes, deduplication may create duplicates",
        EmailAttachmentService.SERVICE_NAME,
        { error }
      );
    }

    return existingHashes;
  }

  /**
   * Check if attachment already exists for this email
   */
  private async getExistingAttachment(
    emailId: string,
    filename: string
  ): Promise<boolean> {
    try {
      const db = databaseService.getRawDatabase();
      const row = db
        .prepare(
          `SELECT id FROM attachments WHERE email_id = ? AND filename = ?`
        )
        .get(emailId, filename);
      return !!row;
    } catch {
      // If email_id column doesn't exist yet, return false
      return false;
    }
  }

  /**
   * Create attachment record in database
   */
  private async createAttachmentRecord(
    userId: string,
    emailId: string,
    externalEmailId: string,
    filename: string,
    mimeType: string,
    fileSize: number,
    storagePath: string
  ): Promise<void> {
    const db = databaseService.getRawDatabase();
    const attachmentId = crypto.randomUUID();

    // Insert with email_id (new column for email attachments)
    // message_id is NULL for email attachments per SR Engineer migration clarification
    db.prepare(
      `
      INSERT INTO attachments (
        id, email_id, external_message_id, filename, mime_type, file_size_bytes, storage_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(
      attachmentId,
      emailId,
      externalEmailId,
      filename,
      mimeType,
      fileSize,
      storagePath
    );

    await logService.debug(
      `Created attachment record: ${filename}`,
      EmailAttachmentService.SERVICE_NAME,
      { attachmentId, emailId, storagePath }
    );
  }

  /**
   * Get attachments for an email
   */
  async getAttachmentsForEmail(
    emailId: string
  ): Promise<
    {
      id: string;
      filename: string;
      mime_type: string | null;
      file_size_bytes: number | null;
      storage_path: string | null;
    }[]
  > {
    try {
      const db = databaseService.getRawDatabase();
      return db
        .prepare(
          `
          SELECT id, filename, mime_type, file_size_bytes, storage_path
          FROM attachments
          WHERE email_id = ?
        `
        )
        .all(emailId) as {
        id: string;
        filename: string;
        mime_type: string | null;
        file_size_bytes: number | null;
        storage_path: string | null;
      }[];
    } catch (error) {
      await logService.warn(
        `Failed to get attachments for email ${emailId}`,
        EmailAttachmentService.SERVICE_NAME,
        { error }
      );
      return [];
    }
  }

  /**
   * Get the attachments directory path
   */
  getAttachmentsDirectory(): string {
    return path.join(app.getPath("userData"), ATTACHMENTS_DIR);
  }
}

// Export singleton instance
export const emailAttachmentService = new EmailAttachmentService();
export default emailAttachmentService;
