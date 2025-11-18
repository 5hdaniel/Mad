/**
 * Unit tests for contact deletion prevention feature
 * Tests the getTransactionsByContact method in databaseService
 */

// Mock sqlite3 before requiring databaseService
jest.mock('sqlite3', () => {
  return {
    verbose: () => ({
      Database: jest.fn().mockImplementation(() => ({
        all: jest.fn(),
        get: jest.fn(),
        run: jest.fn(),
      })),
    }),
  };
});

const databaseService = require('../databaseService');

describe('DatabaseService - Contact Deletion Prevention', () => {
  let _allSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create spy that we'll configure in each test
    _allSpy = jest.spyOn(databaseService, '_all');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTransactionsByContact', () => {
    const contactId = 'contact-123';

    it('should return empty array when contact has no associated transactions', async () => {
      // Mock all three queries to return empty results
      _allSpy
        .mockResolvedValueOnce([]) // Direct FK query
        .mockResolvedValueOnce([]) // Junction table query
        .mockResolvedValueOnce([]); // JSON array query

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toEqual([]);
      expect(_allSpy).toHaveBeenCalledTimes(3);
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

      _allSpy
        .mockResolvedValueOnce([mockTransaction]) // Direct FK query
        .mockResolvedValueOnce([]) // Junction table query
        .mockResolvedValueOnce([]); // JSON array query

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

      _allSpy
        .mockResolvedValueOnce([]) // Direct FK query
        .mockResolvedValueOnce([mockTransaction]) // Junction table query
        .mockResolvedValueOnce([]); // JSON array query

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

      _allSpy
        .mockResolvedValueOnce([]) // Direct FK query
        .mockResolvedValueOnce([]) // Junction table query
        .mockResolvedValueOnce([mockTransaction]); // JSON array query

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
        id: 'txn-1', // Same transaction ID
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        specific_role: 'escrow_officer',
        role_category: 'title_escrow',
      };

      _allSpy
        .mockResolvedValueOnce([directTxn]) // Direct FK query
        .mockResolvedValueOnce([junctionTxn]) // Junction table query
        .mockResolvedValueOnce([]); // JSON array query

      const result = await databaseService.getTransactionsByContact(contactId);

      // Should only have one transaction, but with combined roles
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('txn-1');
      expect(result[0].roles).toContain('Buyer Agent');
      expect(result[0].roles).toContain('escrow_officer');
    });

    it('should combine multiple roles from the same transaction', async () => {
      const directTxn1 = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        role: 'Buyer Agent',
      };

      const directTxn2 = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        role: 'Seller Agent',
      };

      _allSpy
        .mockResolvedValueOnce([directTxn1, directTxn2]) // Direct FK query returns both
        .mockResolvedValueOnce([]) // Junction table query
        .mockResolvedValueOnce([]); // JSON array query

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

      _allSpy
        .mockResolvedValueOnce([directTxn])
        .mockResolvedValueOnce([junctionTxn])
        .mockResolvedValueOnce([jsonTxn]);

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
        other_contacts: `["contact-123", "contact-456"]`,
      };

      _allSpy
        .mockResolvedValueOnce([]) // Direct FK query
        .mockResolvedValueOnce([]) // Junction table query
        .mockRejectedValueOnce(new Error('json_each not supported')) // JSON array query fails
        .mockResolvedValueOnce([fallbackTxn]); // Fallback LIKE query

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('txn-1');
      expect(_allSpy).toHaveBeenCalledTimes(4); // 3 original + 1 fallback
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

      _allSpy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('json_each not supported'))
        .mockResolvedValueOnce([invalidJsonTxn]);

      const result = await databaseService.getTransactionsByContact(contactId);

      // Should handle JSON parse error gracefully
      expect(result).toHaveLength(0);
    });

    it('should pass correct SQL parameters for all queries', async () => {
      _allSpy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await databaseService.getTransactionsByContact(contactId);

      // Check direct FK query parameters (8 times - 4 for CASE, 4 for WHERE)
      expect(_allSpy.mock.calls[0][1]).toEqual([
        contactId,
        contactId,
        contactId,
        contactId,
        contactId,
        contactId,
        contactId,
        contactId,
      ]);

      // Check junction table query parameters
      expect(_allSpy.mock.calls[1][1]).toEqual([contactId]);

      // Check JSON array query parameters
      expect(_allSpy.mock.calls[2][1]).toEqual([contactId]);
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

      _allSpy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockTransaction])
        .mockResolvedValueOnce([]);

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

      _allSpy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockTransaction])
        .mockResolvedValueOnce([]);

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result[0].roles).toBe('Associated Contact');
    });

    it('should handle all transaction types and statuses', async () => {
      const purchaseTxn = {
        id: 'txn-1',
        property_address: '123 Main St',
        closing_date: '2024-01-15',
        transaction_type: 'purchase',
        status: 'active',
        role: 'Buyer Agent',
      };

      const saleTxn = {
        id: 'txn-2',
        property_address: '456 Oak Ave',
        closing_date: '2024-02-20',
        transaction_type: 'sale',
        status: 'closed',
        role: 'Seller Agent',
      };

      _allSpy
        .mockResolvedValueOnce([purchaseTxn, saleTxn])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await databaseService.getTransactionsByContact(contactId);

      expect(result).toHaveLength(2);
      expect(result[0].transaction_type).toBe('purchase');
      expect(result[0].status).toBe('active');
      expect(result[1].transaction_type).toBe('sale');
      expect(result[1].status).toBe('closed');
    });
  });
});
