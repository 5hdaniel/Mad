// ============================================
// EMAIL LINKING IPC HANDLERS
// Handles: get-unlinked-messages, get-unlinked-emails, link-emails,
//          get-message-contacts, get-messages-by-contact, link-messages, unlink-messages
// Extracted from emailSyncHandlers.ts (TASK-2065)
// ============================================

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import transactionService from "../services/transactionService";
import logService from "../services/logService";
import { createEmail, getEmailByExternalId } from "../services/db/emailDbService";
import { createCommunication } from "../services/db/communicationDbService";
import gmailFetchService from "../services/gmailFetchService";
import outlookFetchService from "../services/outlookFetchService";
import emailAttachmentService from "../services/emailAttachmentService";
import emailSyncService from "../services/emailSyncService";
import { wrapHandler } from "../utils/wrapHandler";
import type { TransactionResponse } from "../types/handlerTypes";
import {
  ValidationError,
  validateUserId,
  validateTransactionId,
} from "../utils/validation";

/**
 * Register email linking/unlinking IPC handlers
 */
export function registerEmailLinkingHandlers(): void {
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

  // Get unlinked emails - fetches from email provider (Gmail/Outlook) and stores locally
  // TASK-2067: Routes through emailSyncService.searchProviderEmails() to store fetched emails
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

      // Validate transactionId if provided
      let validatedTxnId: string | undefined;
      if (options?.transactionId) {
        const txnId = validateTransactionId(options.transactionId);
        if (txnId) validatedTxnId = txnId;
      }

      // TASK-2067: Delegate to EmailSyncService which fetches from provider AND stores locally
      const result = await emailSyncService.searchProviderEmails({
        userId: validatedUserId,
        searchParams: {
          query: options?.query || "",
          after: options?.after ? new Date(options.after) : null,
          before: options?.before ? new Date(options.before) : null,
          maxResults: effectiveMaxResults,
          skip: options?.skip || 0,
        },
        transactionId: validatedTxnId,
      });

      if (result.noProviderConnected) {
        return {
          success: false,
          error: "No email account connected. Please connect Gmail or Outlook in Settings.",
        };
      }

      return {
        success: true,
        emails: result.emails,
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
}
