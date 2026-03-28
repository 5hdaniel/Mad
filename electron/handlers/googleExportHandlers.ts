// ============================================
// GOOGLE EXPORT IPC HANDLERS (TASK-1416)
// Mirrors outlookHandlers.ts for Google/Gmail users
// Handles: Google auth check, email export, text message export
// ============================================

import { ipcMain, dialog, BrowserWindow, Notification } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import sqlite3 from "sqlite3";
import { promisify } from "util";

// Import services
import databaseService from "../services/databaseService";
import gmailFetchService from "../services/gmailFetchService";
import { getContactNames, resolveContactName } from "../services/contactsService";
import logService from "../services/logService";
import { macTimestampToDate } from "../utils/dateUtils";
import { sanitizeFilename } from "../utils/fileUtils";
import { getMessageText } from "../utils/messageParser";
import { getValidUserId } from "../utils/userIdHelper";

// Import handler types
import type {
  MessageRow,
  ChatInfoRow,
  ChatIdQueryRow,
  GroupChatData,
  ExportContact,
  ContactExportResult,
} from "../types/handlerTypes";
import { getNumericChatId } from "../types/handlerTypes";

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

/**
 * Register Google export IPC handlers (TASK-1416)
 */
export function registerGoogleExportHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    logService.warn(
      "Google export handlers already registered, skipping duplicate registration",
      "GoogleExportHandlers"
    );
    return;
  }
  handlersRegistered = true;

  // Initialize - check if Google mailbox token exists
  ipcMain.handle("google-export-initialize", async () => {
    return { success: true };
  });

  // Check if authenticated with Google mailbox
  ipcMain.handle(
    "google-export-is-authenticated",
    async (_event: IpcMainInvokeEvent, providedUserId?: string) => {
      try {
        const userId = await getValidUserId(providedUserId);
        if (!userId) return false;

        const token = await databaseService.getOAuthToken(
          userId,
          "google",
          "mailbox"
        );
        if (!token || !token.access_token || !token.token_expires_at)
          return false;

        // Check if token is expired
        const tokenExpiry = new Date(token.token_expires_at);
        const now = new Date();

        return tokenExpiry > now;
      } catch (error) {
        logService.error("Error checking Google authentication", "GoogleExportHandlers", { error });
        return false;
      }
    }
  );

  // Export emails and text messages for multiple contacts
  ipcMain.handle(
    "google-export-emails",
    async (_event: IpcMainInvokeEvent, contacts: ExportContact[]) => {
      try {
        // Get valid user ID
        const userId = await getValidUserId();
        if (!userId) {
          return { success: false, error: "No user found in database" };
        }

        // Initialize Gmail service with user's tokens
        await gmailFetchService.initialize(userId);

        // Show dialog to select export location (folder picker)
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: "Select Folder for Audit Export",
          defaultPath: path.join(os.homedir(), "Documents"),
          properties: ["openDirectory", "createDirectory"],
          buttonLabel: "Select Folder",
        });

        if (canceled || !filePaths || filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        // Auto-generate folder name: "Audit Export YYYY-MM-DD HH-MM-SS"
        const timestamp = new Date()
          .toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
          .replace(/[/:]/g, "-")
          .replace(/,/g, "");

        const exportFolderName = `Audit Export ${timestamp}`;
        const exportPath = path.join(filePaths[0], exportFolderName);

        // Create base export directory
        await fs.mkdir(exportPath, { recursive: true });

        // Open Messages database for text message export
        const messagesDbPath = path.join(
          process.env.HOME!,
          "Library/Messages/chat.db"
        );
        const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
        const dbAll = promisify(db.all.bind(db)) as <T>(
          sql: string,
          params?: unknown
        ) => Promise<T[]>;
        const dbClose = promisify(db.close.bind(db));

        // Load contact names for resolving names in export
        const { contactMap } = await getContactNames();

        const results: ContactExportResult[] = [];

        // Export BOTH text messages AND emails for each contact
        for (let i = 0; i < contacts.length; i++) {
          const contact = contacts[i];

          // Send progress update
          mainWindow?.webContents.send("google-export-progress", {
            stage: "contact",
            current: i + 1,
            total: contacts.length,
            contactName: contact.name,
          });

          // Create contact folder
          const sanitizedName = sanitizeFilename(contact.name, true);
          const contactFolder = path.join(exportPath, sanitizedName);
          await fs.mkdir(contactFolder, { recursive: true });

          let textMessageCount = 0;
          let totalEmails = 0;
          let anySuccess = false;
          const errors: string[] = [];

          // 1. Export text messages (same logic as outlookHandlers.ts)
          const hasPhones = contact.phones && contact.phones.length > 0;
          const hasEmails = contact.emails && contact.emails.length > 0;
          if (contact.chatId || hasPhones || hasEmails) {
            try {
              mainWindow?.webContents.send("google-export-progress", {
                stage: "text-messages",
                message: `Exporting text messages for ${contact.name}...`,
                current: i + 1,
                total: contacts.length,
                contactName: contact.name,
              });

              let messages: MessageRow[] = [];
              const allChatIds = new Set<number>();

              // Step 1: If they have a primary chatId, add it
              const numericChatId = getNumericChatId(contact);
              if (numericChatId !== null) {
                allChatIds.add(numericChatId);
              }

              // Step 2: Find ALL chats where their phone numbers or emails appear
              const identifiers = [
                ...(contact.phones || []),
                ...(contact.emails || []),
              ];

              if (identifiers.length > 0) {
                const placeholders = identifiers.map(() => "?").join(",");
                const chatIds = await dbAll<ChatIdQueryRow>(
                  `
                SELECT DISTINCT chat.ROWID as chat_id, chat.display_name, chat.chat_identifier
                FROM chat
                JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
                JOIN handle ON chat_handle_join.handle_id = handle.ROWID
                WHERE handle.id IN (${placeholders})
              `,
                  identifiers
                );

                chatIds.forEach((c: ChatIdQueryRow) => {
                  allChatIds.add(c.chat_id);
                });
              }

              // Step 3: Fetch messages from ALL identified chats
              if (allChatIds.size > 0) {
                const chatIdArray = Array.from(allChatIds);
                const chatIdPlaceholders = chatIdArray.map(() => "?").join(",");

                messages = await dbAll<MessageRow>(
                  `
                SELECT
                  message.ROWID as id,
                  message.text,
                  message.date,
                  message.is_from_me,
                  handle.id as sender,
                  message.cache_has_attachments,
                  message.attributedBody,
                  chat_message_join.chat_id
                FROM message
                JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
                LEFT JOIN handle ON message.handle_id = handle.ROWID
                WHERE chat_message_join.chat_id IN (${chatIdPlaceholders})
                ORDER BY message.date ASC
              `,
                  chatIdArray
                );
              }

              textMessageCount = messages.length;

              if (messages.length > 0) {
                // Group messages by chat_id
                const messagesByChatId: Record<string, MessageRow[]> = {};
                for (const msg of messages) {
                  const chatId = String(msg.chat_id || "unknown");
                  if (!messagesByChatId[chatId]) {
                    messagesByChatId[chatId] = [];
                  }
                  messagesByChatId[chatId].push(msg);
                }

                // Get chat info for each chat_id
                const chatInfoMap: Record<string, ChatInfoRow> = {};
                const chatIds = Object.keys(messagesByChatId).filter(
                  (id) => id !== "unknown"
                );
                if (chatIds.length > 0) {
                  const chatInfoQuery = `
                  SELECT
                    chat.ROWID as chat_id,
                    chat.chat_identifier,
                    chat.display_name
                  FROM chat
                  WHERE chat.ROWID IN (${chatIds.map(() => "?").join(",")})
                `;
                  const chatInfoResults = await dbAll<ChatInfoRow>(
                    chatInfoQuery,
                    chatIds
                  );
                  chatInfoResults.forEach((info: ChatInfoRow) => {
                    chatInfoMap[info.chat_id] = info;
                  });
                }

                // Separate group chats from 1:1 chats
                const groupChats: Record<string, GroupChatData> = {};
                const oneOnOneMessages: MessageRow[] = [];

                for (const [chatId, chatMessages] of Object.entries(
                  messagesByChatId
                )) {
                  const chatInfo = chatInfoMap[chatId];

                  if (!chatInfo) {
                    oneOnOneMessages.push(...chatMessages);
                    continue;
                  }

                  const isGroupChat =
                    chatInfo.chat_identifier &&
                    typeof chatInfo.chat_identifier === "string" &&
                    chatInfo.chat_identifier.startsWith("chat") &&
                    !chatInfo.chat_identifier.includes("@");

                  if (isGroupChat) {
                    groupChats[chatId] = {
                      info: chatInfo,
                      messages: chatMessages,
                    };
                  } else {
                    oneOnOneMessages.push(...chatMessages);
                  }
                }

                // Sort all 1:1 messages by date
                oneOnOneMessages.sort((a, b) => a.date - b.date);

                // Export all 1:1 messages to a single file
                if (oneOnOneMessages.length > 0) {
                  let exportContent = `1-ON-1 MESSAGES\n`;
                  exportContent += `Contact: ${contact.name}\n`;
                  exportContent += `Exported: ${new Date().toLocaleString()}\n`;
                  exportContent += `Total Messages: ${oneOnOneMessages.length}\n`;
                  exportContent += "=".repeat(80) + "\n\n";

                  for (const msg of oneOnOneMessages) {
                    const messageDate = macTimestampToDate(msg.date);
                    let sender: string;
                    if (msg.is_from_me) {
                      sender = "Me";
                    } else if (msg.sender) {
                      const resolvedName = resolveContactName(
                        msg.sender,
                        msg.sender,
                        undefined,
                        contactMap
                      );
                      sender =
                        resolvedName !== msg.sender ? resolvedName : msg.sender;
                    } else {
                      sender = "Unknown";
                    }
                    const text = getMessageText(msg);
                    exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                  }

                  const oneOnOneFilePath = path.join(
                    contactFolder,
                    "1-on-1_messages.txt"
                  );
                  await fs.writeFile(oneOnOneFilePath, exportContent, "utf8");
                  anySuccess = true;
                }

                // Export each group chat to its own file
                for (const [chatId, groupChat] of Object.entries(groupChats)) {
                  const chatName =
                    groupChat.info.display_name || `Group Chat ${chatId}`;
                  const sanitized = sanitizeFilename(chatName);
                  const fileName = `group_chat_${sanitized}.txt`;

                  let exportContent = `GROUP CHAT: ${chatName}\n`;
                  exportContent += `Contact: ${contact.name}\n`;
                  exportContent += `Exported: ${new Date().toLocaleString()}\n`;
                  exportContent += `Messages in this chat: ${groupChat.messages.length}\n`;
                  exportContent += "=".repeat(80) + "\n\n";

                  for (const msg of groupChat.messages) {
                    const messageDate = macTimestampToDate(msg.date);
                    let sender: string;
                    if (msg.is_from_me) {
                      sender = "Me";
                    } else if (msg.sender) {
                      const resolvedName = resolveContactName(
                        msg.sender,
                        msg.sender,
                        undefined,
                        contactMap
                      );
                      sender =
                        resolvedName !== msg.sender ? resolvedName : msg.sender;
                    } else {
                      sender = "Unknown";
                    }
                    const text = getMessageText(msg);
                    exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                  }

                  const groupFilePath = path.join(contactFolder, fileName);
                  await fs.writeFile(groupFilePath, exportContent, "utf8");
                  anySuccess = true;
                }
              }
            } catch (err) {
              logService.error(
                `Error exporting text messages for ${contact.name}`,
                "GoogleExportHandlers",
                { error: err }
              );
              errors.push(`Text messages: ${(err as Error).message}`);
            }
          }

          // 2. Export Gmail emails (if email addresses exist)
          if (contact.emails && contact.emails.length > 0) {
            try {
              mainWindow?.webContents.send("google-export-progress", {
                stage: "emails",
                message: `Fetching Gmail emails for ${contact.name}...`,
                current: i + 1,
                total: contacts.length,
                contactName: contact.name,
              });

              // Use gmailFetchService to search for emails matching contact addresses
              const emails = await gmailFetchService.searchEmails({
                contactEmails: contact.emails,
                maxResults: 500,
              });

              if (emails.length > 0) {
                // Create emails subfolder
                const emailsFolder = path.join(contactFolder, "emails");
                await fs.mkdir(emailsFolder, { recursive: true });

                for (const email of emails) {
                  const dateStr = email.date
                    ? email.date.toISOString().replace(/[:.]/g, "-").substring(0, 19)
                    : "unknown-date";
                  const subjectClean = sanitizeFilename(
                    email.subject || "no-subject"
                  );
                  const fileName = `${dateStr}_${subjectClean}.txt`.substring(0, 200);

                  let content = `Subject: ${email.subject || "(no subject)"}\n`;
                  content += `From: ${email.from || "unknown"}\n`;
                  content += `To: ${email.to || "unknown"}\n`;
                  if (email.cc) content += `CC: ${email.cc}\n`;
                  content += `Date: ${email.date ? email.date.toLocaleString() : "unknown"}\n`;
                  content += "=".repeat(80) + "\n\n";
                  content += email.bodyPlain || email.body || "(no body)";

                  const emailFilePath = path.join(emailsFolder, fileName);
                  await fs.writeFile(emailFilePath, content, "utf8");
                }

                totalEmails = emails.length;
                anySuccess = true;
              }
            } catch (err) {
              logService.error(
                `Error exporting Gmail emails for ${contact.name}`,
                "GoogleExportHandlers",
                { error: err }
              );
              errors.push(`Gmail emails: ${(err as Error).message}`);
            }
          }

          results.push({
            contactName: contact.name,
            success: anySuccess,
            textMessageCount: textMessageCount,
            emailCount: totalEmails,
            error: errors.length > 0 ? errors.join("; ") : null,
          });
        }

        // Close database
        await dbClose();

        // Show OS notification when complete
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        new Notification({
          title: "Full Audit Export Complete",
          body: `Exported ${successCount} contact${successCount !== 1 ? "s" : ""}${failCount > 0 ? `. ${failCount} failed.` : ""}`,
        }).show();

        return {
          success: true,
          exportPath: exportPath,
          results: results,
        };
      } catch (error) {
        logService.error("Error exporting full audit (Google)", "GoogleExportHandlers", { error, stack: (error as Error).stack });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );
}
