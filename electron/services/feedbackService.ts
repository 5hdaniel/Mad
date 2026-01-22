/**
 * Feedback Service for LLM Corrections
 *
 * Captures and stores user corrections to AI-detected transactions,
 * including transaction approvals/rejections, role corrections,
 * and communication relevance feedback.
 *
 * This service adapts to the existing user_feedback table schema:
 * - Uses field_name to distinguish LLM feedback types
 * - Uses feedback_type (correction/confirmation/rejection) for action type
 * - Stores complex data as JSON in original_value/corrected_value
 * - Stores model/prompt version in user_notes as JSON
 */

import crypto from "crypto";
import databaseService from "./databaseService";

// ============================================
// TYPES
// ============================================

/**
 * LLM-specific feedback categories stored in field_name column
 */
export type LLMFeedbackCategory =
  | "llm_transaction_action" // Transaction approve/reject/edit
  | "llm_contact_role" // Contact role corrections
  | "llm_communication"; // Communication relevance

/**
 * Detailed action types for analytics
 * Stored in original_value JSON
 */
export type LLMFeedbackAction =
  | "transaction_approved"
  | "transaction_rejected"
  | "transaction_edited"
  | "contact_role_corrected"
  | "communication_unlinked"
  | "communication_added";

/**
 * Transaction feedback input
 */
export interface TransactionFeedback {
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
}

/**
 * Role feedback input
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
 * Communication feedback input
 */
export interface CommunicationFeedback {
  communicationId: string;
  wasRelevant: boolean;
  correctTransactionId?: string;
  modelVersion?: string;
  promptVersion?: string;
}

/**
 * Aggregated feedback statistics
 */
export interface FeedbackStats {
  totalFeedback: number;
  transactionApprovals: number;
  transactionRejections: number;
  transactionEdits: number;
  roleCorrections: number;
  communicationUnlinks: number;
  communicationAdds: number;
  approvalRate: number;
  correctionRate: number;
}

/**
 * Internal structure for stored feedback metadata
 */
interface FeedbackMetadata {
  action?: LLMFeedbackAction;
  modelVersion?: string;
  promptVersion?: string;
  [key: string]: unknown;
}

// ============================================
// FEEDBACK SERVICE CLASS
// ============================================

export class FeedbackService {
  /**
   * Record feedback for a transaction action (approve/reject/edit)
   *
   * Maps to existing schema:
   * - field_name: "llm_transaction_action"
   * - feedback_type: "confirmation" for approve, "rejection" for reject, "correction" for edit
   * - original_value: JSON with action details and model/prompt version
   * - corrected_value: JSON with corrections (if any)
   */
  async recordTransactionFeedback(
    userId: string,
    feedback: TransactionFeedback
  ): Promise<string> {
    const id = crypto.randomUUID();

    // Determine the database feedback_type based on action
    let feedbackType: "correction" | "confirmation" | "rejection";
    let actionType: LLMFeedbackAction;

    if (feedback.action === "confirm") {
      if (feedback.corrections && Object.keys(feedback.corrections).length > 0) {
        feedbackType = "correction";
        actionType = "transaction_edited";
      } else {
        feedbackType = "confirmation";
        actionType = "transaction_approved";
      }
    } else {
      feedbackType = "rejection";
      actionType = "transaction_rejected";
    }

    // Build metadata for original_value
    const metadata: FeedbackMetadata = {
      action: actionType,
      modelVersion: feedback.modelVersion,
      promptVersion: feedback.promptVersion,
    };

    // Store using existing databaseService
    await databaseService.saveFeedback({
      user_id: userId,
      transaction_id: feedback.detectedTransactionId,
      field_name: "llm_transaction_action",
      feedback_type: feedbackType,
      original_value: JSON.stringify(metadata),
      corrected_value: feedback.corrections
        ? JSON.stringify(feedback.corrections)
        : undefined,
    });

    return id;
  }

  /**
   * Record feedback for a contact role correction
   *
   * Maps to existing schema:
   * - field_name: "llm_contact_role"
   * - feedback_type: "correction"
   * - original_value: JSON with original role and metadata
   * - corrected_value: corrected role string
   */
  async recordRoleFeedback(
    userId: string,
    feedback: RoleFeedback
  ): Promise<string> {
    const id = crypto.randomUUID();

    const metadata: FeedbackMetadata = {
      action: "contact_role_corrected",
      contactId: feedback.contactId,
      originalRole: feedback.originalRole,
      modelVersion: feedback.modelVersion,
      promptVersion: feedback.promptVersion,
    };

    await databaseService.saveFeedback({
      user_id: userId,
      transaction_id: feedback.transactionId,
      field_name: "llm_contact_role",
      feedback_type: "correction",
      original_value: JSON.stringify(metadata),
      corrected_value: feedback.correctedRole,
    });

    return id;
  }

  /**
   * Record feedback for communication relevance
   *
   * Maps to existing schema:
   * - field_name: "llm_communication"
   * - feedback_type: "confirmation" if wasRelevant=true (added), "rejection" if false (unlinked)
   * - original_value: JSON with communication details and metadata
   * - corrected_value: correct transaction ID (if provided)
   */
  async recordCommunicationFeedback(
    userId: string,
    feedback: CommunicationFeedback
  ): Promise<string> {
    const id = crypto.randomUUID();

    const actionType: LLMFeedbackAction = feedback.wasRelevant
      ? "communication_added"
      : "communication_unlinked";

    const feedbackType: "confirmation" | "rejection" = feedback.wasRelevant
      ? "confirmation"
      : "rejection";

    const metadata: FeedbackMetadata = {
      action: actionType,
      communicationId: feedback.communicationId,
      wasRelevant: feedback.wasRelevant,
      modelVersion: feedback.modelVersion,
      promptVersion: feedback.promptVersion,
    };

    await databaseService.saveFeedback({
      user_id: userId,
      transaction_id: feedback.correctTransactionId,
      communication_id: feedback.communicationId,
      field_name: "llm_communication",
      feedback_type: feedbackType,
      original_value: JSON.stringify(metadata),
      corrected_value: feedback.correctTransactionId || undefined,
    });

    return id;
  }

  /**
   * Get aggregated feedback statistics for a user
   *
   * Queries user_feedback table filtering by LLM-specific field_names
   * and parses the JSON original_value to extract action types.
   */
  async getFeedbackStats(userId: string): Promise<FeedbackStats> {
    // Get all LLM-related feedback for this user
    const llmFieldNames = [
      "llm_transaction_action",
      "llm_contact_role",
      "llm_communication",
    ];

    const stats: FeedbackStats = {
      totalFeedback: 0,
      transactionApprovals: 0,
      transactionRejections: 0,
      transactionEdits: 0,
      roleCorrections: 0,
      communicationUnlinks: 0,
      communicationAdds: 0,
      approvalRate: 0,
      correctionRate: 0,
    };

    // Query feedback for each field type
    for (const fieldName of llmFieldNames) {
      const feedbackList = await databaseService.getFeedbackByField(
        userId,
        fieldName,
        1000 // Get up to 1000 records for stats
      );

      for (const feedback of feedbackList) {
        stats.totalFeedback++;

        // Parse the action from original_value JSON
        try {
          const metadata = feedback.original_value
            ? JSON.parse(feedback.original_value)
            : {};
          const action = metadata.action as LLMFeedbackAction | undefined;

          switch (action) {
            case "transaction_approved":
              stats.transactionApprovals++;
              break;
            case "transaction_rejected":
              stats.transactionRejections++;
              break;
            case "transaction_edited":
              stats.transactionEdits++;
              break;
            case "contact_role_corrected":
              stats.roleCorrections++;
              break;
            case "communication_unlinked":
              stats.communicationUnlinks++;
              break;
            case "communication_added":
              stats.communicationAdds++;
              break;
            default:
              // Action not found in metadata, use fallback logic
              this.countByFeedbackType(stats, fieldName, feedback.feedback_type);
              break;
          }
        } catch {
          // If JSON parsing fails, count based on feedback_type and field_name
          this.countByFeedbackType(stats, fieldName, feedback.feedback_type);
        }
      }
    }

    // Calculate rates
    const totalTransactions =
      stats.transactionApprovals +
      stats.transactionRejections +
      stats.transactionEdits;

    if (totalTransactions > 0) {
      stats.approvalRate =
        (stats.transactionApprovals + stats.transactionEdits) / totalTransactions;
      stats.correctionRate = stats.transactionEdits / totalTransactions;
    }

    return stats;
  }

  /**
   * Helper method to count feedback by type when action metadata is unavailable
   * @private
   */
  private countByFeedbackType(
    stats: FeedbackStats,
    fieldName: string,
    feedbackType: string
  ): void {
    if (fieldName === "llm_transaction_action") {
      if (feedbackType === "confirmation") {
        stats.transactionApprovals++;
      } else if (feedbackType === "rejection") {
        stats.transactionRejections++;
      } else {
        stats.transactionEdits++;
      }
    } else if (fieldName === "llm_contact_role") {
      stats.roleCorrections++;
    } else if (fieldName === "llm_communication") {
      if (feedbackType === "confirmation") {
        stats.communicationAdds++;
      } else {
        stats.communicationUnlinks++;
      }
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

let _instance: FeedbackService | null = null;

/**
 * Get the FeedbackService singleton instance
 */
export function getFeedbackService(): FeedbackService {
  if (!_instance) {
    _instance = new FeedbackService();
  }
  return _instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetFeedbackService(): void {
  _instance = null;
}

export default getFeedbackService();
