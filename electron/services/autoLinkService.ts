/**
 * Auto-Link Service
 *
 * Automatically links existing communications (emails and iMessages/SMS) when a
 * contact is added to a transaction. This eliminates the manual process of
 * attaching messages after adding a contact.
 *
 * @see TASK-1031
 */

import { dbAll, dbGet, dbRun } from "./db/core/dbConnection";
import logService from "./logService";
import { normalizePhone } from "./messageMatchingService";
import {
  createThreadCommunicationReference,
  isThreadLinkedToTransaction,
} from "./db/communicationDbService";
import { computeTransactionDateRange } from "../utils/emailDateRange";


// ============================================
// TYPES
// ============================================

/**
 * Options for auto-linking communications
 */
export interface AutoLinkOptions {
  /** Contact ID to link communications for */
  contactId: string;
  /** Transaction ID to link communications to */
  transactionId: string;
  /** Optional date range (if not provided, uses transaction dates or 6 months) */
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Result of auto-linking communications for a contact
 *
 * TASK-1115: Updated to track thread-level linking.
 * messagesLinked now represents threads linked, not individual messages.
 */
export interface AutoLinkResult {
  /** Number of emails successfully linked */
  emailsLinked: number;
  /** Number of message threads successfully linked (TASK-1115: thread-level) */
  messagesLinked: number;
  /** Number of communications that were already linked */
  alreadyLinked: number;
  /** Number of errors encountered */
  errors: number;
}

/**
 * Contact info needed for auto-linking
 */
interface ContactInfo {
  id: string;
  emails: string[];
  phoneNumbers: string[];
}

/**
 * Transaction info needed for auto-linking (dates + user ID)
 */
interface TransactionInfo {
  userId: string;
  started_at: string | null;
  created_at: string | null;
  closed_at: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a contact's email addresses and phone numbers
 */
async function getContactInfo(contactId: string): Promise<ContactInfo | null> {
  // Get contact to verify it exists
  const contactSql = "SELECT id FROM contacts WHERE id = ?";
  const contact = dbGet<{ id: string }>(contactSql, [contactId]);

  if (!contact) {
    return null;
  }

  // Get all email addresses for this contact
  const emailsSql = `
    SELECT email FROM contact_emails
    WHERE contact_id = ?
  `;
  const emailRows = dbAll<{ email: string }>(emailsSql, [contactId]);
  const emails = emailRows.map((r) => r.email.toLowerCase().trim());

  // Get all phone numbers for this contact
  const phonesSql = `
    SELECT phone_e164 FROM contact_phones
    WHERE contact_id = ?
  `;
  const phoneRows = dbAll<{ phone_e164: string }>(phonesSql, [contactId]);
  const phoneNumbers = phoneRows
    .map((r) => normalizePhone(r.phone_e164))
    .filter((p): p is string => p !== null);

  return {
    id: contactId,
    emails,
    phoneNumbers,
  };
}

/**
 * Get transaction info (dates + user ID) for auto-linking.
 * TASK-2068: Date-range computation is now delegated to computeTransactionDateRange().
 */
async function getTransactionInfo(
  transactionId: string
): Promise<TransactionInfo | null> {
  const sql = `
    SELECT
      user_id,
      started_at,
      created_at,
      closed_at
    FROM transactions
    WHERE id = ?
  `;

  const transaction = dbGet<{
    user_id: string;
    started_at: string | null;
    created_at: string | null;
    closed_at: string | null;
  }>(sql, [transactionId]);

  if (!transaction) {
    return null;
  }

  return {
    userId: transaction.user_id,
    started_at: transaction.started_at,
    created_at: transaction.created_at,
    closed_at: transaction.closed_at,
  };
}

/**
 * Find unlinked emails matching the given email addresses.
 *
 * IMPORTANT: Emails are stored in the `communications` table (not `messages`).
 * The `messages` table is used for iMessages/SMS only.
 *
 * This function finds communications that:
 * 1. Belong to this user
 * 2. Are emails (have email_id set)
 * 3. Are NOT already linked to this transaction
 * 4. Match the contact's email addresses (sender or recipients)
 * 5. Fall within the date range
 * 6. EXCLUDES the user's own email (user shouldn't be treated as a contact)
 */
async function findEmailsByContactEmails(
  userId: string,
  emails: string[],
  transactionId: string,
  dateRange: { start: Date; end: Date }
): Promise<string[]> {
  if (emails.length === 0) {
    return [];
  }

  // Get the user's email to exclude it from contact matching
  const userSql = "SELECT email FROM users_local WHERE id = ?";
  const userResult = dbGet<{ email: string | null }>(userSql, [userId]);
  const userEmail = userResult?.email?.toLowerCase().trim();

  // Filter out user's own email from contact emails
  // The user's email should never be treated as a contact
  const contactEmails = emails.filter((email) => {
    const normalizedEmail = email.toLowerCase().trim();
    return normalizedEmail !== userEmail;
  });

  if (contactEmails.length === 0) {
    await logService.debug(
      "No contact emails to match after filtering user's own email",
      "AutoLinkService",
      { userId, userEmail, originalEmails: emails }
    );
    return [];
  }

  // Build email patterns for LIKE matching (sender, recipients, and cc)
  // BACKLOG-506: Query emails table (content) and check communications (junction) for links
  const emailConditions = contactEmails
    .map(() => "(LOWER(e.sender) LIKE ? OR LOWER(e.recipients) LIKE ? OR LOWER(e.cc) LIKE ?)")
    .join(" OR ");

  const params: (string | number)[] = [userId, transactionId];

  // Add email patterns
  for (const email of contactEmails) {
    params.push(`%${email}%`, `%${email}%`, `%${email}%`);
  }

  // Add date range
  params.push(dateRange.start.toISOString());
  params.push(dateRange.end.toISOString());

  // BACKLOG-506: Query emails table for content, check if already linked via communications
  // No LIMIT — local SQLite queries are fast and we want to link all matching emails
  const sql = `
    SELECT e.id
    FROM emails e
    LEFT JOIN communications c ON c.email_id = e.id AND c.transaction_id = ?
    WHERE e.user_id = ?
      AND c.id IS NULL
      AND (${emailConditions})
      AND e.sent_at >= ?
      AND e.sent_at <= ?
    ORDER BY e.sent_at DESC
  `;

  // Reorder params: transactionId for JOIN, userId for WHERE, then email patterns, then date range
  const reorderedParams: (string | number)[] = [transactionId, userId];
  for (const email of contactEmails) {
    reorderedParams.push(`%${email}%`, `%${email}%`, `%${email}%`);
  }
  reorderedParams.push(dateRange.start.toISOString());
  reorderedParams.push(dateRange.end.toISOString());

  const results = dbAll<{ id: string }>(sql, reorderedParams);
  return results.map((r) => r.id);
}

/**
 * Message with thread information for thread-level linking
 *
 * TASK-1115: Now returns thread_id for grouping messages by conversation.
 */
interface MessageWithThread {
  id: string;
  thread_id: string | null;
}

/**
 * Find unlinked text messages matching the given phone numbers.
 *
 * TASK-1115: Now returns thread_id for thread-level linking.
 * Messages without thread_id will be linked individually (backward compat).
 */
async function findMessagesByContactPhones(
  userId: string,
  phoneNumbers: string[],
  transactionId: string,
  dateRange: { start: Date; end: Date }
): Promise<MessageWithThread[]> {
  if (phoneNumbers.length === 0) {
    return [];
  }

  // Build phone patterns for matching
  // Use participants_flat which contains normalized phone digits
  const phoneConditions = phoneNumbers
    .map(() => "m.participants_flat LIKE ?")
    .join(" OR ");

  const params: (string | number)[] = [userId, transactionId, transactionId];

  // Add phone patterns — use last 10 digits for suffix matching.
  // participants_flat may store phones with or without country code
  // (e.g. "13609181693" vs "3609181693"), so matching on the last 10
  // digits ensures both formats are found.
  for (const phone of phoneNumbers) {
    const digits = phone.replace(/\D/g, "");
    const matchDigits = digits.length > 10 ? digits.slice(-10) : digits;
    params.push(`%${matchDigits}%`);
  }

  // Add date range
  params.push(dateRange.start.toISOString());
  params.push(dateRange.end.toISOString());

  // TASK-1115: Select DISTINCT threads to avoid missing threads due to LIMIT
  // No LIMIT — local SQLite queries are fast and we want to link all matching threads
  const sql = `
    SELECT DISTINCT m.thread_id, MIN(m.id) as id
    FROM messages m
    WHERE m.user_id = ?
      AND m.channel IN ('sms', 'imessage')
      AND m.duplicate_of IS NULL
      AND (
        m.transaction_id IS NULL
        OR m.transaction_id != ?
      )
      AND m.thread_id NOT IN (
        SELECT thread_id FROM communications
        WHERE transaction_id = ? AND thread_id IS NOT NULL
      )
      AND (${phoneConditions})
      AND m.sent_at >= ?
      AND m.sent_at <= ?
    GROUP BY m.thread_id
    ORDER BY MAX(m.sent_at) DESC
  `;

  const results = dbAll<MessageWithThread>(sql, params);
  return results;
}

/**
 * Link an existing communication record to a transaction.
 *
 * For emails that are already in the communications table,
 * we update their transaction_id directly instead of creating
 * a new reference.
 *
 * @param communicationId - The communication record ID
 * @param transactionId - The transaction to link to
 * @param linkSource - How the link was created
 * @param linkConfidence - Confidence score
 * @returns true if linked, false if already linked to this transaction
 */
async function linkEmailToTransaction(
  emailId: string,
  transactionId: string,
  linkSource: "auto" | "manual" | "scan" = "auto",
  linkConfidence: number = 0.85
): Promise<"linked" | "already_linked" | "error"> {
  // Check if this email is already linked to this transaction via communications table
  const checkSql = `
    SELECT id, transaction_id FROM communications
    WHERE email_id = ? AND transaction_id = ?
  `;
  const existing = dbGet<{ id: string; transaction_id: string }>(checkSql, [emailId, transactionId]);

  if (existing) {
    // Already linked to this transaction
    return "already_linked";
  }

  // Get the email's user_id to create a proper communication record
  const emailRow = dbGet<{ user_id: string }>(
    "SELECT user_id FROM emails WHERE id = ?",
    [emailId]
  );

  if (!emailRow) {
    await logService.warn(
      `Email ${emailId} not found when trying to link`,
      "AutoLinkService"
    );
    return "error";
  }

  // Create a new communication record linking this email to the transaction
  const { v4: uuidv4 } = await import("uuid");
  const insertSql = `
    INSERT INTO communications (id, user_id, transaction_id, email_id, link_source, link_confidence, linked_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  dbRun(insertSql, [
    uuidv4(),
    emailRow.user_id,
    transactionId,
    emailId,
    linkSource,
    linkConfidence,
  ]);

  return "linked";
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Auto-link communications for a contact added to a transaction.
 *
 * This function:
 * 1. Gets the contact's email addresses and phone numbers
 * 2. Searches for emails matching those addresses
 * 3. Searches for text messages matching those phone numbers
 * 4. Links found communications to the transaction
 * 5. Returns counts for user notification
 *
 * @param options - Auto-link options including contactId and transactionId
 * @returns Result with counts of linked communications
 */
export async function autoLinkCommunicationsForContact(
  options: AutoLinkOptions
): Promise<AutoLinkResult> {
  const { contactId, transactionId } = options;

  const result: AutoLinkResult = {
    emailsLinked: 0,
    messagesLinked: 0,
    alreadyLinked: 0,
    errors: 0,
  };

  const startTime = Date.now();

  try {
    // 1. Get contact info (emails and phone numbers)
    const contactInfo = await getContactInfo(contactId);

    if (!contactInfo) {
      await logService.warn(
        `Contact not found for auto-link: ${contactId}`,
        "AutoLinkService"
      );
      return result;
    }

    // Skip if contact has no email or phone
    if (contactInfo.emails.length === 0 && contactInfo.phoneNumbers.length === 0) {
      await logService.debug(
        `Contact ${contactId} has no email or phone, skipping auto-link`,
        "AutoLinkService"
      );
      return result;
    }

    // 2. Get transaction info
    const transactionInfo = await getTransactionInfo(transactionId);

    if (!transactionInfo) {
      await logService.warn(
        `Transaction not found for auto-link: ${transactionId}`,
        "AutoLinkService"
      );
      return result;
    }

    const { userId } = transactionInfo;

    // 3. Determine date range for filtering
    // TASK-2068: Use canonical computeTransactionDateRange for date logic
    const dateRange: { start: Date; end: Date } = options.dateRange
      ? options.dateRange
      : computeTransactionDateRange({
          started_at: transactionInfo.started_at,
          created_at: transactionInfo.created_at,
          closed_at: transactionInfo.closed_at,
        });

    await logService.info(
      `Auto-linking communications for contact ${contactId} to transaction ${transactionId}`,
      "AutoLinkService",
      {
        emails: contactInfo.emails.length,
        phones: contactInfo.phoneNumbers.length,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
      }
    );

    // 4. Find matching emails (from communications table)
    const emailIds = await findEmailsByContactEmails(
      userId,
      contactInfo.emails,
      transactionId,
      dateRange
    );

    await logService.debug(
      `Found ${emailIds.length} matching emails for contact ${contactId}`,
      "AutoLinkService",
      { emailIds, contactEmails: contactInfo.emails }
    );

    // 5. Find matching text messages (from messages table)
    // Auto-linking messages to a transaction for an assigned contact is always
    // enabled. The "inferred messages" preference only gates contact *discovery*
    // from messages — it should NOT prevent linking messages for known contacts.
    let messagesWithThreads: MessageWithThread[] = [];
    if (contactInfo.phoneNumbers.length > 0) {
      messagesWithThreads = await findMessagesByContactPhones(
        userId,
        contactInfo.phoneNumbers,
        transactionId,
        dateRange
      );

      await logService.debug(
        `Found ${messagesWithThreads.length} matching messages for contact ${contactId}`,
        "AutoLinkService",
        {
          messageCount: messagesWithThreads.length,
          contactPhones: contactInfo.phoneNumbers,
        }
      );
    }

    // 6. Link emails to transaction
    // Creates communication records linking emails to the transaction
    for (const emailId of emailIds) {
      try {
        const linkResult = await linkEmailToTransaction(
          emailId,
          transactionId,
          "auto",
          0.85 // Email matching confidence
        );

        if (linkResult === "linked") {
          result.emailsLinked++;
        } else if (linkResult === "already_linked") {
          result.alreadyLinked++;
        } else {
          result.errors++;
        }
      } catch (error) {
        result.errors++;
        await logService.warn(
          `Failed to link email ${emailId}: ${error instanceof Error ? error.message : "Unknown"}`,
          "AutoLinkService"
        );
      }
    }

    // 7. Link text messages to transaction at THREAD level
    // TASK-1115: Group messages by thread_id and link once per thread
    const threadIds = new Set<string>();
    const messagesWithoutThread: string[] = [];

    for (const msg of messagesWithThreads) {
      if (msg.thread_id) {
        threadIds.add(msg.thread_id);
      } else {
        // Messages without thread_id will be skipped for now
        // They'll be picked up once thread_id is populated
        messagesWithoutThread.push(msg.id);
      }
    }

    await logService.debug(
      `Grouped ${messagesWithThreads.length} messages into ${threadIds.size} threads`,
      "AutoLinkService",
      {
        threadCount: threadIds.size,
        messagesWithoutThread: messagesWithoutThread.length,
      }
    );

    // Link each unique thread once
    for (const threadId of threadIds) {
      try {
        // Check if thread is already linked to avoid duplicates
        const alreadyLinked = await isThreadLinkedToTransaction(
          threadId,
          transactionId
        );

        if (alreadyLinked) {
          result.alreadyLinked++;
          continue;
        }

        await createThreadCommunicationReference(
          threadId,
          transactionId,
          userId,
          "auto",
          0.9 // Phone matching confidence
        );

        result.messagesLinked++; // Now represents threads linked
      } catch (error) {
        result.errors++;
        await logService.warn(
          `Failed to link thread ${threadId}: ${error instanceof Error ? error.message : "Unknown"}`,
          "AutoLinkService"
        );
      }
    }

    const duration = Date.now() - startTime;

    await logService.info(
      `Auto-link complete for contact ${contactId}`,
      "AutoLinkService",
      {
        emailsLinked: result.emailsLinked,
        messagesLinked: result.messagesLinked,
        alreadyLinked: result.alreadyLinked,
        errors: result.errors,
        durationMs: duration,
      }
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logService.error(
      `Auto-link failed for contact ${contactId}: ${errorMessage}`,
      "AutoLinkService"
    );

    return result;
  }
}

export default {
  autoLinkCommunicationsForContact,
};
