// ============================================
// USER FEEDBACK IPC HANDLERS
// For user corrections and extraction accuracy tracking
// ============================================

const { ipcMain } = require('electron');
const databaseService = require('./services/databaseService');

/**
 * Register all feedback-related IPC handlers
 */
const registerFeedbackHandlers = () => {
  // Submit user feedback
  ipcMain.handle('feedback:submit', async (event, userId, feedbackData) => {
    try {
      const feedbackId = await databaseService.submitFeedback(userId, feedbackData);

      return {
        success: true,
        feedbackId,
      };
    } catch (error) {
      console.error('[Main] Submit feedback failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get feedback for a transaction
  ipcMain.handle('feedback:get-for-transaction', async (event, transactionId) => {
    try {
      const feedback = await databaseService.getFeedbackForTransaction(transactionId);

      return {
        success: true,
        feedback,
      };
    } catch (error) {
      console.error('[Main] Get feedback failed:', error);
      return {
        success: false,
        error: error.message,
        feedback: [],
      };
    }
  });

  // Get extraction metrics
  ipcMain.handle('feedback:get-metrics', async (event, userId, fieldName = null) => {
    try {
      const metrics = await databaseService.getExtractionMetrics(userId, fieldName);

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error('[Main] Get extraction metrics failed:', error);
      return {
        success: false,
        error: error.message,
        metrics: [],
      };
    }
  });
};

module.exports = {
  registerFeedbackHandlers,
};
