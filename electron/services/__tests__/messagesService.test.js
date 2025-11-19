/**
 * MessagesService Tests
 * Tests queries to the macOS Messages database
 */

const messagesService = require('../messagesService');
const sqlite3 = require('sqlite3');
const path = require('path');

// Mock dependencies
jest.mock('sqlite3');
jest.mock('path');

describe('MessagesService', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      all: jest.fn(),
      close: jest.fn((callback) => callback && callback()),
    };

    sqlite3.Database = jest.fn(() => mockDb);
    path.join = jest.fn((...args) => args.join('/'));
    process.env.HOME = '/Users/test';
  });

  describe('openMessagesDatabase', () => {
    it('should open database connection successfully', () => {
      const result = messagesService.openMessagesDatabase();

      expect(sqlite3.Database).toHaveBeenCalled();
      expect(result).toHaveProperty('db');
      expect(result).toHaveProperty('dbAll');
      expect(result).toHaveProperty('dbClose');
    });

    it('should use correct database path', () => {
      messagesService.openMessagesDatabase();

      expect(sqlite3.Database).toHaveBeenCalledWith(
        expect.stringContaining('Library/Messages/chat.db'),
        sqlite3.OPEN_READONLY
      );
    });
  });

  describe('getAllConversations', () => {
    it('should retrieve all conversations with message counts', async () => {
      const mockConversations = [
        {
          chat_id: 1,
          chat_identifier: '+15551234567',
          display_name: null,
          contact_id: '+15551234567',
          last_message_date: 682537200000000000,
          message_count: 25,
        },
        {
          chat_id: 2,
          chat_identifier: 'chat123456789',
          display_name: 'Family Group',
          contact_id: null,
          last_message_date: 682537300000000000,
          message_count: 150,
        },
      ];

      mockDb.all.mockImplementation((query, callback) => {
        callback(null, mockConversations);
      });

      const result = await messagesService.getAllConversations();

      expect(result).toHaveLength(2);
      expect(result[0].message_count).toBe(25);
      expect(result[1].display_name).toBe('Family Group');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should exclude conversations with no messages', async () => {
      const mockConversations = [
        {
          chat_id: 1,
          chat_identifier: '+15551234567',
          message_count: 10,
          last_message_date: 682537200000000000,
        },
      ];

      mockDb.all.mockImplementation((query, callback) => {
        callback(null, mockConversations);
      });

      const result = await messagesService.getAllConversations();

      // Query should have HAVING clause for message_count > 0
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('HAVING'),
        expect.any(Function)
      );
      expect(result).toHaveLength(1);
    });

    it('should order conversations by last message date', async () => {
      mockDb.all.mockImplementation((query, callback) => {
        callback(null, []);
      });

      await messagesService.getAllConversations();

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY last_message_date DESC'),
        expect.any(Function)
      );
    });

    it('should handle database errors', async () => {
      mockDb.all.mockImplementation((query, callback) => {
        callback(new Error('Database error'));
      });

      await expect(messagesService.getAllConversations()).rejects.toThrow('Database error');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should close database connection even on error', async () => {
      mockDb.all.mockImplementation((query, callback) => {
        callback(new Error('Query failed'));
      });

      try {
        await messagesService.getAllConversations();
      } catch (error) {
        // Expected error
      }

      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe('getGroupChatParticipants', () => {
    it('should retrieve all participants for a group chat', async () => {
      const mockParticipants = [
        { contact_id: '+15551111111' },
        { contact_id: '+15552222222' },
        { contact_id: 'alice@example.com' },
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockParticipants);
      });

      const result = await messagesService.getGroupChatParticipants(123);

      expect(result).toHaveLength(3);
      expect(result[0].contact_id).toBe('+15551111111');
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('chat_handle_join'),
        [123],
        expect.any(Function)
      );
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should return empty array for chat with no participants', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const result = await messagesService.getGroupChatParticipants(999);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Failed to fetch participants'));
      });

      await expect(messagesService.getGroupChatParticipants(123)).rejects.toThrow(
        'Failed to fetch participants'
      );
      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe('isGroupChat', () => {
    it('should identify group chat identifiers', () => {
      expect(messagesService.isGroupChat('chat123456789')).toBe(true);
      expect(messagesService.isGroupChat('chat987654321')).toBe(true);
    });

    it('should not identify phone numbers as group chats', () => {
      expect(messagesService.isGroupChat('+15551234567')).toBe(false);
      expect(messagesService.isGroupChat('15551234567')).toBe(false);
    });

    it('should not identify emails as group chats', () => {
      expect(messagesService.isGroupChat('user@example.com')).toBe(false);
      expect(messagesService.isGroupChat('alice.smith@icloud.com')).toBe(false);
    });

    it('should handle null or undefined identifiers', () => {
      expect(messagesService.isGroupChat(null)).toBe(false);
      expect(messagesService.isGroupChat(undefined)).toBe(false);
    });

    it('should not match chat string in email', () => {
      expect(messagesService.isGroupChat('chat@example.com')).toBe(false);
    });
  });

  describe('getMessagesForContact', () => {
    it('should retrieve messages for contact with phone number', async () => {
      const mockContact = {
        phones: ['+15551234567'],
        emails: [],
      };

      const mockMessages = [
        {
          id: 1,
          text: 'Hello',
          date: 682537200000000000,
          is_from_me: 0,
        },
        {
          id: 2,
          text: 'Hi there',
          date: 682537300000000000,
          is_from_me: 1,
        },
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockMessages);
      });

      const result = await messagesService.getMessagesForContact(mockContact);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should retrieve messages for contact with email', async () => {
      const mockContact = {
        phones: [],
        emails: ['alice@example.com'],
      };

      const mockMessages = [
        {
          id: 1,
          text: 'Test message',
          date: 682537200000000000,
          is_from_me: 0,
        },
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockMessages);
      });

      const result = await messagesService.getMessagesForContact(mockContact);

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('handle.id = ?'),
        expect.arrayContaining(['alice@example.com']),
        expect.any(Function)
      );
    });

    it('should handle contacts with multiple phones and emails', async () => {
      const mockContact = {
        phones: ['+15551111111', '+15552222222'],
        emails: ['alice@example.com', 'alice.work@company.com'],
      };

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await messagesService.getMessagesForContact(mockContact);

      // Should include all identifiers in query
      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('OR');
      expect(callArgs[1]).toEqual(
        expect.arrayContaining(['+15551111111', '+15552222222', 'alice@example.com', 'alice.work@company.com'])
      );
    });

    it('should return empty array for contact with no identifiers', async () => {
      const mockContact = {
        phones: [],
        emails: [],
      };

      const result = await messagesService.getMessagesForContact(mockContact);

      expect(result).toEqual([]);
      expect(mockDb.all).not.toHaveBeenCalled();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should try normalized phone numbers', async () => {
      const mockContact = {
        phones: ['(555) 123-4567'],
        emails: [],
      };

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await messagesService.getMessagesForContact(mockContact);

      // Should include both original and normalized format
      const params = mockDb.all.mock.calls[0][1];
      expect(params.length).toBeGreaterThan(1);
    });

    it('should handle database errors', async () => {
      const mockContact = {
        phones: ['+15551234567'],
        emails: [],
      };

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Query failed'));
      });

      await expect(messagesService.getMessagesForContact(mockContact)).rejects.toThrow('Query failed');
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should retrieve distinct messages only', async () => {
      const mockContact = {
        phones: ['+15551234567'],
        emails: [],
      };

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      await messagesService.getMessagesForContact(mockContact);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('getMessagesInDateRange', () => {
    it('should filter messages by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const mockMessages = [
        {
          id: 1,
          text: 'Message in range',
          date: 694310400000000000, // 2024-01-15
        },
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockMessages);
      });

      const contact = { phones: ['+15551234567'], emails: [] };
      const result = await messagesService.getMessagesInDateRange(contact, startDate, endDate);

      expect(result).toBeDefined();
      // Query should include date range conditions
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringMatching(/date.*>=|date.*<=/),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('getRecentMessages', () => {
    it('should retrieve messages from last N days', async () => {
      const mockMessages = [
        { id: 1, text: 'Recent message', date: Date.now() * 1000000 },
      ];

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, mockMessages);
      });

      const contact = { phones: ['+15551234567'], emails: [] };
      const result = await messagesService.getRecentMessages(contact, 7);

      expect(result).toBeDefined();
      expect(mockDb.all).toHaveBeenCalled();
    });
  });
});
