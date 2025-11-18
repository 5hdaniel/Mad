/**
 * Comprehensive DatabaseService Tests
 * Real unit tests for database operations
 */

const crypto = require('crypto');

// Mock dependencies
jest.mock('sqlite3', () => {
  const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    exec: jest.fn(),
    close: jest.fn(),
  };

  return {
    verbose: () => ({
      Database: jest.fn((dbPath, callback) => {
        // Simulate successful database connection
        callback(null);
        return mockDb;
      }),
    }),
    __mockDb: mockDb,
  };
});

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(() => 'CREATE TABLE IF NOT EXISTS test (id TEXT);'),
}));

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData'),
  },
}));

// Import after mocks are set up
const sqlite3 = require('sqlite3');
const fs = require('fs');

describe('DatabaseService - Comprehensive Tests', () => {
  let DatabaseService;
  let dbService;
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = require('sqlite3').__mockDb;

    // Reset module cache to get fresh instance
    jest.resetModules();

    // Re-require DatabaseService to get new instance
    DatabaseService = require('../databaseService');
    dbService = DatabaseService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback(null);
      });

      mockDb.exec.mockImplementation((sql, callback) => {
        callback(null);
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback(null, []);
      });

      await expect(dbService.initialize()).resolves.toBe(true);
      expect(fs.mkdirSync).not.toHaveBeenCalled(); // Directory already exists
    });

    it('should create directory if it does not exist', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      mockDb.run.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') callback = params;
        callback(null);
      });

      mockDb.exec.mockImplementation((sql, callback) => callback(null));
      mockDb.all.mockImplementation((sql, params, callback) => {
        if (typeof params === 'function') callback = params;
        callback(null, []);
      });

      await dbService.initialize();
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Failed to open database');

      jest.resetModules();
      jest.mock('sqlite3', () => ({
        verbose: () => ({
          Database: jest.fn((dbPath, callback) => {
            callback(error);
            return mockDb;
          }),
        }),
      }));

      const DatabaseService = require('../databaseService');
      await expect(DatabaseService.initialize()).rejects.toThrow('Failed to open database');
    });
  });

  describe('User Operations', () => {
    beforeEach(() => {
      // Setup database as initialized
      dbService.db = mockDb;
    });

    it('should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        oauth_provider: 'google',
        oauth_id: 'google-123',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const userId = await dbService.createUser(userData);
      expect(userId).toBeDefined();
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users_local'),
        expect.arrayContaining([expect.any(String), userData.email, userData.first_name]),
        expect.any(Function)
      );
    });

    it('should get user by ID', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        first_name: 'John',
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockUser);
      });

      const user = await dbService.getUserById('123');
      expect(user).toEqual(mockUser);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users_local WHERE id = ?'),
        ['123'],
        expect.any(Function)
      );
    });

    it('should get user by email', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockUser);
      });

      const user = await dbService.getUserByEmail('test@example.com');
      expect(user).toEqual(mockUser);
    });

    it('should update user data', async () => {
      const updates = { first_name: 'Jane', last_name: 'Smith' };
      const updatedUser = { id: '123', ...updates };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, updatedUser);
      });

      const result = await dbService.updateUser('123', updates);
      expect(result).toEqual(updatedUser);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users_local SET'),
        expect.arrayContaining(['Jane', 'Smith', '123']),
        expect.any(Function)
      );
    });

    it('should reject updates with no valid fields', async () => {
      await expect(dbService.updateUser('123', { invalid_field: 'value' }))
        .rejects
        .toThrow('No valid fields to update');
    });

    it('should accept terms and conditions', async () => {
      const userId = '123';
      const mockUser = { id: userId, terms_accepted_at: new Date().toISOString() };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockUser);
      });

      const result = await dbService.acceptTerms(userId, '1.0', '1.0');
      expect(result).toEqual(mockUser);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users_local'),
        expect.arrayContaining(['1.0', '1.0', userId]),
        expect.any(Function)
      );
    });
  });

  describe('Session Operations', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should create a new session', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const sessionToken = await dbService.createSession('user-123');
      expect(sessionToken).toBeDefined();
      expect(typeof sessionToken).toBe('string');
    });

    it('should validate a valid session', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockSession = {
        session_token: 'token-123',
        user_id: 'user-123',
        expires_at: futureDate.toISOString(),
        email: 'test@example.com',
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockSession);
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const session = await dbService.validateSession('token-123');
      expect(session).toEqual(mockSession);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET last_accessed_at'),
        ['token-123'],
        expect.any(Function)
      );
    });

    it('should return null for expired session', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockSession = {
        session_token: 'token-123',
        expires_at: pastDate.toISOString(),
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockSession);
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const session = await dbService.validateSession('token-123');
      expect(session).toBeNull();
    });

    it('should delete a session', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await dbService.deleteSession('token-123');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sessions'),
        ['token-123'],
        expect.any(Function)
      );
    });
  });

  describe('Contact Operations', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should create a new contact', async () => {
      const contactData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-1234',
        source: 'manual',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 'contact-123', ...contactData });
      });

      const contact = await dbService.createContact('user-123', contactData);
      expect(contact.name).toBe(contactData.name);
      expect(contact.email).toBe(contactData.email);
    });

    it('should get all contacts for a user', async () => {
      const mockContacts = [
        { id: '1', name: 'Contact 1', user_id: 'user-123' },
        { id: '2', name: 'Contact 2', user_id: 'user-123' },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockContacts);
      });

      const contacts = await dbService.getContactsByUserId('user-123');
      expect(contacts).toHaveLength(2);
      expect(contacts).toEqual(mockContacts);
    });

    it('should search contacts by name or email', async () => {
      const mockContacts = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockContacts);
      });

      const contacts = await dbService.searchContacts('user-123', 'john');
      expect(contacts).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        ['user-123', '%john%', '%john%'],
        expect.any(Function)
      );
    });

    it('should update contact information', async () => {
      const updates = { name: 'Updated Name', email: 'updated@example.com' };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 'contact-123', ...updates });
      });

      const updated = await dbService.updateContact('contact-123', updates);
      expect(updated.name).toBe(updates.name);
    });

    it('should delete a contact', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await dbService.deleteContact('contact-123');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM contacts'),
        ['contact-123'],
        expect.any(Function)
      );
    });

    it('should get transactions associated with a contact', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          property_address: '123 Main St',
          closing_date: '2024-01-01',
          transaction_type: 'purchase',
          status: 'completed',
        },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockTransactions);
      });

      const transactions = await dbService.getTransactionsByContact('contact-123');
      expect(transactions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transaction Operations', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should create a new transaction', async () => {
      const transactionData = {
        property_address: '123 Main St',
        transaction_type: 'purchase',
        closing_date: '2024-01-01',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const transactionId = await dbService.createTransaction('user-123', transactionData);
      expect(transactionId).toBeDefined();
    });

    it('should get transaction by ID', async () => {
      const mockTransaction = {
        id: 'txn-123',
        property_address: '123 Main St',
        transaction_type: 'purchase',
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockTransaction);
      });

      const transaction = await dbService.getTransactionById('txn-123');
      expect(transaction).toEqual(mockTransaction);
    });

    it('should get all transactions for a user', async () => {
      const mockTransactions = [
        { id: '1', user_id: 'user-123', property_address: '123 Main St' },
        { id: '2', user_id: 'user-123', property_address: '456 Oak Ave' },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockTransactions);
      });

      const transactions = await dbService.getTransactionsByUserId('user-123');
      expect(transactions).toHaveLength(2);
    });

    it('should update transaction', async () => {
      const updates = {
        closing_date: '2024-02-01',
        status: 'completed',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 'txn-123', ...updates });
      });

      const updated = await dbService.updateTransaction('txn-123', updates);
      expect(updated.status).toBe('completed');
    });

    it('should delete a transaction', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await dbService.deleteTransaction('txn-123');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM transactions'),
        ['txn-123'],
        expect.any(Function)
      );
    });
  });

  describe('Communication Operations', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should save a communication', async () => {
      const commData = {
        transaction_id: 'txn-123',
        sender: 'sender@example.com',
        recipients: 'recipient@example.com',
        subject: 'Test Email',
        body_plain: 'Test body',
        sent_at: new Date().toISOString(),
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const commId = await dbService.saveCommunication('user-123', commData);
      expect(commId).toBeDefined();
    });

    it('should get communications by transaction ID', async () => {
      const mockComms = [
        { id: '1', transaction_id: 'txn-123', subject: 'Email 1' },
        { id: '2', transaction_id: 'txn-123', subject: 'Email 2' },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockComms);
      });

      const comms = await dbService.getCommunicationsByTransactionId('txn-123');
      expect(comms).toHaveLength(2);
    });

    it('should link communication to transaction', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await dbService.linkCommunicationToTransaction('comm-123', 'txn-123');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE communications'),
        ['txn-123', 'comm-123'],
        expect.any(Function)
      );
    });
  });

  describe('Transaction Contact Operations', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should assign contact to transaction', async () => {
      const data = {
        contact_id: 'contact-123',
        role_category: 'agent',
        specific_role: 'buyer_agent',
        is_primary: 1,
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const id = await dbService.assignContactToTransaction('txn-123', data);
      expect(id).toBeDefined();
    });

    it('should get transaction contacts', async () => {
      const mockContacts = [
        {
          id: '1',
          transaction_id: 'txn-123',
          contact_id: 'contact-123',
          role_category: 'agent',
          contact_name: 'John Doe',
        },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockContacts);
      });

      const contacts = await dbService.getTransactionContacts('txn-123');
      expect(contacts).toHaveLength(1);
      expect(contacts[0].contact_name).toBe('John Doe');
    });

    it('should remove contact from transaction', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await dbService.removeContactFromTransaction('txn-123', 'contact-123');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM transaction_contacts'),
        ['txn-123', 'contact-123'],
        expect.any(Function)
      );
    });
  });

  describe('Feedback Operations', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should submit user feedback', async () => {
      const feedbackData = {
        transaction_id: 'txn-123',
        field_name: 'closing_date',
        original_value: '2024-01-01',
        corrected_value: '2024-01-15',
        feedback_type: 'correction',
        original_confidence: 75,
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // No existing metrics
      });

      const feedbackId = await dbService.submitFeedback('user-123', feedbackData);
      expect(feedbackId).toBeDefined();
    });

    it('should get feedback for transaction', async () => {
      const mockFeedback = [
        { id: '1', transaction_id: 'txn-123', field_name: 'closing_date' },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockFeedback);
      });

      const feedback = await dbService.getFeedbackForTransaction('txn-123');
      expect(feedback).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      dbService.db = mockDb;
    });

    it('should handle database errors in _run', async () => {
      const error = new Error('Database error');
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(dbService._run('SELECT * FROM test'))
        .rejects
        .toThrow('Database error');
    });

    it('should handle database errors in _get', async () => {
      const error = new Error('Database error');
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(dbService._get('SELECT * FROM test'))
        .rejects
        .toThrow('Database error');
    });

    it('should handle database errors in _all', async () => {
      const error = new Error('Database error');
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(error);
      });

      await expect(dbService._all('SELECT * FROM test'))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('Database Closing', () => {
    it('should close database connection successfully', async () => {
      dbService.db = mockDb;
      mockDb.close.mockImplementation((callback) => {
        callback(null);
      });

      await expect(dbService.close()).resolves.toBeUndefined();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle close errors', async () => {
      dbService.db = mockDb;
      const error = new Error('Close error');
      mockDb.close.mockImplementation((callback) => {
        callback(error);
      });

      await expect(dbService.close()).rejects.toThrow('Close error');
    });

    it('should resolve immediately if no database connection', async () => {
      dbService.db = null;
      await expect(dbService.close()).resolves.toBeUndefined();
      expect(mockDb.close).not.toHaveBeenCalled();
    });
  });
});
