/**
 * Email Database Service (BACKLOG-506)
 * Handles all email-related database operations.
 *
 * This is the content store for emails. The communications table
 * is a junction table that links emails to transactions.
 *
 * Pattern: emails table for content, communications table for links
 * Similar to: messages table for texts, communications for links
 */

import crypto from "crypto";
import { dbGet, dbAll, dbRun } from "./core/dbConnection";
import { DatabaseError } from "../../types";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Email record stored in the emails table
 */
export interface Email {
  id: string;
  user_id: string;
  external_id?: string;
  source?: "gmail" | "outlook";
  account_id?: string;
  direction?: "inbound" | "outbound";
  subject?: string;
  body_plain?: string;
  body_html?: string;
  sender?: string;
  recipients?: string;
  cc?: string;
  bcc?: string;
  thread_id?: string;
  in_reply_to?: string;
  references_header?: string;
  sent_at?: string;
  received_at?: string;
  has_attachments?: boolean;
  attachment_count?: number;
  message_id_header?: string;
  content_hash?: string;
  labels?: string;
  created_at?: string;
}

/**
 * Data required to create a new email
 */
export interface NewEmail {
  user_id: string;
  external_id?: string;
  source?: "gmail" | "outlook";
  account_id?: string;
  direction?: "inbound" | "outbound";
  subject?: string;
  body_plain?: string;
  body_html?: string;
  sender?: string;
  recipients?: string;
  cc?: string;
  bcc?: string;
  thread_id?: string;
  in_reply_to?: string;
  references_header?: string;
  sent_at?: string;
  received_at?: string;
  has_attachments?: boolean;
  attachment_count?: number;
  message_id_header?: string;
  content_hash?: string;
  labels?: string;
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new email in the emails table.
 *
 * BACKLOG-506: Emails are stored separately from communications.
 * After creating an email, use communicationDbService to create the junction link.
 *
 * @param emailData - The email content to store
 * @returns The created email with generated ID
 */
export async function createEmail(emailData: NewEmail): Promise<Email> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO emails (
      id, user_id, external_id, source, account_id, direction,
      subject, body_plain, body_html,
      sender, recipients, cc, bcc,
      thread_id, in_reply_to, references_header,
      sent_at, received_at,
      has_attachments, attachment_count,
      message_id_header, content_hash, labels,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  const params = [
    id,
    emailData.user_id,
    emailData.external_id || null,
    emailData.source || null,
    emailData.account_id || null,
    emailData.direction || null,
    emailData.subject || null,
    emailData.body_plain || null,
    emailData.body_html || null,
    emailData.sender || null,
    emailData.recipients || null,
    emailData.cc || null,
    emailData.bcc || null,
    emailData.thread_id || null,
    emailData.in_reply_to || null,
    emailData.references_header || null,
    emailData.sent_at || null,
    emailData.received_at || null,
    emailData.has_attachments ? 1 : 0,
    emailData.attachment_count || 0,
    emailData.message_id_header || null,
    emailData.content_hash || null,
    emailData.labels || null,
  ];

  dbRun(sql, params);

  const email = await getEmailById(id);
  if (!email) {
    throw new DatabaseError("Failed to create email");
  }

  return email;
}

/**
 * Get an email by ID
 */
export async function getEmailById(emailId: string): Promise<Email | null> {
  const sql = "SELECT * FROM emails WHERE id = ?";
  const email = dbGet<Email>(sql, [emailId]);
  return email || null;
}

/**
 * Get an email by external ID (Gmail/Outlook message ID)
 * Used for deduplication during import
 */
export async function getEmailByExternalId(
  userId: string,
  externalId: string
): Promise<Email | null> {
  const sql = "SELECT * FROM emails WHERE user_id = ? AND external_id = ?";
  const email = dbGet<Email>(sql, [userId, externalId]);
  return email || null;
}

/**
 * Get an email by message_id_header (RFC 5322 Message-ID)
 * Used for deduplication during import
 */
export async function getEmailByMessageIdHeader(
  userId: string,
  messageIdHeader: string
): Promise<Email | null> {
  const sql = "SELECT * FROM emails WHERE user_id = ? AND message_id_header = ?";
  const email = dbGet<Email>(sql, [userId, messageIdHeader]);
  return email || null;
}

/**
 * Get all emails for a user
 */
export async function getEmailsByUser(userId: string): Promise<Email[]> {
  const sql = `
    SELECT * FROM emails
    WHERE user_id = ?
    ORDER BY sent_at DESC
  `;
  return dbAll<Email>(sql, [userId]);
}

/**
 * Get emails in a thread
 */
export async function getEmailsByThread(
  userId: string,
  threadId: string
): Promise<Email[]> {
  const sql = `
    SELECT * FROM emails
    WHERE user_id = ? AND thread_id = ?
    ORDER BY sent_at ASC
  `;
  return dbAll<Email>(sql, [userId, threadId]);
}

/**
 * Update an email
 */
export async function updateEmail(
  emailId: string,
  updates: Partial<Email>
): Promise<void> {
  const allowedFields = [
    "subject",
    "body_plain",
    "body_html",
    "sender",
    "recipients",
    "cc",
    "bcc",
    "thread_id",
    "has_attachments",
    "attachment_count",
    "labels",
  ];

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push((updates as Record<string, unknown>)[key]);
    }
  });

  if (fields.length === 0) {
    throw new DatabaseError("No valid fields to update");
  }

  values.push(emailId);

  const sql = `UPDATE emails SET ${fields.join(", ")} WHERE id = ?`;
  dbRun(sql, values);
}

/**
 * Delete an email by ID
 * Note: This will also delete any communications referencing this email
 * via the ON DELETE CASCADE foreign key constraint.
 */
export async function deleteEmail(emailId: string): Promise<void> {
  const sql = "DELETE FROM emails WHERE id = ?";
  dbRun(sql, [emailId]);
}

/**
 * Delete an email by external ID
 */
export async function deleteEmailByExternalId(
  userId: string,
  externalId: string
): Promise<void> {
  const sql = "DELETE FROM emails WHERE user_id = ? AND external_id = ?";
  dbRun(sql, [userId, externalId]);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if an email exists (by external_id or message_id_header)
 * Used for deduplication during import
 */
export async function emailExists(
  userId: string,
  externalId?: string,
  messageIdHeader?: string
): Promise<boolean> {
  if (externalId) {
    const email = await getEmailByExternalId(userId, externalId);
    if (email) return true;
  }

  if (messageIdHeader) {
    const email = await getEmailByMessageIdHeader(userId, messageIdHeader);
    if (email) return true;
  }

  return false;
}

/**
 * Count emails for a user
 */
export async function countEmailsByUser(userId: string): Promise<number> {
  const sql = "SELECT COUNT(*) as count FROM emails WHERE user_id = ?";
  const result = dbGet<{ count: number }>(sql, [userId]);
  return result?.count || 0;
}
