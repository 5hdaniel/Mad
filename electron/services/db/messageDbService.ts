/**
 * Message Database Service
 * Handles all message-related database operations
 *
 * BACKLOG-506: Created as part of database architecture cleanup
 * Messages table stores the actual content; communications table is the junction.
 */

import crypto from "crypto";
import type { Message, NewMessage } from "../../types";
import { DatabaseError } from "../../types";
import { dbGet, dbRun, dbTransaction } from "./core/dbConnection";

/**
 * Data for creating or getting a message by external_id
 */
export interface CreateOrGetMessageData {
  user_id: string;
  external_id: string;  // Provider ID (Gmail message ID, Outlook message ID)
  channel: "email" | "sms" | "imessage";
  direction?: "inbound" | "outbound";
  subject?: string;
  body_html?: string;
  body_text?: string;
  participants?: {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
  };
  thread_id?: string;
  sent_at?: string;
  received_at?: string;
  has_attachments?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Create a message or return existing one if external_id already exists.
 *
 * BACKLOG-506: This function implements idempotent message creation.
 * It uses external_id (provider's message ID) to deduplicate.
 * The unique index on (user_id, external_id) ensures no duplicates.
 *
 * @param data - Message data including external_id for deduplication
 * @returns The created or existing message
 */
export function createOrGetMessage(data: CreateOrGetMessageData): Message {
  return dbTransaction(() => {
    // First, check if message already exists by external_id
    const existing = dbGet<Message>(
      "SELECT * FROM messages WHERE user_id = ? AND external_id = ?",
      [data.user_id, data.external_id]
    );

    if (existing) {
      return existing;
    }

    // Create new message
    const id = crypto.randomUUID();
    const participantsJson = data.participants ? JSON.stringify(data.participants) : null;
    const participantsFlat = data.participants
      ? [
          data.participants.from,
          ...(data.participants.to || []),
          ...(data.participants.cc || []),
          ...(data.participants.bcc || []),
        ].join(", ")
      : null;
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

    const sql = `
      INSERT INTO messages (
        id, user_id, external_id, channel, direction,
        subject, body_html, body_text, participants, participants_flat,
        thread_id, sent_at, received_at, has_attachments, metadata,
        is_false_positive, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `;

    const params = [
      id,
      data.user_id,
      data.external_id,
      data.channel,
      data.direction || null,
      data.subject || null,
      data.body_html || null,
      data.body_text || null,
      participantsJson,
      participantsFlat,
      data.thread_id || null,
      data.sent_at || null,
      data.received_at || null,
      data.has_attachments ? 1 : 0,
      metadataJson,
    ];

    dbRun(sql, params);

    // Fetch and return the created message
    const created = dbGet<Message>(
      "SELECT * FROM messages WHERE id = ?",
      [id]
    );

    if (!created) {
      throw new DatabaseError("Failed to create message");
    }

    return created;
  });
}

/**
 * Get a message by ID
 */
export function getMessageById(messageId: string): Message | null {
  const message = dbGet<Message>(
    "SELECT * FROM messages WHERE id = ?",
    [messageId]
  );
  return message || null;
}

/**
 * Get a message by external_id and user_id
 */
export function getMessageByExternalId(userId: string, externalId: string): Message | null {
  const message = dbGet<Message>(
    "SELECT * FROM messages WHERE user_id = ? AND external_id = ?",
    [userId, externalId]
  );
  return message || null;
}
