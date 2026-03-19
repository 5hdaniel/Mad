/**
 * Attachment Database Service
 * Handles all attachment-related database operations
 */

import { ensureDb } from "./core/dbConnection";

// ============================================
// ATTACHMENT CRUD OPERATIONS
// ============================================

/**
 * Get all attachment storage paths (for content hash deduplication).
 */
export function getAttachmentStoragePaths(): { storage_path: string }[] {
  const db = ensureDb();
  return db
    .prepare(`SELECT storage_path FROM attachments WHERE storage_path IS NOT NULL`)
    .all() as { storage_path: string }[];
}

/**
 * Check if an attachment already exists for a given email and filename.
 */
export function hasAttachmentForEmail(emailId: string, filename: string): boolean {
  const db = ensureDb();
  const row = db
    .prepare(`SELECT id FROM attachments WHERE email_id = ? AND filename = ?`)
    .get(emailId, filename);
  return !!row;
}

/**
 * Create an attachment record in the database.
 */
export function createAttachmentRecord(params: {
  id: string;
  emailId: string;
  externalEmailId: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
}): void {
  const db = ensureDb();
  db.prepare(
    `
    INSERT INTO attachments (
      id, email_id, external_message_id, filename, mime_type, file_size_bytes, storage_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run(
    params.id,
    params.emailId,
    params.externalEmailId,
    params.filename,
    params.mimeType,
    params.fileSizeBytes,
    params.storagePath
  );
}

/**
 * Get attachments for an email by email_id.
 */
export function getAttachmentsByEmailId(
  emailId: string
): {
  id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}[] {
  const db = ensureDb();
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
}

// ============================================
// FOLDER EXPORT ATTACHMENT QUERIES (TASK-2100)
// ============================================

/**
 * Get attachments for a text message by message_id, with fallback to external_message_id.
 */
export function getAttachmentsForMessageWithFallback(
  messageId: string,
  externalId?: string
): {
  id: string;
  filename: string;
  mime_type: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
}[] {
  const db = ensureDb();

  // Direct message_id lookup
  let rows = db
    .prepare(
      `SELECT id, filename, mime_type, storage_path, file_size_bytes
       FROM attachments WHERE message_id = ?`
    )
    .all(messageId) as {
    id: string;
    filename: string;
    mime_type: string | null;
    storage_path: string | null;
    file_size_bytes: number | null;
  }[];

  // Fallback to external_message_id
  if (rows.length === 0) {
    let lookupExternalId = externalId;
    if (!lookupExternalId) {
      const messageRow = db
        .prepare(`SELECT external_id FROM messages WHERE id = ?`)
        .get(messageId) as { external_id: string | null } | undefined;
      lookupExternalId = messageRow?.external_id || undefined;
    }

    if (lookupExternalId) {
      rows = db
        .prepare(
          `SELECT id, filename, mime_type, storage_path, file_size_bytes
           FROM attachments WHERE external_message_id = ?`
        )
        .all(lookupExternalId) as typeof rows;

      // Update stale message_id for future queries
      if (rows.length > 0) {
        db.prepare(
          `UPDATE attachments SET message_id = ? WHERE external_message_id = ?`
        ).run(messageId, lookupExternalId);
      }
    }
  }

  return rows;
}

/**
 * Get attachments for an email by email_id (folder export variant).
 */
export function getAttachmentsForEmailExport(
  emailId: string
): {
  id: string;
  filename: string;
  mime_type: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
}[] {
  const db = ensureDb();
  return db
    .prepare(
      `SELECT id, filename, mime_type, storage_path, file_size_bytes
       FROM attachments WHERE email_id = ?`
    )
    .all(emailId) as {
    id: string;
    filename: string;
    mime_type: string | null;
    storage_path: string | null;
    file_size_bytes: number | null;
  }[];
}

/**
 * Bulk query attachments by message_ids, external_message_ids, and email_ids.
 * Used by folderExportService for building attachment manifests.
 */
export function getAttachmentsForExportBulk(
  messageIds: string[],
  externalIds: string[],
  emailIds: string[]
): {
  id: string;
  message_id: string | null;
  email_id: string | null;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}[] {
  const db = ensureDb();
  type AttachmentRow = {
    id: string;
    message_id: string | null;
    email_id: string | null;
    filename: string;
    mime_type: string | null;
    file_size_bytes: number | null;
    storage_path: string | null;
  };
  let attachmentRows: AttachmentRow[] = [];

  if (messageIds.length > 0) {
    const placeholders = messageIds.map(() => "?").join(", ");
    const textRows = db
      .prepare(
        `SELECT id, message_id, NULL as email_id, filename, mime_type, file_size_bytes, storage_path
         FROM attachments WHERE message_id IN (${placeholders})`
      )
      .all(...messageIds) as AttachmentRow[];
    attachmentRows = [...attachmentRows, ...textRows];

    if (externalIds.length > 0) {
      const externalPlaceholders = externalIds.map(() => "?").join(", ");
      const fallbackRows = db
        .prepare(
          `SELECT id, message_id, NULL as email_id, filename, mime_type, file_size_bytes, storage_path
           FROM attachments
           WHERE external_message_id IN (${externalPlaceholders})
             AND id NOT IN (SELECT id FROM attachments WHERE message_id IN (${placeholders}))`
        )
        .all(...externalIds, ...messageIds) as AttachmentRow[];
      attachmentRows = [...attachmentRows, ...fallbackRows];
    }
  }

  if (emailIds.length > 0) {
    const emailPlaceholders = emailIds.map(() => "?").join(", ");
    const emailRows = db
      .prepare(
        `SELECT id, NULL as message_id, email_id, filename, mime_type, file_size_bytes, storage_path
         FROM attachments WHERE email_id IN (${emailPlaceholders})`
      )
      .all(...emailIds) as AttachmentRow[];
    attachmentRows = [...attachmentRows, ...emailRows];
  }

  return attachmentRows;
}

// ============================================
// CONTACT RESOLUTION QUERIES (TASK-2100)
// ============================================

/**
 * Look up contact display names by phone numbers.
 * Matches against last 10 digits of both phone_e164 and phone_display.
 */
export function getContactNamesByPhoneDigits(
  normalizedPhones: string[]
): { phone_e164: string | null; phone_display: string | null; display_name: string | null }[] {
  if (normalizedPhones.length === 0) return [];
  const db = ensureDb();
  const placeholders = normalizedPhones.map(() => "?").join(", ");
  const sql = `
    SELECT
      cp.phone_e164,
      cp.phone_display,
      c.display_name
    FROM contact_phones cp
    JOIN contacts c ON cp.contact_id = c.id
    WHERE substr(replace(replace(replace(cp.phone_e164, '+', ''), '-', ''), ' ', ''), -10) IN (${placeholders})
       OR substr(replace(replace(replace(cp.phone_display, '+', ''), '-', ''), ' ', ''), -10) IN (${placeholders})
  `;
  return db.prepare(sql).all(...normalizedPhones, ...normalizedPhones) as {
    phone_e164: string | null;
    phone_display: string | null;
    display_name: string | null;
  }[];
}

/**
 * Look up contact display names by email addresses (case-insensitive).
 */
export function getContactNamesByEmails(
  lowerEmails: string[]
): { email: string; display_name: string | null }[] {
  if (lowerEmails.length === 0) return [];
  const db = ensureDb();
  const placeholders = lowerEmails.map(() => "?").join(", ");
  const sql = `
    SELECT
      LOWER(ce.email) as email,
      c.display_name
    FROM contact_emails ce
    JOIN contacts c ON ce.contact_id = c.id
    WHERE LOWER(ce.email) IN (${placeholders})
  `;
  return db.prepare(sql).all(...lowerEmails) as {
    email: string;
    display_name: string | null;
  }[];
}

/**
 * Look up a contact display name by Apple ID prefix (email prefix match).
 */
export function getContactNameByAppleIdPrefix(
  appleIdLower: string
): { email: string; display_name: string | null } | undefined {
  const db = ensureDb();
  const sql = `
    SELECT
      LOWER(ce.email) as email,
      c.display_name
    FROM contact_emails ce
    JOIN contacts c ON ce.contact_id = c.id
    WHERE LOWER(ce.email) LIKE ? || '@%'
    LIMIT 1
  `;
  return db.prepare(sql).get(appleIdLower) as {
    email: string;
    display_name: string | null;
  } | undefined;
}
