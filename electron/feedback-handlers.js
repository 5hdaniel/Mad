// ============================================
// USER FEEDBACK IPC HANDLERS
// For user corrections and extraction accuracy tracking
// ============================================

const { ipcMain } = require('electron');
const databaseService = require('./services/databaseService');
const feedbackLearningService = require('./services/feedbackLearningService');

/**
 * Register all feedback-related IPC handlers
 */
const registerFeedbackHandlers = () => {
  // Submit user feedback
  ipcMain.handle('feedback:submit', async (event, userId, feedbackData) => {
    try {
      const feedbackId = await databaseService.submitFeedback(userId, feedbackData);

      // Clear pattern cache for this field so new patterns are detected
      feedbackLearningService.clearCache(userId, feedbackData.field_name);

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

  // Get smart suggestion based on past patterns
  ipcMain.handle('feedback:get-suggestion', async (event, userId, fieldName, extractedValue, confidence) => {
    try {
      const suggestion = await feedbackLearningService.generateSuggestion(
        userId,
        fieldName,
        extractedValue,
        confidence
      );

      return {
        success: true,
        suggestion,
      };
    } catch (error) {
      console.error('[Main] Get suggestion failed:', error);
      return {
        success: false,
        error: error.message,
        suggestion: null,
      };
    }
  });

  // Get learning statistics for a field
  ipcMain.handle('feedback:get-learning-stats', async (event, userId, fieldName) => {
    try {
      const stats = await feedbackLearningService.getLearningStats(userId, fieldName);

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('[Main] Get learning stats failed:', error);
      return {
        success: false,
        error: error.message,
        stats: null,
      };
    }
  });
};

module.exports = {
  registerFeedbackHandlers,
};
