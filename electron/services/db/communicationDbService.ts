/**
 * Communication Database Service
 * Handles all communication-related database operations (emails, etc.)
 */

import crypto from "crypto";
import type {
  Communication,
  NewCommunication,
  CommunicationFilters,
  IgnoredCommunication,
  NewIgnoredCommunication,
} from "../../types";
import { DatabaseError } from "../../types";
import { dbGet, dbAll, dbRun } from "./core/dbConnection";
import { validateFields } from "../../utils/sqlFieldWhitelist";

/**
 * Create a new communication (email)
 *
 * TASK-975: Now supports message_id for junction table pattern.
 * New communications should provide message_id to link to the messages table.
 * Legacy content fields (subject, body, etc.) are still supported for backward compatibility.
 */
export async function createCommunication(
  communicationData: NewCommunication,
): Promise<Communication> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO communications (
      id, user_id, transaction_id, message_id, email_id,
      link_source, link_confidence, linked_at,
      communication_type, source,
      email_thread_id, sender, recipients, cc, bcc,
      subject, body, body_plain, sent_at, received_at,
      has_attachments, attachment_count, attachment_metadata,
      keywords_detected, parties_involved, communication_category,
      relevance_score, is_compliance_related
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    communicationData.user_id,
    communicationData.transaction_id || null,
    communicationData.message_id || null,
    communicationData.email_id || null,
    communicationData.link_source || null,
    communicationData.link_confidence || null,
    communicationData.linked_at || null,
    communicationData.communication_type || "email",
    communicationData.source || null,
    communicationData.email_thread_id || null,
    communicationData.sender || null,
    communicationData.recipients || null,
    communicationData.cc || null,
    communicationData.bcc || null,
    communicationData.subject || null,
    communicationData.body || null,
    communicationData.body_plain || null,
    communicationData.sent_at || null,
    communicationData.received_at || null,
    communicationData.has_attachments ? 1 : 0,
    communicationData.attachment_count || 0,
    communicationData.attachment_metadata
      ? JSON.stringify(communicationData.attachment_metadata)
      : null,
    communicationData.keywords_detected
      ? JSON.stringify(communicationData.keywords_detected)
      : null,
    communicationData.parties_involved
      ? JSON.stringify(communicationData.parties_involved)
      : null,
    communicationData.communication_category || null,
    communicationData.relevance_score || null,
    communicationData.is_compliance_related ? 1 : 0,
  ];

  dbRun(sql, params);
  const communication = await getCommunicationById(id);
  if (!communication) {
    throw new DatabaseError("Failed to create communication");
  }

  // BACKLOG-396: Update thread count if this is a text message linked to a transaction
  if (communicationData.transaction_id &&
      (communicationData.communication_type === 'text' ||
       communicationData.communication_type === 'imessage' ||
       communicationData.communication_type === 'sms')) {
    updateTransactionThreadCount(communicationData.transaction_id);
  }

  return communication;
}

/**
 * Get communication by ID
 */
export async function getCommunicationById(
  communicationId: string,
): Promise<Communication | null> {
  const sql = "SELECT * FROM communications WHERE id = ?";
  const communication = dbGet<Communication>(sql, [communicationId]);
  return communication || null;
}

/**
 * Get communications with filters
 */
export async function getCommunications(
  filters?: CommunicationFilters,
): Promise<Communication[]> {
  let sql = "SELECT * FROM communications WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.user_id) {
    sql += " AND user_id = ?";
    params.push(filters.user_id);
  }

  if (filters?.transaction_id) {
    sql += " AND transaction_id = ?";
    params.push(filters.transaction_id);
  }

  if (filters?.communication_type) {
    sql += " AND communication_type = ?";
    params.push(filters.communication_type);
  }

  if (filters?.start_date) {
    sql += " AND sent_at >= ?";
    params.push(filters.start_date);
  }

  if (filters?.end_date) {
    sql += " AND sent_at <= ?";
    params.push(filters.end_date);
  }

  if (filters?.has_attachments !== undefined) {
    sql += " AND has_attachments = ?";
    params.push(filters.has_attachments ? 1 : 0);
  }

  sql += " ORDER BY sent_at DESC";

  return dbAll<Communication>(sql, params);
}

/**
 * Get communications for a transaction
 */
export async function getCommunicationsByTransaction(
  transactionId: string,
): Promise<Communication[]> {
  const sql = `
    SELECT * FROM communications
    WHERE transaction_id = ?
    ORDER BY sent_at DESC
  `;
  return dbAll<Communication>(sql, [transactionId]);
}

/**
 * Update communication
 *
 * TASK-975: Now supports message_id and link metadata fields.
 */
export async function updateCommunication(
  communicationId: string,
  updates: Partial<Communication>,
): Promise<void> {
  const allowedFields = [
    "transaction_id",
    "message_id",
    "email_id",
    "link_source",
    "link_confidence",
    "linked_at",
    "communication_type",
    "source",
    "email_thread_id",
    "sender",
    "recipients",
    "cc",
    "bcc",
    "subject",
    "body",
    "body_plain",
    "sent_at",
    "received_at",
    "has_attachments",
    "attachment_count",
    "attachment_metadata",
    "keywords_detected",
    "parties_involved",
    "communication_category",
    "relevance_score",
    "flagged_for_review",
    "is_compliance_related",
  ];

  const fields: string[] = [];
  const values: unknown[] = [];

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      let value = (updates as Record<string, unknown>)[key];
      if (
        [
          "attachment_metadata",
          "keywords_detected",
          "parties_involved",
        ].includes(key) &&
        typeof value === "object"
      ) {
        value = JSON.stringify(value);
      }
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    throw new DatabaseError("No valid fields to update");
  }

  // Validate fields against whitelist before SQL construction
  validateFields("communications", fields);

  values.push(communicationId);

  const sql = `UPDATE communications SET ${fields.join(", ")} WHERE id = ?`;
  dbRun(sql, values);
}

/**
 * Delete communication
 */
export async function deleteCommunication(communicationId: string): Promise<void> {
  // BACKLOG-396: Get the transaction ID before deleting so we can update thread count
  const comm = dbGet<{ transaction_id: string | null; communication_type: string | null }>(
    "SELECT transaction_id, communication_type FROM communications WHERE id = ?",
    [communicationId]
  );

  const sql = "DELETE FROM communications WHERE id = ?";
  dbRun(sql, [communicationId]);

  // BACKLOG-396: Update thread count if this was a text message linked to a transaction
  if (comm?.transaction_id &&
      (comm.communication_type === 'text' ||
       comm.communication_type === 'imessage' ||
       comm.communication_type === 'sms')) {
    updateTransactionThreadCount(comm.transaction_id);
  }
}

/**
 * Delete communication by message_id
 * Used when unlinking messages from a transaction - removes the communications table reference
 */
export async function deleteCommunicationByMessageId(messageId: string): Promise<void> {
  // BACKLOG-396: Get the transaction ID before deleting so we can update thread count
  const comm = dbGet<{ transaction_id: string | null; communication_type: string | null }>(
    "SELECT transaction_id, communication_type FROM communications WHERE message_id = ?",
    [messageId]
  );

  const sql = "DELETE FROM communications WHERE message_id = ?";
  dbRun(sql, [messageId]);

  // BACKLOG-396: Update thread count if this was a text message linked to a transaction
  if (comm?.transaction_id &&
      (comm.communication_type === 'text' ||
       comm.communication_type === 'imessage' ||
       comm.communication_type === 'sms')) {
    updateTransactionThreadCount(comm.transaction_id);
  }
}

/**
 * Link communication to transaction
 */
export async function linkCommunicationToTransaction(
  communicationId: string,
  transactionId: string,
): Promise<void> {
  const sql = "UPDATE communications SET transaction_id = ? WHERE id = ?";
  dbRun(sql, [transactionId, communicationId]);
}

// ============================================
// IGNORED COMMUNICATION OPERATIONS
// ============================================

/**
 * Add a communication to the ignored list for a transaction
 * This prevents the email from being re-added during future scans
 */
export async function addIgnoredCommunication(
  data: NewIgnoredCommunication,
): Promise<IgnoredCommunication> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO ignored_communications (
      id, user_id, transaction_id, email_subject, email_sender,
      email_sent_at, email_thread_id, original_communication_id, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    data.user_id,
    data.transaction_id,
    data.email_subject || null,
    data.email_sender || null,
    data.email_sent_at || null,
    data.email_thread_id || null,
    data.original_communication_id || null,
    data.reason || null,
  ];

  dbRun(sql, params);

  const ignoredComm = dbGet<IgnoredCommunication>(
    "SELECT * FROM ignored_communications WHERE id = ?",
    [id],
  );

  if (!ignoredComm) {
    throw new DatabaseError("Failed to create ignored communication record");
  }

  return ignoredComm;
}

/**
 * Get all ignored communications for a transaction
 */
export async function getIgnoredCommunicationsByTransaction(
  transactionId: string,
): Promise<IgnoredCommunication[]> {
  const sql = `
    SELECT * FROM ignored_communications
    WHERE transaction_id = ?
    ORDER BY ignored_at DESC
  `;
  return dbAll<IgnoredCommunication>(sql, [transactionId]);
}

/**
 * Get all ignored communications for a user
 */
export async function getIgnoredCommunicationsByUser(
  userId: string,
): Promise<IgnoredCommunication[]> {
  const sql = `
    SELECT * FROM ignored_communications
    WHERE user_id = ?
    ORDER BY ignored_at DESC
  `;
  return dbAll<IgnoredCommunication>(sql, [userId]);
}

/**
 * Check if a communication is ignored for a transaction
 * Uses email sender, subject, and sent_at to identify the email
 */
export async function isEmailIgnoredForTransaction(
  transactionId: string,
  emailSender: string,
  emailSubject: string,
  emailSentAt: string,
): Promise<boolean> {
  const sql = `
    SELECT id FROM ignored_communications
    WHERE transaction_id = ?
      AND email_sender = ?
      AND email_subject = ?
      AND email_sent_at = ?
    LIMIT 1
  `;
  const result = dbGet(sql, [
    transactionId,
    emailSender,
    emailSubject,
    emailSentAt,
  ]);
  return !!result;
}

/**
 * Check if a communication is ignored for any transaction of a user
 * Used during email scanning to filter out previously ignored emails
 */
export async function isEmailIgnoredByUser(
  userId: string,
  emailSender: string,
  emailSubject: string,
  emailSentAt: string,
): Promise<boolean> {
  const sql = `
    SELECT id FROM ignored_communications
    WHERE user_id = ?
      AND email_sender = ?
      AND email_subject = ?
      AND email_sent_at = ?
    LIMIT 1
  `;
  const result = dbGet(sql, [userId, emailSender, emailSubject, emailSentAt]);
  return !!result;
}

/**
 * Remove an ignored communication (re-allow it to be linked)
 */
export async function removeIgnoredCommunication(ignoredCommId: string): Promise<void> {
  const sql = "DELETE FROM ignored_communications WHERE id = ?";
  dbRun(sql, [ignoredCommId]);
}

// ============================================
// EXTRACTED DATA OPERATIONS
// ============================================

/**
 * Save extracted transaction data (audit trail)
 */
export async function saveExtractedData(
  transactionId: string,
  fieldName: string,
  fieldValue: string,
  sourceCommId?: string,
  confidence?: number,
): Promise<string> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO extracted_transaction_data (
      id, transaction_id, field_name, field_value,
      source_communication_id, extraction_method, confidence_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  dbRun(sql, [
    id,
    transactionId,
    fieldName,
    fieldValue,
    sourceCommId || null,
    "pattern_matching",
    confidence || null,
  ]);

  return id;
}

// ============================================
// TASK-975: JUNCTION TABLE OPERATIONS
// ============================================

/**
 * Data required to create a communication reference (junction table pattern)
 */
export interface CreateCommunicationReferenceData {
  user_id: string;
  message_id: string;
  transaction_id: string;
  link_source?: 'auto' | 'manual' | 'scan';
  link_confidence?: number;
}

/**
 * Create a communication reference linking a message to a transaction.
 *
 * TASK-975: This is the new junction table pattern.
 * - message_id references the messages table (where content lives)
 * - transaction_id references the transactions table
 * - No content duplication - content stays in messages table
 *
 * @param data - The reference data
 * @returns The created communication reference
 */
export async function createCommunicationReference(
  data: CreateCommunicationReferenceData,
): Promise<Communication> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO communications (
      id, user_id, message_id, transaction_id,
      link_source, link_confidence, linked_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  const params = [
    id,
    data.user_id,
    data.message_id,
    data.transaction_id,
    data.link_source || 'auto',
    data.link_confidence || null,
  ];

  dbRun(sql, params);

  const communication = await getCommunicationById(id);
  if (!communication) {
    throw new DatabaseError("Failed to create communication reference");
  }

  // BACKLOG-396: Check if the linked message is a text and update thread count
  const message = dbGet<{ channel: string | null }>(
    "SELECT channel FROM messages WHERE id = ?",
    [data.message_id]
  );
  if (message?.channel &&
      (message.channel === 'text' || message.channel === 'sms' || message.channel === 'imessage')) {
    updateTransactionThreadCount(data.transaction_id);
  }

  return communication;
}

/**
 * Get communications for a transaction, joining to messages table for content.
 *
 * TASK-975: This retrieves communications with full message content from the
 * messages table when message_id is set. Falls back to legacy content columns
 * for records without message_id.
 *
 * TASK-992: Added direction field from messages table for proper bubble display.
 *
 * TASK-1116: Updated to support thread-based linking. For records with thread_id
 * but no message_id, returns all messages in the thread.
 *
 * @param transactionId - The transaction ID
 * @returns Communications with content from messages table when available
 */
export async function getCommunicationsWithMessages(
  transactionId: string,
): Promise<Communication[]> {
  // BACKLOG-506: Three-way join - messages for texts, emails for emails
  // Query handles:
  //   1. Records with message_id (per-message text linking)
  //   2. Records with thread_id (per-thread text linking)
  //   3. Records with email_id (email linking - NEW)
  //
  // NOTE: The return type Communication is aliased to Message for backward compatibility.
  // The SELECT populates Message fields from JOINs to messages/emails tables.
  const sql = `
    SELECT
      -- Use content table ID when available, fall back to communication ID
      COALESCE(m.id, e.id, c.id) as id,
      c.id as communication_id,
      c.user_id,
      c.transaction_id,
      -- HOTFIX: For thread-linked messages, c.message_id is NULL but m.id has the actual message ID
      -- This is needed for attachment lookup which uses message_id
      COALESCE(c.message_id, m.id) as message_id,
      c.email_id,
      c.link_source,
      c.link_confidence,
      c.linked_at,
      c.created_at,
      -- Type: prefer message channel, then 'email' if email_id set
      CASE
        WHEN m.id IS NOT NULL THEN m.channel
        WHEN e.id IS NOT NULL THEN 'email'
        ELSE 'unknown'
      END as channel,
      CASE
        WHEN m.id IS NOT NULL THEN m.channel
        WHEN e.id IS NOT NULL THEN 'email'
        ELSE 'unknown'
      END as communication_type,
      -- Content from messages or emails table (NO legacy column fallback)
      COALESCE(m.body_text, e.body_plain) as body_text,
      COALESCE(m.body_text, e.body_plain) as body_plain,
      COALESCE(m.body_html, e.body_html) as body,
      COALESCE(m.subject, e.subject) as subject,
      COALESCE(json_extract(m.participants, '$.from'), e.sender) as sender,
      COALESCE(
        (SELECT group_concat(value) FROM json_each(json_extract(m.participants, '$.to'))),
        e.recipients
      ) as recipients,
      COALESCE(m.sent_at, e.sent_at) as sent_at,
      COALESCE(m.received_at, e.received_at) as received_at,
      COALESCE(m.has_attachments, e.has_attachments) as has_attachments,
      COALESCE(m.thread_id, e.thread_id) as email_thread_id,
      -- Thread ID for grouping messages into conversations
      COALESCE(m.thread_id, e.thread_id) as thread_id,
      -- Participants JSON for group chat detection and sender identification
      m.participants as participants,
      -- Direction from messages table for bubble display
      COALESCE(m.direction, e.direction) as direction,
      -- External ID for attachment lookup fallback
      COALESCE(m.external_id, e.external_id) as external_id,
      -- Email-specific fields from emails table only
      e.source as source,
      e.cc as cc,
      e.bcc as bcc,
      e.attachment_count as attachment_count,
      -- Legacy metadata columns (may be populated by analysis, not content)
      c.attachment_metadata,
      c.keywords_detected,
      c.parties_involved,
      c.communication_category,
      c.relevance_score,
      c.is_compliance_related
    FROM communications c
    LEFT JOIN messages m ON (
      -- Per-message linking
      (c.message_id IS NOT NULL AND c.message_id = m.id)
      OR
      -- Thread-based linking
      (c.message_id IS NULL AND c.email_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
    )
    LEFT JOIN emails e ON (
      -- BACKLOG-506: Email linking - join only when email_id is set and matches
      c.email_id IS NOT NULL AND c.email_id = e.id
    )
    WHERE c.transaction_id = ?
    ORDER BY COALESCE(m.sent_at, e.sent_at) DESC
  `;

  const results = dbAll<Communication>(sql, [transactionId]);

  // Deduplicate by message ID first
  const seenIds = new Set<string>();
  const dedupedById = results.filter(r => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  // Content-based deduplication for text messages
  // Catches cases where same content exists with different IDs
  const seenContent = new Set<string>();
  const deduped = dedupedById.filter(r => {
    const channel = (r as { channel?: string }).channel;
    const commType = (r as { communication_type?: string }).communication_type;
    const isTextMessage = channel === 'sms' || channel === 'imessage' ||
                          commType === 'sms' || commType === 'imessage';

    if (!isTextMessage) return true;

    const bodyText = (r as { body_text?: string }).body_text || '';
    const sentAt = (r as { sent_at?: string }).sent_at || '';
    const contentKey = `${bodyText}|${sentAt}`;

    if (seenContent.has(contentKey)) return false;
    seenContent.add(contentKey);
    return true;
  });

  return deduped;
}

/**
 * Check if a message is already linked to a transaction
 *
 * @param messageId - The message ID
 * @param transactionId - The transaction ID
 * @returns True if the link exists
 */
export async function isMessageLinkedToTransaction(
  messageId: string,
  transactionId: string,
): Promise<boolean> {
  const sql = `
    SELECT id FROM communications
    WHERE message_id = ? AND transaction_id = ?
    LIMIT 1
  `;
  const result = dbGet(sql, [messageId, transactionId]);
  return !!result;
}

/**
 * Get all transactions a message is linked to
 *
 * @param messageId - The message ID
 * @returns Array of transaction IDs
 */
export async function getTransactionsForMessage(
  messageId: string,
): Promise<string[]> {
  const sql = `
    SELECT transaction_id FROM communications
    WHERE message_id = ?
  `;
  const results = dbAll<{ transaction_id: string }>(sql, [messageId]);
  return results.map(r => r.transaction_id);
}

// ============================================
// TASK-1115: THREAD-LEVEL LINKING OPERATIONS
// ============================================

/**
 * Create a thread-level communication link (one record per thread per transaction).
 *
 * TASK-1115: This replaces message-by-message linking for thread-based communications.
 * Instead of creating one communication record per message, we create one per thread.
 * The messages table retains individual messages; this is just the linking junction.
 *
 * @param threadId - The thread identifier (from messages.thread_id)
 * @param transactionId - The transaction to link to
 * @param userId - The user ID
 * @param linkSource - How the link was created ('auto', 'manual', 'scan')
 * @param linkConfidence - Confidence score (0.0 - 1.0)
 * @returns The created communication ID
 */
export async function createThreadCommunicationReference(
  threadId: string,
  transactionId: string,
  userId: string,
  linkSource: 'auto' | 'manual' | 'scan' = 'auto',
  linkConfidence: number = 0.9,
): Promise<string> {
  const id = crypto.randomUUID();

  // BACKLOG-502: Set communication_type to 'text' for thread-based links.
  // This ensures text messages display correctly even if the JOIN to
  // messages table fails. The schema allows: 'email', 'text', 'imessage'.
  const sql = `
    INSERT INTO communications (
      id, user_id, thread_id, transaction_id,
      communication_type, link_source, link_confidence, linked_at
    ) VALUES (?, ?, ?, ?, 'text', ?, ?, CURRENT_TIMESTAMP)
  `;

  const params = [
    id,
    userId,
    threadId,
    transactionId,
    linkSource,
    linkConfidence,
  ];

  dbRun(sql, params);

  // BACKLOG-396: Thread-based linking is always for text messages, update count
  updateTransactionThreadCount(transactionId);

  return id;
}

/**
 * Delete communication records by thread_id for a specific transaction.
 *
 * TASK-1115: Used when unlinking a thread from a transaction.
 * Removes the junction record so the thread is no longer associated.
 *
 * @param threadId - The thread identifier
 * @param transactionId - The transaction to unlink from
 */
export async function deleteCommunicationByThread(
  threadId: string,
  transactionId: string,
): Promise<void> {
  const sql = `
    DELETE FROM communications
    WHERE thread_id = ? AND transaction_id = ?
  `;
  dbRun(sql, [threadId, transactionId]);

  // BACKLOG-396: Thread-based unlinking is always for text messages, update count
  updateTransactionThreadCount(transactionId);
}

/**
 * Check if a thread is already linked to a transaction.
 *
 * TASK-1115: Used to avoid duplicate links when auto-linking.
 *
 * @param threadId - The thread identifier
 * @param transactionId - The transaction ID
 * @returns True if the thread is already linked to this transaction
 */
export async function isThreadLinkedToTransaction(
  threadId: string,
  transactionId: string,
): Promise<boolean> {
  const sql = `
    SELECT id FROM communications
    WHERE thread_id = ? AND transaction_id = ?
    LIMIT 1
  `;
  const result = dbGet(sql, [threadId, transactionId]);
  return !!result;
}

// ============================================
// BACKLOG-396: THREAD COUNT MANAGEMENT
// ============================================

/**
 * Normalize a participant identifier for consistent grouping.
 * Matches frontend logic in MessageThreadCard.tsx.
 */
function normalizeParticipant(participant: string): string {
  if (!participant) return '';

  // If it looks like a phone number, normalize to digits only
  const digits = participant.replace(/\D/g, '');
  if (digits.length >= 10) {
    // Use last 10 digits to normalize +1 prefix variations
    return digits.slice(-10);
  }

  // Otherwise return lowercase trimmed version
  return participant.toLowerCase().trim();
}

/**
 * Generate a key for grouping messages into threads.
 * Matches frontend logic in MessageThreadCard.tsx getThreadKey().
 */
function getThreadKey(msg: { thread_id?: string | null; participants?: string | null; id: string }): string {
  // FIRST: Use thread_id if available - this is the actual iMessage chat ID
  if (msg.thread_id) {
    return msg.thread_id;
  }

  // FALLBACK: Compute from participants if no thread_id
  try {
    if (msg.participants) {
      const parsed = typeof msg.participants === 'string'
        ? JSON.parse(msg.participants)
        : msg.participants;

      // Collect all participants
      const allParticipants = new Set<string>();

      if (parsed.from) {
        allParticipants.add(normalizeParticipant(parsed.from));
      }
      if (parsed.to) {
        const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
        toList.forEach((p: string) => allParticipants.add(normalizeParticipant(p)));
      }

      // Remove "me" - we only care about external participants for grouping
      allParticipants.delete('me');

      // Sort and join to create a consistent key
      if (allParticipants.size > 0) {
        return `participants-${Array.from(allParticipants).sort().join('|')}`;
      }
    }
  } catch {
    // Fall through to default
  }

  // Last resort: use message id (each message is its own "thread")
  return `msg-${msg.id}`;
}

/**
 * Count unique threads for text communications linked to a transaction.
 * Uses the same logic as frontend's groupMessagesByThread().
 *
 * BACKLOG-396: This is the source of truth for text thread counts.
 */
export function countTextThreadsForTransaction(transactionId: string): number {
  // Get all text communications linked to this transaction
  // This query matches getCommunicationsWithMessages but only for text messages
  const sql = `
    SELECT
      COALESCE(m.id, c.id) as id,
      m.thread_id as thread_id,
      m.participants as participants
    FROM communications c
    LEFT JOIN messages m ON (
      (c.message_id IS NOT NULL AND c.message_id = m.id)
      OR
      (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
    )
    WHERE c.transaction_id = ?
      AND COALESCE(m.channel, c.communication_type) IN ('text', 'sms', 'imessage')
  `;

  const messages = dbAll<{ id: string; thread_id: string | null; participants: string | null }>(
    sql,
    [transactionId]
  );

  // Group messages by thread using the same logic as frontend
  const threads = new Set<string>();
  for (const msg of messages) {
    const threadKey = getThreadKey(msg);
    threads.add(threadKey);
  }

  return threads.size;
}

/**
 * Update the text_thread_count on a transaction.
 * Call this after linking/unlinking messages to keep the count in sync.
 *
 * BACKLOG-396: Ensures TransactionCard displays the correct thread count.
 */
export function updateTransactionThreadCount(transactionId: string): void {
  const threadCount = countTextThreadsForTransaction(transactionId);

  const sql = `UPDATE transactions SET text_thread_count = ? WHERE id = ?`;
  dbRun(sql, [threadCount, transactionId]);
}

/**
 * Backfill text_thread_count for all transactions.
 * Run this once to populate existing data.
 *
 * BACKLOG-396: Migration helper for existing transactions.
 */
export function backfillAllTransactionThreadCounts(): { updated: number; errors: number } {
  // Get all transaction IDs
  const transactions = dbAll<{ id: string }>(`SELECT id FROM transactions`);

  let updated = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      updateTransactionThreadCount(tx.id);
      updated++;
    } catch {
      errors++;
    }
  }

  return { updated, errors };
}
