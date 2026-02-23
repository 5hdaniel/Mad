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
import { createEmail, getEmailByExternalId, countEmailsByUser } from "./db/emailDbService";
import gmailFetchService from "./gmailFetchService";
import outlookFetchService from "./outlookFetchService";
import failureLogService from "./failureLogService";
import emailAttachmentService from "./emailAttachmentService";
import { backfillMissingAttachments } from "../handlers/attachmentHandlers";
import { isNetworkError } from "../utils/networkErrors";
import { retryOnNetwork, networkResilienceService } from "./networkResilience";
import { computeTransactionDateRange } from "../utils/emailDateRange";
import type { TransactionResponse } from "../types/handlerTypes";
import type { TransactionContactResult } from "./db/transactionContactDbService";
import type { TransactionWithDetails } from "./transactionService/types";

// TASK-2060: Safety cap for email fetching with date-range filtering.
// With date filtering, we no longer need the old 200 cap. This higher cap
// serves as a safety valve to prevent runaway fetches for extremely high-volume contacts.
export const EMAIL_FETCH_SAFETY_CAP = 2000;

// TASK-2060: Safety cap for sent items (per-contact email search)
export const SENT_ITEMS_SAFETY_CAP = 200;

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

    return {
      success: true,
      totalEmailsLinked,
      totalMessagesLinked,
      totalAlreadyLinked,
      totalErrors,
    };
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

  /**
   * Fetch emails from Outlook (inbox, sent items, all folders) with network resilience.
   */
  private async fetchOutlookEmails(params: {
    userId: string;
    transactionId: string;
    contactEmails: string[];
    emailFetchSinceDate: Date;
    seenEmailIds: Set<string>;
  }): Promise<{ fetched: number; stored: number; networkError: boolean; networkErrorMessage?: string }> {
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
        logService.warn("Outlook fetch failed, falling back to local search", "Transactions", {
          error: outlookError instanceof Error ? outlookError.message : "Unknown",
        });
      }
      // TASK-2058: Log failure for offline diagnostics
      failureLogService.logFailure(
        "outlook_email_fetch",
        outlookError instanceof Error ? outlookError.message : "Unknown error",
        { emailsStoredBeforeFailure: stored }
      );
      return { fetched, stored, networkError: false };
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
  }): Promise<{ fetched: number; stored: number; networkError: boolean; networkErrorMessage?: string }> {
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
        logService.warn("Gmail fetch failed, falling back to local search", "Transactions", {
          error: gmailError instanceof Error ? gmailError.message : "Unknown",
        });
      }
      // TASK-2058: Log failure for offline diagnostics
      failureLogService.logFailure(
        "gmail_email_fetch",
        gmailError instanceof Error ? gmailError.message : "Unknown error",
        { emailsStoredBeforeFailure: totalStored }
      );
      return { fetched, stored, networkError: false };
    }
  }
}

// Export singleton instance
const emailSyncService = new EmailSyncService();
export default emailSyncService;
