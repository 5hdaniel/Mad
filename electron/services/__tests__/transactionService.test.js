/**
 * TransactionService Tests
 * Tests the core transaction orchestration workflow
 */

const TransactionService = require('../transactionService');
const gmailFetchService = require('../gmailFetchService');
const outlookFetchService = require('../outlookFetchService');
const transactionExtractorService = require('../transactionExtractorService');
const databaseService = require('../databaseService');

// Mock dependencies
jest.mock('../gmailFetchService');
jest.mock('../outlookFetchService');
jest.mock('../transactionExtractorService');
jest.mock('../databaseService');

describe('TransactionService', () => {
  let transactionService;
  const mockUserId = 'user-123';

  beforeEach(() => {
    transactionService = new TransactionService();
    jest.clearAllMocks();
  });

  describe('scanAndExtractTransactions', () => {
    it('should successfully scan and extract transactions from Gmail', async () => {
      // Mock email data
      const mockEmails = [
        {
          id: 'email-1',
          from: 'agent@realestate.com',
          subject: 'Property at 123 Main St',
          body: 'Closing on Monday',
          date: new Date('2024-01-15'),
        },
        {
          id: 'email-2',
          from: 'escrow@title.com',
          subject: 'Re: 123 Main St closing',
          body: 'Documents ready',
          date: new Date('2024-01-20'),
        },
      ];

      // Mock analyzed emails
      const mockAnalyzed = [
        {
          ...mockEmails[0],
          isRealEstateRelated: true,
          propertyAddress: '123 Main St, City, CA 90210',
        },
        {
          ...mockEmails[1],
          isRealEstateRelated: true,
          propertyAddress: '123 Main St, City, CA 90210',
        },
      ];

      // Mock grouped data
      const mockGrouped = {
        '123 Main St, City, CA 90210': mockAnalyzed,
      };

      // Mock transaction summary
      const mockSummary = {
        propertyAddress: '123 Main St, City, CA 90210',
        transactionType: 'purchase',
        closingDate: '2024-01-20',
        communicationsCount: 2,
        confidence: 0.95,
        firstCommunication: new Date('2024-01-15'),
        lastCommunication: new Date('2024-01-20'),
        salePrice: 500000,
      };

      const mockTransactionId = 'txn-123';

      // Setup mocks
      gmailFetchService.initialize.mockResolvedValue(true);
      gmailFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue(mockAnalyzed);
      transactionExtractorService.groupByProperty.mockReturnValue(mockGrouped);
      transactionExtractorService.generateTransactionSummary.mockReturnValue(mockSummary);
      databaseService.createTransaction.mockResolvedValue(mockTransactionId);
      databaseService.createCommunication.mockResolvedValue('comm-123');
      databaseService.linkCommunicationToTransaction.mockResolvedValue(true);

      // Execute
      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      // Verify results
      expect(result.success).toBe(true);
      expect(result.transactionsFound).toBe(1);
      expect(result.emailsScanned).toBe(2);
      expect(result.realEstateEmailsFound).toBe(2);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].id).toBe(mockTransactionId);

      // Verify service calls
      expect(gmailFetchService.initialize).toHaveBeenCalledWith(mockUserId);
      expect(gmailFetchService.searchEmails).toHaveBeenCalled();
      expect(transactionExtractorService.batchAnalyze).toHaveBeenCalledWith(mockEmails);
      expect(databaseService.createTransaction).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          property_address: '123 Main St, City, CA 90210',
          transaction_type: 'purchase',
        })
      );
    });

    it('should successfully scan and extract transactions from Outlook', async () => {
      const mockEmails = [
        {
          id: 'email-1',
          from: 'agent@realestate.com',
          subject: 'Property listing',
          body: 'Great property',
          date: new Date('2024-01-15'),
        },
      ];

      const mockAnalyzed = [
        {
          ...mockEmails[0],
          isRealEstateRelated: true,
          propertyAddress: '456 Oak Ave, City, CA 90211',
        },
      ];

      const mockGrouped = {
        '456 Oak Ave, City, CA 90211': mockAnalyzed,
      };

      const mockSummary = {
        propertyAddress: '456 Oak Ave, City, CA 90211',
        transactionType: 'sale',
        closingDate: '2024-02-01',
        communicationsCount: 1,
        confidence: 0.85,
        firstCommunication: new Date('2024-01-15'),
        lastCommunication: new Date('2024-01-15'),
        salePrice: 750000,
      };

      outlookFetchService.initialize.mockResolvedValue(true);
      outlookFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue(mockAnalyzed);
      transactionExtractorService.groupByProperty.mockReturnValue(mockGrouped);
      transactionExtractorService.generateTransactionSummary.mockReturnValue(mockSummary);
      databaseService.createTransaction.mockResolvedValue('txn-456');

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'microsoft',
      });

      expect(result.success).toBe(true);
      expect(outlookFetchService.initialize).toHaveBeenCalledWith(mockUserId);
      expect(outlookFetchService.searchEmails).toHaveBeenCalled();
    });

    it('should filter out non-real-estate emails', async () => {
      const mockEmails = [
        { id: 'email-1', subject: 'Property listing' },
        { id: 'email-2', subject: 'Newsletter' },
        { id: 'email-3', subject: 'Another property' },
      ];

      const mockAnalyzed = [
        { ...mockEmails[0], isRealEstateRelated: true, propertyAddress: '123 Main St' },
        { ...mockEmails[1], isRealEstateRelated: false },
        { ...mockEmails[2], isRealEstateRelated: true, propertyAddress: '456 Oak Ave' },
      ];

      gmailFetchService.initialize.mockResolvedValue(true);
      gmailFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue(mockAnalyzed);
      transactionExtractorService.groupByProperty.mockReturnValue({
        '123 Main St': [mockAnalyzed[0]],
        '456 Oak Ave': [mockAnalyzed[2]],
      });
      transactionExtractorService.generateTransactionSummary.mockReturnValue({
        propertyAddress: '123 Main St',
        communicationsCount: 1,
        firstCommunication: new Date(),
        lastCommunication: new Date(),
      });
      databaseService.createTransaction.mockResolvedValue('txn-1');

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
      });

      expect(result.emailsScanned).toBe(3);
      expect(result.realEstateEmailsFound).toBe(2);
      expect(transactionExtractorService.groupByProperty).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ isRealEstateRelated: true }),
        ])
      );
    });

    it('should call progress callback at each step', async () => {
      const mockProgress = jest.fn();
      const mockEmails = [{ id: 'email-1' }];
      const mockAnalyzed = [{ ...mockEmails[0], isRealEstateRelated: true, propertyAddress: '123 Main St' }];

      gmailFetchService.initialize.mockResolvedValue(true);
      gmailFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue(mockAnalyzed);
      transactionExtractorService.groupByProperty.mockReturnValue({ '123 Main St': mockAnalyzed });
      transactionExtractorService.generateTransactionSummary.mockReturnValue({
        propertyAddress: '123 Main St',
        communicationsCount: 1,
        firstCommunication: new Date(),
        lastCommunication: new Date(),
      });
      databaseService.createTransaction.mockResolvedValue('txn-1');

      await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
        onProgress: mockProgress,
      });

      expect(mockProgress).toHaveBeenCalledWith({ step: 'fetching', message: 'Fetching emails...' });
      expect(mockProgress).toHaveBeenCalledWith({ step: 'analyzing', message: expect.stringContaining('Analyzing') });
      expect(mockProgress).toHaveBeenCalledWith({ step: 'grouping', message: 'Grouping by property...' });
      expect(mockProgress).toHaveBeenCalledWith({ step: 'saving', message: 'Saving transactions...' });
      expect(mockProgress).toHaveBeenCalledWith({ step: 'complete', message: 'Scan complete!' });
    });

    it('should throw error for unknown provider', async () => {
      await expect(
        transactionService.scanAndExtractTransactions(mockUserId, {
          provider: 'unknown-provider',
        })
      ).rejects.toThrow('Unknown provider: unknown-provider');
    });

    it('should handle errors during email fetch', async () => {
      gmailFetchService.initialize.mockRejectedValue(new Error('Auth failed'));

      await expect(
        transactionService.scanAndExtractTransactions(mockUserId, {
          provider: 'google',
        })
      ).rejects.toThrow('Auth failed');
    });

    it('should handle errors during transaction creation', async () => {
      const mockEmails = [{ id: 'email-1' }];
      const mockAnalyzed = [{ ...mockEmails[0], isRealEstateRelated: true, propertyAddress: '123 Main St' }];

      gmailFetchService.initialize.mockResolvedValue(true);
      gmailFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue(mockAnalyzed);
      transactionExtractorService.groupByProperty.mockReturnValue({ '123 Main St': mockAnalyzed });
      transactionExtractorService.generateTransactionSummary.mockReturnValue({
        propertyAddress: '123 Main St',
        communicationsCount: 1,
        firstCommunication: new Date(),
        lastCommunication: new Date(),
      });
      databaseService.createTransaction.mockRejectedValue(new Error('Database error'));

      await expect(
        transactionService.scanAndExtractTransactions(mockUserId, {
          provider: 'google',
        })
      ).rejects.toThrow('Database error');
    });

    it('should use default date range when not provided', async () => {
      const mockEmails = [];

      gmailFetchService.initialize.mockResolvedValue(true);
      gmailFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue([]);

      await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
      });

      expect(gmailFetchService.searchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          after: expect.any(Date),
          before: expect.any(Date),
        })
      );
    });

    it('should handle multiple properties in one scan', async () => {
      const mockEmails = [
        { id: 'email-1', subject: '123 Main St' },
        { id: 'email-2', subject: '456 Oak Ave' },
        { id: 'email-3', subject: '789 Pine Rd' },
      ];

      const mockAnalyzed = mockEmails.map((email, idx) => ({
        ...email,
        isRealEstateRelated: true,
        propertyAddress: ['123 Main St', '456 Oak Ave', '789 Pine Rd'][idx],
      }));

      const mockGrouped = {
        '123 Main St': [mockAnalyzed[0]],
        '456 Oak Ave': [mockAnalyzed[1]],
        '789 Pine Rd': [mockAnalyzed[2]],
      };

      gmailFetchService.initialize.mockResolvedValue(true);
      gmailFetchService.searchEmails.mockResolvedValue(mockEmails);
      transactionExtractorService.batchAnalyze.mockReturnValue(mockAnalyzed);
      transactionExtractorService.groupByProperty.mockReturnValue(mockGrouped);
      transactionExtractorService.generateTransactionSummary.mockImplementation((emails) => ({
        propertyAddress: emails[0].propertyAddress,
        communicationsCount: emails.length,
        firstCommunication: new Date(),
        lastCommunication: new Date(),
      }));
      databaseService.createTransaction.mockImplementation((userId, data) =>
        Promise.resolve(`txn-${data.property_address}`)
      );

      const result = await transactionService.scanAndExtractTransactions(mockUserId, {
        provider: 'google',
      });

      expect(result.transactionsFound).toBe(3);
      expect(databaseService.createTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('_parseAddress', () => {
    it('should parse a full address correctly', () => {
      const address = '123 Main St, Springfield, IL 62701';
      const parsed = transactionService._parseAddress(address);

      expect(parsed.street).toBe('123 Main St');
      expect(parsed.city).toBe('Springfield');
      expect(parsed.state).toBe('IL');
      expect(parsed.zip).toBe('62701');
    });

    it('should handle address with missing components', () => {
      const address = '123 Main St';
      const parsed = transactionService._parseAddress(address);

      expect(parsed.street).toBeDefined();
    });

    it('should handle multi-word city names', () => {
      const address = '456 Oak Ave, Los Angeles, CA 90001';
      const parsed = transactionService._parseAddress(address);

      expect(parsed.city).toBe('Los Angeles');
      expect(parsed.state).toBe('CA');
      expect(parsed.zip).toBe('90001');
    });
  });
});
