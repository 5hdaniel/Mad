/**
 * Get Earliest Communication Date
 * Standalone utility function extracted from transactionService.ts.
 * Used by the audit wizard to auto-detect the start date for a transaction.
 */

import { dbGet, dbAll } from "../db/core/dbConnection";

/**
 * Get the earliest communication date (email or message) for a set of contacts.
 * Used by the audit wizard to auto-detect the start date for a transaction.
 *
 * @param contactIds - Array of contact IDs to search communications for
 * @param userId - The user ID who owns the communications
 * @returns ISO date string of the earliest communication, or null if none found
 */
export function getEarliestCommunicationDate(
  contactIds: string[],
  userId: string,
): string | null {
  if (!contactIds || contactIds.length === 0) {
    return null;
  }

  // Get email addresses for the contacts
  const emailPlaceholders = contactIds.map(() => "?").join(", ");
  const contactEmails = dbAll<{ email: string }>(
    `SELECT DISTINCT LOWER(email) as email FROM contact_emails WHERE contact_id IN (${emailPlaceholders})`,
    contactIds,
  );

  // Get phone numbers for the contacts
  const contactPhones = dbAll<{ phone_e164: string }>(
    `SELECT DISTINCT phone_e164 FROM contact_phones WHERE contact_id IN (${emailPlaceholders})`,
    contactIds,
  );

  let earliestEmail: string | null = null;
  let earliestMessage: string | null = null;

  // Query 1: Find earliest email matching contact email addresses
  if (contactEmails.length > 0) {
    // Build conditions for each email address
    const emailConditions = contactEmails.map(
      () => "(LOWER(e.sender) LIKE '%' || ? || '%' OR LOWER(e.recipients) LIKE '%' || ? || '%')"
    ).join(" OR ");

    const emailParams: unknown[] = [userId];
    for (const ce of contactEmails) {
      emailParams.push(ce.email, ce.email);
    }

    const emailResult = dbGet<{ earliest: string | null }>(
      `SELECT MIN(e.sent_at) as earliest
       FROM emails e
       WHERE e.user_id = ?
         AND (${emailConditions})
         AND e.sent_at IS NOT NULL`,
      emailParams,
    );

    if (emailResult?.earliest) {
      earliestEmail = emailResult.earliest;
    }
  }

  // Query 2: Find earliest message matching contact phone numbers
  if (contactPhones.length > 0) {
    // Normalize phone numbers (strip non-digits) for participants_flat matching
    const normalizedPhones = contactPhones
      .map((cp) => cp.phone_e164.replace(/\D/g, ""))
      .filter((p) => p.length > 0);

    if (normalizedPhones.length > 0) {
      const phoneConditions = normalizedPhones
        .map(() => "m.participants_flat LIKE '%' || ? || '%'")
        .join(" OR ");

      const messageResult = dbGet<{ earliest: string | null }>(
        `SELECT MIN(m.sent_at) as earliest
         FROM messages m
         WHERE m.user_id = ?
           AND m.channel IN ('sms', 'imessage')
           AND m.duplicate_of IS NULL
           AND (${phoneConditions})
           AND m.sent_at IS NOT NULL`,
        [userId, ...normalizedPhones],
      );

      if (messageResult?.earliest) {
        earliestMessage = messageResult.earliest;
      }
    }
  }

  // Return the earlier of the two dates
  if (earliestEmail && earliestMessage) {
    return earliestEmail < earliestMessage ? earliestEmail : earliestMessage;
  }
  return earliestEmail || earliestMessage;
}
