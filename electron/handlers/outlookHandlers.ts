// ============================================
// OUTLOOK INTEGRATION IPC HANDLERS
// Extracted from main.ts for modularity
// Handles: Outlook OAuth, email export, authentication
// ============================================

import { ipcMain, dialog, shell, BrowserWindow, Notification } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import sqlite3 from "sqlite3";
import { promisify } from "util";

// Import services
import databaseService from "../services/databaseService";
import microsoftAuthService from "../services/microsoftAuthService";
import OutlookService from "../outlookService";
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
  ExportProgressCallback,
  ContactExportResult,
} from "../types/handlerTypes";
import { getNumericChatId } from "../types/handlerTypes";

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

// Outlook service instance - shared across handlers
let outlookService: OutlookService | null = null;

// Note: getValidUserId imported from ../utils/userIdHelper (BACKLOG-615: removed duplicate)

/**
 * Register Outlook integration IPC handlers
 */
export function registerOutlookHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    logService.warn(
      "Handlers already registered, skipping duplicate registration",
      "OutlookHandlers"
    );
    return;
  }
  handlersRegistered = true;

  // Initialize outlook service
  outlookService = new OutlookService();

  // ===== OUTLOOK INTEGRATION IPC HANDLERS =====
  // Now using redirect-based OAuth (no device code required!)

  // Initialize Outlook service (no-op now, kept for compatibility)
  ipcMain.handle("outlook-initialize", async () => {
    return { success: true };
  });

  // Authenticate with Outlook using redirect-based OAuth
  ipcMain.handle(
    "outlook-authenticate",
    async (event: IpcMainInvokeEvent, providedUserId?: string) => {
      try {
        logService.info("Starting Outlook authentication with redirect flow", "OutlookHandlers");

        // BACKLOG-551: Get valid user ID (handles missing/stale IDs)
        const userId = await getValidUserId(providedUserId);
        if (!userId) {
          return { success: false, error: "No user found in database" };
        }

        // Get user info to use as login hint
        let loginHint: string | undefined = undefined;
        const user = await databaseService.getUserById(userId);
        if (user) {
          loginHint = user.email;
        }

        // Start auth flow - returns authUrl and a promise for the code
        const {
          authUrl,
          codePromise,
          codeVerifier,
          scopes: _scopes,
        } = await microsoftAuthService.authenticateForMailbox(loginHint);

        // Open browser with auth URL
        await shell.openExternal(authUrl);

        // Wait for user to complete auth in browser (local server will catch redirect)
        const code = await codePromise;
        logService.info("Received authorization code from redirect", "OutlookHandlers");

        // Exchange code for tokens
        const tokens = await microsoftAuthService.exchangeCodeForTokens(
          code,
          codeVerifier
        );

        // Get user info
        const userInfo = await microsoftAuthService.getUserInfo(
          tokens.access_token
        );

        // Session-only OAuth: no token encryption needed (database is already encrypted)
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token || undefined;

        // Save mailbox token to database
        const expiresAt = new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString();

        await databaseService.saveOAuthToken(userId, "microsoft", "mailbox", {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          scopes_granted: tokens.scope,
          connected_email_address: userInfo.email,
        });

        logService.info("Outlook authentication completed successfully", "OutlookHandlers");

        return {
          success: true,
          userInfo: {
            username: userInfo.email,
            name: userInfo.name,
          },
        };
      } catch (error) {
        logService.error("Outlook authentication failed", "OutlookHandlers", { error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // Check if authenticated
  ipcMain.handle(
    "outlook-is-authenticated",
    async (event: IpcMainInvokeEvent, providedUserId?: string) => {
      try {
        // BACKLOG-551: Get valid user ID (handles missing/stale IDs)
        const userId = await getValidUserId(providedUserId);
        if (!userId) return false;

        const token = await databaseService.getOAuthToken(
          userId,
          "microsoft",
          "mailbox"
        );
        if (!token || !token.access_token || !token.token_expires_at)
          return false;

        // Check if token is expired
        const tokenExpiry = new Date(token.token_expires_at);
        const now = new Date();

        return tokenExpiry > now;
      } catch (error) {
        logService.error("Error checking Outlook authentication", "OutlookHandlers", { error });
        return false;
      }
    }
  );

  // Get user email
  ipcMain.handle(
    "outlook-get-user-email",
    async (event: IpcMainInvokeEvent, providedUserId?: string) => {
      try {
        // BACKLOG-551: Get valid user ID (handles missing/stale IDs)
        const userId = await getValidUserId(providedUserId);
        if (!userId) {
          return {
            success: false,
            error: "No user found in database",
          };
        }

        const token = await databaseService.getOAuthToken(
          userId,
          "microsoft",
          "mailbox"
        );
        if (!token || !token.connected_email_address) {
          return {
            success: false,
            error: "Not authenticated",
          };
        }

        return {
          success: true,
          email: token.connected_email_address,
        };
      } catch (error) {
        logService.error("Error getting user email", "OutlookHandlers", { error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // Export emails for multiple contacts
  ipcMain.handle(
    "outlook-export-emails",
    async (event: IpcMainInvokeEvent, contacts: ExportContact[]) => {
      try {
        if (!outlookService || !outlookService.isAuthenticated()) {
          return {
            success: false,
            error: "Not authenticated with Outlook",
          };
        }

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
          mainWindow?.webContents.send("export-progress", {
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

          // 1. Export text messages (if chatId exists or if we have phone/email identifiers)
          const hasPhones = contact.phones && contact.phones.length > 0;
          const hasEmails = contact.emails && contact.emails.length > 0;
          if (
            contact.chatId ||
            hasPhones ||
            hasEmails
          ) {
            try {
              mainWindow?.webContents.send("export-progress", {
                stage: "text-messages",
                message: `Exporting text messages for ${contact.name}...`,
                current: i + 1,
                total: contacts.length,
                contactName: contact.name,
              });

              let messages: MessageRow[] = [];
              const allChatIds = new Set<number>();

              // Strategy: Fetch messages from ALL chats involving this contact
              // This includes both their primary 1:1 chat AND any group chats they're in

              // Step 1: If they have a primary chatId, add it
              const numericChatId = getNumericChatId(contact);
              if (numericChatId !== null) {
                allChatIds.add(numericChatId);
              }

              // Step 2: Find ALL chats where their phone numbers or emails appear
              // This will find group chats they're in
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

                let _filesCreated = 0;

                // Export all 1:1 messages to a single file
                if (oneOnOneMessages.length > 0) {
                  let exportContent = `1-ON-1 MESSAGES\n`;
                  exportContent += `Contact: ${contact.name}\n`;
                  exportContent += `Exported: ${new Date().toLocaleString()}\n`;
                  exportContent += `Total Messages: ${oneOnOneMessages.length}\n`;
                  exportContent += "=".repeat(80) + "\n\n";

                  for (const msg of oneOnOneMessages) {
                    // Convert Mac timestamp to readable date
                    const messageDate = macTimestampToDate(msg.date);

                    // Resolve sender name
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

                    // Handle text content (using centralized message parser)
                    const text = getMessageText(msg);

                    exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                  }

                  // Save 1:1 messages file
                  const oneOnOneFilePath = path.join(
                    contactFolder,
                    "1-on-1_messages.txt"
                  );
                  await fs.writeFile(oneOnOneFilePath, exportContent, "utf8");
                  _filesCreated++;
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
                    // Convert Mac timestamp to readable date
                    const messageDate = macTimestampToDate(msg.date);

                    // Resolve sender name
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

                    // Handle text content (using centralized message parser)
                    const text = getMessageText(msg);

                    exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
                  }

                  // Save group chat file
                  const groupFilePath = path.join(contactFolder, fileName);
                  await fs.writeFile(groupFilePath, exportContent, "utf8");
                  _filesCreated++;
                  anySuccess = true;
                }
              }
            } catch (err) {
              logService.error(
                `Error exporting text messages for ${contact.name}`,
                "OutlookHandlers",
                { error: err }
              );
              errors.push(`Text messages: ${(err as Error).message}`);
            }
          }

          // 2. Export emails (if email addresses exist)
          if (contact.emails && contact.emails.length > 0) {
            for (const email of contact.emails) {
              try {
                const result = await outlookService!.exportEmailsToAudit(
                  contact.name,
                  email,
                  exportPath,
                  ((progress: Record<string, unknown>) => {
                    // Forward progress to renderer
                    mainWindow?.webContents.send("export-progress", {
                      ...progress,
                      contactName: contact.name,
                      current: i + 1,
                      total: contacts.length,
                    });
                  }) as ExportProgressCallback
                );

                if (result.success) {
                  anySuccess = true;
                  totalEmails += result.emailCount || 0;
                } else if (result.error) {
                  errors.push(`${email}: ${result.error}`);
                }
              } catch (err) {
                logService.error(`Error exporting emails from ${email}`, "OutlookHandlers", { error: err });
                errors.push(`${email}: ${(err as Error).message}`);
              }
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
        logService.error("Error exporting full audit", "OutlookHandlers", { error, stack: (error as Error).stack });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // Sign out from Outlook
  ipcMain.handle("outlook-signout", async () => {
    try {
      if (outlookService) {
        await outlookService.signOut();
      }
      return { success: true };
    } catch (error) {
      logService.error("Error signing out", "OutlookHandlers", { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}

/**
 * Get the Outlook service instance (for use by other handlers if needed)
 */
export function getOutlookService(): OutlookService | null {
  return outlookService;
}
