/**
 * Attachment Handling Helpers
 * Functions for querying and managing attachments during export.
 * Extracted from folderExportService.ts for maintainability.
 */

import databaseService from "../databaseService";
import logService from "../logService";

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
