// ============================================
// EMAIL SYNC IPC HANDLERS
// Handles: scan, email fetching, linking/unlinking,
//          auto-link, and provider sync
// ============================================

import { ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import transactionService from "../services/transactionService";
import logService from "../services/logService";
import { autoLinkAllToTransaction } from "../services/messageMatchingService";
import { autoLinkCommunicationsForContact } from "../services/autoLinkService";
import { createEmail, getEmailByExternalId, countEmailsByUser } from "../services/db/emailDbService";
import { createCommunication } from "../services/db/communicationDbService";
import {
  getContactEmailsForTransaction,
  getEmailsByContactId,
  resolveContactEmailsByQuery,
} from "../services/db/contactDbService";
import databaseService from "../services/databaseService";
import gmailFetchService from "../services/gmailFetchService";
import outlookFetchService from "../services/outlookFetchService";
import failureLogService from "../services/failureLogService";
import emailAttachmentService from "../services/emailAttachmentService";
import { backfillMissingAttachments } from "./attachmentHandlers";
import { wrapHandler } from "../utils/wrapHandler";
import type { TransactionResponse } from "../types/handlerTypes";
import {
  ValidationError,
  validateUserId,
  validateTransactionId,
  sanitizeObject,
} from "../utils/validation";
import { rateLimiters } from "../utils/rateLimit";
import { isNetworkError } from "../utils/networkErrors";
import { retryOnNetwork, networkResilienceService } from "../services/networkResilience";

interface ScanOptions {
  onProgress?: (progress: unknown) => void;
  [key: string]: unknown;
}

/**
 * Register email sync IPC handlers
 * @param mainWindow - Main window instance
 */
export function registerEmailSyncHandlers(
  mainWindow: BrowserWindow | null,
): void {
  // Cancel ongoing scan
  ipcMain.handle(
    "transactions:cancel-scan",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Cancelling transaction scan", "Transactions", {
        userId,
      });

      // Validate input
      const validatedUserId = validateUserId(userId);
      if (!validatedUserId) {
        throw new ValidationError("User ID validation failed", "userId");
      }

      const cancelled = transactionService.cancelScan(validatedUserId);

      return {
        success: true,
        cancelled,
      };
    }, { module: "Transactions" }),
  );

  // Scan and extract transactions from emails
  // Rate limited: 5 second cooldown per user to prevent scan spam.
  // Scans hit external email APIs (Gmail, Outlook).
  ipcMain.handle(
    "transactions:scan",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      userId: string,
      options?: unknown,
    ): Promise<TransactionResponse> => {
      logService.info("Starting transaction scan", "Transactions", {
        userId,
      });

      // Validate input
      const validatedUserId = validateUserId(userId);
      if (!validatedUserId) {
        throw new ValidationError("User ID validation failed", "userId");
      }

      // Rate limit check - 5 second cooldown per user
      const { allowed, remainingMs } = rateLimiters.scan.canExecute(
        "transactions:scan",
        validatedUserId
      );
      if (!allowed && remainingMs !== undefined) {
        const seconds = Math.ceil(remainingMs / 1000);
        logService.warn(
          `Rate limited transactions:scan for user ${validatedUserId}. Retry in ${seconds}s`,
          "Transactions"
        );
        return {
          success: false,
          error: `Please wait ${seconds} seconds before starting another scan.`,
          rateLimited: true,
        };
      }

      const sanitizedOptions = sanitizeObject(options || {}) as ScanOptions;

      const result = await transactionService.scanAndExtractTransactions(
        validatedUserId,
        {
          ...sanitizedOptions,
          onProgress: (progress: unknown) => {
            // Send progress updates to renderer
            if (mainWindow) {
              mainWindow.webContents.send(
                "transactions:scan-progress",
                progress,
              );
            }
          },
        },
      );

      logService.info("Transaction scan complete", "Transactions", {
        userId: validatedUserId,
        transactionsFound: result.transactionsFound,
        emailsScanned: result.emailsScanned,
      });

      return {
        ...result,
      };
    }, { module: "Transactions" }),
  );

  // Get unlinked messages (not attached to any transaction)
  ipcMain.handle(
    "transactions:get-unlinked-messages",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Getting unlinked messages", "Transactions", { userId });

      // Validate input
      const validatedUserId = validateUserId(userId);
      if (!validatedUserId) {
        throw new ValidationError("User ID validation failed", "userId");
      }

      const messages = await transactionService.getUnlinkedMessages(validatedUserId);

      return {
        success: true,
        messages,
      };
    }, { module: "Transactions" }),
  );

  // Get unlinked emails - fetches directly from email provider (Gmail/Outlook)
  // Supports server-side search with query, date range, pagination, and contact filtering
  // TASK-1993: Server-side search   TASK-1998: body preview fix   BACKLOG-712: contact email filter
  ipcMain.handle(
    "transactions:get-unlinked-emails",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      userId: string,
      options?: {
        query?: string;
        after?: string;   // ISO date string
        before?: string;  // ISO date string
        maxResults?: number;
        skip?: number;    // BACKLOG-711: offset for pagination (skip already-fetched results)
        transactionId?: string; // BACKLOG-712: filter by transaction contact emails
      },
    ): Promise<TransactionResponse> => {
      const effectiveMaxResults = Math.min(options?.maxResults || 100, 500);
      logService.info("Fetching emails from provider", "Transactions", {
        userId,
        query: options?.query || "",
        after: options?.after || null,
        before: options?.before || null,
        maxResults: effectiveMaxResults,
        transactionId: options?.transactionId || null,
      });

      const validatedUserId = validateUserId(userId);
      if (!validatedUserId) {
        throw new ValidationError("User ID validation failed", "userId");
      }

      // BACKLOG-712: Look up contact emails for the transaction
      let contactEmails: string[] = [];
      if (options?.transactionId) {
        const validatedTxnId = validateTransactionId(options.transactionId);
        if (validatedTxnId) {
          try {
            contactEmails = getContactEmailsForTransaction(validatedTxnId);
            logService.info(`Found ${contactEmails.length} contact emails for transaction`, "Transactions", {
              transactionId: validatedTxnId,
            });
          } catch (contactErr) {
            logService.warn("Failed to look up contact emails, proceeding without filter", "Transactions", {
              error: contactErr instanceof Error ? contactErr.message : "Unknown",
            });
          }
        }
      }

      // Build search params from options
      const searchParams: {
        query: string;
        after: Date | null;
        before: Date | null;
        maxResults: number;
        skip?: number;
        contactEmails?: string[];
      } = {
        query: options?.query || "",
        after: options?.after ? new Date(options.after) : null,
        before: options?.before ? new Date(options.before) : null,
        maxResults: effectiveMaxResults,
        skip: options?.skip || 0,
      };

      // When user is actively searching, resolve query against contacts DB
      // to enable searching by contact name, email, company, or title.
      // Note: we use a separate list (not the transaction contactEmails) so that
      // searching "agustin" only returns Agustin's emails, not all transaction contacts.
      if (options?.query?.trim()) {
        const resolvedEmails = resolveContactEmailsByQuery(validatedUserId, options.query);

        if (resolvedEmails.length > 0) {
          // Use ONLY the resolved emails as filter (not the transaction contact list)
          searchParams.contactEmails = resolvedEmails;
          // Clear the text query to avoid AND-ing contact filter with text search
          searchParams.query = "";
          logService.info(`Resolved query "${options.query}" to ${resolvedEmails.length} contact emails`, "Transactions", {
            resolvedEmails,
          });
        }
        // If no contacts matched, the text query passes through as-is for subject/body search
      }

      // Check which provider the user is authenticated with
      const googleToken = await databaseService.getOAuthToken(validatedUserId, "google", "mailbox");
      const microsoftToken = await databaseService.getOAuthToken(validatedUserId, "microsoft", "mailbox");

      let emails: Array<{
        id: string;
        subject: string | null;
        sender: string | null;
        sent_at: string | null;
        body_preview?: string | null;
        email_thread_id?: string | null;
        has_attachments?: boolean;
        provider: "gmail" | "outlook";
      }> = [];

      // Fetch from Gmail if authenticated (TASK-2049: with network retry)
      if (googleToken) {
        try {
          await retryOnNetwork(async () => {
            const isReady = await gmailFetchService.initialize(validatedUserId);
            if (isReady) {
              const gmailEmails = await gmailFetchService.searchEmails(searchParams);
              emails = gmailEmails.map((email: { id: string; subject: string | null; from: string | null; date: Date; bodyPlain: string; snippet: string; threadId: string; hasAttachments: boolean }) => ({
                id: `gmail:${email.id}`,
                subject: email.subject,
                sender: email.from,
                sent_at: email.date ? new Date(email.date).toISOString() : null,
                // TASK-1998: prefer snippet (always populated by Gmail API), fall back to bodyPlain
                body_preview: (email.snippet || email.bodyPlain?.substring(0, 200)) || null,
                email_thread_id: email.threadId || null,
                has_attachments: email.hasAttachments || false,
                provider: "gmail" as const,
              }));
              logService.info(`Fetched ${emails.length} emails from Gmail`, "Transactions");
            }
          }, undefined, "GmailSearch");
        } catch (gmailError) {
          logService.warn("Failed to fetch from Gmail", "Transactions", {
            error: gmailError instanceof Error ? gmailError.message : "Unknown",
            isNetworkError: isNetworkError(gmailError),
          });
        }
      }

      // Fetch from Outlook if authenticated (and no Gmail emails) (TASK-2049: with network retry)
      if (microsoftToken && emails.length === 0) {
        try {
          await retryOnNetwork(async () => {
            const isReady = await outlookFetchService.initialize(validatedUserId);
            if (isReady) {
              const outlookEmails = await outlookFetchService.searchEmails(searchParams);

              // Also search sent items for emails TO contacts (bidirectional)
              // Use searchParams.contactEmails (resolved from query) not the full transaction contactEmails
              let sentEmails: typeof outlookEmails = [];
              const sentSearchEmails = searchParams.contactEmails || [];
              if (sentSearchEmails.length > 0) {
                try {
                  sentEmails = await outlookFetchService.searchSentEmailsToContacts(
                    sentSearchEmails, Math.min(50, effectiveMaxResults),
                  );
                } catch { /* logged inside the method */ }
              }

              // Merge and dedup
              const allOutlook = [...outlookEmails, ...sentEmails];
              const seenIds = new Set<string>();
              const dedupedOutlook = allOutlook.filter(e => {
                if (seenIds.has(e.id)) return false;
                seenIds.add(e.id);
                return true;
              });

              emails = dedupedOutlook.map((email: { id: string; subject: string | null; from: string | null; date: Date; bodyPlain: string; snippet: string; threadId: string; hasAttachments: boolean }) => ({
                id: `outlook:${email.id}`,
                subject: email.subject,
                sender: email.from,
                sent_at: email.date ? new Date(email.date).toISOString() : null,
                // TASK-1998: prefer snippet (bodyPreview from Graph API), fall back to bodyPlain
                body_preview: (email.snippet || email.bodyPlain?.substring(0, 200)) || null,
                email_thread_id: email.threadId || null,
                has_attachments: email.hasAttachments || false,
                provider: "outlook" as const,
              }));
              logService.info(`Fetched ${outlookEmails.length} inbox + ${sentEmails.length} sent = ${emails.length} unique from Outlook`, "Transactions");
            }
          }, undefined, "OutlookSearch");
        } catch (outlookError) {
          logService.warn("Failed to fetch from Outlook", "Transactions", {
            error: outlookError instanceof Error ? outlookError.message : "Unknown",
            isNetworkError: isNetworkError(outlookError),
          });
        }
      }

      if (emails.length === 0 && !googleToken && !microsoftToken) {
        return {
          success: false,
          error: "No email account connected. Please connect Gmail or Outlook in Settings.",
        };
      }

      return {
        success: true,
        emails,
      };
    }, { module: "Transactions" }),
  );

  // Link emails to a transaction - fetches full email from provider and saves to database
  ipcMain.handle(
    "transactions:link-emails",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      emailIds: string[],
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Linking emails to transaction", "Transactions", {
        emailCount: emailIds?.length || 0,
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      // Validate email IDs
      if (!Array.isArray(emailIds) || emailIds.length === 0) {
        throw new ValidationError(
          "Email IDs must be a non-empty array",
          "emailIds",
        );
      }

      // Get transaction to get user_id
      const transaction = await transactionService.getTransactionDetails(validatedTransactionId);
      if (!transaction) {
        throw new ValidationError("Transaction not found", "transactionId");
      }

      // Group emails by provider
      const gmailIds: string[] = [];
      const outlookIds: string[] = [];
      for (const emailId of emailIds) {
        if (!emailId || typeof emailId !== "string") continue;
        if (emailId.startsWith("gmail:")) {
          gmailIds.push(emailId.replace("gmail:", ""));
        } else if (emailId.startsWith("outlook:")) {
          outlookIds.push(emailId.replace("outlook:", ""));
        }
      }

      let linkedCount = 0;

      // Fetch and save Gmail emails
      if (gmailIds.length > 0) {
        try {
          const isReady = await gmailFetchService.initialize(transaction.user_id);
          if (isReady) {
            for (const messageId of gmailIds) {
              try {
                const email = await gmailFetchService.getEmailById(messageId);

                // BACKLOG-506: Check if email already exists (dedup by external_id)
                let emailRecord = await getEmailByExternalId(transaction.user_id, messageId);

                if (!emailRecord) {
                  // Create email in emails table (content store)
                  emailRecord = await createEmail({
                    user_id: transaction.user_id,
                    external_id: messageId,
                    source: "gmail",
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
                }

                // TASK-1775: Download email attachments if present
                if (email.hasAttachments && email.attachments && email.attachments.length > 0) {
                  try {
                    await emailAttachmentService.downloadEmailAttachments(
                      transaction.user_id,
                      emailRecord.id,
                      messageId, // External email ID (Gmail message ID)
                      "gmail",
                      email.attachments.map((att: { filename?: string; name?: string; mimeType?: string; contentType?: string; size?: number; attachmentId?: string; id?: string }) => ({
                        filename: att.filename || att.name || "attachment",
                        mimeType: att.mimeType || att.contentType || "application/octet-stream",
                        size: att.size || 0,
                        attachmentId: att.attachmentId || att.id || "",
                      }))
                    );
                  } catch (attachmentError) {
                    // Log but don't fail - attachment download is non-blocking
                    logService.warn("Failed to download Gmail email attachments", "Transactions", {
                      emailId: emailRecord.id,
                      error: attachmentError instanceof Error ? attachmentError.message : "Unknown",
                    });
                  }
                }

                // Create junction link in communications table
                await createCommunication({
                  user_id: transaction.user_id,
                  transaction_id: validatedTransactionId,
                  email_id: emailRecord.id,
                  communication_type: "email",
                  link_source: "manual",
                  link_confidence: 1.0,
                  has_attachments: emailRecord.has_attachments || false,
                  is_false_positive: false,
                });
                linkedCount++;
              } catch (emailError) {
                logService.warn(`Failed to fetch Gmail email ${messageId}`, "Transactions", {
                  error: emailError instanceof Error ? emailError.message : "Unknown",
                });
              }
            }
          }
        } catch (gmailError) {
          logService.error("Gmail fetch failed", "Transactions", {
            error: gmailError instanceof Error ? gmailError.message : "Unknown",
          });
        }
      }

      // Fetch and save Outlook emails
      if (outlookIds.length > 0) {
        try {
          const isReady = await outlookFetchService.initialize(transaction.user_id);
          if (isReady) {
            for (const messageId of outlookIds) {
              try {
                const email = await outlookFetchService.getEmailById(messageId);

                // BACKLOG-506: Check if email already exists (dedup by external_id)
                let emailRecord = await getEmailByExternalId(transaction.user_id, messageId);

                if (!emailRecord) {
                  // Create email in emails table (content store)
                  emailRecord = await createEmail({
                    user_id: transaction.user_id,
                    external_id: messageId,
                    source: "outlook",
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
                }

                // TASK-1775: Download email attachments if present
                if (email.hasAttachments && email.attachments && email.attachments.length > 0) {
                  try {
                    await emailAttachmentService.downloadEmailAttachments(
                      transaction.user_id,
                      emailRecord.id,
                      messageId, // External email ID (Outlook message ID)
                      "outlook",
                      email.attachments.map((att: { filename?: string; name?: string; mimeType?: string; contentType?: string; size?: number; attachmentId?: string; id?: string }) => ({
                        filename: att.filename || att.name || "attachment",
                        mimeType: att.mimeType || att.contentType || "application/octet-stream",
                        size: att.size || 0,
                        attachmentId: att.attachmentId || att.id || "",
                      }))
                    );
                  } catch (attachmentError) {
                    // Log but don't fail - attachment download is non-blocking
                    logService.warn("Failed to download Outlook email attachments", "Transactions", {
                      emailId: emailRecord.id,
                      error: attachmentError instanceof Error ? attachmentError.message : "Unknown",
                    });
                  }
                }

                // Create junction link in communications table
                await createCommunication({
                  user_id: transaction.user_id,
                  transaction_id: validatedTransactionId,
                  email_id: emailRecord.id,
                  communication_type: "email",
                  link_source: "manual",
                  link_confidence: 1.0,
                  has_attachments: emailRecord.has_attachments || false,
                  is_false_positive: false,
                });
                linkedCount++;
              } catch (emailError) {
                logService.warn(`Failed to fetch Outlook email ${messageId}`, "Transactions", {
                  error: emailError instanceof Error ? emailError.message : "Unknown",
                });
              }
            }
          }
        } catch (outlookError) {
          logService.error("Outlook fetch failed", "Transactions", {
            error: outlookError instanceof Error ? outlookError.message : "Unknown",
          });
        }
      }

      logService.info("Emails linked successfully", "Transactions", {
        requestedCount: emailIds.length,
        linkedCount,
        transactionId: validatedTransactionId,
      });

      return {
        success: true,
        linkedCount,
      };
    }, { module: "Transactions" }),
  );

  // Get message contacts for contact-first browsing
  ipcMain.handle(
    "transactions:get-message-contacts",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Getting message contacts", "Transactions", { userId });

      const validatedUserId = validateUserId(userId);
      if (!validatedUserId) {
        throw new ValidationError("User ID validation failed", "userId");
      }

      const contacts = await transactionService.getMessageContacts(validatedUserId);

      return {
        success: true,
        contacts,
      };
    }, { module: "Transactions" }),
  );

  // Get messages for a specific contact
  ipcMain.handle(
    "transactions:get-messages-by-contact",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      userId: string,
      contact: string,
    ): Promise<TransactionResponse> => {
      logService.info("Getting messages by contact", "Transactions", { userId, contact });

      const validatedUserId = validateUserId(userId);
      if (!validatedUserId) {
        throw new ValidationError("User ID validation failed", "userId");
      }

      if (!contact || typeof contact !== "string") {
        throw new ValidationError("Contact is required", "contact");
      }

      const messages = await transactionService.getMessagesByContact(validatedUserId, contact);

      return {
        success: true,
        messages,
      };
    }, { module: "Transactions" }),
  );

  // Link messages to a transaction
  ipcMain.handle(
    "transactions:link-messages",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      messageIds: string[],
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Linking messages to transaction", "Transactions", {
        messageCount: messageIds?.length || 0,
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      // Validate message IDs
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        throw new ValidationError(
          "Message IDs must be a non-empty array",
          "messageIds",
        );
      }

      // Validate each message ID
      for (const id of messageIds) {
        if (!id || typeof id !== "string" || id.trim().length === 0) {
          throw new ValidationError(`Invalid message ID: ${id}`, "messageIds");
        }
      }

      await transactionService.linkMessages(messageIds, validatedTransactionId);

      logService.info("Messages linked successfully", "Transactions", {
        messageCount: messageIds.length,
        transactionId: validatedTransactionId,
      });

      return {
        success: true,
      };
    }, { module: "Transactions" }),
  );

  // Unlink messages from a transaction (sets transaction_id to null)
  ipcMain.handle(
    "transactions:unlink-messages",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      messageIds: string[],
      transactionId?: string,
    ): Promise<TransactionResponse> => {
      logService.info("Unlinking messages from transaction", "Transactions", {
        messageCount: messageIds?.length || 0,
        transactionId,
      });

      // Validate message IDs
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        throw new ValidationError(
          "Message IDs must be a non-empty array",
          "messageIds",
        );
      }

      // Validate each message ID
      for (const id of messageIds) {
        if (!id || typeof id !== "string" || id.trim().length === 0) {
          throw new ValidationError(`Invalid message ID: ${id}`, "messageIds");
        }
      }

      // TASK-1116: Pass transactionId for thread-based unlinking
      await transactionService.unlinkMessages(messageIds, transactionId);

      logService.info("Messages unlinked successfully", "Transactions", {
        messageCount: messageIds.length,
      });

      return {
        success: true,
      };
    }, { module: "Transactions" }),
  );

  // Auto-link text messages to a transaction based on assigned contacts
  ipcMain.handle(
    "transactions:auto-link-texts",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Auto-linking communications to transaction", "Transactions", {
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      const result = await autoLinkAllToTransaction(validatedTransactionId);

      logService.info("Auto-link communications complete", "Transactions", {
        transactionId: validatedTransactionId,
        linked: result.linked,
        skipped: result.skipped,
        errors: result.errors.length,
      });

      return {
        success: result.errors.length === 0,
        linked: result.linked,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
    }, { module: "Transactions" }),
  );

  // Re-sync auto-link communications for all contacts on a transaction
  // Use when contacts have been updated and user wants to re-link communications
  ipcMain.handle(
    "transactions:resync-auto-link",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Re-syncing auto-link for transaction", "Transactions", {
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      // Get transaction with contacts
      const transactionDetails = await transactionService.getTransactionWithContacts(
        validatedTransactionId,
      );

      if (!transactionDetails) {
        return {
          success: false,
          error: "Transaction not found",
        };
      }

      const contactAssignments = transactionDetails.contact_assignments || [];

      if (contactAssignments.length === 0) {
        return {
          success: true,
          message: "No contacts to sync",
          totalEmailsLinked: 0,
          totalMessagesLinked: 0,
          totalAlreadyLinked: 0,
        };
      }

      // Auto-link communications for each contact
      const results: Array<{
        contactId: string;
        emailsLinked: number;
        messagesLinked: number;
        alreadyLinked: number;
        errors: number;
      }> = [];

      let totalEmailsLinked = 0;
      let totalMessagesLinked = 0;
      let totalAlreadyLinked = 0;
      let totalErrors = 0;

      for (const assignment of contactAssignments) {
        try {
          const result = await autoLinkCommunicationsForContact({
            contactId: assignment.contact_id,
            transactionId: validatedTransactionId,
          });

          results.push({
            contactId: assignment.contact_id,
            ...result,
          });

          totalEmailsLinked += result.emailsLinked;
          totalMessagesLinked += result.messagesLinked;
          totalAlreadyLinked += result.alreadyLinked;
          totalErrors += result.errors;

          logService.debug(
            "Re-sync auto-link complete for contact",
            "Transactions",
            {
              contactId: assignment.contact_id,
              emailsLinked: result.emailsLinked,
              messagesLinked: result.messagesLinked,
              alreadyLinked: result.alreadyLinked,
            }
          );
        } catch (error) {
          totalErrors++;
          logService.warn(
            `Re-sync auto-link failed for contact ${assignment.contact_id}`,
            "Transactions",
            {
              error: error instanceof Error ? error.message : "Unknown",
            }
          );
        }
      }

      logService.info("Re-sync auto-link complete", "Transactions", {
        transactionId: validatedTransactionId,
        contactsProcessed: contactAssignments.length,
        totalEmailsLinked,
        totalMessagesLinked,
        totalAlreadyLinked,
        totalErrors,
      });

      return {
        success: true,
        contactsProcessed: contactAssignments.length,
        totalEmailsLinked,
        totalMessagesLinked,
        totalAlreadyLinked,
        totalErrors,
        results,
      };
    }, { module: "Transactions" }),
  );

  // ============================================
  // SYNC FROM PROVIDER HANDLER (BACKLOG-457)
  // ============================================

  // Sync emails from email provider (Gmail/Outlook) for a transaction
  // This fetches NEW emails from the provider, stores them, then runs auto-link
  // Rate limited: 10 second cooldown per transaction to prevent sync spam.
  ipcMain.handle(
    "transactions:sync-and-fetch-emails",
    wrapHandler(async (
      event: IpcMainInvokeEvent,
      transactionId: string,
    ): Promise<TransactionResponse> => {
      logService.info("Sync and fetch emails for transaction", "Transactions", {
        transactionId,
      });

      // Validate transaction ID
      const validatedTransactionId = validateTransactionId(transactionId);
      if (!validatedTransactionId) {
        throw new ValidationError(
          "Transaction ID validation failed",
          "transactionId",
        );
      }

      // Rate limit check - 10 second cooldown per transaction
      const { allowed, remainingMs } = rateLimiters.sync.canExecute(
        "transactions:sync-and-fetch-emails",
        validatedTransactionId
      );
      if (!allowed && remainingMs !== undefined) {
        const seconds = Math.ceil(remainingMs / 1000);
        logService.warn(
          `Rate limited transactions:sync-and-fetch-emails for transaction ${validatedTransactionId}. Retry in ${seconds}s`,
          "Transactions"
        );
        return {
          success: false,
          error: `Please wait ${seconds}s before syncing again.`,
          rateLimited: true,
        };
      }

      // Get transaction with contacts
      const transactionDetails = await transactionService.getTransactionWithContacts(
        validatedTransactionId,
      );

      if (!transactionDetails) {
        return {
          success: false,
          error: "Transaction not found",
        };
      }

      const userId = transactionDetails.user_id;
      const contactAssignments = transactionDetails.contact_assignments || [];

      if (contactAssignments.length === 0) {
        return {
          success: true,
          message: "No contacts to sync",
          emailsFetched: 0,
          emailsStored: 0,
          totalEmailsLinked: 0,
          totalMessagesLinked: 0,
        };
      }

      // Collect all contact emails
      const contactEmails: string[] = [];
      for (const assignment of contactAssignments) {
        // Get contact's email addresses from contact_emails table
        const emails = getEmailsByContactId(assignment.contact_id);
        logService.info(`Contact ${assignment.contact_id}: found ${emails.length} emails in contact_emails`, "Transactions", {
          emails,
        });
        for (const email of emails) {
          if (email && !contactEmails.includes(email.toLowerCase())) {
            contactEmails.push(email.toLowerCase());
          }
        }
      }

      logService.info(`Total contact emails for sync: ${contactEmails.length}`, "Transactions", {
        contactEmails,
      });

      if (contactEmails.length === 0) {
        // No contact emails -- still run auto-link for phone-based message matching
        let totalMessagesLinked = 0;
        let totalAlreadyLinked = 0;
        let totalErrors = 0;

        for (const assignment of contactAssignments) {
          try {
            const result = await autoLinkCommunicationsForContact({
              contactId: assignment.contact_id,
              transactionId: validatedTransactionId,
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

      // Try Outlook (TASK-2049: with network resilience)
      try {
        await retryOnNetwork(async () => {
          const outlookReady = await outlookFetchService.initialize(userId);
          if (outlookReady) {
            const outlookEmails = await outlookFetchService.searchEmails({
              contactEmails,
              maxResults: 200,
            });
            // Also search sent items for emails TO the contact
            const sentEmails = await outlookFetchService.searchSentEmailsToContacts(
              contactEmails,
              50,
            );

            // TASK-2046: Also fetch from all folders (custom folders, archives, etc.)
            let allFolderEmails: typeof outlookEmails = [];
            try {
              allFolderEmails = await outlookFetchService.searchAllFolders({
                maxResults: 200,
              });
              logService.info(`Fetched ${allFolderEmails.length} emails from all Outlook folders`, "Transactions");
            } catch (folderError) {
              // TASK-2049: If folder fetch fails due to network, let it bubble up for retry
              if (isNetworkError(folderError)) throw folderError;
              logService.warn("Failed to fetch from all Outlook folders, continuing with inbox/sent only", "Transactions", {
                error: folderError instanceof Error ? folderError.message : "Unknown",
              });
            }

            const allOutlookEmails = [...outlookEmails, ...sentEmails, ...allFolderEmails];

            // Dedup by ID
            const seenIds = new Set<string>();
            const dedupedEmails = allOutlookEmails.filter((e) => {
              if (seenIds.has(e.id)) return false;
              seenIds.add(e.id);
              return true;
            });

            emailsFetched += dedupedEmails.length;
            logService.info(`Fetched ${outlookEmails.length} inbox + ${sentEmails.length} sent + ${allFolderEmails.length} all-folders = ${dedupedEmails.length} unique from Outlook`, "Transactions");

            // TASK-2049: Store emails individually -- each saved email is preserved
            // even if a subsequent save or fetch fails due to network disconnect
            for (const email of dedupedEmails) {
              try {
                let emailRecord = await getEmailByExternalId(userId, email.id);
                if (!emailRecord) {
                  emailRecord = await createEmail({
                    user_id: userId,
                    external_id: email.id,
                    source: "outlook",
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
                  emailsStored++;

                  // Download attachments if present (fetch metadata from Graph API)
                  if (email.hasAttachments && emailRecord) {
                    try {
                      const graphAttachments = await outlookFetchService.getAttachments(email.id);
                      if (graphAttachments.length > 0) {
                        await emailAttachmentService.downloadEmailAttachments(
                          userId,
                          emailRecord.id,
                          email.id,
                          "outlook",
                          graphAttachments.map((att: { id: string; name: string; contentType: string; size: number }) => ({
                            filename: att.name || "attachment",
                            mimeType: att.contentType || "application/octet-stream",
                            size: att.size || 0,
                            attachmentId: att.id,
                          })),
                        );
                      }
                    } catch (attError) {
                      // Attachment download failure is non-blocking for email save
                      if (!isNetworkError(attError)) {
                        logService.warn("Failed to download Outlook attachments during sync", "Transactions", {
                          emailId: emailRecord.id,
                          error: attError instanceof Error ? attError.message : "Unknown",
                        });
                      }
                      // Network errors on attachment download are non-fatal; email is already saved
                    }
                  }
                }
              } catch (emailError) {
                logService.warn("Failed to store Outlook email", "Transactions", {
                  error: emailError instanceof Error ? emailError.message : "Unknown",
                });
              }
            }
          }
        }, undefined, "OutlookSync");
      } catch (outlookError) {
        if (isNetworkError(outlookError)) {
          // TASK-2049: Network error after all retries exhausted
          networkErrorOccurred = true;
          networkErrorMessage = "Network disconnected during Outlook sync. Emails saved so far will be preserved.";
          networkResilienceService.recordPartialSync(userId, "outlook", emailsStored);
          logService.warn("Outlook sync failed due to network disconnect after retries", "Transactions", {
            emailsStoredBeforeFailure: emailsStored,
            error: outlookError instanceof Error ? outlookError.message : "Unknown",
          });
        } else {
          logService.warn("Outlook fetch failed, falling back to local search", "Transactions", {
            error: outlookError instanceof Error ? outlookError.message : "Unknown",
          });
        }
        // TASK-2058: Log failure for offline diagnostics
        failureLogService.logFailure(
          "outlook_email_fetch",
          outlookError instanceof Error ? outlookError.message : "Unknown error",
          { emailsStoredBeforeFailure: emailsStored }
        );
      }

      // Try Gmail (bidirectional: from + to contacts) (TASK-2049: with network resilience)
      try {
        await retryOnNetwork(async () => {
          const gmailReady = await gmailFetchService.initialize(userId);
          if (gmailReady) {
            // Build explicit bidirectional query (from + to) instead of from-only contactEmails
            const gmailSearchOptions: { query?: string; maxResults: number; contactEmails?: string[] } = {
              maxResults: 200,
            };
            if (contactEmails.length > 0) {
              // Use contactEmails param -- gmailFetchService.searchEmails now builds bidirectional filter
              gmailSearchOptions.contactEmails = contactEmails;
            }
            const gmailEmails = await gmailFetchService.searchEmails(gmailSearchOptions);

            // TASK-2046: Also fetch from all labels (custom labels, archives, etc.)
            let allLabelEmails: typeof gmailEmails = [];
            try {
              allLabelEmails = await gmailFetchService.searchAllLabels({
                maxResults: 200,
              });
              logService.info(`Fetched ${allLabelEmails.length} emails from all Gmail labels`, "Transactions");
            } catch (labelError) {
              // TASK-2049: If label fetch fails due to network, let it bubble up for retry
              if (isNetworkError(labelError)) throw labelError;
              logService.warn("Failed to fetch from all Gmail labels, continuing with default search only", "Transactions", {
                error: labelError instanceof Error ? labelError.message : "Unknown",
              });
            }

            // Dedup by ID across contact search and label fetch
            const seenGmailIds = new Set<string>();
            const dedupedGmailEmails = [...gmailEmails, ...allLabelEmails].filter((e) => {
              if (seenGmailIds.has(e.id)) return false;
              seenGmailIds.add(e.id);
              return true;
            });

            emailsFetched += dedupedGmailEmails.length;
            logService.info(`Fetched ${gmailEmails.length} contact-search + ${allLabelEmails.length} all-labels = ${dedupedGmailEmails.length} unique from Gmail`, "Transactions");

            // TASK-2049: Store emails individually -- each saved email is preserved
            // even if a subsequent save or fetch fails due to network disconnect
            for (const email of dedupedGmailEmails) {
              try {
                let emailRecord = await getEmailByExternalId(userId, email.id);
                if (!emailRecord) {
                  emailRecord = await createEmail({
                    user_id: userId,
                    external_id: email.id,
                    source: "gmail",
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
                  emailsStored++;

                  // Download attachments if present (Gmail searchEmails includes attachment metadata)
                  if (email.hasAttachments && email.attachments && email.attachments.length > 0 && emailRecord) {
                    try {
                      await emailAttachmentService.downloadEmailAttachments(
                        userId,
                        emailRecord.id,
                        email.id,
                        "gmail",
                        email.attachments.map((att: { filename?: string; name?: string; mimeType?: string; contentType?: string; size?: number; attachmentId?: string; id?: string }) => ({
                          filename: att.filename || att.name || "attachment",
                          mimeType: att.mimeType || att.contentType || "application/octet-stream",
                          size: att.size || 0,
                          attachmentId: att.attachmentId || att.id || "",
                        })),
                      );
                    } catch (attError) {
                      // Attachment download failure is non-blocking for email save
                      if (!isNetworkError(attError)) {
                        logService.warn("Failed to download Gmail attachments during sync", "Transactions", {
                          emailId: emailRecord.id,
                          error: attError instanceof Error ? attError.message : "Unknown",
                        });
                      }
                      // Network errors on attachment download are non-fatal; email is already saved
                    }
                  }
                }
              } catch (emailError) {
                logService.warn("Failed to store Gmail email", "Transactions", {
                  error: emailError instanceof Error ? emailError.message : "Unknown",
                });
              }
            }
          }
        }, undefined, "GmailSync");
      } catch (gmailError) {
        if (isNetworkError(gmailError)) {
          // TASK-2049: Network error after all retries exhausted
          networkErrorOccurred = true;
          networkErrorMessage = "Network disconnected during Gmail sync. Emails saved so far will be preserved.";
          networkResilienceService.recordPartialSync(userId, "gmail", emailsStored);
          logService.warn("Gmail sync failed due to network disconnect after retries", "Transactions", {
            emailsStoredBeforeFailure: emailsStored,
            error: gmailError instanceof Error ? gmailError.message : "Unknown",
          });
        } else {
          logService.warn("Gmail fetch failed, falling back to local search", "Transactions", {
            error: gmailError instanceof Error ? gmailError.message : "Unknown",
          });
        }
        // TASK-2058: Log failure for offline diagnostics
        failureLogService.logFailure(
          "gmail_email_fetch",
          gmailError instanceof Error ? gmailError.message : "Unknown error",
          { emailsStoredBeforeFailure: emailsStored }
        );
      }

      logService.info(`Email fetch complete: ${emailsFetched} fetched, ${emailsStored} new stored`, "Transactions");

      // Step 2: Auto-link from local DB
      let totalEmailsLinked = 0;
      let totalMessagesLinked = 0;
      let totalAlreadyLinked = 0;
      let totalErrors = 0;

      for (const assignment of contactAssignments) {
        try {
          const result = await autoLinkCommunicationsForContact({
            contactId: assignment.contact_id,
            transactionId: validatedTransactionId,
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

      // Step 3: Backfill any missing attachments for previously-synced emails
      const backfillResult = await backfillMissingAttachments(userId);

      logService.info("Sync and fetch emails complete", "Transactions", {
        transactionId: validatedTransactionId,
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
    }, { module: "Transactions" }),
  );
}
