/**
 * Attachment Handling Helpers
 * Functions for querying and managing attachments during export.
 * Extracted from folderExportService.ts for maintainability.
 *
 * TASK-2050: Added email attachment export to thread directories
 */

import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import databaseService from "../databaseService";
import logService from "../logService";
import type { Communication } from "../../types/models";
import { isEmailMessage } from "../../utils/channelHelpers";

/**
 * Get attachments for a specific message
 * Used for embedding images inline in text thread PDFs
 *
 * Includes external_message_id fallback for when message_id is stale after re-import
 * @param messageId - Internal message UUID
 * @param externalId - Optional macOS GUID for fallback lookup
 */
export function getAttachmentsForMessage(messageId: string, externalId?: string): {
  id: string;
  filename: string;
  mime_type: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
}[] {
  try {
    const db = databaseService.getRawDatabase();

    // First try direct message_id lookup
    const sql = `
        SELECT id, filename, mime_type, storage_path, file_size_bytes
        FROM attachments
        WHERE message_id = ?
      `;
    let rows = db.prepare(sql).all(messageId) as {
      id: string;
      filename: string;
      mime_type: string | null;
      storage_path: string | null;
      file_size_bytes: number | null;
    }[];

    // If no results, try external_message_id fallback
    // After re-import, message IDs change but external_message_id (macOS GUID) is stable
    if (rows.length === 0) {
      // Use provided externalId or look it up from messages table
      let lookupExternalId = externalId;
      if (!lookupExternalId) {
        const messageRow = db.prepare(
          `SELECT external_id FROM messages WHERE id = ?`
        ).get(messageId) as { external_id: string | null } | undefined;
        lookupExternalId = messageRow?.external_id || undefined;
      }

      if (lookupExternalId) {
        rows = db.prepare(`
            SELECT id, filename, mime_type, storage_path, file_size_bytes
            FROM attachments
            WHERE external_message_id = ?
          `).all(lookupExternalId) as typeof rows;

        // If found via fallback, update the stale message_id for future queries
        if (rows.length > 0) {
          logService.debug(
            `[Folder Export] Found ${rows.length} attachments via external_message_id fallback`,
            "FolderExport",
            { messageId, externalId: lookupExternalId }
          );
          const updateStmt = db.prepare(
            `UPDATE attachments SET message_id = ? WHERE external_message_id = ?`
          );
          updateStmt.run(messageId, lookupExternalId);
        }
      }
    }

    return rows;
  } catch (error) {
    logService.warn("[Folder Export] Failed to get attachments for message", "FolderExport", {
      messageId,
      error,
    });
    return [];
  }
}

/**
 * TASK-1780: Get attachments for an email by email_id
 * @param emailId - Email UUID
 */
export function getAttachmentsForEmail(emailId: string): {
  id: string;
  filename: string;
  mime_type: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
}[] {
  try {
    const db = databaseService.getRawDatabase();
    const sql = `
        SELECT id, filename, mime_type, storage_path, file_size_bytes
        FROM attachments
        WHERE email_id = ?
      `;
    return db.prepare(sql).all(emailId) as {
      id: string;
      filename: string;
      mime_type: string | null;
      storage_path: string | null;
      file_size_bytes: number | null;
    }[];
  } catch (error) {
    logService.warn("[Folder Export] Failed to get attachments for email", "FolderExport", {
      emailId,
      error,
    });
    return [];
  }
}

/**
 * Sanitize filename to remove invalid characters
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9_\-\.]/gi, "_")
    .replace(/_+/g, "_")
    .substring(0, 100);
}

/**
 * TASK-2050: Resolve filename conflicts within a directory.
 * If a file with the same name already exists, append a counter:
 * report.pdf -> report (1).pdf -> report (2).pdf
 */
export function resolveFilenameConflict(dir: string, filename: string): string {
  let candidate = sanitizeFileName(filename);
  let counter = 1;

  while (fsSync.existsSync(path.join(dir, candidate))) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    candidate = sanitizeFileName(`${base} (${counter})${ext}`);
    counter++;
  }

  return candidate;
}

/**
 * TASK-2050: Result of exporting email attachments to thread directories
 */
export interface AttachmentExportResult {
  exported: number;
  skipped: number;
  totalSizeBytes: number;
  errors: string[];
  items: Array<{
    emailId: string;
    threadId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    exportPath: string;
    status: "exported" | "skipped" | "error";
  }>;
}

/**
 * TASK-2050: Export email attachments into per-thread subdirectories.
 *
 * Creates structure:
 *   emails/<thread-dir>/attachments/<filename>
 *
 * For each email in the provided communications:
 * 1. Look up attachments in the local database via email_id
 * 2. Copy attachment files from local cache to the export directory
 * 3. Handle filename conflicts for duplicates within the same thread
 * 4. Skip missing/inaccessible attachments gracefully
 * 5. Log warning if total size exceeds 50MB
 */
export async function exportEmailAttachmentsToThreadDirs(
  emails: Communication[],
  emailsExportPath: string,
): Promise<AttachmentExportResult> {
  const result: AttachmentExportResult = {
    exported: 0,
    skipped: 0,
    totalSizeBytes: 0,
    errors: [],
    items: [],
  };

  // Group emails by thread for directory structure
  const threadMap = new Map<string, Communication[]>();
  for (const email of emails) {
    if (!isEmailMessage(email)) continue;
    // Use thread_id if available, otherwise use email id as thread key
    const threadKey = email.thread_id || email.id || "unknown";
    const thread = threadMap.get(threadKey) || [];
    thread.push(email);
    threadMap.set(threadKey, thread);
  }

  // Track filenames per thread directory to avoid conflicts
  const usedFilenamesPerThread = new Map<string, Set<string>>();

  for (const [threadKey, threadEmails] of threadMap) {
    const threadDirName = sanitizeFileName(threadKey);

    for (const email of threadEmails) {
      if (!email.id) continue;

      // Get attachments for this email from database
      const attachments = getAttachmentsForEmail(email.id);
      if (attachments.length === 0) continue;

      // Create attachments subdirectory inside the thread directory
      const attachDir = path.join(emailsExportPath, threadDirName, "attachments");
      await fs.mkdir(attachDir, { recursive: true });

      // Get or create used filenames set for this thread
      if (!usedFilenamesPerThread.has(threadDirName)) {
        usedFilenamesPerThread.set(threadDirName, new Set<string>());
      }
      const usedFilenames = usedFilenamesPerThread.get(threadDirName)!;

      for (const att of attachments) {
        const originalFilename = att.filename || `attachment_${result.items.length + 1}`;

        try {
          if (!att.storage_path) {
            result.skipped++;
            const errorMsg = `Missing storage path: ${originalFilename} (email ${email.id})`;
            result.errors.push(errorMsg);
            result.items.push({
              emailId: email.id,
              threadId: threadKey,
              filename: originalFilename,
              contentType: att.mime_type || "application/octet-stream",
              sizeBytes: att.file_size_bytes || 0,
              exportPath: "",
              status: "skipped",
            });
            continue;
          }

          // Check if source file exists
          try {
            await fs.access(att.storage_path);
          } catch {
            result.skipped++;
            const errorMsg = `File not found: ${originalFilename} at ${att.storage_path}`;
            result.errors.push(errorMsg);
            result.items.push({
              emailId: email.id,
              threadId: threadKey,
              filename: originalFilename,
              contentType: att.mime_type || "application/octet-stream",
              sizeBytes: att.file_size_bytes || 0,
              exportPath: "",
              status: "skipped",
            });
            continue;
          }

          // Resolve filename conflicts within this thread's attachments dir
          let exportFilename = sanitizeFileName(originalFilename);
          let counter = 1;
          const baseName = exportFilename.replace(/\.[^.]+$/, "");
          const extension = exportFilename.includes(".")
            ? exportFilename.slice(exportFilename.lastIndexOf("."))
            : "";

          while (usedFilenames.has(exportFilename)) {
            exportFilename = sanitizeFileName(`${baseName} (${counter})${extension}`);
            counter++;
          }
          usedFilenames.add(exportFilename);

          const destPath = path.join(attachDir, exportFilename);
          const relativePath = path.join(threadDirName, "attachments", exportFilename);

          // Copy file (streaming via fs.copyFile -- no buffering in memory)
          await fs.copyFile(att.storage_path, destPath);

          const fileSize = att.file_size_bytes || 0;
          result.exported++;
          result.totalSizeBytes += fileSize;
          result.items.push({
            emailId: email.id,
            threadId: threadKey,
            filename: exportFilename,
            contentType: att.mime_type || "application/octet-stream",
            sizeBytes: fileSize,
            exportPath: relativePath,
            status: "exported",
          });
        } catch (error) {
          result.skipped++;
          const errorMsg = `Failed: ${originalFilename} - ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          result.items.push({
            emailId: email.id,
            threadId: threadKey,
            filename: originalFilename,
            contentType: att.mime_type || "application/octet-stream",
            sizeBytes: att.file_size_bytes || 0,
            exportPath: "",
            status: "error",
          });
        }
      }
    }
  }

  // Size warning
  const SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024; // 50MB
  if (result.totalSizeBytes > SIZE_WARNING_THRESHOLD) {
    logService.warn(
      `[Folder Export] Email attachments total ${(result.totalSizeBytes / 1024 / 1024).toFixed(1)}MB -- export may be large`,
      "FolderExport"
    );
  }

  logService.info(
    `[Folder Export] Email attachments export: ${result.exported} exported, ${result.skipped} skipped`,
    "FolderExport",
    {
      exported: result.exported,
      skipped: result.skipped,
      totalSizeBytes: result.totalSizeBytes,
      errorCount: result.errors.length,
    }
  );

  return result;
}
