"use strict";
/**
 * Messages Service
 * Handles queries to the macOS Messages database
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openMessagesDatabase = openMessagesDatabase;
exports.getAllConversations = getAllConversations;
exports.getGroupChatParticipants = getGroupChatParticipants;
exports.isGroupChat = isGroupChat;
exports.getMessagesForContact = getMessagesForContact;
exports.getMessagesForChat = getMessagesForChat;
exports.getRecentChats = getRecentChats;
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const util_1 = require("util");
const { macTimestampToDate, getYearsAgoTimestamp } = require('../utils/dateUtils');
const { normalizePhoneNumber } = require('../utils/phoneUtils');
const { getMessageText } = require('../utils/messageParser');
const { MESSAGES_DB_PATH, FIVE_YEARS_IN_MS } = require('../constants');
/**
 * Open Messages database connection
 */
function openMessagesDatabase() {
    const messagesDbPath = path_1.default.join(process.env.HOME, MESSAGES_DB_PATH);
    const db = new sqlite3_1.default.Database(messagesDbPath, sqlite3_1.default.OPEN_READONLY);
    const dbAll = (0, util_1.promisify)(db.all.bind(db));
    const dbClose = (0, util_1.promisify)(db.close.bind(db));
    return { db, dbAll, dbClose };
}
/**
 * Get all conversations from Messages database
 */
async function getAllConversations() {
    const { dbAll, dbClose } = openMessagesDatabase();
    try {
        const conversations = await dbAll(`
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
    }
    catch (error) {
        await dbClose();
        throw error;
    }
}
/**
 * Get group chat participants
 */
async function getGroupChatParticipants(chatId) {
    const { dbAll, dbClose } = openMessagesDatabase();
    try {
        const participants = await dbAll(`
      SELECT DISTINCT handle.id as contact_id
      FROM chat_handle_join
      JOIN handle ON chat_handle_join.handle_id = handle.ROWID
      WHERE chat_handle_join.chat_id = ?
    `, [chatId]);
        await dbClose();
        return participants;
    }
    catch (error) {
        await dbClose();
        throw error;
    }
}
/**
 * Check if a chat identifier represents a group chat
 * Group chats have identifiers like "chat123456789"
 * Individual chats have phone numbers or emails
 */
function isGroupChat(chatIdentifier) {
    return Boolean(chatIdentifier) && chatIdentifier.startsWith('chat') && !chatIdentifier.includes('@');
}
/**
 * Get messages for a specific contact
 */
async function getMessagesForContact(contact) {
    const { dbAll, dbClose } = openMessagesDatabase();
    try {
        // Build WHERE clause for all contact identifiers
        const whereClauses = [];
        const params = [];
        // Add phone numbers
        if (contact.phones && contact.phones.length > 0) {
            contact.phones.forEach((phone) => {
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
            contact.emails.forEach((email) => {
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
        const messages = await dbAll(`
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
    }
    catch (error) {
        await dbClose();
        throw error;
    }
}
/**
 * Get messages for a specific chat
 */
async function getMessagesForChat(chatId) {
    const { dbAll, dbClose } = openMessagesDatabase();
    try {
        const messages = await dbAll(`
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
    }
    catch (error) {
        await dbClose();
        throw error;
    }
}
/**
 * Get recent chats (within last 5 years)
 */
async function getRecentChats() {
    const { dbAll, dbClose } = openMessagesDatabase();
    const fiveYearsAgo = getYearsAgoTimestamp(5);
    try {
        const chats = await dbAll(`
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
    }
    catch (error) {
        await dbClose();
        throw error;
    }
}
