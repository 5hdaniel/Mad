// ============================================
// USER FEEDBACK IPC HANDLERS
// For user corrections and extraction accuracy tracking
// ============================================

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import databaseService from './services/databaseService';

// Services (still JS - to be migrated)
const feedbackLearningService = require('./services/feedbackLearningService');

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  validateTransactionId,
  validateString,
  sanitizeObject,
} from './utils/validation';

// Type definitions
interface FeedbackResponse {
  success: boolean;
  error?: string;
  feedbackId?: string;
  feedback?: unknown[];
  metrics?: unknown[];
  suggestion?: unknown;
  stats?: unknown;
}

/**
 * Register all feedback-related IPC handlers
 */
export const registerFeedbackHandlers = (): void => {
  // Submit user feedback
  ipcMain.handle('feedback:submit', async (event: IpcMainInvokeEvent, userId: string, feedbackData: unknown): Promise<FeedbackResponse> => {
    try {
      // Validate inputs
      const validatedUserId = validateUserId(userId);

      // Validate feedback data object
      if (!feedbackData || typeof feedbackData !== 'object') {
        throw new ValidationError('Feedback data must be an object', 'feedbackData');
      }

      const sanitizedData = sanitizeObject(feedbackData);

      // Validate required fields in feedback data
      if ((sanitizedData as any).field_name) {
        (sanitizedData as any).field_name = validateString((sanitizedData as any).field_name, 'field_name', {
          required: false,
          maxLength: 100,
        });
      }

      const feedbackId = await databaseService.submitFeedback(validatedUserId, sanitizedData);

      // Clear pattern cache for this field so new patterns are detected
      if ((sanitizedData as any).field_name) {
        feedbackLearningService.clearCache(validatedUserId, (sanitizedData as any).field_name);
      }

      return {
        success: true,
        feedbackId,
      };
    } catch (error) {
      console.error('[Main] Submit feedback failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get feedback for a transaction
  ipcMain.handle('feedback:get-for-transaction', async (event: IpcMainInvokeEvent, transactionId: string): Promise<FeedbackResponse> => {
    try {
      // Validate input
      const validatedTransactionId = validateTransactionId(transactionId);

      const feedback = await databaseService.getFeedbackForTransaction(validatedTransactionId);

      return {
        success: true,
        feedback,
      };
    } catch (error) {
      console.error('[Main] Get feedback failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
          feedback: [],
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        feedback: [],
      };
    }
  });

  // Get extraction metrics
  ipcMain.handle('feedback:get-metrics', async (event: IpcMainInvokeEvent, userId: string, fieldName: string | null = null): Promise<FeedbackResponse> => {
    try {
      // Validate inputs
      const validatedUserId = validateUserId(userId);

      // Validate fieldName (optional)
      const validatedFieldName = fieldName
        ? validateString(fieldName, 'fieldName', {
            required: false,
            maxLength: 100,
          })
        : null;

      const metrics = await databaseService.getExtractionMetrics(
        validatedUserId,
        validatedFieldName
      );

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error('[Main] Get extraction metrics failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
          metrics: [],
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: [],
      };
    }
  });

  // Get smart suggestion based on past patterns
  ipcMain.handle('feedback:get-suggestion', async (
    event: IpcMainInvokeEvent,
    userId: string,
    fieldName: string,
    extractedValue: string,
    confidence: number | null
  ): Promise<FeedbackResponse> => {
    try {
      // Validate inputs
      const validatedUserId = validateUserId(userId);

      const validatedFieldName = validateString(fieldName, 'fieldName', {
        required: true,
        maxLength: 100,
      });

      const validatedExtractedValue = validateString(extractedValue, 'extractedValue', {
        required: false,
        maxLength: 1000,
      });

      // Validate confidence (should be a number between 0 and 1)
      let validatedConfidence = confidence;
      if (confidence !== null && confidence !== undefined) {
        const confNum = Number(confidence);
        if (isNaN(confNum) || confNum < 0 || confNum > 1) {
          throw new ValidationError('Confidence must be a number between 0 and 1', 'confidence');
        }
        validatedConfidence = confNum;
      }

      const suggestion = await feedbackLearningService.generateSuggestion(
        validatedUserId,
        validatedFieldName,
        validatedExtractedValue,
        validatedConfidence
      );

      return {
        success: true,
        suggestion,
      };
    } catch (error) {
      console.error('[Main] Get suggestion failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
          suggestion: null,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: null,
      };
    }
  });

  // Get learning statistics for a field
  ipcMain.handle('feedback:get-learning-stats', async (event: IpcMainInvokeEvent, userId: string, fieldName: string): Promise<FeedbackResponse> => {
    try {
      // Validate inputs
      const validatedUserId = validateUserId(userId);

      const validatedFieldName = validateString(fieldName, 'fieldName', {
        required: true,
        maxLength: 100,
      });

      const stats = await feedbackLearningService.getLearningStats(
        validatedUserId,
        validatedFieldName
      );

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('[Main] Get learning stats failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
          stats: null,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: null,
      };
    }
  });
};
