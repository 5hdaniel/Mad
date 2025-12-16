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

/**
 * Create a new communication (email)
 */
export async function createCommunication(
  communicationData: NewCommunication,
): Promise<Communication> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO communications (
      id, user_id, transaction_id, communication_type, source,
      email_thread_id, sender, recipients, cc, bcc,
      subject, body, body_plain, sent_at, received_at,
      has_attachments, attachment_count, attachment_metadata,
      keywords_detected, parties_involved, communication_category,
      relevance_score, is_compliance_related
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    communicationData.user_id,
    communicationData.transaction_id || null,
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
 */
export async function updateCommunication(
  communicationId: string,
  updates: Partial<Communication>,
): Promise<void> {
  const allowedFields = [
    "transaction_id",
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

  values.push(communicationId);

  const sql = `UPDATE communications SET ${fields.join(", ")} WHERE id = ?`;
  dbRun(sql, values);
}

/**
 * Delete communication
 */
export async function deleteCommunication(communicationId: string): Promise<void> {
  const sql = "DELETE FROM communications WHERE id = ?";
  dbRun(sql, [communicationId]);
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
