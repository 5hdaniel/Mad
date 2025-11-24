/**
 * @jest-environment node
 */

/**
 * Unit tests for TransactionService
 * Tests the fixed database service method calls
 */

import transactionService from '../transactionService';
import databaseService from '../databaseService';
import type { Transaction, NewTransaction } from '../../types';

// Mock the dependencies
jest.mock('../databaseService');
jest.mock('../gmailFetchService');
jest.mock('../outlookFetchService');
jest.mock('../transactionExtractorService');
jest.mock('../logService');

describe('TransactionService - Database Method Fixes', () => {
  const mockUserId = 'test-user-id';
  const mockTransactionId = 'test-transaction-id';
  const mockContactId = 'test-contact-id';

  const mockTransaction: Transaction = {
    id: mockTransactionId,
    user_id: mockUserId,
    property_address: '123 Test St',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransactions', () => {
    it('should call databaseService.getTransactions with user_id filter', async () => {
      const mockTransactions = [mockTransaction];
      (databaseService.getTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const result = await transactionService.getTransactions(mockUserId);

      expect(databaseService.getTransactions).toHaveBeenCalledWith({ user_id: mockUserId });
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array when no transactions found', async () => {
      (databaseService.getTransactions as jest.Mock).mockResolvedValue([]);

      const result = await transactionService.getTransactions(mockUserId);

      expect(result).toEqual([]);
      expect(databaseService.getTransactions).toHaveBeenCalledTimes(1);
    });
  });

  describe('createManualTransaction', () => {
    it('should include user_id in transaction data object', async () => {
      const transactionData: Partial<NewTransaction> = {
        property_address: '123 Test St',
        transaction_type: 'purchase',
        status: 'active',
      };

      (databaseService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      const result = await transactionService.createManualTransaction(mockUserId, transactionData);

      expect(databaseService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          property_address: '123 Test St',
          transaction_type: 'purchase',
          status: 'active',
        })
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should use default values when not provided', async () => {
      const transactionData: Partial<NewTransaction> = {
        property_address: '456 Oak Ave',
      };

      (databaseService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

      await transactionService.createManualTransaction(mockUserId, transactionData);

      expect(databaseService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          property_address: '456 Oak Ave',
          status: 'active',
          closing_date_verified: 0,
        })
      );
    });
  });

  describe('getTransactionDetails', () => {
    it('should call getCommunicationsByTransaction instead of getCommunicationsByTransactionId', async () => {
      const mockCommunications = [{ id: 'comm-1', subject: 'Test' }];
      const mockContacts = [{ id: mockContactId, name: 'Test Contact' }];

      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(mockTransaction);
      (databaseService.getCommunicationsByTransaction as jest.Mock).mockResolvedValue(mockCommunications);
      (databaseService.getTransactionContacts as jest.Mock).mockResolvedValue(mockContacts);

      const result = await transactionService.getTransactionDetails(mockTransactionId);

      expect(databaseService.getCommunicationsByTransaction).toHaveBeenCalledWith(mockTransactionId);
      expect(result).toEqual({
        ...mockTransaction,
        communications: mockCommunications,
        contact_assignments: mockContacts,
      });
    });

    it('should return null when transaction not found', async () => {
      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(null);

      const result = await transactionService.getTransactionDetails(mockTransactionId);

      expect(result).toBeNull();
      expect(databaseService.getCommunicationsByTransaction).not.toHaveBeenCalled();
    });
  });

  describe('removeContactFromTransaction', () => {
    it('should call unlinkContactFromTransaction instead of removeContactFromTransaction', async () => {
      (databaseService.unlinkContactFromTransaction as jest.Mock).mockResolvedValue(undefined);

      await transactionService.removeContactFromTransaction(mockTransactionId, mockContactId);

      expect(databaseService.unlinkContactFromTransaction).toHaveBeenCalledWith(
        mockTransactionId,
        mockContactId
      );
    });
  });

  describe('createAuditedTransaction', () => {
    it('should include user_id in transaction data and extract id from result', async () => {
      const auditedData = {
        property_address: '789 Pine Rd',
        property_street: '789 Pine Rd',
        property_city: 'San Francisco',
        property_state: 'CA',
        property_zip: '94102',
        transaction_type: 'purchase' as const,
        contact_assignments: [],
      };

      const mockCreatedTransaction = {
        ...mockTransaction,
        id: 'new-transaction-id',
      };

      (databaseService.createTransaction as jest.Mock).mockResolvedValue(mockCreatedTransaction);
      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(mockCreatedTransaction);
      (databaseService.getTransactionContactsWithRoles as jest.Mock).mockResolvedValue([]);

      const result = await transactionService.createAuditedTransaction(mockUserId, auditedData);

      expect(databaseService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          property_address: '789 Pine Rd',
          status: 'active',
        })
      );
      expect(result).toBeDefined();
    });

    it('should handle errors and log them properly', async () => {
      const auditedData = {
        property_address: '789 Pine Rd',
        contact_assignments: [],
      };

      const error = new Error('Database error');
      (databaseService.createTransaction as jest.Mock).mockRejectedValue(error);

      await expect(
        transactionService.createAuditedTransaction(mockUserId, auditedData)
      ).rejects.toThrow('Database error');
    });
  });

  describe('updateTransaction', () => {
    it('should call databaseService.updateTransaction with correct parameters', async () => {
      const updates = { property_address: '999 New St' };
      (databaseService.updateTransaction as jest.Mock).mockResolvedValue(undefined);

      await transactionService.updateTransaction(mockTransactionId, updates);

      expect(databaseService.updateTransaction).toHaveBeenCalledWith(mockTransactionId, updates);
    });
  });

  describe('deleteTransaction', () => {
    it('should call databaseService.deleteTransaction', async () => {
      (databaseService.deleteTransaction as jest.Mock).mockResolvedValue(undefined);

      await transactionService.deleteTransaction(mockTransactionId);

      expect(databaseService.deleteTransaction).toHaveBeenCalledWith(mockTransactionId);
    });
  });
});
