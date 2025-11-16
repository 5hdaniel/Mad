// ============================================
// TRANSACTION IPC HANDLERS
// This file contains transaction handlers to be registered in main.js
// ============================================

const { ipcMain } = require('electron');
const transactionService = require('./services/transactionService');

/**
 * Register all transaction-related IPC handlers
 * @param {BrowserWindow} mainWindow - Main window instance
 */
const registerTransactionHandlers = (mainWindow) => {
  // Scan and extract transactions from emails
  ipcMain.handle('transactions:scan', async (event, userId, options) => {
    try {
      console.log('[Main] Starting transaction scan for user:', userId);

      const result = await transactionService.scanAndExtractTransactions(userId, {
        ...options,
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
      const updated = await transactionService.updateTransaction(transactionId, updates);

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
      await transactionService.deleteTransaction(transactionId);

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
};

module.exports = {
  registerTransactionHandlers,
};
