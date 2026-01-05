/**
 * Message Matching Service
 * Auto-links text messages to transactions based on contact phone numbers.
 *
 * Logic:
 * 1. Get all contacts linked to a transaction (via transaction_contacts)
 * 2. For each contact, get their phone numbers (via contact_phones)
 * 3. Find all messages where channel = 'sms' OR 'imessage' AND participants match
 * 4. Link messages to transaction via communications table
 *
 * @see TASK-977
 */

import crypto from "crypto";
import { dbAll, dbRun, dbGet } from "./db/core/dbConnection";
import logService from "./logService";

/**
 * Result of matching a message to a contact
 */
export interface MessageMatch {
  messageId: string;
  contactId: string;
  matchedPhone: string;
  direction: "inbound" | "outbound";
}

/**
 * Result of auto-linking texts to a transaction
 */
export interface AutoLinkResult {
  linked: number;
  skipped: number;
  errors: string[];
}

/**
 * Options for auto-linking texts
 */
export interface AutoLinkOptions {
  /** Only link messages within this date range */
  dateBuffer?: number; // Days before/after transaction to include
  /** Include archived/closed transaction messages */
  includeArchived?: boolean;
}

/**
 * Normalize a phone number to E.164 format for comparison.
 * Handles various input formats: (415) 555-0000, 415-555-0000, +14155550000, etc.
 *
 * @param phone - The phone number to normalize
 * @returns Normalized E.164 format (+14155550000) or null if invalid
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle various formats
  if (digits.length === 10) {
    // US number without country code: 4155550000 -> +14155550000
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // US number with country code: 14155550000 -> +14155550000
    return `+${digits}`;
  } else if (digits.length > 10) {
    // International number: assume already has country code
    return `+${digits}`;
  }

  // Invalid phone number (too short)
  return null;
}

/**
 * Check if two phone numbers match (handles various formats).
 *
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns true if the phones match
 */
export function phonesMatch(
  phone1: string | null | undefined,
  phone2: string | null | undefined
): boolean {
  const normalized1 = normalizePhone(phone1);
  const normalized2 = normalizePhone(phone2);

  if (!normalized1 || !normalized2) return false;

  return normalized1 === normalized2;
}

/**
 * Get all phone numbers for contacts linked to a transaction.
 *
 * @param transactionId - The transaction ID
 * @returns Array of { contactId, phone } pairs
 */
export async function getTransactionContactPhones(
  transactionId: string
): Promise<Array<{ contactId: string; phone: string }>> {
  const sql = `
    SELECT
      tc.contact_id as contactId,
      cp.phone_e164 as phone
    FROM transaction_contacts tc
    JOIN contact_phones cp ON tc.contact_id = cp.contact_id
    WHERE tc.transaction_id = ?
  `;

  const results = dbAll<{ contactId: string; phone: string }>(sql, [transactionId]);
  return results;
}

/**
 * Find text messages that match any of the given phone numbers.
 * Only returns messages not already linked to a transaction.
 *
 * @param userId - The user ID to scope the search
 * @param phoneNumbers - Array of E.164 phone numbers to match
 * @param transactionId - The transaction to check for existing links
 * @returns Array of matching messages with contact attribution
 */
export async function findTextMessagesByPhones(
  userId: string,
  phoneNumbers: Array<{ contactId: string; phone: string }>,
  transactionId: string
): Promise<MessageMatch[]> {
  if (phoneNumbers.length === 0) {
    return [];
  }

  // Build a map of normalized phone -> contactId for efficient lookup
  const phoneToContact = new Map<string, string>();
  for (const { contactId, phone } of phoneNumbers) {
    const normalized = normalizePhone(phone);
    if (normalized) {
      phoneToContact.set(normalized, contactId);
    }
  }

  if (phoneToContact.size === 0) {
    return [];
  }

  // Query all text messages for this user that aren't already linked to this transaction
  // We use participants_flat which contains all participants in a searchable format
  const sql = `
    SELECT
      m.id,
      m.participants,
      m.participants_flat,
      m.direction,
      m.channel
    FROM messages m
    WHERE m.user_id = ?
      AND m.channel IN ('sms', 'imessage')
      AND m.duplicate_of IS NULL
      AND (
        m.transaction_id IS NULL
        OR m.transaction_id != ?
      )
      AND m.id NOT IN (
        SELECT message_id FROM communications
        WHERE transaction_id = ? AND message_id IS NOT NULL
      )
  `;

  const messages = dbAll<{
    id: string;
    participants: string | null;
    participants_flat: string | null;
    direction: string | null;
    channel: string;
  }>(sql, [userId, transactionId, transactionId]);

  const matches: MessageMatch[] = [];

  for (const msg of messages) {
    // Try to find a matching phone in the participants
    let matchedPhone: string | null = null;
    let matchedContactId: string | null = null;

    // First try participants_flat (denormalized search string)
    if (msg.participants_flat) {
      for (const [phone, contactId] of phoneToContact) {
        // Extract just digits from both for comparison
        const phoneDigits = phone.replace(/\D/g, "");
        if (msg.participants_flat.includes(phoneDigits)) {
          matchedPhone = phone;
          matchedContactId = contactId;
          break;
        }
      }
    }

    // If not found in flat, try parsing participants JSON
    if (!matchedPhone && msg.participants) {
      try {
        const participants = JSON.parse(msg.participants);
        const allParticipants: string[] = [];

        if (participants.from) allParticipants.push(participants.from);
        if (Array.isArray(participants.to)) {
          allParticipants.push(...participants.to);
        }

        for (const participant of allParticipants) {
          const normalizedParticipant = normalizePhone(participant);
          if (normalizedParticipant && phoneToContact.has(normalizedParticipant)) {
            matchedPhone = normalizedParticipant;
            matchedContactId = phoneToContact.get(normalizedParticipant) || null;
            break;
          }
        }
      } catch {
        // JSON parse error - skip this message
        logService.warn(
          `Failed to parse participants JSON for message ${msg.id}`,
          "MessageMatchingService"
        );
      }
    }

    if (matchedPhone && matchedContactId) {
      matches.push({
        messageId: msg.id,
        contactId: matchedContactId,
        matchedPhone,
        direction: (msg.direction as "inbound" | "outbound") || "inbound",
      });
    }
  }

  return matches;
}

/**
 * Create a communication reference linking a message to a transaction.
 * Uses INSERT OR IGNORE to handle duplicates gracefully.
 *
 * @param messageId - The message ID
 * @param transactionId - The transaction ID
 * @param userId - The user ID
 * @param linkSource - How the link was created ('auto' for auto-linking)
 * @param linkConfidence - Confidence score (0.0 - 1.0)
 * @returns The created communication ID, or null if already exists
 */
export async function createCommunicationReference(
  messageId: string,
  transactionId: string,
  userId: string,
  _linkSource: "auto" | "manual" | "scan" = "auto",
  linkConfidence: number = 0.9
): Promise<string | null> {
  const id = crypto.randomUUID();

  // First check if this link already exists
  const existingCheck = `
    SELECT id FROM communications
    WHERE message_id = ? AND transaction_id = ?
  `;
  const existing = dbGet<{ id: string }>(existingCheck, [messageId, transactionId]);

  if (existing) {
    return null; // Already linked
  }

  // Get message details to populate communication fields
  const msgSql = `
    SELECT
      channel as communication_type,
      subject,
      body_text as body_plain,
      body_html as body,
      sent_at,
      received_at,
      has_attachments,
      participants
    FROM messages
    WHERE id = ?
  `;
  const message = dbGet<{
    communication_type: string | null;
    subject: string | null;
    body_plain: string | null;
    body: string | null;
    sent_at: string | null;
    received_at: string | null;
    has_attachments: number;
    participants: string | null;
  }>(msgSql, [messageId]);

  if (!message) {
    logService.warn(
      `Message ${messageId} not found when creating communication reference`,
      "MessageMatchingService"
    );
    return null;
  }

  // Parse participants to extract sender/recipients
  let sender: string | null = null;
  let recipients: string | null = null;
  if (message.participants) {
    try {
      const participants = JSON.parse(message.participants);
      sender = participants.from || null;
      recipients = Array.isArray(participants.to)
        ? participants.to.join(", ")
        : null;
    } catch {
      // Ignore parse errors
    }
  }

  // Map channel to communication_type
  const commType =
    message.communication_type === "sms" || message.communication_type === "imessage"
      ? message.communication_type
      : "text";

  const sql = `
    INSERT INTO communications (
      id, message_id, user_id, transaction_id,
      communication_type, sender, recipients,
      subject, body, body_plain,
      sent_at, received_at, has_attachments,
      relevance_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    messageId,
    userId,
    transactionId,
    commType,
    sender,
    recipients,
    message.subject,
    message.body,
    message.body_plain,
    message.sent_at,
    message.received_at,
    message.has_attachments,
    linkConfidence,
  ];

  try {
    dbRun(sql, params);
    return id;
  } catch (error) {
    // Handle unique constraint violation gracefully
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return null;
    }
    throw error;
  }
}

/**
 * Auto-link text messages to a transaction based on assigned contacts.
 * This is the main entry point for the auto-linking feature.
 *
 * @param transactionId - The transaction to link messages to
 * @param options - Optional configuration
 * @returns Result with counts of linked/skipped messages
 */
export async function autoLinkTextsToTransaction(
  transactionId: string,
  _options?: AutoLinkOptions
): Promise<AutoLinkResult> {
  const result: AutoLinkResult = {
    linked: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Get the transaction to verify it exists and get user_id
    const txnSql = "SELECT user_id FROM transactions WHERE id = ?";
    const transaction = dbGet<{ user_id: string }>(txnSql, [transactionId]);

    if (!transaction) {
      result.errors.push(`Transaction ${transactionId} not found`);
      return result;
    }

    const userId = transaction.user_id;

    // 2. Get all phone numbers for contacts linked to this transaction
    const contactPhones = await getTransactionContactPhones(transactionId);

    if (contactPhones.length === 0) {
      logService.debug(
        `No contact phones found for transaction ${transactionId}`,
        "MessageMatchingService"
      );
      return result;
    }

    logService.info(
      `Found ${contactPhones.length} phone numbers for transaction ${transactionId}`,
      "MessageMatchingService"
    );

    // 3. Find matching text messages
    const matches = await findTextMessagesByPhones(
      userId,
      contactPhones,
      transactionId
    );

    logService.info(
      `Found ${matches.length} text messages to link for transaction ${transactionId}`,
      "MessageMatchingService"
    );

    // 4. Create communication references for each match
    for (const match of matches) {
      try {
        const refId = await createCommunicationReference(
          match.messageId,
          transactionId,
          userId,
          "auto",
          0.9 // High confidence for phone-based matching
        );

        if (refId) {
          result.linked++;
        } else {
          result.skipped++; // Already linked or message not found
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(
          `Failed to link message ${match.messageId}: ${errorMsg}`
        );
        logService.warn(
          `Failed to link message ${match.messageId} to transaction ${transactionId}: ${errorMsg}`,
          "MessageMatchingService"
        );
      }
    }

    // 5. Also update the message's transaction_id directly for consistency
    if (result.linked > 0) {
      const linkedMessageIds = matches
        .slice(0, result.linked)
        .map((m) => m.messageId);

      // Update messages table to set transaction_id
      const placeholders = linkedMessageIds.map(() => "?").join(",");
      const updateSql = `
        UPDATE messages
        SET transaction_id = ?, transaction_link_source = 'pattern', transaction_link_confidence = 0.9
        WHERE id IN (${placeholders}) AND transaction_id IS NULL
      `;
      dbRun(updateSql, [transactionId, ...linkedMessageIds]);
    }

    logService.info(
      `Auto-link complete for transaction ${transactionId}: ${result.linked} linked, ${result.skipped} skipped`,
      "MessageMatchingService"
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Auto-link failed: ${errorMsg}`);
    logService.error(
      `Auto-link failed for transaction ${transactionId}: ${errorMsg}`,
      "MessageMatchingService"
    );
    return result;
  }
}

export default {
  normalizePhone,
  phonesMatch,
  getTransactionContactPhones,
  findTextMessagesByPhones,
  createCommunicationReference,
  autoLinkTextsToTransaction,
};
