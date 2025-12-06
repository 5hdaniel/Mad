/**
 * iOS Messages Parser Service
 * Parses sms.db from iOS backups to extract conversations and messages
 */

import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import log from 'electron-log';
import {
  iOSMessage,
  iOSAttachment,
  iOSConversation,
  RawMessageRow,
  RawAttachmentRow,
  RawChatRow,
  RawHandleRow,
} from '../types/iosMessages';

/**
 * Convert Apple Cocoa Core Data timestamp to JavaScript Date
 * iOS uses nanoseconds since 2001-01-01 00:00:00 UTC
 */
export function convertAppleTimestamp(timestamp: number | null): Date | null {
  if (timestamp === null || timestamp === undefined || timestamp === 0) {
    return null;
  }

  // Apple epoch is 2001-01-01 00:00:00 UTC in milliseconds since Unix epoch
  const APPLE_EPOCH_MS = 978307200000;

  // iOS stores in nanoseconds, need to convert to milliseconds
  const milliseconds = timestamp / 1000000;

  return new Date(APPLE_EPOCH_MS + milliseconds);
}

/**
 * iOS Messages Parser
 * Reads sms.db from an iTunes-style backup and extracts conversations and messages
 */
export class iOSMessagesParser {
  private db: Database.Database | null = null;
  private backupPath: string = '';

  // The sms.db hash in iOS backups (SHA-1 of domain + path)
  static readonly SMS_DB_HASH = '3d0d7e5fb2ce288813306e4d4636395e047a3d28';

  /**
   * Open the sms.db database from a backup
   * @param backupPath Path to the iOS backup directory
   */
  open(backupPath: string): void {
    const dbPath = path.join(backupPath, iOSMessagesParser.SMS_DB_HASH);

    try {
      this.db = new Database(dbPath, { readonly: true });
      this.backupPath = backupPath;
      log.info('iOSMessagesParser: Opened database', { backupPath });
    } catch (error) {
      log.error('iOSMessagesParser: Failed to open database', {
        backupPath,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
        log.info('iOSMessagesParser: Closed database');
      } catch (error) {
        log.error('iOSMessagesParser: Error closing database', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.db = null;
      this.backupPath = '';
    }
  }

  /**
   * Check if database is open
   */
  isOpen(): boolean {
    return this.db !== null;
  }

  /**
   * Ensure database is open before operations
   */
  private ensureOpen(): void {
    if (!this.db) {
      throw new Error('Database not open. Call open() first.');
    }
  }

  /**
   * Get a handle (contact identifier) by ID
   */
  private getHandle(handleId: number): string {
    this.ensureOpen();

    try {
      const row = this.db!.prepare(`
        SELECT id FROM handle WHERE ROWID = ?
      `).get(handleId) as RawHandleRow | undefined;

      return row?.id || '';
    } catch (error) {
      log.error('iOSMessagesParser: Error getting handle', {
        handleId,
        error: error instanceof Error ? error.message : String(error)
      });
      return '';
    }
  }

  /**
   * Get all conversations from the database
   */
  getConversations(): iOSConversation[] {
    this.ensureOpen();

    try {
      const chats = this.db!.prepare(`
        SELECT
          chat.ROWID,
          chat.guid,
          chat.chat_identifier,
          chat.display_name
        FROM chat
        ORDER BY chat.ROWID
      `).all() as RawChatRow[];

      const conversations: iOSConversation[] = [];

      for (const chat of chats) {
        try {
          // Get participants for this chat
          const participants = this.getParticipants(chat.ROWID);

          // Get last message date
          const lastMessageRow = this.db!.prepare(`
            SELECT MAX(message.date) as last_date
            FROM message
            JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
            WHERE chat_message_join.chat_id = ?
          `).get(chat.ROWID) as { last_date: number | null } | undefined;

          const lastMessageDate = convertAppleTimestamp(lastMessageRow?.last_date || null);

          // Skip chats with no messages
          if (!lastMessageDate) {
            continue;
          }

          // Determine if group chat (more than 1 participant or starts with 'chat')
          const isGroupChat = participants.length > 1 ||
            (chat.chat_identifier?.startsWith('chat') && !chat.chat_identifier.includes('@'));

          conversations.push({
            chatId: chat.ROWID,
            chatIdentifier: chat.chat_identifier || chat.display_name || '',
            participants,
            messages: [], // Messages loaded separately via getMessages()
            lastMessage: lastMessageDate,
            isGroupChat,
          });
        } catch (chatError) {
          log.error('iOSMessagesParser: Error processing chat', {
            chatId: chat.ROWID,
            error: chatError instanceof Error ? chatError.message : String(chatError)
          });
          // Continue with next chat
        }
      }

      // Sort by last message date descending
      conversations.sort((a, b) => b.lastMessage.getTime() - a.lastMessage.getTime());

      return conversations;
    } catch (error) {
      log.error('iOSMessagesParser: Error getting conversations', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get participants for a chat
   */
  private getParticipants(chatId: number): string[] {
    this.ensureOpen();

    try {
      const rows = this.db!.prepare(`
        SELECT DISTINCT handle.id
        FROM chat_handle_join
        JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        WHERE chat_handle_join.chat_id = ?
      `).all(chatId) as Array<{ id: string }>;

      return rows.map(row => row.id);
    } catch (error) {
      log.error('iOSMessagesParser: Error getting participants', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get messages for a specific chat
   * @param chatId The chat ID to get messages for
   * @param limit Optional limit on number of messages (for pagination)
   * @param offset Optional offset for pagination
   */
  getMessages(chatId: number, limit?: number, offset?: number): iOSMessage[] {
    this.ensureOpen();

    try {
      let query = `
        SELECT
          message.ROWID,
          message.guid,
          message.text,
          message.handle_id,
          message.is_from_me,
          message.date,
          message.date_read,
          message.date_delivered,
          message.service
        FROM message
        JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
        WHERE chat_message_join.chat_id = ?
        ORDER BY message.date ASC
      `;

      if (limit !== undefined) {
        query += ` LIMIT ${Math.max(1, Math.floor(limit))}`;
        if (offset !== undefined) {
          query += ` OFFSET ${Math.max(0, Math.floor(offset))}`;
        }
      }

      const rows = this.db!.prepare(query).all(chatId) as RawMessageRow[];

      return rows.map(row => this.mapMessage(row));
    } catch (error) {
      log.error('iOSMessagesParser: Error getting messages', {
        chatId,
        limit,
        offset,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Map a raw message row to iOSMessage
   */
  private mapMessage(row: RawMessageRow): iOSMessage {
    return {
      id: row.ROWID,
      guid: row.guid || '',
      text: row.text,
      handle: row.handle_id ? this.getHandle(row.handle_id) : '',
      isFromMe: row.is_from_me === 1,
      date: convertAppleTimestamp(row.date) || new Date(0),
      dateRead: convertAppleTimestamp(row.date_read),
      dateDelivered: convertAppleTimestamp(row.date_delivered),
      service: row.service === 'iMessage' ? 'iMessage' : 'SMS',
      attachments: this.getAttachments(row.ROWID),
    };
  }

  /**
   * Get attachments for a specific message
   * @param messageId The message ID to get attachments for
   */
  getAttachments(messageId: number): iOSAttachment[] {
    this.ensureOpen();

    try {
      const rows = this.db!.prepare(`
        SELECT
          attachment.ROWID,
          attachment.guid,
          attachment.filename,
          attachment.mime_type,
          attachment.transfer_name
        FROM attachment
        JOIN message_attachment_join ON attachment.ROWID = message_attachment_join.attachment_id
        WHERE message_attachment_join.message_id = ?
      `).all(messageId) as RawAttachmentRow[];

      return rows.map(row => ({
        id: row.ROWID,
        guid: row.guid || '',
        filename: row.filename || '',
        mimeType: row.mime_type || '',
        transferName: row.transfer_name || '',
      }));
    } catch (error) {
      log.error('iOSMessagesParser: Error getting attachments', {
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Search messages across all conversations
   * @param query The search query string
   * @param limit Optional limit on results
   */
  searchMessages(query: string, limit?: number): iOSMessage[] {
    this.ensureOpen();

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      let sql = `
        SELECT
          message.ROWID,
          message.guid,
          message.text,
          message.handle_id,
          message.is_from_me,
          message.date,
          message.date_read,
          message.date_delivered,
          message.service
        FROM message
        WHERE message.text LIKE ?
        ORDER BY message.date DESC
      `;

      if (limit !== undefined && limit > 0) {
        sql += ` LIMIT ${Math.floor(limit)}`;
      }

      const searchPattern = `%${query}%`;
      const rows = this.db!.prepare(sql).all(searchPattern) as RawMessageRow[];

      return rows.map(row => this.mapMessage(row));
    } catch (error) {
      log.error('iOSMessagesParser: Error searching messages', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get total message count for a chat
   */
  getMessageCount(chatId: number): number {
    this.ensureOpen();

    try {
      const row = this.db!.prepare(`
        SELECT COUNT(*) as count
        FROM message
        JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
        WHERE chat_message_join.chat_id = ?
      `).get(chatId) as { count: number } | undefined;

      return row?.count || 0;
    } catch (error) {
      log.error('iOSMessagesParser: Error getting message count', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Get conversation with messages populated
   */
  getConversationWithMessages(chatId: number, limit?: number, offset?: number): iOSConversation | null {
    this.ensureOpen();

    try {
      const chat = this.db!.prepare(`
        SELECT
          chat.ROWID,
          chat.guid,
          chat.chat_identifier,
          chat.display_name
        FROM chat
        WHERE chat.ROWID = ?
      `).get(chatId) as RawChatRow | undefined;

      if (!chat) {
        return null;
      }

      const participants = this.getParticipants(chatId);
      const messages = this.getMessages(chatId, limit, offset);

      const lastMessageDate = messages.length > 0
        ? messages[messages.length - 1].date
        : new Date(0);

      const isGroupChat = participants.length > 1 ||
        (chat.chat_identifier?.startsWith('chat') && !chat.chat_identifier.includes('@'));

      return {
        chatId: chat.ROWID,
        chatIdentifier: chat.chat_identifier || chat.display_name || '',
        participants,
        messages,
        lastMessage: lastMessageDate,
        isGroupChat,
      };
    } catch (error) {
      log.error('iOSMessagesParser: Error getting conversation with messages', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}

export default iOSMessagesParser;
