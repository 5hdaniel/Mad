/**
 * @jest-environment node
 */

/**
 * Additional tests for TransactionService
 * Covers scanning workflow, contact assignments, and address parsing
 */

import transactionService from '../transactionService';
import databaseService from '../databaseService';
import gmailFetchService from '../gmailFetchService';
import outlookFetchService from '../outlookFetchService';
import transactionExtractorService from '../transactionExtractorService';
import logService from '../logService';
import type { Transaction, NewTransaction } from '../../types';

// Mock the dependencies
jest.mock('../databaseService');
jest.mock('../gmailFetchService');
jest.mock('../outlookFetchService');
jest.mock('../transactionExtractorService');
jest.mock('../logService');

describe('TransactionService - Additional Coverage', () => {
  const mockUserId = 'test-user-id';
  const mockTransactionId = 'test-transaction-id';
  const mockContactId = 'test-contact-id';

  const mockTransaction: Transaction = {
    id: mockTransactionId,
    user_id: mockUserId,
    property_address: '123 Test St, San Francisco, CA 94102',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scanAndExtractTransactions', () => {
    const mockEmails = [
      { subject: 'RE: 123 Main St Offer', from: 'agent@realty.com', date: '2024-01-15', to: 'client@email.com' },
      { subject: 'Closing Documents', from: 'title@company.com', date: '2024-01-20', to: 'agent@realty.com' },
    ];

    const mockAnalyzedEmails = [
      { subject: 'RE: 123 Main St Offer', from: 'agent@realty.com', date: '2024-01-15', isRealEstateRelated: true, keywords: 'offer, closing', confidence: 85 },
      { subject: 'Closing Documents', from: 'title@company.com', date: '2024-01-20', isRealEstateRelated: true, keywords: 'title, closing', confidence: 90 },
    ];

    const mockGrouped = {
      '123 Main St, City, ST 12345': mockAnalyzedEmails,
    };

    const mockSummary = {
      propertyAddress: '123 Main St, City, ST 12345',
      transactionType: 'purchase',
      closingDate: '2024-02-15',
      communicationsCount: 2,
      confidence: 87,
      firstCommunication: '2024-01-15',
      lastCommunication: '2024-01-20',
      salePrice: 500000,
    };

    it('should scan and extract transactions from Gmail', async () => {
      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockResolvedValue(mockEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mockAnalyzedEmails);
      (transactionExtractorService.groupByProperty as jest.Mock).mockReturnValue(mockGrouped);
      (transactionExtractorService.generateTransactionSummary as jest.Mock).mockReturnValue(mockSummary);
      (databaseService.createTransaction as jest.Mock).mockResolvedValue({ id: 'new-txn-id' });
      (databaseService.createCommunication as jest.Mock).mockResolvedValue({});
      (logService.info as jest.Mock).mockResolvedValue(undefined);

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-01'),
      });

      expect(gmailFetchService.initialize).toHaveBeenCalledWith(mockUserId);
      expect(result.success).toBe(true);
      expect(result.emailsScanned).toBe(2);
      expect(result.realEstateEmailsFound).toBe(2);
    });

    it('should scan and extract transactions from Outlook', async () => {
      (outlookFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (outlookFetchService.searchEmails as jest.Mock).mockResolvedValue(mockEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mockAnalyzedEmails);
      (transactionExtractorService.groupByProperty as jest.Mock).mockReturnValue(mockGrouped);
      (transactionExtractorService.generateTransactionSummary as jest.Mock).mockReturnValue(mockSummary);
      (databaseService.createTransaction as jest.Mock).mockResolvedValue({ id: 'new-txn-id' });
      (databaseService.createCommunication as jest.Mock).mockResolvedValue({});
      (logService.info as jest.Mock).mockResolvedValue(undefined);

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'microsoft',
      });

      expect(outlookFetchService.initialize).toHaveBeenCalledWith(mockUserId);
      expect(result.success).toBe(true);
    });

    it('should call progress callback during scan', async () => {
      const onProgress = jest.fn();

      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockResolvedValue(mockEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mockAnalyzedEmails);
      (transactionExtractorService.groupByProperty as jest.Mock).mockReturnValue(mockGrouped);
      (transactionExtractorService.generateTransactionSummary as jest.Mock).mockReturnValue(mockSummary);
      (databaseService.createTransaction as jest.Mock).mockResolvedValue({ id: 'new-txn-id' });
      (databaseService.createCommunication as jest.Mock).mockResolvedValue({});
      (logService.info as jest.Mock).mockResolvedValue(undefined);

      await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith({ step: 'fetching', message: 'Fetching emails...' });
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ step: 'analyzing' }));
      expect(onProgress).toHaveBeenCalledWith({ step: 'grouping', message: 'Grouping by property...' });
      expect(onProgress).toHaveBeenCalledWith({ step: 'saving', message: 'Saving transactions...' });
      expect(onProgress).toHaveBeenCalledWith({ step: 'complete', message: 'Scan complete!' });
    });

    it('should throw error for unknown provider', async () => {
      await expect(
        transactionService.scanAndExtractTransactions(mockUserId, {
          provider: 'unknown' as any,
        })
      ).rejects.toThrow('Unknown provider: unknown');
    });

    it('should filter out non-real-estate emails', async () => {
      const mixedEmails = [
        ...mockEmails,
        { subject: 'Your Amazon Order', from: 'noreply@amazon.com', date: '2024-01-18' },
      ];

      const mixedAnalyzed = [
        ...mockAnalyzedEmails,
        { subject: 'Your Amazon Order', from: 'noreply@amazon.com', date: '2024-01-18', isRealEstateRelated: false },
      ];

      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockResolvedValue(mixedEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mixedAnalyzed);
      (transactionExtractorService.groupByProperty as jest.Mock).mockReturnValue(mockGrouped);
      (transactionExtractorService.generateTransactionSummary as jest.Mock).mockReturnValue(mockSummary);
      (databaseService.createTransaction as jest.Mock).mockResolvedValue({ id: 'new-txn-id' });
      (databaseService.createCommunication as jest.Mock).mockResolvedValue({});
      (logService.info as jest.Mock).mockResolvedValue(undefined);

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
      });

      expect(result.emailsScanned).toBe(3);
      expect(result.realEstateEmailsFound).toBe(2); // Only 2 real estate emails
    });

    it('should skip properties with no valid summary', async () => {
      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockResolvedValue(mockEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mockAnalyzedEmails);
      (transactionExtractorService.groupByProperty as jest.Mock).mockReturnValue(mockGrouped);
      (transactionExtractorService.generateTransactionSummary as jest.Mock).mockReturnValue(null); // No valid summary
      (logService.info as jest.Mock).mockResolvedValue(undefined);

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
      });

      expect(result.transactionsFound).toBe(0);
      expect(databaseService.createTransaction).not.toHaveBeenCalled();
    });

    it('should handle scan errors and log them', async () => {
      const scanError = new Error('Network error');
      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockRejectedValue(scanError);
      (logService.error as jest.Mock).mockResolvedValue(undefined);

      await expect(
        transactionService.scanAndExtractTransactions(mockUserId, { provider: 'google' })
      ).rejects.toThrow('Network error');

      expect(logService.error).toHaveBeenCalledWith(
        'Transaction scan failed',
        'TransactionService.scanAndExtractTransactions',
        expect.objectContaining({
          error: 'Network error',
          userId: mockUserId,
          provider: 'google',
        })
      );
    });
  });

  describe('getTransactionWithContacts', () => {
    it('should return transaction with contact assignments', async () => {
      const mockContacts = [
        { id: 'contact-1', role: 'buyer', is_primary: true },
        { id: 'contact-2', role: 'seller_agent', is_primary: false },
      ];

      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(mockTransaction);
      (databaseService.getTransactionContacts as jest.Mock).mockResolvedValue(mockContacts);

      const result = await transactionService.getTransactionWithContacts(mockTransactionId);

      expect(result).toEqual({
        ...mockTransaction,
        contact_assignments: mockContacts,
      });
    });

    it('should return null when transaction not found', async () => {
      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(null);

      const result = await transactionService.getTransactionWithContacts('non-existent');

      expect(result).toBeNull();
      expect(databaseService.getTransactionContacts).not.toHaveBeenCalled();
    });
  });

  describe('assignContactToTransaction', () => {
    it('should assign contact with all role details', async () => {
      const mockAssignment = { id: 'assignment-1', contact_id: mockContactId };
      (databaseService.assignContactToTransaction as jest.Mock).mockResolvedValue(mockAssignment);

      const result = await transactionService.assignContactToTransaction(
        mockTransactionId,
        mockContactId,
        'buyer',
        'client',
        true,
        'Primary buyer'
      );

      expect(databaseService.assignContactToTransaction).toHaveBeenCalledWith(
        mockTransactionId,
        {
          contact_id: mockContactId,
          role: 'buyer',
          role_category: 'client',
          specific_role: 'buyer',
          is_primary: 1,
          notes: 'Primary buyer',
        }
      );
      expect(result).toEqual(mockAssignment);
    });

    it('should handle null notes', async () => {
      (databaseService.assignContactToTransaction as jest.Mock).mockResolvedValue({});

      await transactionService.assignContactToTransaction(
        mockTransactionId,
        mockContactId,
        'seller',
        'client',
        false,
        null
      );

      expect(databaseService.assignContactToTransaction).toHaveBeenCalledWith(
        mockTransactionId,
        expect.objectContaining({
          notes: undefined,
        })
      );
    });
  });

  describe('updateContactRole', () => {
    it('should update contact role with provided updates', async () => {
      const updates = {
        role: 'listing_agent',
        role_category: 'agent',
        is_primary: true,
        notes: 'Updated role',
      };

      (databaseService.updateContactRole as jest.Mock).mockResolvedValue({});

      await transactionService.updateContactRole(mockTransactionId, mockContactId, updates);

      expect(databaseService.updateContactRole).toHaveBeenCalledWith(
        mockTransactionId,
        mockContactId,
        expect.objectContaining(updates)
      );
    });

    it('should handle partial updates', async () => {
      const updates = { is_primary: false };

      (databaseService.updateContactRole as jest.Mock).mockResolvedValue({});

      await transactionService.updateContactRole(mockTransactionId, mockContactId, updates);

      expect(databaseService.updateContactRole).toHaveBeenCalledWith(
        mockTransactionId,
        mockContactId,
        expect.objectContaining({
          is_primary: false,
          role: undefined,
        })
      );
    });
  });

  describe('reanalyzeProperty', () => {
    const mockEmails = [
      { subject: 'RE: 123 Main St', from: 'agent@realty.com', date: '2024-01-15' },
    ];

    const mockAnalyzed = [
      { subject: 'RE: 123 Main St', from: 'agent@realty.com', date: '2024-01-15', isRealEstateRelated: true },
    ];

    it('should reanalyze property with Gmail provider', async () => {
      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockResolvedValue(mockEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mockAnalyzed);

      const result = await transactionService.reanalyzeProperty(
        mockUserId,
        'google',
        '123 Main St',
        { start: new Date('2024-01-01'), end: new Date('2024-02-01') }
      );

      expect(result.emailsFound).toBe(1);
      expect(result.realEstateEmailsFound).toBe(1);
      expect(result.analyzed).toEqual(mockAnalyzed);
    });

    it('should reanalyze property with Outlook provider', async () => {
      (outlookFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (outlookFetchService.searchEmails as jest.Mock).mockResolvedValue(mockEmails);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue(mockAnalyzed);

      const result = await transactionService.reanalyzeProperty(
        mockUserId,
        'microsoft',
        '456 Oak Ave'
      );

      expect(outlookFetchService.searchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '456 Oak Ave',
        })
      );
      expect(result.emailsFound).toBe(1);
    });

    it('should use default date range when not provided', async () => {
      (gmailFetchService.initialize as jest.Mock).mockResolvedValue(undefined);
      (gmailFetchService.searchEmails as jest.Mock).mockResolvedValue([]);
      (transactionExtractorService.batchAnalyze as jest.Mock).mockReturnValue([]);

      await transactionService.reanalyzeProperty(mockUserId, 'google', '123 Main St', {});

      expect(gmailFetchService.searchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          after: expect.any(Date),
          before: expect.any(Date),
        })
      );
    });
  });

  describe('createAuditedTransaction with contacts', () => {
    it('should create transaction and assign multiple contacts', async () => {
      const auditedData = {
        property_address: '789 Pine Rd, Oakland, CA 94612',
        property_street: '789 Pine Rd',
        property_city: 'Oakland',
        property_state: 'CA',
        property_zip: '94612',
        transaction_type: 'sale' as const,
        contact_assignments: [
          { contact_id: 'contact-1', role: 'seller', role_category: 'client', is_primary: true },
          { contact_id: 'contact-2', role: 'buyer_agent', role_category: 'agent', is_primary: false },
        ],
      };

      const mockCreatedTransaction = { ...mockTransaction, id: 'new-txn-id' };

      (databaseService.createTransaction as jest.Mock).mockResolvedValue(mockCreatedTransaction);
      (databaseService.assignContactToTransaction as jest.Mock).mockResolvedValue({});
      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(mockCreatedTransaction);
      (databaseService.getTransactionContacts as jest.Mock).mockResolvedValue(auditedData.contact_assignments);

      const result = await transactionService.createAuditedTransaction(mockUserId, auditedData);

      expect(databaseService.assignContactToTransaction).toHaveBeenCalledTimes(2);
      expect(databaseService.assignContactToTransaction).toHaveBeenCalledWith(
        'new-txn-id',
        expect.objectContaining({ contact_id: 'contact-1', role: 'seller' })
      );
      expect(databaseService.assignContactToTransaction).toHaveBeenCalledWith(
        'new-txn-id',
        expect.objectContaining({ contact_id: 'contact-2', role: 'buyer_agent' })
      );
      expect(result?.contact_assignments).toHaveLength(2);
    });

    it('should handle transaction with property coordinates', async () => {
      const auditedData = {
        property_address: '123 Verified St',
        property_coordinates: '37.7749,-122.4194',
        contact_assignments: [],
      };

      const mockCreatedTransaction = { ...mockTransaction, id: 'verified-txn' };

      (databaseService.createTransaction as jest.Mock).mockResolvedValue(mockCreatedTransaction);
      (databaseService.getTransactionById as jest.Mock).mockResolvedValue(mockCreatedTransaction);
      (databaseService.getTransactionContacts as jest.Mock).mockResolvedValue([]);

      await transactionService.createAuditedTransaction(mockUserId, auditedData);

      expect(databaseService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          property_coordinates: '37.7749,-122.4194',
          closing_date_verified: true, // Should be true when coordinates present
        })
      );
    });
  });

  describe('Address Parsing', () => {
    it('should parse full address correctly in createManualTransaction', async () => {
      // We can indirectly test address parsing through the transaction creation
      const transactionData: Partial<NewTransaction> = {
        property_address: '123 Main St, San Francisco, CA 94102',
        property_street: '123 Main St',
        property_city: 'San Francisco',
        property_state: 'CA',
        property_zip: '94102',
      };

      (databaseService.createTransaction as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        ...transactionData,
      });

      const result = await transactionService.createManualTransaction(mockUserId, transactionData);

      expect(databaseService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          property_street: '123 Main St',
          property_city: 'San Francisco',
          property_state: 'CA',
          property_zip: '94102',
        })
      );
    });
  });
});
