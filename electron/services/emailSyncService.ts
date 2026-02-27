// ============================================
// EMAIL SYNC SERVICE
// Extracted from emailSyncHandlers.ts (TASK-2066)
//
// Encapsulates the full email sync orchestration:
// - Provider fetch (Outlook inbox/sent/all-folders + Gmail search/all-labels)
// - Store & dedup logic
// - Auto-link loop for each contact
// - Attachment backfill
// - Network resilience wrapping
// ============================================

import * as Sentry from "@sentry/electron/main";
import logService from "./logService";
import { autoLinkCommunicationsForContact } from "./autoLinkService";
import type { AutoLinkResult } from "./autoLinkService";
import { createEmail, getEmailByExternalId, countEmailsByUser } from "./db/emailDbService";
import { dbGet } from "./db/core/dbConnection";
import gmailFetchService from "./gmailFetchService";
import outlookFetchService from "./outlookFetchService";
import databaseService from "./databaseService";
import failureLogService from "./failureLogService";
import emailAttachmentService from "./emailAttachmentService";
import { backfillMissingAttachments } from "../handlers/attachmentHandlers";
import { isNetworkError } from "../utils/networkErrors";
import { retryOnNetwork, networkResilienceService } from "./networkResilience";
import { computeTransactionDateRange } from "../utils/emailDateRange";
import {
  getContactEmailsForTransaction,
  resolveContactEmailsByQuery,
} from "./db/contactDbService";
import { getEmailsByContactId } from "./db/contactDbService";
import type { TransactionResponse } from "../types/handlerTypes";
import type { TransactionContactResult } from "./db/transactionContactDbService";
import type { TransactionWithDetails } from "./transactionService/types";

// TASK-2060: Safety cap for email fetching with date-range filtering.
// With date filtering, we no longer need the old 200 cap. This higher cap
// serves as a safety valve to prevent runaway fetches for extremely high-volume contacts.
export const EMAIL_FETCH_SAFETY_CAP = 2000;

// ============================================
// TASK-2070: Provider error classification
// ============================================

/**
 * Determines if an error is caused by an expired or revoked OAuth token.
 * These errors require the user to re-authenticate (reconnect) in Settings.
 *
 * Matches patterns from Outlook (AADSTS50173, 401, "token expired") and
 * Gmail ("invalid_grant", "Token has been expired or revoked").
 */
export function isTokenExpiryError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : (error as { message?: string })?.message ?? "";
  const lowerMessage = message.toLowerCase();

  // Check for HTTP 401 status (common for expired tokens)
  const status = (error as { response?: { status?: number } })?.response?.status
    ?? (error as { status?: number })?.status;
  if (status === 401) return true;

  // Outlook-specific: AADSTS error codes for expired/revoked tokens
  if (/aadsts\d+/i.test(message)) return true;

  // Common token expiry patterns
  const tokenPatterns = [
    "token expired",
    "token has been expired",
    "token has been revoked",
    "invalid_grant",
    "access token expired",
    "refresh failed",
    "please reconnect",
    "invalidauthenticationtoken",
    "compacttoken",
  ];

  return tokenPatterns.some((pattern) => lowerMessage.includes(pattern));
}

/**
 * Returns a user-facing warning message based on the type of provider error.
 * Token expiry errors get a reconnect message; other errors get a generic message.
 */
export function classifyProviderError(error: unknown): string {
  if (isTokenExpiryError(error)) {
    return "Your email connection has expired. Please reconnect in Settings.";
  }
  return "Could not reach your email provider. Showing cached results only.";
}

// TASK-2060: Safety cap for sent items (per-contact email search)
export const SENT_ITEMS_SAFETY_CAP = 200;

// ============================================
// TASK-2067: Types for new service methods
// ============================================

/**
 * Search parameters passed from the get-unlinked-emails handler.
 */
export interface EmailSearchParams {
  query: string;
  after: Date | null;
  before: Date | null;
  maxResults: number;
  skip?: number;
  contactEmails?: string[];
}

/**
 * A single email result returned to the renderer (matches existing IPC shape).
 */
export interface ProviderEmailResult {
  id: string;
  subject: string | null;
  sender: string | null;
  sent_at: string | null;
  body_preview?: string | null;
  email_thread_id?: string | null;
  has_attachments?: boolean;
  provider: "gmail" | "outlook";
}

/**
 * Result of searching provider emails and storing them locally.
 */
export interface SearchProviderEmailsResult {
  emails: ProviderEmailResult[];
  noProviderConnected: boolean;
  /** TASK-2070: Warning message when provider fetch failed (token expiry, API error) */
  warning?: string;
}

/**
 * Result of fetching from provider + auto-linking for a contact.
 */
export interface FetchAndAutoLinkResult {
  emailsFetched: number;
  emailsStored: number;
  autoLinkResult: AutoLinkResult;
}

/**
 * TASK-2060: Shared helper for fetching emails from a provider, storing them locally,
 * and deduplicating by external ID.
 *
 * This replaces the duplicated fetch-store-dedup pattern that was repeated for each
 * provider path (Outlook inbox, sent, all-folders, Gmail search, all-labels).
 *
 * Preserves:
 * - Individual email save pattern (TASK-2049: each email saved independently)
 * - Network error propagation (for retryOnNetwork wrapper)
 * - Attachment download with non-blocking error handling
 *
 * @returns Object with counts of fetched, stored, and errored emails
 */
async function fetchStoreAndDedup(params: {
  provider: "outlook" | "gmail";
  fetchFn: () => Promise<Array<{
    id: string;
    threadId: string;
    from?: string | null;
    to?: string | null;
    cc?: string | null;
    subject?: string | null;
    body: string;
    bodyPlain: string;
    date: Date;
    hasAttachments: boolean;
    attachmentCount: number;
    attachments?: Array<{
      filename?: string;
      name?: string;
      mimeType?: string;
      contentType?: string;
      size?: number;
      attachmentId?: string;
      id?: string;
    }>;
  }>>;
  userId: string;
  seenIds: Set<string>;
  /** For Outlook: function to get Graph API attachments by message ID */
  getAttachmentsFn?: (messageId: string) => Promise<Array<{ id: string; name: string; contentType: string; size: number }>>;
}): Promise<{ fetched: number; stored: number; errors: number }> {
  const { provider, fetchFn, userId, seenIds, getAttachmentsFn } = params;
  let fetched = 0;
  let stored = 0;
  let errors = 0;

  const emails = await fetchFn();

  // Dedup against previously seen IDs
  const newEmails = emails.filter((e) => {
    if (seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });

  fetched = newEmails.length;

  // TASK-2049: Store emails individually -- each saved email is preserved
  // even if a subsequent save or fetch fails due to network disconnect
  for (const email of newEmails) {
    try {
      let emailRecord = await getEmailByExternalId(userId, email.id);
      if (!emailRecord) {
        emailRecord = await createEmail({
          user_id: userId,
          external_id: email.id,
          source: provider,
          thread_id: email.threadId,
          sender: email.from ?? undefined,
          recipients: email.to ?? undefined,
          cc: email.cc ?? undefined,
          subject: email.subject ?? undefined,
          body_html: email.body,
          body_plain: email.bodyPlain,
          sent_at: email.date ? new Date(email.date).toISOString() : undefined,
          has_attachments: email.hasAttachments || false,
          attachment_count: email.attachmentCount || 0,
        });
        stored++;

        // Download attachments if present
        if (email.hasAttachments && emailRecord) {
          try {
            if (provider === "outlook" && getAttachmentsFn) {
              // Outlook: fetch attachment metadata from Graph API
              const graphAttachments = await getAttachmentsFn(email.id);
              if (graphAttachments.length > 0) {
                await emailAttachmentService.downloadEmailAttachments(
                  userId,
                  emailRecord.id,
                  email.id,
                  "outlook",
                  graphAttachments.map((att) => ({
                    filename: att.name || "attachment",
                    mimeType: att.contentType || "application/octet-stream",
                    size: att.size || 0,
                    attachmentId: att.id,
                  })),
                );
              }
            } else if (provider === "gmail" && email.attachments && email.attachments.length > 0) {
              // Gmail: attachment metadata is included in searchEmails response
              await emailAttachmentService.downloadEmailAttachments(
                userId,
                emailRecord.id,
                email.id,
                "gmail",
                email.attachments.map((att) => ({
                  filename: att.filename || att.name || "attachment",
                  mimeType: att.mimeType || att.contentType || "application/octet-stream",
                  size: att.size || 0,
                  attachmentId: att.attachmentId || att.id || "",
                })),
              );
            }
          } catch (attError) {
            // Attachment download failure is non-blocking for email save
            if (!isNetworkError(attError)) {
              logService.warn(`Failed to download ${provider} attachments during sync`, "Transactions", {
                emailId: emailRecord.id,
                error: attError instanceof Error ? attError.message : "Unknown",
              });
            }
            // Network errors on attachment download are non-fatal; email is already saved
          }
        }
      }
    } catch (emailError) {
      errors++;
      logService.warn(`Failed to store ${provider} email`, "Transactions", {
        error: emailError instanceof Error ? emailError.message : "Unknown",
      });
    }
  }

  return { fetched, stored, errors };
}

/**
 * TASK-2066: EmailSyncService encapsulates the full email sync orchestration.
 *
 * Extracted from the `sync-and-fetch-emails` IPC handler to keep handlers thin
 * (validation + rate limiting + delegation) while service owns business logic.
 */
class EmailSyncService {
  /**
   * Sync emails from provider(s) for a transaction, then auto-link communications.
   *
   * Steps:
   * 1. Compute date range from transaction details
   * 2. Fetch emails from Outlook (inbox/sent/all-folders) with network resilience
   * 3. Fetch emails from Gmail (search/all-labels) with network resilience
   * 4. Auto-link communications for each contact assignment
   * 5. Backfill missing attachments
   */
  async syncTransactionEmails(params: {
    transactionId: string;
    userId: string;
    contactAssignments: TransactionContactResult[];
    contactEmails: string[];
    transactionDetails: TransactionWithDetails;
  }): Promise<TransactionResponse> {
    const { transactionId, userId, contactAssignments, contactEmails, transactionDetails } = params;

    if (contactEmails.length === 0) {
      // No contact emails -- still run auto-link for phone-based message matching
      return this.runAutoLinkOnly(transactionId, contactAssignments);
    }

    // Diagnostic: how many emails are in the local DB for this user?
    const emailCount = await countEmailsByUser(userId);
    logService.info(`Local emails table has ${emailCount} emails for user`, "Transactions", {
      userId,
    });

    // Step 1: Fetch emails from provider and store locally
    // The auto-link searches the local emails table, so we need to ensure
    // relevant emails are downloaded first.
    // TASK-2049: Wrapped with network resilience -- partial save on disconnect,
    // retry with exponential backoff, auto-retry on reconnect
    let emailsFetched = 0;
    let emailsStored = 0;
    let networkErrorOccurred = false;
    let networkErrorMessage = "";

    // TASK-2060/2068: Compute date range for email fetching based on transaction audit period.
    // Uses canonical computeTransactionDateRange from electron/utils/emailDateRange.ts.
    const emailFetchSinceDate = computeTransactionDateRange(transactionDetails).start;
    logService.info(`Email fetch date range: since ${emailFetchSinceDate.toISOString()}`, "Transactions", {
      transactionId,
      sinceDate: emailFetchSinceDate.toISOString(),
      source: transactionDetails.started_at ? "started_at" : transactionDetails.created_at ? "created_at" : "fallback_2yr",
    });

    // TASK-2060: Shared seenIds set for cross-provider deduplication
    const seenEmailIds = new Set<string>();

    // TASK-2070: Track provider errors for UI warning
    let providerWarning = "";

    // Try Outlook (TASK-2049: with network resilience)
    const outlookResult = await this.fetchOutlookEmails({
      userId,
      transactionId,
      contactEmails,
      emailFetchSinceDate,
      seenEmailIds,
    });
    emailsFetched += outlookResult.fetched;
    emailsStored += outlookResult.stored;
    if (outlookResult.networkError) {
      networkErrorOccurred = true;
      networkErrorMessage = outlookResult.networkErrorMessage || "";
    }
    if (outlookResult.providerError) {
      providerWarning = outlookResult.providerError;
    }

    // Try Gmail (bidirectional: from + to contacts) (TASK-2049: with network resilience)
    const gmailResult = await this.fetchGmailEmails({
      userId,
      transactionId,
      contactEmails,
      emailFetchSinceDate,
      seenEmailIds,
      currentEmailsStored: emailsStored,
    });
    emailsFetched += gmailResult.fetched;
    emailsStored += gmailResult.stored;
    if (gmailResult.networkError) {
      networkErrorOccurred = true;
      networkErrorMessage = gmailResult.networkErrorMessage || "";
    }
    if (gmailResult.providerError && !providerWarning) {
      providerWarning = gmailResult.providerError;
    }

    logService.info(`Email fetch complete: ${emailsFetched} fetched, ${emailsStored} new stored`, "Transactions");

    // Step 2: Auto-link from local DB
    Sentry.addBreadcrumb({
      category: 'sync',
      message: 'Auto-link started',
      level: 'info',
      data: {
        operation: 'sync-and-fetch-emails',
        contactCount: contactAssignments.length,
      },
    });
    let totalEmailsLinked = 0;
    let totalMessagesLinked = 0;
    let totalAlreadyLinked = 0;
    let totalErrors = 0;

    for (const assignment of contactAssignments) {
      try {
        const result = await autoLinkCommunicationsForContact({
          contactId: assignment.contact_id,
          transactionId,
        });

        totalEmailsLinked += result.emailsLinked;
        totalMessagesLinked += result.messagesLinked;
        totalAlreadyLinked += result.alreadyLinked;
        totalErrors += result.errors;
      } catch (error) {
        totalErrors++;
        logService.warn(
          `Auto-link failed for contact ${assignment.contact_id}`,
          "Transactions",
          {
            error: error instanceof Error ? error.message : "Unknown",
          }
        );
      }
    }

    Sentry.addBreadcrumb({
      category: 'sync',
      message: 'Auto-link completed',
      level: 'info',
      data: {
        operation: 'sync-and-fetch-emails',
        totalEmailsLinked,
        totalMessagesLinked,
        totalErrors,
      },
    });

    // Step 3: Backfill any missing attachments for previously-synced emails
    const backfillResult = await backfillMissingAttachments(userId);

    logService.info("Sync and fetch emails complete", "Transactions", {
      transactionId,
      contactEmails,
      totalEmailsLinked,
      totalMessagesLinked,
      totalAlreadyLinked,
      totalErrors,
      attachmentsBackfilled: backfillResult.downloaded,
      networkErrorOccurred,
    });

    // TASK-2049: Return partial success when network error occurred but some emails were saved
    if (networkErrorOccurred) {
      return {
        success: false,
        error: networkErrorMessage || "Network disconnected during email sync. Already-fetched emails have been saved.",
        partialSync: true,
        emailsFetched,
        emailsStored,
        totalEmailsLinked,
        totalMessagesLinked,
        totalAlreadyLinked,
        totalErrors,
      };
    }

    // TASK-2070: Include warning when provider fetch failed but local results are available
    const result: TransactionResponse = {
      success: true,
      totalEmailsLinked,
      totalMessagesLinked,
      totalAlreadyLinked,
      totalErrors,
    };
    if (providerWarning) {
      result.warning = providerWarning;
    }
    return result;
  }

  /**
   * Run auto-link only (no email fetching) -- used when there are no contact emails
   * but we still want to link phone-based messages.
   */
  private async runAutoLinkOnly(
    transactionId: string,
    contactAssignments: TransactionContactResult[],
  ): Promise<TransactionResponse> {
    let totalMessagesLinked = 0;
    let totalAlreadyLinked = 0;
    let totalErrors = 0;

    for (const assignment of contactAssignments) {
      try {
        const result = await autoLinkCommunicationsForContact({
          contactId: assignment.contact_id,
          transactionId,
        });
        totalMessagesLinked += result.messagesLinked;
        totalAlreadyLinked += result.alreadyLinked;
        totalErrors += result.errors;
      } catch (error) {
        totalErrors++;
        logService.warn(
          `Auto-link failed for contact ${assignment.contact_id}`,
          "Transactions",
          { error: error instanceof Error ? error.message : "Unknown" }
        );
      }
    }

    return {
      success: true,
      emailsFetched: 0,
      emailsStored: 0,
      totalEmailsLinked: 0,
      totalMessagesLinked,
      totalAlreadyLinked,
    };
  }

  // ============================================
  // TASK-2067: New public methods for Gap 1 & Gap 2
  // ============================================

  /**
   * TASK-2067 Gap 1: Search provider emails and store results locally.
   *
   * Wraps the provider search logic from the get-unlinked-emails handler
   * with fetchStoreAndDedup() so that fetched emails are persisted locally
   * even if the user doesn't manually attach them.
   *
   * Returns the same response shape the renderer expects.
   */
  async searchProviderEmails(params: {
    userId: string;
    searchParams: EmailSearchParams;
    transactionId?: string;
  }): Promise<SearchProviderEmailsResult> {
    const { userId, searchParams, transactionId } = params;

    // Look up contact emails for the transaction (if provided)
    let contactEmails: string[] = [];
    if (transactionId) {
      try {
        contactEmails = getContactEmailsForTransaction(transactionId);
        logService.info(`Found ${contactEmails.length} contact emails for transaction`, "EmailSyncService", {
          transactionId,
        });
      } catch (contactErr) {
        logService.warn("Failed to look up contact emails, proceeding without filter", "EmailSyncService", {
          error: contactErr instanceof Error ? contactErr.message : "Unknown",
        });
      }
    }

    // When user is actively searching, resolve query against contacts DB
    const effectiveSearchParams = { ...searchParams };
    if (searchParams.query?.trim()) {
      const resolvedEmails = resolveContactEmailsByQuery(userId, searchParams.query);
      if (resolvedEmails.length > 0) {
        effectiveSearchParams.contactEmails = resolvedEmails;
        effectiveSearchParams.query = "";
        logService.info(`Resolved query "${searchParams.query}" to ${resolvedEmails.length} contact emails`, "EmailSyncService", {
          resolvedEmails,
        });
      }
    }

    // Check which providers are authenticated
    const googleToken = await databaseService.getOAuthToken(userId, "google", "mailbox");
    const microsoftToken = await databaseService.getOAuthToken(userId, "microsoft", "mailbox");

    let emails: ProviderEmailResult[] = [];
    const seenIds = new Set<string>();
    // TASK-2070: Track provider errors for UI warning
    let providerWarning = "";

    // Fetch from Gmail if authenticated
    if (googleToken) {
      try {
        await retryOnNetwork(async () => {
          const isReady = await gmailFetchService.initialize(userId);
          if (isReady) {
            const gmailEmails = await gmailFetchService.searchEmails(effectiveSearchParams);

            // TASK-2067: Store fetched emails locally via fetchStoreAndDedup
            await fetchStoreAndDedup({
              provider: "gmail",
              fetchFn: async () => gmailEmails,
              userId,
              seenIds,
            });

            emails = gmailEmails.map((email: { id: string; subject: string | null; from: string | null; date: Date; bodyPlain: string; snippet: string; threadId: string; hasAttachments: boolean }) => ({
              id: `gmail:${email.id}`,
              subject: email.subject,
              sender: email.from,
              sent_at: email.date ? new Date(email.date).toISOString() : null,
              body_preview: (email.snippet || email.bodyPlain?.substring(0, 200)) || null,
              email_thread_id: email.threadId || null,
              has_attachments: email.hasAttachments || false,
              provider: "gmail" as const,
            }));
            logService.info(`Fetched and stored ${emails.length} emails from Gmail`, "EmailSyncService");
          }
        }, undefined, "GmailSearch");
      } catch (gmailError) {
        logService.warn("Failed to fetch from Gmail", "EmailSyncService", {
          error: gmailError instanceof Error ? gmailError.message : "Unknown",
          isNetworkError: isNetworkError(gmailError),
        });
        // TASK-2070: Classify provider error for UI warning
        if (!isNetworkError(gmailError)) {
          Sentry.captureException(gmailError, {
            tags: { service: "email-sync", operation: "provider-fetch", provider: "gmail" },
            level: "warning",
            fingerprint: ["provider-fetch-failure", "gmail"],
          });
          providerWarning = classifyProviderError(gmailError);
        } else {
          providerWarning = "Could not reach your email provider. Showing cached results only.";
        }
      }
    }

    // Fetch from Outlook if authenticated (and no Gmail emails)
    if (microsoftToken && emails.length === 0) {
      try {
        await retryOnNetwork(async () => {
          const isReady = await outlookFetchService.initialize(userId);
          if (isReady) {
            const outlookEmails = await outlookFetchService.searchEmails(effectiveSearchParams);

            // Also search sent items for emails TO contacts (bidirectional)
            let sentEmails: typeof outlookEmails = [];
            const sentSearchEmails = effectiveSearchParams.contactEmails || [];
            if (sentSearchEmails.length > 0) {
              try {
                sentEmails = await outlookFetchService.searchSentEmailsToContacts(
                  sentSearchEmails, Math.min(50, effectiveSearchParams.maxResults),
                );
              } catch { /* logged inside the method */ }
            }

            // Merge and dedup
            const allOutlook = [...outlookEmails, ...sentEmails];
            const outlookSeenIds = new Set<string>();
            const dedupedOutlook = allOutlook.filter(e => {
              if (outlookSeenIds.has(e.id)) return false;
              outlookSeenIds.add(e.id);
              return true;
            });

            // TASK-2067: Store fetched emails locally via fetchStoreAndDedup
            await fetchStoreAndDedup({
              provider: "outlook",
              fetchFn: async () => dedupedOutlook,
              userId,
              seenIds,
              getAttachmentsFn: (msgId) => outlookFetchService.getAttachments(msgId),
            });

            emails = dedupedOutlook.map((email: { id: string; subject: string | null; from: string | null; date: Date; bodyPlain: string; snippet: string; threadId: string; hasAttachments: boolean }) => ({
              id: `outlook:${email.id}`,
              subject: email.subject,
              sender: email.from,
              sent_at: email.date ? new Date(email.date).toISOString() : null,
              body_preview: (email.snippet || email.bodyPlain?.substring(0, 200)) || null,
              email_thread_id: email.threadId || null,
              has_attachments: email.hasAttachments || false,
              provider: "outlook" as const,
            }));
            logService.info(`Fetched and stored ${outlookEmails.length} inbox + ${sentEmails.length} sent = ${emails.length} unique from Outlook`, "EmailSyncService");
          }
        }, undefined, "OutlookSearch");
      } catch (outlookError) {
        logService.warn("Failed to fetch from Outlook", "EmailSyncService", {
          error: outlookError instanceof Error ? outlookError.message : "Unknown",
          isNetworkError: isNetworkError(outlookError),
        });
        // TASK-2070: Classify provider error for UI warning
        if (!providerWarning) {
          if (!isNetworkError(outlookError)) {
            Sentry.captureException(outlookError, {
              tags: { service: "email-sync", operation: "provider-fetch", provider: "outlook" },
              level: "warning",
              fingerprint: ["provider-fetch-failure", "outlook"],
            });
            providerWarning = classifyProviderError(outlookError);
          } else {
            providerWarning = "Could not reach your email provider. Showing cached results only.";
          }
        }
      }
    }

    // TASK-2070: Include warning when provider fetch failed
    const result: SearchProviderEmailsResult = {
      emails,
      noProviderConnected: emails.length === 0 && !googleToken && !microsoftToken,
    };
    if (providerWarning) {
      result.warning = providerWarning;
    }
    return result;
  }

  /**
   * TASK-2067 Gap 2: Fetch emails from provider for audit period, store locally,
   * then auto-link communications for a contact.
   *
   * Called when a contact is assigned to a transaction. This ensures provider emails
   * for the audit period are in the local DB before auto-link searches it.
   */
  /**
   * Check if local email cache extends back to before the audit start for given contact emails.
   * If we have cached emails from before the audit period started, a provider fetch is redundant.
   */
  private localCacheCoversAuditPeriod(
    userId: string,
    contactEmails: string[],
    auditStart: Date,
  ): boolean {
    if (contactEmails.length === 0) return false;

    const placeholders = contactEmails.map(() => "LOWER(?)").join(", ");
    const sql = `
      SELECT MIN(sent_at) as earliest, COUNT(*) as total
      FROM emails
      WHERE user_id = ?
        AND (LOWER(sender) IN (${placeholders}) OR ${contactEmails.map(() => "LOWER(recipients) LIKE ?").join(" OR ")})
    `;
    const lowerEmails = contactEmails.map(e => e.toLowerCase());
    const likeParams = contactEmails.map(e => `%${e.toLowerCase()}%`);
    const params = [userId, ...lowerEmails, ...likeParams];

    const row = dbGet<{ earliest: string | null; total: number }>(sql, params);

    if (!row || row.total === 0 || !row.earliest) {
      return false;
    }

    const earliest = new Date(row.earliest);
    const covers = earliest <= auditStart;

    logService.info(`Cache coverage check for contact`, "EmailSyncService", {
      cachedEmails: row.total,
      earliest: earliest.toISOString(),
      auditStart: auditStart.toISOString(),
      covers,
    });

    return covers;
  }

  async fetchAndAutoLinkForContact(params: {
    userId: string;
    transactionId: string;
    contactId: string;
    transactionDetails: {
      started_at?: Date | string | null;
      created_at?: Date | string | null;
      closed_at?: Date | string | null;
    };
  }): Promise<FetchAndAutoLinkResult> {
    const { userId, transactionId, contactId, transactionDetails } = params;

    // Get contact email addresses
    const contactEmails = getEmailsByContactId(contactId);

    let emailsFetched = 0;
    let emailsStored = 0;

    if (contactEmails.length > 0) {
      // Compute audit period date range
      const emailFetchSinceDate = computeTransactionDateRange(transactionDetails).start;

      // Skip provider fetch if local cache already covers the audit period for this contact
      if (this.localCacheCoversAuditPeriod(userId, contactEmails, emailFetchSinceDate)) {
        logService.info(`Skipping provider fetch — local cache covers audit period for contact`, "EmailSyncService", {
          transactionId,
          contactId,
          contactEmailCount: contactEmails.length,
        });
      } else {
      logService.info(`Fetching provider emails for contact assignment`, "EmailSyncService", {
        transactionId,
        contactId,
        contactEmailCount: contactEmails.length,
        sinceDate: emailFetchSinceDate.toISOString(),
      });

      const seenEmailIds = new Set<string>();

      // Fetch from Outlook
      const outlookResult = await this.fetchOutlookEmails({
        userId,
        transactionId,
        contactEmails,
        emailFetchSinceDate,
        seenEmailIds,
      });
      emailsFetched += outlookResult.fetched;
      emailsStored += outlookResult.stored;

      // Fetch from Gmail
      const gmailResult = await this.fetchGmailEmails({
        userId,
        transactionId,
        contactEmails,
        emailFetchSinceDate,
        seenEmailIds,
        currentEmailsStored: emailsStored,
      });
      emailsFetched += gmailResult.fetched;
      emailsStored += gmailResult.stored;

      logService.info(`Provider fetch for contact assignment complete`, "EmailSyncService", {
        transactionId,
        contactId,
        emailsFetched,
        emailsStored,
      });
      } // end else (provider fetch)
    }

    // Now auto-link from local DB (which includes newly fetched emails)
    const autoLinkResult = await autoLinkCommunicationsForContact({
      contactId,
      transactionId,
    });

    return {
      emailsFetched,
      emailsStored,
      autoLinkResult,
    };
  }

  /**
   * Fetch emails from Outlook (inbox, sent items, all folders) with network resilience.
   */
  private async fetchOutlookEmails(params: {
    userId: string;
    transactionId: string;
    contactEmails: string[];
    emailFetchSinceDate: Date;
    seenEmailIds: Set<string>;
  }): Promise<{ fetched: number; stored: number; networkError: boolean; networkErrorMessage?: string; providerError?: string }> {
    const { userId, transactionId, contactEmails, emailFetchSinceDate, seenEmailIds } = params;
    let fetched = 0;
    let stored = 0;

    Sentry.addBreadcrumb({
      category: 'sync',
      message: 'Outlook email fetch started',
      level: 'info',
      data: {
        syncType: 'emails',
        provider: 'outlook',
        operation: 'sync-and-fetch-emails',
        transactionId,
        contactEmailCount: contactEmails.length,
      },
    });

    try {
      await retryOnNetwork(async () => {
        const outlookReady = await outlookFetchService.initialize(userId);
        if (outlookReady) {
          // TASK-2060: Fetch inbox emails with date-range filtering via shared helper
          const inboxResult = await fetchStoreAndDedup({
            provider: "outlook",
            fetchFn: () => outlookFetchService.searchEmails({
              contactEmails,
              maxResults: EMAIL_FETCH_SAFETY_CAP,
              after: emailFetchSinceDate,
            }),
            userId,
            seenIds: seenEmailIds,
            getAttachmentsFn: (msgId) => outlookFetchService.getAttachments(msgId),
          });

          // TASK-2060: Fetch sent items with date-range filtering via shared helper
          const sentResult = await fetchStoreAndDedup({
            provider: "outlook",
            fetchFn: () => outlookFetchService.searchSentEmailsToContacts(
              contactEmails,
              SENT_ITEMS_SAFETY_CAP,
              emailFetchSinceDate,
            ),
            userId,
            seenIds: seenEmailIds,
            getAttachmentsFn: (msgId) => outlookFetchService.getAttachments(msgId),
          });

          // TASK-2046: Also fetch from all folders (custom folders, archives, etc.)
          let allFolderResult = { fetched: 0, stored: 0, errors: 0 };
          try {
            allFolderResult = await fetchStoreAndDedup({
              provider: "outlook",
              fetchFn: () => outlookFetchService.searchAllFolders({
                maxResults: EMAIL_FETCH_SAFETY_CAP,
                after: emailFetchSinceDate,
              }),
              userId,
              seenIds: seenEmailIds,
              getAttachmentsFn: (msgId) => outlookFetchService.getAttachments(msgId),
            });
            logService.info(`Fetched ${allFolderResult.fetched} emails from all Outlook folders`, "Transactions");
          } catch (folderError) {
            // TASK-2049: If folder fetch fails due to network, let it bubble up for retry
            if (isNetworkError(folderError)) throw folderError;
            logService.warn("Failed to fetch from all Outlook folders, continuing with inbox/sent only", "Transactions", {
              error: folderError instanceof Error ? folderError.message : "Unknown",
            });
          }

          const totalFetched = inboxResult.fetched + sentResult.fetched + allFolderResult.fetched;
          const totalStored = inboxResult.stored + sentResult.stored + allFolderResult.stored;
          fetched += totalFetched;
          stored += totalStored;

          logService.info(`Outlook sync: ${inboxResult.fetched} inbox + ${sentResult.fetched} sent + ${allFolderResult.fetched} all-folders = ${totalFetched} unique, ${totalStored} new stored`, "Transactions");

          // TASK-2060: Warn if safety cap was hit (may indicate missing emails)
          if (inboxResult.fetched >= EMAIL_FETCH_SAFETY_CAP) {
            logService.warn(`Outlook inbox fetch hit safety cap of ${EMAIL_FETCH_SAFETY_CAP}. Some emails may be missing.`, "Transactions");
          }
        }
      }, undefined, "OutlookSync");

      Sentry.addBreadcrumb({
        category: 'sync',
        message: 'Outlook email fetch completed',
        level: 'info',
        data: {
          syncType: 'emails',
          provider: 'outlook',
          operation: 'sync-and-fetch-emails',
          emailsFetched: fetched,
          emailsStored: stored,
        },
      });

      return { fetched, stored, networkError: false };
    } catch (outlookError) {
      if (isNetworkError(outlookError)) {
        // TASK-2049: Network error after all retries exhausted
        networkResilienceService.recordPartialSync(userId, "outlook", stored);
        logService.warn("Outlook sync failed due to network disconnect after retries", "Transactions", {
          emailsStoredBeforeFailure: stored,
          error: outlookError instanceof Error ? outlookError.message : "Unknown",
        });
        // TASK-2058: Log failure for offline diagnostics
        failureLogService.logFailure(
          "outlook_email_fetch",
          outlookError instanceof Error ? outlookError.message : "Unknown error",
          { emailsStoredBeforeFailure: stored }
        );
        return {
          fetched,
          stored,
          networkError: true,
          networkErrorMessage: "Network disconnected during Outlook sync. Emails saved so far will be preserved.",
        };
      } else {
        const errorMsg = outlookError instanceof Error ? outlookError.message : "";
        if (errorMsg.includes("needs to connect")) {
          // Provider not configured — skip silently (not a provider error)
          logService.info("Outlook not connected, skipping", "Transactions");
          return { fetched, stored, networkError: false };
        } else {
          // TASK-2070: Non-network provider error (token expiry, API error, etc.)
          logService.warn("Outlook fetch failed, falling back to local search", "Transactions", {
            error: errorMsg || "Unknown",
          });
          Sentry.captureException(outlookError, {
            tags: { service: "email-sync", operation: "provider-fetch", provider: "outlook" },
            level: "warning",
            fingerprint: ["provider-fetch-failure", "outlook"],
          });
        }
      }
      // TASK-2058: Log failure for offline diagnostics
      failureLogService.logFailure(
        "outlook_email_fetch",
        outlookError instanceof Error ? outlookError.message : "Unknown error",
        { emailsStoredBeforeFailure: stored }
      );
      // TASK-2070: Return classified provider error for UI warning
      return { fetched, stored, networkError: false, providerError: classifyProviderError(outlookError) };
    }
  }

  /**
   * Fetch emails from Gmail (search, all labels) with network resilience.
   */
  private async fetchGmailEmails(params: {
    userId: string;
    transactionId: string;
    contactEmails: string[];
    emailFetchSinceDate: Date;
    seenEmailIds: Set<string>;
    currentEmailsStored: number;
  }): Promise<{ fetched: number; stored: number; networkError: boolean; networkErrorMessage?: string; providerError?: string }> {
    const { userId, transactionId, contactEmails, emailFetchSinceDate, seenEmailIds, currentEmailsStored } = params;
    let fetched = 0;
    let stored = 0;

    Sentry.addBreadcrumb({
      category: 'sync',
      message: 'Gmail email fetch started',
      level: 'info',
      data: {
        syncType: 'emails',
        provider: 'gmail',
        operation: 'sync-and-fetch-emails',
        transactionId,
        contactEmailCount: contactEmails.length,
      },
    });

    try {
      await retryOnNetwork(async () => {
        const gmailReady = await gmailFetchService.initialize(userId);
        if (gmailReady) {
          // TASK-2060: Fetch contact emails with date-range filtering via shared helper
          const gmailResult = await fetchStoreAndDedup({
            provider: "gmail",
            fetchFn: () => {
              const gmailSearchOptions: { query?: string; maxResults: number; contactEmails?: string[]; after?: Date | null } = {
                maxResults: EMAIL_FETCH_SAFETY_CAP,
                after: emailFetchSinceDate,
              };
              if (contactEmails.length > 0) {
                // Use contactEmails param -- gmailFetchService.searchEmails builds bidirectional filter
                gmailSearchOptions.contactEmails = contactEmails;
              }
              return gmailFetchService.searchEmails(gmailSearchOptions);
            },
            userId,
            seenIds: seenEmailIds,
          });

          // TASK-2046: Also fetch from all labels (custom labels, archives, etc.)
          let allLabelResult = { fetched: 0, stored: 0, errors: 0 };
          try {
            allLabelResult = await fetchStoreAndDedup({
              provider: "gmail",
              fetchFn: () => gmailFetchService.searchAllLabels({
                maxResults: EMAIL_FETCH_SAFETY_CAP,
                after: emailFetchSinceDate,
              }),
              userId,
              seenIds: seenEmailIds,
            });
            logService.info(`Fetched ${allLabelResult.fetched} emails from all Gmail labels`, "Transactions");
          } catch (labelError) {
            // TASK-2049: If label fetch fails due to network, let it bubble up for retry
            if (isNetworkError(labelError)) throw labelError;
            logService.warn("Failed to fetch from all Gmail labels, continuing with default search only", "Transactions", {
              error: labelError instanceof Error ? labelError.message : "Unknown",
            });
          }

          const totalFetched = gmailResult.fetched + allLabelResult.fetched;
          const totalStored = gmailResult.stored + allLabelResult.stored;
          fetched += totalFetched;
          stored += totalStored;

          logService.info(`Gmail sync: ${gmailResult.fetched} contact-search + ${allLabelResult.fetched} all-labels = ${totalFetched} unique, ${totalStored} new stored`, "Transactions");

          // TASK-2060: Warn if safety cap was hit (may indicate missing emails)
          if (gmailResult.fetched >= EMAIL_FETCH_SAFETY_CAP) {
            logService.warn(`Gmail contact-search hit safety cap of ${EMAIL_FETCH_SAFETY_CAP}. Some emails may be missing.`, "Transactions");
          }
        }
      }, undefined, "GmailSync");

      Sentry.addBreadcrumb({
        category: 'sync',
        message: 'Gmail email fetch completed',
        level: 'info',
        data: {
          syncType: 'emails',
          provider: 'gmail',
          operation: 'sync-and-fetch-emails',
          emailsFetched: fetched,
          emailsStored: stored,
        },
      });

      return { fetched, stored, networkError: false };
    } catch (gmailError) {
      const totalStored = currentEmailsStored + stored;
      if (isNetworkError(gmailError)) {
        // TASK-2049: Network error after all retries exhausted
        networkResilienceService.recordPartialSync(userId, "gmail", totalStored);
        logService.warn("Gmail sync failed due to network disconnect after retries", "Transactions", {
          emailsStoredBeforeFailure: totalStored,
          error: gmailError instanceof Error ? gmailError.message : "Unknown",
        });
        // TASK-2058: Log failure for offline diagnostics
        failureLogService.logFailure(
          "gmail_email_fetch",
          gmailError instanceof Error ? gmailError.message : "Unknown error",
          { emailsStoredBeforeFailure: totalStored }
        );
        return {
          fetched,
          stored,
          networkError: true,
          networkErrorMessage: "Network disconnected during Gmail sync. Emails saved so far will be preserved.",
        };
      } else {
        const errorMsg = gmailError instanceof Error ? gmailError.message : "";
        if (errorMsg.includes("needs to connect")) {
          // Provider not configured — skip silently (not a provider error)
          logService.info("Gmail not connected, skipping", "Transactions");
          return { fetched, stored, networkError: false };
        } else {
          // TASK-2070: Non-network provider error (token expiry, API error, etc.)
          logService.warn("Gmail fetch failed, falling back to local search", "Transactions", {
            error: errorMsg || "Unknown",
          });
          Sentry.captureException(gmailError, {
            tags: { service: "email-sync", operation: "provider-fetch", provider: "gmail" },
            level: "warning",
            fingerprint: ["provider-fetch-failure", "gmail"],
          });
        }
      }
      // TASK-2058: Log failure for offline diagnostics
      failureLogService.logFailure(
        "gmail_email_fetch",
        gmailError instanceof Error ? gmailError.message : "Unknown error",
        { emailsStoredBeforeFailure: totalStored }
      );
      // TASK-2070: Return classified provider error for UI warning
      return { fetched, stored, networkError: false, providerError: classifyProviderError(gmailError) };
    }
  }
}

// Export singleton instance
const emailSyncService = new EmailSyncService();
export default emailSyncService;
