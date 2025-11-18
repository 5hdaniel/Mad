// ============================================
// TRANSACTION IPC HANDLERS
// This file contains transaction handlers to be registered in main.js
// ============================================

const { ipcMain } = require('electron');
const transactionService = require('./services/transactionService');
const pdfExportService = require('./services/pdfExportService');
const enhancedExportService = require('./services/enhancedExportService');

// Import validation utilities
const {
  ValidationError,
  validateUserId,
  validateTransactionId,
  validateTransactionData,
  validateProvider,
  validateFilePath,
  sanitizeObject,
} = require('./utils/validation');

/**
 * Register all transaction-related IPC handlers
 * @param {BrowserWindow} mainWindow - Main window instance
 */
const registerTransactionHandlers = (mainWindow) => {
  /**
   * Scan and extract transactions from emails
   *
   * COMPLEX IPC OPERATION - Long-Running Email Processing with Progress Updates
   * This handler scans Gmail/Outlook emails for real estate transaction data.
   * Can process thousands of emails and takes minutes to complete.
   *
   * FLOW:
   * 1. Retrieve encrypted OAuth tokens from database
   * 2. Decrypt tokens using OS keychain
   * 3. Connect to Gmail/Outlook API
   * 4. Fetch emails in batches (paginated)
   * 5. For each email: Extract transaction data using regex patterns
   * 6. Save transactions to SQLite database
   * 7. Send progress updates to renderer every N items
   *
   * PROGRESS UPDATES:
   * - Emits 'transactions:scan-progress' events to renderer
   * - Includes: processedCount, totalCount, currentItem, percentage
   * - Allows UI to show real-time progress bar
   *
   * PERFORMANCE CONSIDERATIONS:
   * - Processes emails in batches to avoid memory issues
   * - Uses streaming API calls where possible
   * - Implements retry logic for network failures
   * - Can be cancelled by user (checked between batches)
   *
   * @param {Event} event - IPC event object
   * @param {number} userId - User ID for email account lookup
   * @param {Object} options - Scan options
   * @param {string} options.provider - 'google' or 'microsoft'
   * @param {Date} [options.startDate] - Optional start date for scan range
   * @param {Date} [options.endDate] - Optional end date for scan range
   * @param {string} [options.propertyAddress] - Optional filter for specific property
   * @returns {Promise<{success: boolean, transactionsFound?: number, emailsScanned?: number, error?: string}>}
   * @emits transactions:scan-progress - Periodic progress updates during scan
   */
  ipcMain.handle('transactions:scan', async (event, userId, options) => {
    try {
      console.log('[Main] Starting transaction scan for user:', userId);

      // INPUT VALIDATION
      const validatedUserId = validateUserId(userId);
      const sanitizedOptions = sanitizeObject(options || {});

      const result = await transactionService.scanAndExtractTransactions(validatedUserId, {
        ...sanitizedOptions,
        onProgress: (progress) => {
          // Send progress updates to renderer
          if (mainWindow) {
            mainWindow.webContents.send('transactions:scan-progress', progress);
          }
        },
      });

      console.log('[Main] Transaction scan complete:', result);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] Transaction scan failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get all transactions for a user
  ipcMain.handle('transactions:get-all', async (event, userId) => {
    try {
      const transactions = await transactionService.getTransactions(userId);

      return {
        success: true,
        transactions,
      };
    } catch (error) {
      console.error('[Main] Get transactions failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Create manual transaction
  ipcMain.handle('transactions:create', async (event, userId, transactionData) => {
    try {
      // INPUT VALIDATION
      const validatedUserId = validateUserId(userId);
      const validatedData = validateTransactionData(transactionData, false);

      const transaction = await transactionService.createManualTransaction(validatedUserId, validatedData);

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      console.error('[Main] Create transaction failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get transaction details with communications
  ipcMain.handle('transactions:get-details', async (event, transactionId) => {
    try {
      const details = await transactionService.getTransactionDetails(transactionId);

      if (!details) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }

      return {
        success: true,
        transaction: details,
      };
    } catch (error) {
      console.error('[Main] Get transaction details failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Update transaction
  ipcMain.handle('transactions:update', async (event, transactionId, updates) => {
    try {
      // INPUT VALIDATION
      const validatedTransactionId = validateTransactionId(transactionId);
      const validatedUpdates = validateTransactionData(updates, true);

      const updated = await transactionService.updateTransaction(validatedTransactionId, validatedUpdates);

      return {
        success: true,
        transaction: updated,
      };
    } catch (error) {
      console.error('[Main] Update transaction failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Delete transaction
  ipcMain.handle('transactions:delete', async (event, transactionId) => {
    try {
      // INPUT VALIDATION
      const validatedTransactionId = validateTransactionId(transactionId);

      await transactionService.deleteTransaction(validatedTransactionId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Delete transaction failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Create audited transaction with contact assignments
  ipcMain.handle('transactions:create-audited', async (event, userId, transactionData) => {
    try {
      console.log('[Main] Creating audited transaction for user:', userId);
      const transaction = await transactionService.createAuditedTransaction(userId, transactionData);

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      console.error('[Main] Create audited transaction failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get transaction with contacts
  ipcMain.handle('transactions:get-with-contacts', async (event, transactionId) => {
    try {
      const transaction = await transactionService.getTransactionWithContacts(transactionId);

      if (!transaction) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }

      return {
        success: true,
        transaction,
      };
    } catch (error) {
      console.error('[Main] Get transaction with contacts failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Assign contact to transaction
  ipcMain.handle('transactions:assign-contact', async (event, transactionId, contactId, role, roleCategory, isPrimary, notes) => {
    try {
      await transactionService.assignContactToTransaction(transactionId, contactId, role, roleCategory, isPrimary, notes);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Assign contact to transaction failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Remove contact from transaction
  ipcMain.handle('transactions:remove-contact', async (event, transactionId, contactId) => {
    try {
      await transactionService.removeContactFromTransaction(transactionId, contactId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('[Main] Remove contact from transaction failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Re-analyze property (rescan emails for specific address)
  ipcMain.handle('transactions:reanalyze', async (event, userId, provider, propertyAddress, dateRange) => {
    try {
      const result = await transactionService.reanalyzeProperty(userId, provider, propertyAddress, dateRange);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] Reanalyze property failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Export transaction to PDF
  ipcMain.handle('transactions:export-pdf', async (event, transactionId, outputPath) => {
    try {
      console.log('[Main] Exporting transaction to PDF:', transactionId);

      // Get transaction details with communications
      const details = await transactionService.getTransactionDetails(transactionId);

      if (!details) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }

      // Use provided output path or generate default one
      const pdfPath = outputPath || pdfExportService.getDefaultExportPath(details);

      // Generate PDF
      const generatedPath = await pdfExportService.generateTransactionPDF(
        details,
        details.communications || [],
        pdfPath
      );

      console.log('[Main] PDF exported successfully:', generatedPath);

      return {
        success: true,
        path: generatedPath,
      };
    } catch (error) {
      console.error('[Main] PDF export failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Enhanced export with options
  ipcMain.handle('transactions:export-enhanced', async (event, transactionId, options) => {
    try {
      console.log('[Main] Enhanced export for transaction:', transactionId, options);

      // Get transaction details with communications
      const details = await transactionService.getTransactionDetails(transactionId);

      if (!details) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }

      // Export with options
      const exportPath = await enhancedExportService.exportTransaction(
        details,
        details.communications || [],
        options
      );

      console.log('[Main] Enhanced export successful:', exportPath);

      // Update export tracking in database
      const db = require('./services/databaseService');
      await db.updateTransaction(transactionId, {
        export_status: 'exported',
        export_format: options.exportFormat || 'pdf',
        last_exported_on: new Date().toISOString(),
        export_count: (details.export_count || 0) + 1,
      });

      return {
        success: true,
        path: exportPath,
      };
    } catch (error) {
      console.error('[Main] Enhanced export failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
};

module.exports = {
  registerTransactionHandlers,
};
