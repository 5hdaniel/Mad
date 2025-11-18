/**
 * Unit tests for contact deletion prevention feature
 * Tests the getTransactionsByContact method in databaseService
 */

// Create a mock database before requiring the service
// Important: Provide default implementations that always call the callback
// This ensures that Promises created by _all() always resolve
const mockDatabase = {
  all: jest.fn((sql, params, callback) => {
    const cb = typeof params === 'function' ? params : callback;
    if (cb) cb(null, []);
  }),
  get: jest.fn((sql, params, callback) => {
    const cb = typeof params === 'function' ? params : callback;
    if (cb) cb(null, null);
  }),
  run: jest.fn((sql, params, callback) => {
    const cb = typeof params === 'function' ? params : callback;
    if (cb) cb(null);
  }),
};

// Mock electron before requiring databaseService
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/app/path'),
  },
}));

// Mock sqlite3 before requiring databaseService
jest.mock('sqlite3', () => {
  return {
    verbose: () => ({
      Database: jest.fn().mockImplementation((dbPath, callback) => {
        // Call the callback to simulate successful connection
        if (callback) callback(null);
        return mockDatabase;
      }),
    }),
  };
});

const databaseService = require('../databaseService');

describe('DatabaseService - Contact Deletion Prevention', () => {
  beforeEach(() => {
    // Clear only call history, not implementations
    mockDatabase.all.mockClear();
    mockDatabase.get.mockClear();
    mockDatabase.run.mockClear();

    // Set the db directly since initialize() is async and we don't need full initialization for these tests
    databaseService.db = mockDatabase;
  });

  describe('getTransactionsByContact', () => {
    const contactId = 'contact-123';

    it('should return empty array when contact has no associated transactions', async () => {
      // Mock db.all to return empty results for all three queries
      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, [])) // Direct FK
        .mockImplementationOnce((sql, params, callback) => callback(null, [])) // Junction
        .mockImplementationOnce((sql, params, callback) => callback(null, [])); // JSON

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toEqual([]);
      expect(mockDatabase.all).toHaveBeenCalledTimes(3);
    });

    it('should find transactions via direct FK references (buyer_agent_id)', async () => {
      const mockTransaction = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        role: 'Buyer Agent',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, [mockTransaction]))
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'txn-1',
        property_address: '123 Main St',
        roles: 'Buyer Agent',
      });
    });

    it('should find transactions via junction table (transaction_contacts)', async () => {
      const mockTransaction = {
        id: 'txn-2',
        property_address: '456 Oak Ave',
        closing_date: '2024-02-20',
        transaction_type: 'sale',
        status: 'active',
        specific_role: 'inspector',
        role_category: 'inspection',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, [mockTransaction]))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'txn-2',
        property_address: '456 Oak Ave',
        roles: 'inspector',
      });
    });

    it('should find transactions via JSON array (other_contacts)', async () => {
      const mockTransaction = {
        id: 'txn-3',
        property_address: '789 Elm St',
        closing_date: '2024-03-10',
        transaction_type: 'purchase',
        status: 'closed',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, [mockTransaction]));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'txn-3',
        property_address: '789 Elm St',
        roles: 'Other Contact',
      });
    });

    it('should deduplicate transactions found in multiple sources', async () => {
      const directTxn = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        role: 'Buyer Agent',
      };

      const junctionTxn = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        specific_role: 'escrow_officer',
        role_category: 'title_escrow',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, [directTxn]))
        .mockImplementationOnce((sql, params, callback) => callback(null, [junctionTxn]))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('txn-1');
      expect(result[0].roles).toContain('Buyer Agent');
      expect(result[0].roles).toContain('escrow_officer');
    });

    it('should combine multiple roles from the same transaction', async () => {
      const transactions = [
        {
          id: 'txn-1',
          property_address: '123 Main St',
          closing_date: '2024-01-15',
          transaction_type: 'purchase',
          status: 'active',
          role: 'Buyer Agent',
        },
        {
          id: 'txn-1',
          property_address: '123 Main St',
          closing_date: '2024-01-15',
          transaction_type: 'purchase',
          status: 'active',
          role: 'Seller Agent',
        }
      ];

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, transactions))
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0].roles).toBe('Buyer Agent, Seller Agent');
    });

    it('should handle multiple transactions across different sources', async () => {
      const directTxn = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        role: 'Buyer Agent',
      };

      const junctionTxn = {
        id: 'txn-2',
        property_address: '456 Oak Ave',
        closing_date: '2024-02-20',
        transaction_type: 'sale',
        status: 'active',
        specific_role: 'inspector',
      };

      const jsonTxn = {
        id: 'txn-3',
        property_address: '789 Elm St',
        closing_date: '2024-03-10',
        transaction_type: 'purchase',
        status: 'closed',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, [directTxn]))
        .mockImplementationOnce((sql, params, callback) => callback(null, [junctionTxn]))
        .mockImplementationOnce((sql, params, callback) => callback(null, [jsonTxn]));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(3);
      expect(result.map((t) => t.id)).toEqual(['txn-1', 'txn-2', 'txn-3']);
    });

    it('should handle json_each failure and fall back to LIKE query', async () => {
      const fallbackTxn = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        other_contacts: `["${contactId}", "contact-456"]`,
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(new Error('json_each not supported')))
        .mockImplementationOnce((sql, params, callback) => callback(null, [fallbackTxn]));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('txn-1');
      expect(mockDatabase.all).toHaveBeenCalledTimes(4);
    });

    it('should handle fallback query with invalid JSON gracefully', async () => {
      const invalidJsonTxn = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        other_contacts: 'invalid-json',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(new Error('json_each not supported')))
        .mockImplementationOnce((sql, params, callback) => callback(null, [invalidJsonTxn]));

      const result = await databaseService.getTransactionsByContact(contactId);

      // Should handle JSON parse error gracefully
      expect(result).toHaveLength(0);
    });

    it('should pass correct SQL parameters for all queries', async () => {
      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => {
          // Verify direct FK query has 8 parameters
          expect(params).toHaveLength(8);
          expect(params).toEqual([
            contactId, contactId, contactId, contactId,
            contactId, contactId, contactId, contactId
          ]);
          callback(null, []);
        })
        .mockImplementationOnce((sql, params, callback) => {
          // Verify junction query has 1 parameter
          expect(params).toEqual([contactId]);
          callback(null, []);
        })
        .mockImplementationOnce((sql, params, callback) => {
          // Verify JSON query has 1 parameter
          expect(params).toEqual([contactId]);
          callback(null, []);
        });

      await databaseService.getTransactionsByContact(contactId);

      expect(mockDatabase.all).toHaveBeenCalledTimes(3);
    });

    it('should use role_category when specific_role is not available', async () => {
      const mockTransaction = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        specific_role: null,
        role_category: 'inspection',
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, [mockTransaction]))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result[0].roles).toBe('inspection');
    });

    it('should use "Associated Contact" as fallback when no role is specified', async () => {
      const mockTransaction = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        specific_role: null,
        role_category: null,
      };

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, [mockTransaction]))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result[0].roles).toBe('Associated Contact');
    });

    it('should handle all transaction types and statuses', async () => {
      const transactions = [
        {
          id: 'txn-1',
          property_address: '123 Main St',
          closing_date: '2024-01-15',
          transaction_type: 'purchase',
          status: 'active',
          role: 'Buyer Agent',
        },
        {
          id: 'txn-2',
          property_address: '456 Oak Ave',
          closing_date: '2024-02-20',
          transaction_type: 'sale',
          status: 'closed',
          role: 'Seller Agent',
        }
      ];

      mockDatabase.all
        .mockImplementationOnce((sql, params, callback) => callback(null, transactions))
        .mockImplementationOnce((sql, params, callback) => callback(null, []))
        .mockImplementationOnce((sql, params, callback) => callback(null, []));

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(2);
      expect(result[0].transaction_type).toBe('purchase');
      expect(result[0].status).toBe('active');
      expect(result[1].transaction_type).toBe('sale');
      expect(result[1].status).toBe('closed');
    });
  });
});
