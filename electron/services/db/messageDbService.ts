/**
 * Message Database Service
 * Handles all message-related database operations (SMS/iMessage/email messages)
 */

import type { Message, Communication } from "../../types";
import { ensureDb } from "./core/dbConnection";
import logService from "../logService";

// ============================================
// LLM ANALYSIS OPERATIONS
// ============================================

/**
 * Get messages that need LLM analysis (not yet classified)
 */
export function getMessagesForLLMAnalysis(userId: string, limit = 100): Message[] {
  const db = ensureDb();
  const sql = `
    SELECT * FROM messages
    WHERE user_id = ?
      AND is_transaction_related IS NULL
      AND duplicate_of IS NULL
    ORDER BY received_at DESC
    LIMIT ?
  `;
  return db.prepare(sql).all(userId, limit) as Message[];
}

/**
 * Get count of messages pending LLM analysis
 */
export function getPendingLLMAnalysisCount(userId: string): number {
  const db = ensureDb();
  const sql = `
    SELECT COUNT(*) as count FROM messages
    WHERE user_id = ?
      AND is_transaction_related IS NULL
      AND duplicate_of IS NULL
  `;
  const result = db.prepare(sql).get(userId) as { count: number } | undefined;
  return result?.count ?? 0;
}

// ============================================
// UNLINKED MESSAGE OPERATIONS
// ============================================

/**
 * Get unlinked text messages (SMS/iMessage) from the messages table
 * These are messages not yet attached to any transaction
 * Limited to 1000 most recent messages to prevent UI freeze
 */
export function getUnlinkedTextMessages(userId: string, limit = 1000): Message[] {
  const db = ensureDb();
  const sql = `
    SELECT * FROM messages
    WHERE user_id = ?
      AND transaction_id IS NULL
      AND channel IN ('sms', 'imessage')
    ORDER BY sent_at DESC
    LIMIT ?
  `;
  return db.prepare(sql).all(userId, limit) as Message[];
}

/**
 * Get unlinked emails - emails not attached to any transaction
 * BACKLOG-506: Now queries emails table directly since communications is a junction table
 */
export function getUnlinkedEmails(userId: string, limit = 500): Communication[] {
  const db = ensureDb();
  const sql = `
    SELECT
      e.id,
      e.user_id,
      NULL as transaction_id,
      e.subject,
      e.sender,
      e.sent_at,
      SUBSTR(e.body_plain, 1, 200) as body_preview
    FROM emails e
    WHERE e.user_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM communications c
        WHERE c.email_id = e.id
          AND c.transaction_id IS NOT NULL
      )
    ORDER BY e.sent_at DESC
    LIMIT ?
  `;
  return db.prepare(sql).all(userId, limit) as Communication[];
}

/**
 * Get distinct contacts (phone numbers) with unlinked message counts
 * Used for contact-first message browsing
 */
export function getMessageContacts(userId: string): { contact: string; messageCount: number; lastMessageAt: string }[] {
  const db = ensureDb();
  const sql = `
    SELECT
      COALESCE(
        CASE
          WHEN direction = 'inbound' THEN json_extract(participants, '$.from')
          ELSE json_extract(participants, '$.to[0]')
        END,
        thread_id
      ) as contact,
      COUNT(*) as messageCount,
      MAX(sent_at) as lastMessageAt
    FROM messages
    WHERE user_id = ?
      AND transaction_id IS NULL
      AND channel IN ('sms', 'imessage')
      AND participants IS NOT NULL
    GROUP BY contact
    HAVING contact IS NOT NULL AND contact != 'me' AND contact != 'unknown' AND contact != ''
    ORDER BY lastMessageAt DESC
  `;
  return db.prepare(sql).all(userId) as { contact: string; messageCount: number; lastMessageAt: string }[];
}

/**
 * Get unlinked messages for a specific contact (phone number)
 * Used after user selects a contact in the contact-first UI
 *
 * Strategy: First find all thread_ids where the contact appears, then fetch
 * ALL messages from those threads. This ensures group chats are fully captured
 * even when individual messages have different handles.
 */
export function getMessagesByContact(userId: string, contact: string): Message[] {
  const db = ensureDb();

  // Step 1: Find all thread_ids where the contact appears in any message
  const threadIdsSql = `
    SELECT DISTINCT thread_id FROM messages
    WHERE user_id = ?
      AND transaction_id IS NULL
      AND channel IN ('sms', 'imessage')
      AND thread_id IS NOT NULL
      AND (
        json_extract(participants, '$.from') = ?
        OR json_extract(participants, '$.to[0]') = ?
      )
  `;
  const threadRows = db.prepare(threadIdsSql).all(userId, contact, contact) as { thread_id: string }[];
  const threadIds = threadRows.map(r => r.thread_id);

  if (threadIds.length === 0) {
    const fallbackSql = `
      SELECT * FROM messages
      WHERE user_id = ?
        AND transaction_id IS NULL
        AND channel IN ('sms', 'imessage')
        AND (
          json_extract(participants, '$.from') = ?
          OR json_extract(participants, '$.to[0]') = ?
        )
      ORDER BY sent_at DESC
    `;
    return db.prepare(fallbackSql).all(userId, contact, contact) as Message[];
  }

  const placeholders = threadIds.map(() => '?').join(', ');
  const messagesSql = `
    SELECT * FROM messages
    WHERE user_id = ?
      AND transaction_id IS NULL
      AND channel IN ('sms', 'imessage')
      AND thread_id IN (${placeholders})
    ORDER BY sent_at DESC
  `;
  return db.prepare(messagesSql).all(userId, ...threadIds) as Message[];
}

// ============================================
// MESSAGE CRUD OPERATIONS
// ============================================

/**
 * Update a message in the messages table
 */
export function updateMessage(messageId: string, updates: Partial<Message>): void {
  const db = ensureDb();
  const allowedFields = [
    "transaction_id",
    "transaction_link_confidence",
    "transaction_link_source",
    "is_transaction_related",
    "classification_confidence",
    "classification_method",
    "classified_at",
    "is_false_positive",
    "false_positive_reason",
    "stage_hint",
    "stage_hint_source",
    "stage_hint_confidence",
    "llm_analysis",
  ];

  const entries = Object.entries(updates).filter(([key]) =>
    allowedFields.includes(key)
  );

  if (entries.length === 0) return;

  const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  values.push(messageId);

  db.prepare(`UPDATE messages SET ${setClause} WHERE id = ?`).run(...values);
}

/**
 * Link a message to a transaction
 */
export function linkMessageToTransaction(messageId: string, transactionId: string): void {
  const db = ensureDb();
  db.prepare(`UPDATE messages SET transaction_id = ? WHERE id = ?`).run(
    transactionId,
    messageId
  );
}

/**
 * Unlink a message from a transaction
 */
export function unlinkMessageFromTransaction(messageId: string): void {
  const db = ensureDb();
  db.prepare(`UPDATE messages SET transaction_id = NULL WHERE id = ?`).run(messageId);
}

/**
 * Get messages linked to a transaction
 */
export function getMessagesByTransaction(transactionId: string): Message[] {
  const db = ensureDb();
  const sql = `
    SELECT * FROM messages
    WHERE transaction_id = ?
    ORDER BY sent_at DESC
  `;
  return db.prepare(sql).all(transactionId) as Message[];
}

/**
 * Get a single message by ID
 */
export function getMessageById(messageId: string): Message | null {
  const db = ensureDb();
  const sql = `SELECT * FROM messages WHERE id = ?`;
  const result = db.prepare(sql).get(messageId) as Message | undefined;
  return result || null;
}

// ============================================
// PHONE LOOKUP OPERATIONS (BACKLOG-567)
// ============================================

/**
 * Get the most recent message date for a phone number using lookup table
 * Falls back to direct query if lookup table is empty (BACKLOG-567)
 */
export function getLastMessageDateForPhone(userId: string, normalizedPhone: string): string | null {
  const db = ensureDb();

  const result = db.prepare(`
    SELECT last_message_at as last_date
    FROM phone_last_message
    WHERE user_id = ?
      AND phone_normalized = ?
  `).get(userId, normalizedPhone) as { last_date: string | null } | undefined;

  return result?.last_date || null;
}

/**
 * Batch lookup for multiple phones (much more efficient than N queries)
 * Returns a Map of normalized phone -> last_message_at (BACKLOG-567)
 */
export function getLastMessageDatesForPhones(userId: string, phones: string[]): Map<string, string> {
  const db = ensureDb();
  const result = new Map<string, string>();

  if (phones.length === 0) return result;

  const placeholders = phones.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT phone_normalized, last_message_at
    FROM phone_last_message
    WHERE user_id = ?
      AND phone_normalized IN (${placeholders})
  `).all(userId, ...phones) as { phone_normalized: string; last_message_at: string }[];

  for (const row of rows) {
    result.set(row.phone_normalized, row.last_message_at);
  }

  return result;
}

/**
 * Populate phone_last_message lookup table from messages (BACKLOG-567)
 * This aggregates all SMS/iMessage into a phone->lastDate lookup for O(1) queries
 */
export async function backfillPhoneLastMessageTable(userId: string): Promise<number> {
  const db = ensureDb();

  await logService.info("Backfilling phone_last_message table", "messageDbService", { userId });

  const messages = db.prepare(`
    SELECT participants_flat, MAX(sent_at) as last_date
    FROM messages
    WHERE user_id = ?
      AND (channel = 'sms' OR channel = 'imessage')
      AND participants_flat IS NOT NULL
      AND participants_flat != ''
    GROUP BY participants_flat
  `).all(userId) as { participants_flat: string; last_date: string }[];

  const phoneLastDates = new Map<string, string>();

  for (const msg of messages) {
    const phones = msg.participants_flat.split(',').filter(p => p.trim().length >= 7);

    for (const phone of phones) {
      const normalized = phone.trim().slice(-10);
      if (normalized.length < 7) continue;

      const existing = phoneLastDates.get(normalized);
      if (!existing || msg.last_date > existing) {
        phoneLastDates.set(normalized, msg.last_date);
      }
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO phone_last_message (phone_normalized, user_id, last_message_at)
    VALUES (?, ?, ?)
  `);

  const runInserts = db.transaction(() => {
    let count = 0;
    for (const [phone, lastDate] of phoneLastDates) {
      insertStmt.run(phone, userId, lastDate);
      count++;
    }
    return count;
  });

  const count = runInserts();

  await logService.info("Phone last message backfill complete", "messageDbService", {
    userId,
    phonesUpdated: count,
  });

  return count;
}
