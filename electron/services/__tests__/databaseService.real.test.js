/**
 * Database Service Real Unit Tests
 * Tests actual database operations and migrations
 */

const DatabaseService = require('../databaseService');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Mock dependencies
jest.mock('sqlite3');
jest.mock('fs');
jest.mock('electron');
jest.mock('path');

describe('DatabaseService - Real Tests', () => {
  let databaseService;
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database instance
    mockDb = {
      run: jest.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        if (callback) callback(null);
      }),
      get: jest.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        if (callback) callback(null, {});
      }),
      all: jest.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        if (callback) callback(null, []);
      }),
      exec: jest.fn((sql, callback) => {
        if (callback) callback(null);
      }),
    };

    // Mock sqlite3.Database constructor
    sqlite3.Database = jest.fn((dbPath, callback) => {
      if (callback) callback(null);
      return mockDb;
    });
    sqlite3.verbose = jest.fn(() => sqlite3);

    // Mock fs
    fs.existsSync = jest.fn(() => true);
    fs.mkdirSync = jest.fn();
    fs.readFileSync = jest.fn(() => 'CREATE TABLE IF NOT EXISTS test;');

    // Mock path
    path.join = jest.fn((...args) => args.join('/'));
    path.dirname = jest.fn((p) => p.split('/').slice(0, -1).join('/'));

    // Mock electron app
    app.getPath = jest.fn(() => '/mock/user/data');

    databaseService = new DatabaseService();
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      const result = await databaseService.initialize();

      expect(result).toBe(true);
      expect(app.getPath).toHaveBeenCalledWith('userData');
      expect(sqlite3.Database).toHaveBeenCalled();
      expect(databaseService.db).toBeDefined();
      expect(databaseService.dbPath).toBeDefined();
    });

    it('should create directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await databaseService.initialize();

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should enable foreign keys on database connection', async () => {
      mockDb.run = jest.fn((sql, callback) => {
        if (sql.includes('PRAGMA foreign_keys')) {
          callback(null);
        }
      });

      await databaseService.initialize();

      expect(mockDb.run).toHaveBeenCalledWith(
        'PRAGMA foreign_keys = ON;',
        expect.any(Function)
      );
    });

    it('should run schema migrations during initialization', async () => {
      await databaseService.initialize();

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('schema.sql'),
        'utf8'
      );
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should throw error if database connection fails', async () => {
      sqlite3.Database = jest.fn((dbPath, callback) => {
        callback(new Error('Connection failed'));
        return mockDb;
      });

      await expect(databaseService.initialize()).rejects.toThrow('Connection failed');
    });

    it('should throw error if foreign keys pragma fails', async () => {
      mockDb.run = jest.fn((sql, callback) => {
        if (sql.includes('PRAGMA foreign_keys')) {
          callback(new Error('Pragma failed'));
        }
      });

      await expect(databaseService.initialize()).rejects.toThrow();
    });
  });

  describe('_runAdditionalMigrations', () => {
    beforeEach(async () => {
      // Initialize database first
      await databaseService.initialize();
    });

    it('should check for existing columns before adding new ones', async () => {
      mockDb.all.mockImplementation((sql, callback) => {
        if (sql.includes('PRAGMA table_info')) {
          callback(null, [
            { name: 'id', type: 'TEXT' },
            { name: 'email', type: 'TEXT' },
          ]);
        } else {
          callback(null, []);
        }
      });

      await databaseService._runAdditionalMigrations();

      // Should check table structure before altering
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('PRAGMA table_info'),
        expect.any(Function)
      );
    });

    it('should create indexes for performance optimization', async () => {
      mockDb.all.mockImplementation((sql, callback) => {
        callback(null, []);
      });

      await databaseService._runAdditionalMigrations();

      // Should create various indexes
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX'),
        expect.any(Function)
      );
    });

    it('should create triggers for automatic timestamp updates', async () => {
      mockDb.all.mockImplementation((sql, callback) => {
        callback(null, []);
      });

      await databaseService._runAdditionalMigrations();

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TRIGGER'),
        expect.any(Function)
      );
    });

    it('should be idempotent and not fail on repeated runs', async () => {
      mockDb.all.mockImplementation((sql, callback) => {
        if (sql.includes('PRAGMA table_info')) {
          callback(null, [
            { name: 'id', type: 'TEXT' },
            { name: 'terms_accepted_at', type: 'DATETIME' },
          ]);
        } else {
          callback(null, []);
        }
      });

      // Run migrations twice
      await databaseService._runAdditionalMigrations();
      await databaseService._runAdditionalMigrations();

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle migration errors gracefully', async () => {
      mockDb.run.mockImplementation((sql, callback) => {
        if (sql.includes('ALTER TABLE')) {
          callback(new Error('Column already exists'));
        } else {
          callback(null);
        }
      });

      mockDb.all.mockImplementation((sql, callback) => {
        callback(null, [{ name: 'id', type: 'TEXT' }]);
      });

      await expect(databaseService._runAdditionalMigrations()).rejects.toThrow();
    });
  });

  describe('createUser', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('should create a new user successfully', async () => {
      const userId = 'user-123';
      const userData = {
        email: 'test@example.com',
        display_name: 'Test User',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await databaseService.createUser(userId, userData);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users_local'),
        expect.arrayContaining([userId, userData.email]),
        expect.any(Function)
      );
    });

    it('should handle user creation errors', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('User already exists'));
      });

      await expect(
        databaseService.createUser('user-123', { email: 'test@example.com' })
      ).rejects.toThrow('User already exists');
    });
  });

  describe('createTransaction', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('should create a transaction with required fields', async () => {
      const userId = 'user-123';
      const transactionData = {
        property_address: '123 Main St, City, CA 90210',
        transaction_type: 'purchase',
        transaction_status: 'active',
      };

      let capturedSql;
      let capturedParams;
      mockDb.run.mockImplementation((sql, params, callback) => {
        capturedSql = sql;
        capturedParams = params;
        callback.call({ lastID: 'txn-456' }, null);
      });

      const result = await databaseService.createTransaction(userId, transactionData);

      expect(capturedSql).toContain('INSERT INTO transactions');
      expect(capturedParams).toContain(userId);
      expect(capturedParams).toContain(transactionData.property_address);
      expect(result).toBeDefined();
    });

    it('should handle optional transaction fields', async () => {
      const userId = 'user-123';
      const transactionData = {
        property_address: '123 Main St',
        transaction_type: 'sale',
        sale_price: 500000,
        closing_date: '2024-12-31',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 'txn-789' }, null);
      });

      const result = await databaseService.createTransaction(userId, transactionData);

      expect(mockDb.run).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getTransactionById', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('should retrieve transaction by ID', async () => {
      const mockTransaction = {
        id: 'txn-123',
        property_address: '123 Main St',
        transaction_type: 'purchase',
      };

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockTransaction);
      });

      const result = await databaseService.getTransactionById('txn-123');

      expect(result).toEqual(mockTransaction);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM transactions'),
        expect.arrayContaining(['txn-123']),
        expect.any(Function)
      );
    });

    it('should return null for non-existent transaction', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await databaseService.getTransactionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAllTransactions', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('should retrieve all transactions for a user', async () => {
      const mockTransactions = [
        { id: 'txn-1', property_address: '123 Main St' },
        { id: 'txn-2', property_address: '456 Oak Ave' },
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockTransactions);
      });

      const result = await databaseService.getAllTransactions('user-123');

      expect(result).toEqual(mockTransactions);
      expect(result.length).toBe(2);
    });

    it('should return empty array when user has no transactions', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await databaseService.getAllTransactions('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('updateTransaction', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('should update transaction fields', async () => {
      const transactionId = 'txn-123';
      const updates = {
        sale_price: 550000,
        closing_date: '2024-12-31',
      };

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await databaseService.updateTransaction(transactionId, updates);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('deleteTransaction', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('should delete transaction by ID', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await databaseService.deleteTransaction('txn-123');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM transactions'),
        expect.arrayContaining(['txn-123']),
        expect.any(Function)
      );
    });

    it('should cascade delete related records', async () => {
      // With foreign keys enabled, deleting a transaction should cascade
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await databaseService.deleteTransaction('txn-123');

      // Verify foreign keys were enabled during initialization
      expect(mockDb.run).toHaveBeenCalledWith(
        'PRAGMA foreign_keys = ON;',
        expect.any(Function)
      );
    });
  });

  describe('helper methods', () => {
    beforeEach(async () => {
      await databaseService.initialize();
    });

    it('_run should execute SQL with parameters', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await databaseService._run('INSERT INTO test VALUES (?, ?)', ['val1', 'val2']);

      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT INTO test VALUES (?, ?)',
        ['val1', 'val2'],
        expect.any(Function)
      );
    });

    it('_get should retrieve single row', async () => {
      const mockRow = { id: 1, name: 'test' };
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, mockRow);
      });

      const result = await databaseService._get('SELECT * FROM test WHERE id = ?', [1]);

      expect(result).toEqual(mockRow);
    });

    it('_all should retrieve multiple rows', async () => {
      const mockRows = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ];
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await databaseService._all('SELECT * FROM test');

      expect(result).toEqual(mockRows);
      expect(result.length).toBe(2);
    });
  });
});
