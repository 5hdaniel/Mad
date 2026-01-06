// ============================================
// CONVERSATION & MESSAGE IPC HANDLERS
// Extracted from main.ts for modularity
// Handles: get-conversations, get-messages, open-folder, export-conversations
// ============================================

import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { promises as fs } from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { app } from "electron";

// Import services and utilities
import {
  getContactNames,
  resolveContactName,
} from "../services/contactsService";
import logService from "../services/logService";
import { macTimestampToDate, getYearsAgoTimestamp } from "../utils/dateUtils";
import { createTimestampedFilename } from "../utils/fileUtils";
import { getMessageText } from "../utils/messageParser";
import { MAC_EPOCH } from "../constants";

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

/**
 * Register conversation and message export IPC handlers
 */
export function registerConversationHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    logService.warn(
      "Handlers already registered, skipping duplicate registration",
      "ConversationHandlers"
    );
    return;
  }
  handlersRegistered = true;

  // Get conversations from Messages database
  ipcMain.handle("get-conversations", async () => {
    try {
      const messagesDbPath = path.join(
        process.env.HOME!,
        "Library/Messages/chat.db"
      );

      const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
      const dbAll = promisify(db.all.bind(db)) as (
        sql: string,
        params?: any
      ) => Promise<any[]>;
      const dbClose = promisify(db.close.bind(db));

      let db2: sqlite3.Database | null = null;
      let dbClose2: (() => Promise<void>) | null = null;

      try {
        // Get contact names from Contacts database
        const { contactMap, phoneToContactInfo } = await getContactNames();

        // Get all chats with their latest message
        // Filter to only show chats with at least 1 message
        const conversations = (await dbAll(`
          SELECT
            chat.ROWID as chat_id,
            chat.chat_identifier,
            chat.display_name,
            handle.id as contact_id,
            MAX(message.date) as last_message_date,
            COUNT(message.ROWID) as message_count
          FROM chat
          LEFT JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
          LEFT JOIN handle ON chat_handle_join.handle_id = handle.ROWID
          LEFT JOIN chat_message_join ON chat.ROWID = chat_message_join.chat_id
          LEFT JOIN message ON chat_message_join.message_id = message.ROWID
          GROUP BY chat.ROWID
          HAVING message_count > 0 AND last_message_date IS NOT NULL
          ORDER BY last_message_date DESC
        `)) as any[];

        // Close first database connection - we're done with it
        await dbClose();

        // Re-open database to query group chat participants
        db2 = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
        const dbAll2 = promisify(db2.all.bind(db2)) as (
          sql: string,
          params?: any
        ) => Promise<any[]>;
        dbClose2 = promisify(db2.close.bind(db2));

        // Map conversations and deduplicate by contact NAME
        // This ensures that if a contact has multiple phone numbers or emails,
        // they appear as ONE contact with all their info
        const conversationMap = new Map<string, any>();

        // Process conversations - track direct chats and group chats separately
        for (const conv of conversations) {
          const rawContactId = conv.contact_id || conv.chat_identifier;
          const displayName = resolveContactName(
            conv.contact_id,
            conv.chat_identifier,
            conv.display_name,
            contactMap
          );

          // Detect group chats - they have chat_identifier like "chat123456789"
          // Individual chats have phone numbers or emails as identifiers
          const isGroupChat =
            conv.chat_identifier &&
            conv.chat_identifier.startsWith("chat") &&
            !conv.chat_identifier.includes("@");

          if (isGroupChat) {
            // For group chats, we need to attribute the chat to all participants

            try {
              // Get all participants in this group chat
              const participants = (await dbAll2(
                `
                SELECT DISTINCT handle.id as contact_id
                FROM chat_handle_join
                JOIN handle ON chat_handle_join.handle_id = handle.ROWID
                WHERE chat_handle_join.chat_id = ?
              `,
                [conv.chat_id]
              )) as any[];

              // Add this group chat to each participant's statistics
              for (const participant of participants) {
                const participantName = resolveContactName(
                  participant.contact_id,
                  participant.contact_id,
                  undefined,
                  contactMap
                );
                const normalizedKey = participantName.toLowerCase().trim();

                // Get or create contact entry
                if (!conversationMap.has(normalizedKey)) {
                  // Create new contact entry for this participant
                  let contactInfo: any = null;
                  let phones: string[] = [];
                  let emails: string[] = [];

                  if (
                    participant.contact_id &&
                    participant.contact_id.includes("@")
                  ) {
                    const emailLower = participant.contact_id.toLowerCase();
                    for (const info of Object.values(phoneToContactInfo)) {
                      const contactInfoTyped = info as any;
                      if (
                        contactInfoTyped.emails &&
                        contactInfoTyped.emails.some(
                          (e: string) => e.toLowerCase() === emailLower
                        )
                      ) {
                        contactInfo = contactInfoTyped;
                        break;
                      }
                    }
                    if (contactInfo) {
                      phones = contactInfo.phones || [];
                      emails = contactInfo.emails || [];
                    } else {
                      emails = [participant.contact_id];
                    }
                  } else if (participant.contact_id) {
                    const normalized = participant.contact_id.replace(/\D/g, "");
                    contactInfo =
                      phoneToContactInfo[normalized] ||
                      phoneToContactInfo[participant.contact_id];
                    if (contactInfo) {
                      phones = contactInfo.phones || [];
                      emails = contactInfo.emails || [];
                    } else {
                      phones = [participant.contact_id];
                    }
                  }

                  conversationMap.set(normalizedKey, {
                    id: `group-contact-${normalizedKey}`, // Generate unique ID for group-only contacts
                    name: participantName,
                    contactId: participant.contact_id,
                    phones: phones,
                    emails: emails,
                    showBothNameAndNumber:
                      participantName !== participant.contact_id,
                    messageCount: 0,
                    lastMessageDate: 0,
                    directChatCount: 0,
                    directMessageCount: 0,
                    groupChatCount: 0,
                    groupMessageCount: 0,
                  });
                }

                // Add group chat stats to this participant
                const existing = conversationMap.get(normalizedKey);
                existing.groupChatCount += 1;
                existing.groupMessageCount += conv.message_count;
                existing.messageCount += conv.message_count;

                // Update last message date if this group chat is more recent
                if (conv.last_message_date > existing.lastMessageDate) {
                  existing.lastMessageDate = conv.last_message_date;
                }
              }
            } catch (err) {
              logService.error(
                `Error processing group chat ${conv.chat_identifier}`,
                "ConversationHandlers",
                { error: err }
              );
            }

            continue; // Skip to next conversation (don't add group chat as its own contact)
          }

          // Get full contact info (all phones and emails)
          let contactInfo: any = null;
          let phones: string[] = [];
          let emails: string[] = [];

          if (rawContactId && rawContactId.includes("@")) {
            // contactId is an email - look up contact info by email
            const emailLower = rawContactId.toLowerCase();
            // Try to find this email in phoneToContactInfo
            for (const info of Object.values(phoneToContactInfo)) {
              const contactInfoTyped = info as any;
              if (
                contactInfoTyped.emails &&
                contactInfoTyped.emails.some(
                  (e: string) => e.toLowerCase() === emailLower
                )
              ) {
                contactInfo = contactInfoTyped;
                break;
              }
            }

            if (contactInfo) {
              phones = contactInfo.phones || [];
              emails = contactInfo.emails || [];
            } else {
              emails = [rawContactId];
            }
          } else if (rawContactId) {
            // contactId is a phone - look up full contact info
            const normalized = rawContactId.replace(/\D/g, "");
            contactInfo =
              phoneToContactInfo[normalized] || phoneToContactInfo[rawContactId];

            // If not found and number has country code 1 (11 digits starting with 1), try without it
            if (
              !contactInfo &&
              normalized.startsWith("1") &&
              normalized.length === 11
            ) {
              const withoutCountryCode = normalized.substring(1);
              contactInfo = phoneToContactInfo[withoutCountryCode];
            }

            if (contactInfo) {
              phones = contactInfo.phones || [];
              emails = contactInfo.emails || [];
            } else {
              // No contact info found, just use the raw phone number
              phones = [rawContactId];
            }
          }

          // Use contact name as the deduplication key
          // This ensures all chats with the same person are merged
          const normalizedKey = displayName.toLowerCase().trim();

          const conversationData = {
            id: conv.chat_id,
            chatId: conv.chat_id, // CRITICAL: Set chatId field for exports
            name: displayName,
            contactId: rawContactId,
            phones: phones,
            emails: emails,
            showBothNameAndNumber: displayName !== rawContactId,
            messageCount: conv.message_count,
            lastMessageDate: conv.last_message_date,
            directChatCount: 1, // This is a direct chat
            directMessageCount: conv.message_count,
            groupChatCount: 0,
            groupMessageCount: 0,
          };

          // If we already have this contact, merge the data
          if (conversationMap.has(normalizedKey)) {
            const existing = conversationMap.get(normalizedKey);

            // Merge phones (unique)
            const allPhones = [...new Set([...existing.phones, ...phones])];
            // Merge emails (unique)
            const allEmails = [...new Set([...existing.emails, ...emails])];

            // CRITICAL FIX: Always prefer a real chat ID over a generated group-contact-* ID
            // This ensures we can export 1:1 messages even if group chat is more recent
            const wasGeneratedId =
              typeof existing.id === "string" &&
              existing.id.startsWith("group-contact-");
            if (!existing.id || wasGeneratedId) {
              // Current ID is fake, use the real chat ID from this 1:1 conversation
              existing.id = conv.chat_id;
              existing.chatId = conv.chat_id; // Also set chatId field
            }

            // Update last message date if this chat is more recent
            if (conv.last_message_date > existing.lastMessageDate) {
              existing.lastMessageDate = conv.last_message_date;
            }

            // Add up message counts and direct chat counts
            existing.messageCount += conv.message_count;
            existing.directChatCount += 1;
            existing.directMessageCount += conv.message_count;
            existing.phones = allPhones;
            existing.emails = allEmails;
          } else {
            conversationMap.set(normalizedKey, conversationData);
          }
        }

        // Close the second database connection
        await dbClose2();

        // Convert map back to array
        const deduplicatedConversations = Array.from(
          conversationMap.values()
        ).sort((a, b) => b.lastMessageDate - a.lastMessageDate);

        // Filter out contacts with no messages in the last 5 years
        const fiveYearsAgo = getYearsAgoTimestamp(5);
        const macEpoch = MAC_EPOCH;
        const fiveYearsAgoMacTime = (fiveYearsAgo - macEpoch) * 1000000; // Convert to Mac timestamp (nanoseconds)

        const recentConversations = deduplicatedConversations.filter((conv) => {
          return conv.lastMessageDate > fiveYearsAgoMacTime;
        });

        return {
          success: true,
          conversations: recentConversations,
        };
      } catch (error) {
        // Clean up db2 if it was opened
        if (dbClose2) {
          try {
            await dbClose2();
          } catch (closeError) {
            logService.error("Error closing db2", "ConversationHandlers", { error: closeError });
          }
        }
        throw error;
      }
    } catch (error) {
      logService.error("Error getting conversations", "ConversationHandlers", { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // Get messages for a specific conversation
  ipcMain.handle(
    "get-messages",
    async (event: IpcMainInvokeEvent, chatId: number) => {
      try {
        const messagesDbPath = path.join(
          process.env.HOME!,
          "Library/Messages/chat.db"
        );

        const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
        const dbAll = promisify(db.all.bind(db)) as (
          sql: string,
          params?: any
        ) => Promise<any[]>;
        const dbClose = promisify(db.close.bind(db));

        try {
          const messages = (await dbAll(
            `
          SELECT
            message.ROWID as id,
            message.text,
            message.date,
            message.is_from_me,
            handle.id as sender
          FROM message
          JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
          LEFT JOIN handle ON message.handle_id = handle.ROWID
          WHERE chat_message_join.chat_id = ?
          ORDER BY message.date ASC
        `,
            [chatId]
          )) as any[];

          await dbClose();

          return {
            success: true,
            messages: messages.map((msg) => ({
              id: msg.id,
              text: msg.text || "",
              date: msg.date,
              isFromMe: msg.is_from_me === 1,
              sender: msg.sender,
            })),
          };
        } catch (error) {
          await dbClose();
          throw error;
        }
      } catch (error) {
        logService.error("Error getting messages", "ConversationHandlers", { error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // Open folder in Finder
  ipcMain.handle(
    "open-folder",
    async (event: IpcMainInvokeEvent, folderPath: string) => {
      try {
        await shell.openPath(folderPath);
        return { success: true };
      } catch (error) {
        logService.error("Error opening folder", "ConversationHandlers", { error, folderPath });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Export conversations to files
  ipcMain.handle(
    "export-conversations",
    async (event: IpcMainInvokeEvent, conversationIds: number[]) => {
      try {
        // Generate default folder name with timestamp
        const now = new Date();
        const timestamp = now
          .toLocaleString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
          .replace(/[/:]/g, "-")
          .replace(", ", " ");

        const defaultFolderName = `Text Messages Export ${timestamp}`;

        // Show save dialog
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: "Choose Export Location",
          defaultPath: path.join(app.getPath("documents"), defaultFolderName),
          properties: ["createDirectory", "showOverwriteConfirmation"],
        });

        if (canceled || !filePath) {
          return { success: false, canceled: true };
        }

        // Create export directory
        await fs.mkdir(filePath, { recursive: true });

        const messagesDbPath = path.join(
          process.env.HOME!,
          "Library/Messages/chat.db"
        );

        const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
        const dbAll = promisify(db.all.bind(db)) as (
          sql: string,
          params?: any
        ) => Promise<any[]>;
        const dbClose = promisify(db.close.bind(db));

        // Load contact names for resolving names in export
        const { contactMap } = await getContactNames();

        const exportedFiles: string[] = [];
        const exportedContactNames: string[] = [];

        try {
          for (const chatId of conversationIds) {
            // Get chat info
            const chatInfo = (await dbAll(
              `
            SELECT
              chat.chat_identifier,
              chat.display_name,
              handle.id as contact_id
            FROM chat
            LEFT JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
            LEFT JOIN handle ON chat_handle_join.handle_id = handle.ROWID
            WHERE chat.ROWID = ?
            LIMIT 1
          `,
              [chatId]
            )) as any[];

            if (chatInfo.length === 0) continue;

            // Resolve contact name using the same logic as conversation list
            const chatName = resolveContactName(
              chatInfo[0].contact_id,
              chatInfo[0].chat_identifier,
              chatInfo[0].display_name,
              contactMap
            );

            // Track contact names for folder renaming
            exportedContactNames.push(chatName);

            // Get messages with attachment info
            // Note: Some messages have text in 'attributedBody' blob field instead of 'text'
            const messages = (await dbAll(
              `
            SELECT
              message.ROWID as id,
              message.text,
              message.date,
              message.is_from_me,
              handle.id as sender,
              message.cache_has_attachments,
              message.attributedBody
            FROM message
            JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
            LEFT JOIN handle ON message.handle_id = handle.ROWID
            WHERE chat_message_join.chat_id = ?
            ORDER BY message.date ASC
          `,
              [chatId]
            )) as any[];

            // Format messages as text
            let exportContent = `Conversation with: ${chatName}\n`;
            exportContent += `Exported: ${new Date().toLocaleString()}\n`;
            exportContent += `Total Messages: ${messages.length}\n`;
            exportContent += "=".repeat(80) + "\n\n";

            for (const msg of messages) {
              // Convert Mac timestamp to readable date
              const messageDate = macTimestampToDate(msg.date);

              // Resolve sender name
              let sender: string;
              if (msg.is_from_me) {
                sender = "Me";
              } else if (msg.sender) {
                // Try to resolve sender name from contacts
                const resolvedName = resolveContactName(
                  msg.sender,
                  msg.sender,
                  undefined,
                  contactMap
                );
                sender = resolvedName !== msg.sender ? resolvedName : msg.sender;
              } else {
                sender = "Unknown";
              }

              // Handle text content (using centralized message parser)
              const text = getMessageText(msg);

              exportContent += `[${messageDate.toLocaleString()}] ${sender}:\n${text}\n\n`;
            }

            // Save file
            const fileName = createTimestampedFilename(chatName, "txt");
            const exportFilePath = path.join(filePath, fileName);

            await fs.writeFile(exportFilePath, exportContent, "utf8");
            exportedFiles.push(fileName);
          }

          await dbClose();

          // Rename folder if exporting a single contact
          let finalPath = filePath;
          if (exportedContactNames.length === 1) {
            const contactName = exportedContactNames[0];
            const now = new Date();
            const timestamp = now
              .toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })
              .replace(/[/:]/g, "-")
              .replace(", ", " ");

            // Format: "Name text messages export MM-DD-YYYY HH:MM:SS"
            const newFolderName = `${contactName} text messages export ${timestamp}`;
            const newPath = path.join(path.dirname(filePath), newFolderName);

            try {
              await fs.rename(filePath, newPath);
              finalPath = newPath;
            } catch (renameError) {
              logService.error("Error renaming folder", "ConversationHandlers", { error: renameError });
              // Keep original path if rename fails
            }
          }

          return {
            success: true,
            exportPath: finalPath,
            filesCreated: exportedFiles,
          };
        } catch (error) {
          await dbClose();
          throw error;
        }
      } catch (error) {
        logService.error("Error exporting conversations", "ConversationHandlers", { error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );
}
