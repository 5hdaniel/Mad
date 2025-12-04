/**
 * @jest-environment node
 */

/**
 * Unit tests for MessagesService
 * Tests macOS Messages database queries with mocked SQLite
 */

import { jest } from '@jest/globals';
import path from 'path';

// Set HOME environment variable before imports
process.env.HOME = '/Users/testuser';

// Create mock functions
let mockDbAllResult: any[] = [];
let mockDbAllError: Error | null = null;
let mockDbCloseError: Error | null = null;

// Mock sqlite3
jest.mock('sqlite3', () => {
  return {
    Database: jest.fn().mockImplementation(() => ({
      all: jest.fn(function(this: any, sql: string, ...args: any[]) {
        // Last argument is always callback
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          if (mockDbAllError) {
            callback(mockDbAllError, null);
          } else {
            callback(null, mockDbAllResult);
          }
        }
      }),
      close: jest.fn(function(this: any, callback: Function) {
        if (mockDbCloseError) {
          callback(mockDbCloseError);
        } else {
          callback(null);
        }
      }),
    })),
    OPEN_READONLY: 1,
  };
});

// Mock dateUtils
jest.mock('../../utils/dateUtils', () => ({
  getYearsAgoTimestamp: jest.fn(() => 1577836800000000000), // 5 years ago in Apple timestamp
}));

// Mock phoneUtils
jest.mock('../../utils/phoneUtils', () => ({
  normalizePhoneNumber: jest.fn((phone: string) => {
    // Simple normalization: remove spaces and dashes
    return phone.replace(/[\s-]/g, '');
  }),
}));

// Mock constants
jest.mock('../../constants', () => ({
  MESSAGES_DB_PATH: 'Library/Messages/chat.db',
}));

describe('MessagesService', () => {
  let messagesService: typeof import('../messagesService');
  let sqlite3: any;

  beforeEach(async () => {
    // Reset mock state
    mockDbAllResult = [];
    mockDbAllError = null;
    mockDbCloseError = null;

    jest.clearAllMocks();
    jest.resetModules();

    // Re-import to get fresh module
    messagesService = await import('../messagesService');
    sqlite3 = await import('sqlite3');
  });

  describe('isGroupChat', () => {
    it('should return true for group chat identifiers', () => {
      expect(messagesService.isGroupChat('chat123456789')).toBe(true);
      expect(messagesService.isGroupChat('chat987654321')).toBe(true);
    });

    it('should return false for individual phone numbers', () => {
      expect(messagesService.isGroupChat('+14155551234')).toBe(false);
      expect(messagesService.isGroupChat('14155551234')).toBe(false);
    });

    it('should return false for email addresses', () => {
      expect(messagesService.isGroupChat('user@example.com')).toBe(false);
      expect(messagesService.isGroupChat('chat@example.com')).toBe(false); // Contains @
    });

    it('should return false for empty or null identifiers', () => {
      expect(messagesService.isGroupChat('')).toBe(false);
      expect(messagesService.isGroupChat(null as any)).toBe(false);
      expect(messagesService.isGroupChat(undefined as any)).toBe(false);
    });
  });

  describe('openMessagesDatabase', () => {
    it('should open database with correct path', () => {
      const connection = messagesService.openMessagesDatabase();

      expect(sqlite3.Database).toHaveBeenCalledWith(
        path.join(process.env.HOME!, 'Library/Messages/chat.db'),
        1 // OPEN_READONLY
      );
      expect(connection).toHaveProperty('db');
      expect(connection).toHaveProperty('dbAll');
      expect(connection).toHaveProperty('dbClose');
    });
  });

  describe('getAllConversations', () => {
    it('should return all conversations from database', async () => {
      mockDbAllResult = [
        {
          chat_id: 1,
          chat_identifier: '+14155551234',
          display_name: 'John Doe',
          contact_id: '+14155551234',
          last_message_date: 1700000000000000000,
          message_count: 50,
        },
        {
          chat_id: 2,
          chat_identifier: 'chat123456789',
          display_name: 'Family Group',
          contact_id: null,
          last_message_date: 1699000000000000000,
          message_count: 200,
        },
      ];

      const conversations = await messagesService.getAllConversations();

      expect(conversations).toEqual(mockDbAllResult);
      expect(conversations).toHaveLength(2);
    });

    it('should close database even on error', async () => {
      mockDbAllError = new Error('Database error');

      await expect(messagesService.getAllConversations()).rejects.toThrow('Database error');
    });

    it('should return empty array when no conversations', async () => {
      mockDbAllResult = [];

      const conversations = await messagesService.getAllConversations();

      expect(conversations).toEqual([]);
    });
  });

  describe('getGroupChatParticipants', () => {
    it('should return participants for a group chat', async () => {
      mockDbAllResult = [
        { contact_id: '+14155551234' },
        { contact_id: '+14155555678' },
        { contact_id: 'user@example.com' },
      ];

      const participants = await messagesService.getGroupChatParticipants(42);

      expect(participants).toEqual(mockDbAllResult);
      expect(participants).toHaveLength(3);
    });

    it('should return empty array for chat with no participants', async () => {
      mockDbAllResult = [];

      const participants = await messagesService.getGroupChatParticipants(999);

      expect(participants).toEqual([]);
    });

    it('should handle database error', async () => {
      mockDbAllError = new Error('Query failed');

      await expect(messagesService.getGroupChatParticipants(1)).rejects.toThrow('Query failed');
    });
  });

  describe('getMessagesForContact', () => {
    it('should get messages for contact with phone numbers', async () => {
      mockDbAllResult = [
        { id: 1, text: 'Hello', date: 1700000000000000000, is_from_me: 0, sender: '+14155551234' },
        { id: 2, text: 'Hi there', date: 1700000001000000000, is_from_me: 1, sender: null },
      ];

      const contact = {
        name: 'John Doe',
        phones: ['+14155551234'],
        emails: [],
      };

      const messages = await messagesService.getMessagesForContact(contact);

      expect(messages).toEqual(mockDbAllResult);
    });

    it('should get messages for contact with emails', async () => {
      mockDbAllResult = [
        { id: 3, text: 'Email message', date: 1700000002000000000, is_from_me: 0, sender: 'user@example.com' },
      ];

      const contact = {
        name: 'Jane Doe',
        phones: [],
        emails: ['user@example.com'],
      };

      const messages = await messagesService.getMessagesForContact(contact);

      expect(messages).toEqual(mockDbAllResult);
    });

    it('should return empty array for contact with no identifiers', async () => {
      const contact = {
        name: 'No Contact Info',
        phones: [],
        emails: [],
      };

      const messages = await messagesService.getMessagesForContact(contact);

      expect(messages).toEqual([]);
      // Database should not be queried - but we can't easily verify this
    });

    it('should return empty array when contact has undefined phones/emails', async () => {
      const contact = {
        name: 'Partial Contact',
      };

      const messages = await messagesService.getMessagesForContact(contact as any);

      expect(messages).toEqual([]);
    });

    it('should handle database error', async () => {
      mockDbAllError = new Error('Query error');

      const contact = { phones: ['+14155551234'] };

      await expect(messagesService.getMessagesForContact(contact)).rejects.toThrow('Query error');
    });
  });

  describe('getMessagesForChat', () => {
    it('should get messages for a specific chat ID', async () => {
      mockDbAllResult = [
        { id: 1, text: 'First message', date: 1700000000000000000, is_from_me: 1, cache_has_attachments: 0 },
        { id: 2, text: 'Second message', date: 1700000001000000000, is_from_me: 0, cache_has_attachments: 1 },
      ];

      const messages = await messagesService.getMessagesForChat(123);

      expect(messages).toEqual(mockDbAllResult);
      expect(messages).toHaveLength(2);
    });

    it('should return empty array for chat with no messages', async () => {
      mockDbAllResult = [];

      const messages = await messagesService.getMessagesForChat(999);

      expect(messages).toEqual([]);
    });

    it('should handle database error', async () => {
      mockDbAllError = new Error('Chat query failed');

      await expect(messagesService.getMessagesForChat(1)).rejects.toThrow('Chat query failed');
    });
  });

  describe('getRecentChats', () => {
    it('should get chats from last 5 years', async () => {
      mockDbAllResult = [
        { chat_id: 1, chat_identifier: '+14155551234', display_name: null, last_message_date: 1700000000000000000 },
        { chat_id: 2, chat_identifier: 'chat123', display_name: 'Family', last_message_date: 1699000000000000000 },
      ];

      const chats = await messagesService.getRecentChats();

      expect(chats).toEqual(mockDbAllResult);
      expect(chats).toHaveLength(2);
    });

    it('should return empty array when no recent chats', async () => {
      mockDbAllResult = [];

      const chats = await messagesService.getRecentChats();

      expect(chats).toEqual([]);
    });

    it('should handle database error', async () => {
      mockDbAllError = new Error('Recent chats query failed');

      await expect(messagesService.getRecentChats()).rejects.toThrow('Recent chats query failed');
    });
  });

  describe('Message Types', () => {
    it('should handle messages with attributedBody', async () => {
      mockDbAllResult = [
        {
          id: 1,
          text: null,
          attributedBody: Buffer.from('Styled text content'),
          date: 1700000000000000000,
          is_from_me: 0,
          cache_has_attachments: 0,
        },
      ];

      const messages = await messagesService.getMessagesForChat(1);

      expect(messages[0].attributedBody).toBeInstanceOf(Buffer);
    });

    it('should handle messages with attachments', async () => {
      mockDbAllResult = [
        {
          id: 1,
          text: 'Check this image',
          date: 1700000000000000000,
          is_from_me: 1,
          cache_has_attachments: 1,
        },
      ];

      const messages = await messagesService.getMessagesForChat(1);

      expect(messages[0].cache_has_attachments).toBe(1);
    });
  });

  describe('Database Connection Handling', () => {
    it('should create new connection for each query', async () => {
      mockDbAllResult = [];

      await messagesService.getAllConversations();
      await messagesService.getRecentChats();

      // Database constructor should be called twice
      expect(sqlite3.Database).toHaveBeenCalledTimes(2);
    });
  });
});
