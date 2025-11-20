/**
 * Messages Service
 * Handles queries to the macOS Messages database
 */

import path from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { macTimestampToDate, getYearsAgoTimestamp } from '../utils/dateUtils';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { getMessageText } from '../utils/messageParser';
import { MESSAGES_DB_PATH, FIVE_YEARS_IN_MS } from '../constants';

/**
 * Database connection helpers
 */
interface DatabaseConnection {
  db: sqlite3.Database;
  dbAll: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  dbClose: () => Promise<void>;
}

/**
 * Conversation object from database
 */
export interface Conversation {
  chat_id: number;
  chat_identifier: string;
  display_name: string | null;
  contact_id: string | null;
  last_message_date: number;
  message_count: number;
}

/**
 * Group chat participant
 */
export interface Participant {
  contact_id: string;
}

/**
 * Message object from database
 */
export interface Message {
  id: number;
  text: string | null;
  attributedBody: Buffer | null;
  date: number;
  is_from_me: number;
  cache_has_attachments: number;
  sender: string | null;
  chat_identifier?: string;
  chat_name?: string | null;
}

/**
 * Contact with identifiers
 */
export interface ContactWithIdentifiers {
  phones?: string[];
  emails?: string[];
}

/**
 * Chat object
 */
export interface Chat {
  chat_id: number;
  chat_identifier: string;
  display_name: string | null;
  last_message_date: number;
}

/**
 * Open Messages database connection
 * @returns Database connection with helper functions
 */
export function openMessagesDatabase(): DatabaseConnection {
  const messagesDbPath = path.join(process.env.HOME!, MESSAGES_DB_PATH);
  const db = new sqlite3.Database(messagesDbPath, sqlite3.OPEN_READONLY);
  const dbAll = promisify(db.all.bind(db)) as <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  const dbClose = promisify(db.close.bind(db)) as () => Promise<void>;

  return { db, dbAll, dbClose };
}

/**
 * Get all conversations from Messages database
 * @returns Array of conversation objects
 */
export async function getAllConversations(): Promise<Conversation[]> {
  const { dbAll, dbClose } = openMessagesDatabase();

  try {
    const conversations = await dbAll<Conversation>(`
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
    `);

    await dbClose();
    return conversations;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Get group chat participants
 * @param chatId - Chat ID from Messages database
 * @returns Array of participant objects
 */
export async function getGroupChatParticipants(chatId: number): Promise<Participant[]> {
  const { dbAll, dbClose } = openMessagesDatabase();

  try {
    const participants = await dbAll<Participant>(`
      SELECT DISTINCT handle.id as contact_id
      FROM chat_handle_join
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE chat_handle_join.chat_id = ?
    `, [chatId]);

    await dbClose();
    return participants;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Check if a chat identifier represents a group chat
 * Group chats have identifiers like "chat123456789"
 * Individual chats have phone numbers or emails
 *
 * @param chatIdentifier - Chat identifier from Messages
 * @returns True if group chat
 */
export function isGroupChat(chatIdentifier: string): boolean {
  return chatIdentifier &&
    chatIdentifier.startsWith('chat') &&
    !chatIdentifier.includes('@');
}

/**
 * Get messages for a specific contact
 *
 * @param contact - Contact object with phone numbers and emails
 * @returns Array of message objects
 */
export async function getMessagesForContact(contact: ContactWithIdentifiers): Promise<Message[]> {
  const { dbAll, dbClose } = openMessagesDatabase();

  try {
    // Build WHERE clause for all contact identifiers
    const whereClauses: string[] = [];
    const params: string[] = [];

    // Add phone numbers
    if (contact.phones && contact.phones.length > 0) {
      contact.phones.forEach(phone => {
        whereClauses.push('handle.id = ?');
        params.push(phone);

        // Also try normalized version
        const normalized = normalizePhoneNumber(phone);
        if (normalized !== phone) {
          whereClauses.push('handle.id = ?');
          params.push(normalized);
        }
      });
    }

    // Add emails
    if (contact.emails && contact.emails.length > 0) {
      contact.emails.forEach(email => {
        whereClauses.push('handle.id = ?');
        params.push(email);
      });
    }

    // If no identifiers, return empty array
    if (whereClauses.length === 0) {
      await dbClose();
      return [];
    }

    const whereClause = whereClauses.join(' OR ');

    // Query messages
    const messages = await dbAll<Message>(`
      SELECT DISTINCT
        message.ROWID as id,
        message.text,
        message.attributedBody,
        message.date,
        message.is_from_me,
        message.cache_has_attachments,
        handle.id as sender,
        chat.chat_identifier,
        chat.display_name as chat_name
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      JOIN chat ON chat_message_join.chat_id = chat.ROWID
      LEFT JOIN handle ON message.handle_id = handle.ROWID
      WHERE ${whereClause}
      ORDER BY message.date ASC
    `, params);

    await dbClose();
    return messages;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Get messages for a specific chat
 *
 * @param chatId - Chat ID from Messages database
 * @returns Array of message objects
 */
export async function getMessagesForChat(chatId: number): Promise<Message[]> {
  const { dbAll, dbClose } = openMessagesDatabase();

  try {
    const messages = await dbAll<Message>(`
      SELECT
        message.ROWID as id,
        message.text,
        message.attributedBody,
        message.date,
        message.is_from_me,
        message.cache_has_attachments,
        handle.id as sender
      FROM message
      JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
      WHERE chat_message_join.chat_id = ?
      ORDER BY message.date ASC
    `, [chatId]);

    await dbClose();
    return messages;
  } catch (error) {
    await dbClose();
    throw error;
  }
}

/**
 * Get recent chats (within last 5 years)
 * @returns Array of chat objects
 */
export async function getRecentChats(): Promise<Chat[]> {
  const { dbAll, dbClose } = openMessagesDatabase();
  const fiveYearsAgo = getYearsAgoTimestamp(5);

  try {
    const chats = await dbAll<Chat>(`
      SELECT
        chat.ROWID as chat_id,
        chat.chat_identifier,
        chat.display_name,
        MAX(message.date) as last_message_date
      FROM chat
      JOIN chat_message_join ON chat.ROWID = chat_message_join.chat_id
      JOIN message ON chat_message_join.message_id = message.ROWID
      GROUP BY chat.ROWID
      HAVING last_message_date > ?
      ORDER BY last_message_date DESC
    `, [fiveYearsAgo]);

    await dbClose();
    return chats;
  } catch (error) {
    await dbClose();
    throw error;
  }
}
