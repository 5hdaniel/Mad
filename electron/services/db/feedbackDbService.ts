/**
 * User Feedback Database Service
 * Handles all user feedback-related database operations
 */

import crypto from "crypto";
import type { UserFeedback } from "../../types";
import { DatabaseError } from "../../types";
import { dbGet, dbAll, dbRun } from "./core/dbConnection";

/**
 * Save user feedback on extracted data
 */
export async function saveFeedback(
  feedbackData: Omit<UserFeedback, "id" | "created_at">,
): Promise<UserFeedback> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO user_feedback (
      id, user_id, transaction_id, communication_id, feedback_type,
      field_name, original_value, corrected_value, feedback_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    feedbackData.user_id,
    feedbackData.transaction_id || null,
    feedbackData.communication_id || null,
    feedbackData.feedback_type,
    feedbackData.field_name || null,
    feedbackData.original_value || null,
    feedbackData.corrected_value || null,
    feedbackData.feedback_text || null,
  ];

  dbRun(sql, params);

  const feedback = dbGet<UserFeedback>(
    "SELECT * FROM user_feedback WHERE id = ?",
    [id],
  );
  if (!feedback) {
    throw new DatabaseError("Failed to save feedback");
  }

  return feedback;
}

/**
 * Get all feedback for a transaction
 */
export async function getFeedbackByTransaction(
  transactionId: string,
): Promise<UserFeedback[]> {
  const sql = `
    SELECT * FROM user_feedback
    WHERE transaction_id = ?
    ORDER BY created_at DESC
  `;

  return dbAll<UserFeedback>(sql, [transactionId]);
}

/**
 * Get feedback by field name
 */
export async function getFeedbackByField(
  userId: string,
  fieldName: string,
  limit: number = 100,
): Promise<UserFeedback[]> {
  const sql = `
    SELECT * FROM user_feedback
    WHERE user_id = ? AND field_name = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;

  return dbAll<UserFeedback>(sql, [userId, fieldName, limit]);
}

/**
 * Get all feedback for a user
 */
export async function getFeedbackByUser(
  userId: string,
  limit: number = 100,
): Promise<UserFeedback[]> {
  const sql = `
    SELECT * FROM user_feedback
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `;

  return dbAll<UserFeedback>(sql, [userId, limit]);
}

/**
 * Get feedback by ID
 */
export async function getFeedbackById(
  feedbackId: string,
): Promise<UserFeedback | null> {
  const sql = "SELECT * FROM user_feedback WHERE id = ?";
  const feedback = dbGet<UserFeedback>(sql, [feedbackId]);
  return feedback || null;
}

/**
 * Delete feedback
 */
export async function deleteFeedback(feedbackId: string): Promise<void> {
  const sql = "DELETE FROM user_feedback WHERE id = ?";
  dbRun(sql, [feedbackId]);
}
