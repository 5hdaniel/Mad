/**
 * Transaction Handlers Tests
 * Tests for IPC handlers in transaction-handlers.js
 */

const { ipcMain } = require('electron');

// Mock dependencies
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

jest.mock('../services/transactionService', () => ({
  scanAndExtractTransactions: jest.fn(),
  getTransactions: jest.fn(),
  createManualTransaction: jest.fn(),
  getTransactionDetails: jest.fn(),
  updateTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
}));

jest.mock('../services/pdfExportService', () => ({
  exportTransactionToPDF: jest.fn(),
}));

jest.mock('../utils/validation', () => ({
  ValidationError: class ValidationError extends Error {},
  validateUserId: jest.fn((id) => id),
  validateTransactionId: jest.fn((id) => id),
  validateTransactionData: jest.fn((data) => data),
  validateProvider: jest.fn((provider) => provider),
  validateFilePath: jest.fn((path) => path),
  sanitizeObject: jest.fn((obj) => obj),
}));

const transactionService = require('../services/transactionService');
const { registerTransactionHandlers } = require('../transaction-handlers');

describe('Transaction Handlers', () => {
  let mockWindow;
  let handlers;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWindow = {
      webContents: {
        send: jest.fn(),
      },
    };

    // Capture registered handlers
    handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    // Register handlers
    registerTransactionHandlers(mockWindow);
  });

  describe('transactions:scan', () => {
    it('should scan and extract transactions successfully', async () => {
      const mockResult = {
        transactionsFound: 5,
        emailsScanned: 100,
      };

      transactionService.scanAndExtractTransactions.mockResolvedValue(mockResult);

      const result = await handlers['transactions:scan'](
        {},
        'user-123',
        { provider: 'google' }
      );

      expect(result).toEqual({
        success: true,
        ...mockResult,
      });
      expect(transactionService.scanAndExtractTransactions).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          provider: 'google',
          onProgress: expect.any(Function),
        })
      );
    });

    it('should send progress updates during scan', async () => {
      let progressCallback;

      transactionService.scanAndExtractTransactions.mockImplementation(async (userId, options) => {
        progressCallback = options.onProgress;
        progressCallback({ processed: 50, total: 100, percentage: 50 });
        return { transactionsFound: 5 };
      });

      await handlers['transactions:scan'](
        {},
        'user-123',
        { provider: 'google' }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'transactions:scan-progress',
        expect.objectContaining({ processed: 50, total: 100 })
      );
    });

    it('should handle scan errors gracefully', async () => {
      const error = new Error('Scan failed');
      transactionService.scanAndExtractTransactions.mockRejectedValue(error);

      const result = await handlers['transactions:scan'](
        {},
        'user-123',
        { provider: 'google' }
      );

      expect(result).toEqual({
        success: false,
        error: 'Scan failed',
      });
    });
  });

  describe('transactions:get-all', () => {
    it('should retrieve all transactions for a user', async () => {
      const mockTransactions = [
        { id: '1', property_address: '123 Main St' },
        { id: '2', property_address: '456 Oak Ave' },
      ];

      transactionService.getTransactions.mockResolvedValue(mockTransactions);

      const result = await handlers['transactions:get-all']({}, 'user-123');

      expect(result).toEqual({
        success: true,
        transactions: mockTransactions,
      });
    });

    it('should handle errors when retrieving transactions', async () => {
      const error = new Error('Database error');
      transactionService.getTransactions.mockRejectedValue(error);

      const result = await handlers['transactions:get-all']({}, 'user-123');

      expect(result).toEqual({
        success: false,
        error: 'Database error',
      });
    });
  });

  describe('transactions:create', () => {
    it('should create a manual transaction', async () => {
      const transactionData = {
        property_address: '789 Pine St',
        transaction_type: 'purchase',
        closing_date: '2024-03-01',
      };

      const mockTransaction = { id: 'txn-123', ...transactionData };

      transactionService.createManualTransaction.mockResolvedValue(mockTransaction);

      const result = await handlers['transactions:create'](
        {},
        'user-123',
        transactionData
      );

      expect(result).toEqual({
        success: true,
        transaction: mockTransaction,
      });
      expect(transactionService.createManualTransaction).toHaveBeenCalledWith(
        'user-123',
        transactionData
      );
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      transactionService.createManualTransaction.mockRejectedValue(error);

      const result = await handlers['transactions:create'](
        {},
        'user-123',
        { invalid: 'data' }
      );

      expect(result).toEqual({
        success: false,
        error: 'Validation failed',
      });
    });
  });

  describe('transactions:get-details', () => {
    it('should retrieve transaction details with communications', async () => {
      const mockDetails = {
        id: 'txn-123',
        property_address: '123 Main St',
        communications: [
          { id: 'comm-1', subject: 'Offer accepted' },
        ],
      };

      transactionService.getTransactionDetails.mockResolvedValue(mockDetails);

      const result = await handlers['transactions:get-details']({}, 'txn-123');

      expect(result).toEqual({
        success: true,
        details: mockDetails,
      });
    });

    it('should handle transaction not found', async () => {
      transactionService.getTransactionDetails.mockResolvedValue(null);

      const result = await handlers['transactions:get-details']({}, 'txn-123');

      expect(result).toEqual({
        success: false,
        error: 'Transaction not found',
      });
    });
  });
});
