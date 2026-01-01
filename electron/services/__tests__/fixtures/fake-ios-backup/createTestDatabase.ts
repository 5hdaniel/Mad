/**
 * Create Test Database Utility
 * Creates in-memory SQLite databases matching iOS sms.db schema for testing
 */

import Database from 'better-sqlite3-multiple-ciphers';
import type { Database as DatabaseType } from 'better-sqlite3-multiple-ciphers';
import {
  getAllMessages,
  getAllHandles,
  getAllChats,
  getAllAttachments,
  getMessagesForChat,
} from './iosBackupFixtureService';
import type {
  FakeMessage,
  FakeHandle,
  FakeChat,
  FakeAttachment,
  MessageFixtureFilter,
} from './types';

/**
 * Options for creating a test database
 */
export interface CreateTestDatabaseOptions {
  /** Filter to select which messages to include */
  messageFilter?: MessageFixtureFilter;
  /** Include attachments table */
  includeAttachments?: boolean;
  /** File path for persistent database (uses in-memory if not provided) */
  filePath?: string;
}

/**
 * Result from creating a test database
 */
export interface TestDatabaseResult {
  /** The database instance */
  db: DatabaseType;
  /** Number of handles inserted */
  handleCount: number;
  /** Number of chats inserted */
  chatCount: number;
  /** Number of messages inserted */
  messageCount: number;
  /** Number of attachments inserted */
  attachmentCount: number;
}

/**
 * iOS sms.db schema SQL
 * Matches the schema used by iOSMessagesParser
 */
const SMS_DB_SCHEMA = `
  CREATE TABLE handle (
    ROWID INTEGER PRIMARY KEY,
    id TEXT,
    service TEXT
  );

  CREATE TABLE chat (
    ROWID INTEGER PRIMARY KEY,
    guid TEXT,
    chat_identifier TEXT,
    display_name TEXT,
    style INTEGER DEFAULT 45
  );

  CREATE TABLE message (
    ROWID INTEGER PRIMARY KEY,
    guid TEXT,
    text TEXT,
    handle_id INTEGER,
    is_from_me INTEGER,
    date INTEGER,
    date_read INTEGER,
    date_delivered INTEGER,
    service TEXT,
    cache_has_attachments INTEGER DEFAULT 0
  );

  CREATE TABLE attachment (
    ROWID INTEGER PRIMARY KEY,
    guid TEXT,
    filename TEXT,
    mime_type TEXT,
    transfer_name TEXT
  );

  CREATE TABLE chat_handle_join (
    chat_id INTEGER,
    handle_id INTEGER
  );

  CREATE TABLE chat_message_join (
    chat_id INTEGER,
    message_id INTEGER
  );

  CREATE TABLE message_attachment_join (
    message_id INTEGER,
    attachment_id INTEGER
  );

  -- Create indices for common queries
  CREATE INDEX idx_message_date ON message(date);
  CREATE INDEX idx_message_handle ON message(handle_id);
  CREATE INDEX idx_chat_identifier ON chat(chat_identifier);
  CREATE INDEX idx_handle_id ON handle(id);
`;

/**
 * Create an in-memory SQLite database with iOS sms.db schema
 * Optionally populated with fixture data
 */
export function createTestDatabase(
  options: CreateTestDatabaseOptions = {}
): TestDatabaseResult {
  const { messageFilter, includeAttachments = true, filePath } = options;

  // Create database (in-memory or file)
  const db = filePath ? new Database(filePath) : new Database(':memory:');

  // Create schema
  db.exec(SMS_DB_SCHEMA);

  // Get fixture data
  let messages = getAllMessages();
  if (messageFilter) {
    messages = filterMessagesForDb(messages, messageFilter);
  }

  const handles = getAllHandles();
  const chats = getAllChats();
  const attachments = includeAttachments ? getAllAttachments() : [];

  // Insert data
  const handleCount = insertHandles(db, handles);
  const chatCount = insertChats(db, chats);
  const messageCount = insertMessages(db, messages);
  const attachmentCount = includeAttachments ? insertAttachments(db, attachments, messages) : 0;

  return {
    db,
    handleCount,
    chatCount,
    messageCount,
    attachmentCount,
  };
}

/**
 * Create an empty test database with schema only (no data)
 */
export function createEmptyTestDatabase(filePath?: string): DatabaseType {
  const db = filePath ? new Database(filePath) : new Database(':memory:');
  db.exec(SMS_DB_SCHEMA);
  return db;
}

/**
 * Create a test database with specific messages
 */
export function createTestDatabaseWithMessages(
  messages: FakeMessage[],
  options: { includeAttachments?: boolean; filePath?: string } = {}
): TestDatabaseResult {
  const { includeAttachments = true, filePath } = options;

  const db = filePath ? new Database(filePath) : new Database(':memory:');
  db.exec(SMS_DB_SCHEMA);

  // Get related handles and chats
  const handleIds = new Set<number>();
  const chatIds = new Set<number>();

  for (const msg of messages) {
    if (msg.handleId > 0) handleIds.add(msg.handleId);
    for (const chatId of msg.chatIds) {
      chatIds.add(chatId);
    }
  }

  const allHandles = getAllHandles();
  const allChats = getAllChats();
  const allAttachments = getAllAttachments();

  // Filter to only relevant handles and chats
  const handles = allHandles.filter((h) => handleIds.has(h.id));
  const chats = allChats.filter((c) => chatIds.has(c.id));

  // Get attachments for these messages
  const attachments = includeAttachments
    ? allAttachments.filter((a) =>
        messages.some((m) => m.attachmentIds.includes(a.id))
      )
    : [];

  // Insert data
  const handleCount = insertHandles(db, handles);
  const chatCount = insertChats(db, chats);
  const messageCount = insertMessages(db, messages);
  const attachmentCount = insertAttachments(db, attachments, messages);

  return {
    db,
    handleCount,
    chatCount,
    messageCount,
    attachmentCount,
  };
}

/**
 * Create a test database for a specific chat
 */
export function createTestDatabaseForChat(
  chatId: number,
  options: { includeAttachments?: boolean; filePath?: string } = {}
): TestDatabaseResult {
  const messages = getMessagesForChat(chatId);
  return createTestDatabaseWithMessages(messages, options);
}

// ============================================================================
// Private Helper Functions
// ============================================================================

function filterMessagesForDb(
  messages: FakeMessage[],
  filter: MessageFixtureFilter
): FakeMessage[] {
  let result = [...messages];

  if (filter.service) {
    result = result.filter((m) => m.service === filter.service);
  }

  if (filter.category) {
    result = result.filter((m) => m.category === filter.category);
  }

  if (filter.difficulty) {
    result = result.filter((m) => m.difficulty === filter.difficulty);
  }

  if (filter.chatId !== undefined) {
    result = result.filter((m) => m.chatIds.includes(filter.chatId!));
  }

  if (filter.handleId !== undefined) {
    result = result.filter((m) => m.handleId === filter.handleId);
  }

  if (filter.isTransactionRelated !== undefined) {
    result = result.filter(
      (m) => m.expected.isTransactionRelated === filter.isTransactionRelated
    );
  }

  if (filter.isFromMe !== undefined) {
    result = result.filter((m) => m.isFromMe === filter.isFromMe);
  }

  if (filter.limit && filter.limit > 0) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

function insertHandles(db: DatabaseType, handles: FakeHandle[]): number {
  const stmt = db.prepare(`
    INSERT INTO handle (ROWID, id, service)
    VALUES (?, ?, ?)
  `);

  for (const handle of handles) {
    stmt.run(handle.id, handle.identifier, handle.service);
  }

  return handles.length;
}

function insertChats(db: DatabaseType, chats: FakeChat[]): number {
  const chatStmt = db.prepare(`
    INSERT INTO chat (ROWID, guid, chat_identifier, display_name, style)
    VALUES (?, ?, ?, ?, ?)
  `);

  const joinStmt = db.prepare(`
    INSERT INTO chat_handle_join (chat_id, handle_id)
    VALUES (?, ?)
  `);

  for (const chat of chats) {
    chatStmt.run(
      chat.id,
      chat.guid,
      chat.chatIdentifier,
      chat.displayName,
      chat.style
    );

    // Insert chat_handle_join entries
    for (const handleId of chat.handleIds) {
      joinStmt.run(chat.id, handleId);
    }
  }

  return chats.length;
}

function insertMessages(db: DatabaseType, messages: FakeMessage[]): number {
  const msgStmt = db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, date_read, date_delivered, service, cache_has_attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const joinStmt = db.prepare(`
    INSERT INTO chat_message_join (chat_id, message_id)
    VALUES (?, ?)
  `);

  for (const msg of messages) {
    msgStmt.run(
      msg.id,
      msg.guid,
      msg.text,
      msg.handleId || null,
      msg.isFromMe ? 1 : 0,
      msg.date,
      msg.dateRead,
      msg.dateDelivered,
      msg.service,
      msg.attachmentIds.length > 0 ? 1 : 0
    );

    // Insert chat_message_join entries
    for (const chatId of msg.chatIds) {
      joinStmt.run(chatId, msg.id);
    }
  }

  return messages.length;
}

function insertAttachments(
  db: DatabaseType,
  attachments: FakeAttachment[],
  messages: FakeMessage[]
): number {
  const attachStmt = db.prepare(`
    INSERT INTO attachment (ROWID, guid, filename, mime_type, transfer_name)
    VALUES (?, ?, ?, ?, ?)
  `);

  const joinStmt = db.prepare(`
    INSERT INTO message_attachment_join (message_id, attachment_id)
    VALUES (?, ?)
  `);

  for (const attach of attachments) {
    attachStmt.run(
      attach.id,
      attach.guid,
      attach.filename,
      attach.mimeType,
      attach.transferName
    );
  }

  // Create message_attachment_join entries based on message data
  for (const msg of messages) {
    for (const attachId of msg.attachmentIds) {
      joinStmt.run(msg.id, attachId);
    }
  }

  return attachments.length;
}

// ============================================================================
// Export the schema for reference
// ============================================================================

/**
 * The SQL schema used to create the test database
 */
export const IOS_SMS_DB_SCHEMA = SMS_DB_SCHEMA;
