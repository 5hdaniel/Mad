/**
 * Feedback Service
 *
 * Service abstraction for AI feedback and learning-related API calls.
 * Centralizes all window.api.feedback calls and provides type-safe wrappers.
 */

import { type ApiResult, getErrorMessage } from "./index";

/**
 * Transaction feedback action
 */
export type TransactionFeedbackAction = "confirm" | "reject" | "merge";

/**
 * Transaction feedback payload
 */
export interface TransactionFeedback {
  detectedTransactionId: string;
  action: TransactionFeedbackAction;
  corrections?: {
    propertyAddress?: string;
    transactionType?: string;
    addCommunications?: string[];
    removeCommunications?: string[];
    reason?: string;
  };
  modelVersion?: string;
  promptVersion?: string;
}

/**
 * Role feedback payload
 */
export interface RoleFeedback {
  transactionId: string;
  contactId: string;
  originalRole: string;
  correctedRole: string;
  modelVersion?: string;
  promptVersion?: string;
}

/**
 * Relevance feedback payload
 */
export interface RelevanceFeedback {
  communicationId: string;
  wasRelevant: boolean;
  correctTransactionId?: string;
  modelVersion?: string;
  promptVersion?: string;
}

/**
 * Feedback metrics
 */
export interface FeedbackMetrics {
  totalFeedback: number;
  confirmations: number;
  corrections: number;
  rejections: number;
  accuracyRate: number;
}

/**
 * Feedback suggestion
 */
export interface FeedbackSuggestion {
  shouldShowWarning: boolean;
  suggestedValue?: string;
  reason?: string;
}

/**
 * Learning statistics
 */
export interface LearningStats {
  totalSamples: number;
  averageAccuracy: number;
  commonCorrections: Array<{ from: string; to: string; count: number }>;
}

/**
 * Feedback Service
 * Provides a clean abstraction over window.api.feedback
 */
export const feedbackService = {
  /**
   * Submit general feedback
   */
  async submit(
    userId: string,
    feedbackData: Record<string, unknown>
  ): Promise<ApiResult<{ feedbackId?: string }>> {
    try {
      const result = await window.api.feedback.submit(userId, feedbackData);
      if (result.success) {
        return { success: true, data: { feedbackId: result.feedbackId } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get feedback for a specific transaction
   */
  async getForTransaction(transactionId: string): Promise<ApiResult<unknown[]>> {
    try {
      const result = await window.api.feedback.getForTransaction(transactionId);
      if (result.success) {
        return { success: true, data: result.feedback || [] };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get feedback metrics for a user
   */
  async getMetrics(
    userId: string,
    fieldName: string
  ): Promise<ApiResult<unknown>> {
    try {
      const result = await window.api.feedback.getMetrics(userId, fieldName);
      if (result.success) {
        return { success: true, data: result.metrics };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get a suggestion based on feedback history
   */
  async getSuggestion(
    userId: string,
    fieldName: string,
    extractedValue: unknown,
    confidence: number
  ): Promise<ApiResult<{ suggestion?: unknown; confidence?: number }>> {
    try {
      const result = await window.api.feedback.getSuggestion(
        userId,
        fieldName,
        extractedValue,
        confidence
      );
      if (result.success) {
        return {
          success: true,
          data: {
            suggestion: result.suggestion,
            confidence: result.confidence,
          },
        };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get learning statistics for a field
   */
  async getLearningStats(
    userId: string,
    fieldName: string
  ): Promise<ApiResult<unknown>> {
    try {
      const result = await window.api.feedback.getLearningStats(userId, fieldName);
      if (result.success) {
        return { success: true, data: result.stats };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Record transaction detection feedback
   */
  async recordTransaction(
    userId: string,
    feedback: TransactionFeedback
  ): Promise<ApiResult> {
    try {
      const result = await window.api.feedback.recordTransaction(userId, feedback);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Record role assignment feedback
   */
  async recordRole(userId: string, feedback: RoleFeedback): Promise<ApiResult> {
    try {
      const result = await window.api.feedback.recordRole(userId, feedback);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Record message relevance feedback
   */
  async recordRelevance(
    userId: string,
    feedback: RelevanceFeedback
  ): Promise<ApiResult> {
    try {
      const result = await window.api.feedback.recordRelevance(userId, feedback);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get overall feedback statistics
   */
  async getStats(userId: string): Promise<ApiResult<unknown>> {
    try {
      const result = await window.api.feedback.getStats(userId);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export default feedbackService;
