/**
 * Communication Bridge
 * Manages user feedback for AI extraction corrections and learning
 */

import { ipcRenderer } from "electron";

export const feedbackBridge = {
  /**
   * Submits user feedback to improve extraction accuracy
   * @param userId - User ID submitting feedback
   * @param feedbackData - Feedback details (field, original, corrected, etc.)
   * @returns Submission result
   */
  submit: (userId: string, feedbackData: unknown) =>
    ipcRenderer.invoke("feedback:submit", userId, feedbackData),

  /**
   * Gets all feedback entries for a transaction
   * @param transactionId - Transaction ID
   * @returns Transaction feedback
   */
  getForTransaction: (transactionId: string) =>
    ipcRenderer.invoke("feedback:get-for-transaction", transactionId),

  /**
   * Gets accuracy metrics for a specific field
   * @param userId - User ID
   * @param fieldName - Field name to get metrics for (e.g., 'propertyAddress')
   * @returns Field metrics
   */
  getMetrics: (userId: string, fieldName: string) =>
    ipcRenderer.invoke("feedback:get-metrics", userId, fieldName),

  /**
   * Gets AI suggestion based on learning from past feedback
   * @param userId - User ID
   * @param fieldName - Field name
   * @param extractedValue - Currently extracted value
   * @param confidence - Confidence score (0-1)
   * @returns AI suggestion
   */
  getSuggestion: (
    userId: string,
    fieldName: string,
    extractedValue: unknown,
    confidence: number,
  ) =>
    ipcRenderer.invoke(
      "feedback:get-suggestion",
      userId,
      fieldName,
      extractedValue,
      confidence,
    ),

  /**
   * Gets learning statistics for a field (accuracy trends, improvement)
   * @param userId - User ID
   * @param fieldName - Field name
   * @returns Learning stats
   */
  getLearningStats: (userId: string, fieldName: string) =>
    ipcRenderer.invoke("feedback:get-learning-stats", userId, fieldName),

  /**
   * Records transaction feedback (approve/reject/edit) for LLM-detected transactions
   * @param userId - User ID
   * @param feedback - Transaction feedback data
   * @returns Recording result
   */
  recordTransaction: (
    userId: string,
    feedback: {
      detectedTransactionId: string;
      action: "confirm" | "reject" | "merge";
      corrections?: {
        propertyAddress?: string;
        transactionType?: string;
        addCommunications?: string[];
        removeCommunications?: string[];
      };
      modelVersion?: string;
      promptVersion?: string;
    },
  ) => ipcRenderer.invoke("feedback:record-transaction", userId, feedback),

  /**
   * Records role feedback for contact role corrections
   * @param userId - User ID
   * @param feedback - Role feedback data
   * @returns Recording result
   */
  recordRole: (
    userId: string,
    feedback: {
      transactionId: string;
      contactId: string;
      originalRole: string;
      correctedRole: string;
      modelVersion?: string;
      promptVersion?: string;
    },
  ) => ipcRenderer.invoke("feedback:record-role", userId, feedback),

  /**
   * Records communication relevance feedback
   * @param userId - User ID
   * @param feedback - Communication feedback data
   * @returns Recording result
   */
  recordRelevance: (
    userId: string,
    feedback: {
      communicationId: string;
      wasRelevant: boolean;
      correctTransactionId?: string;
      modelVersion?: string;
      promptVersion?: string;
    },
  ) => ipcRenderer.invoke("feedback:record-relevance", userId, feedback),

  /**
   * Gets aggregated feedback statistics for a user
   * @param userId - User ID
   * @returns Feedback stats
   */
  getStats: (userId: string) =>
    ipcRenderer.invoke("feedback:get-stats", userId),
};
