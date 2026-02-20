/**
 * Feedback Learning Service
 * Analyzes user corrections to detect patterns and generate smart suggestions
 */

import databaseService from "./databaseService";
import logService from "./logService";
import { UserFeedback } from "../types/models";

interface Pattern {
  type: "date_adjustment" | "substitution" | "rejection" | "number_adjustment";
  [key: string]: any;
}

interface DateAdjustmentPattern extends Pattern {
  type: "date_adjustment";
  adjustment_days: number;
  confidence: number;
  sample_size: number;
}

interface SubstitutionPattern extends Pattern {
  type: "substitution";
  from_value: string;
  to_value: string;
  frequency: number;
  sample_size: number;
}

interface RejectionPattern extends Pattern {
  type: "rejection";
  rejected_values: string[];
  sample_size: number;
}

interface NumberAdjustmentPattern extends Pattern {
  type: "number_adjustment";
  percent_adjustment: number;
  confidence: number;
  sample_size: number;
}

interface Suggestion {
  value: string | null;
  reason: string;
  confidence: number;
  isWarning?: boolean;
}

interface LearningStats {
  total_feedback: number;
  confirmations: number;
  corrections: number;
  rejections: number;
  patterns_detected: number;
  patterns: Pattern[];
}

/**
 * Accuracy statistics for a provider or prompt version
 */
export interface AccuracyStats {
  approvals: number;
  rejections: number;
  rate: number;
}

/**
 * Systematic error pattern detected in LLM feedback
 */
export interface SystematicError {
  pattern: string;
  frequency: number;
  suggestion: string;
}

/**
 * Comprehensive LLM feedback analysis results
 */
export interface LLMFeedbackAnalysis {
  accuracyByProvider: Record<string, AccuracyStats>;
  accuracyByPromptVersion: Record<string, AccuracyStats>;
  systematicErrors: SystematicError[];
  totalLLMFeedback: number;
  overallAccuracy: number;
}

class FeedbackLearningService {
  private patternCache: Map<string, Pattern[]>;

  constructor() {
    this.patternCache = new Map(); // Cache detected patterns
  }

  /**
   * Analyze past feedback to detect correction patterns
   * @param userId - User ID
   * @param fieldName - Field to analyze
   * @returns Detected patterns
   */
  async detectPatterns(userId: string, fieldName: string): Promise<Pattern[]> {
    // Check cache first
    const cacheKey = `${userId}_${fieldName}`;
    const cached = this.patternCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get recent feedback for this field
      const feedback = await databaseService.getFeedbackByField(
        userId,
        fieldName,
        50,
      );

      if (feedback.length < 3) {
        return []; // Need at least 3 corrections to detect patterns
      }

      const patterns: Pattern[] = [];

      // Pattern 1: Consistent date adjustment
      if (fieldName === "closing_date") {
        const datePattern = this._detectDateAdjustmentPattern(feedback);
        if (datePattern) patterns.push(datePattern);
      }

      // Pattern 2: Consistent value substitution
      const substitutionPattern = this._detectSubstitutionPattern(feedback);
      if (substitutionPattern) patterns.push(substitutionPattern);

      // Pattern 3: Consistent rejection of certain values
      const rejectionPattern = this._detectRejectionPattern(feedback);
      if (rejectionPattern) patterns.push(rejectionPattern);

      // Pattern 4: Number adjustment (for prices, amounts)
      if (
        fieldName === "sale_price" ||
        fieldName.includes("price") ||
        fieldName.includes("amount")
      ) {
        const numberPattern = this._detectNumberAdjustmentPattern(feedback);
        if (numberPattern) patterns.push(numberPattern);
      }

      // Cache patterns
      this.patternCache.set(cacheKey, patterns);

      return patterns;
    } catch (error) {
      logService.error("[FeedbackLearning] Pattern detection failed:", "FeedbackLearning", { error });
      return [];
    }
  }

  /**
   * Generate suggestion for a field based on patterns
   * @param userId - User ID
   * @param fieldName - Field name
   * @param extractedValue - Value extracted by system
   * @param confidence - Extraction confidence
   * @returns Suggestion object or null
   */
  async generateSuggestion(
    userId: string,
    fieldName: string,
    extractedValue: unknown,
    confidence?: number,
  ): Promise<Suggestion | null> {
    // Only suggest for medium/low confidence extractions
    if (confidence && confidence > 85) {
      return null;
    }

    const patterns = await this.detectPatterns(userId, fieldName);

    if (patterns.length === 0) {
      return null;
    }

    // Find applicable pattern
    for (const pattern of patterns) {
      const suggestion = this._applyPattern(pattern, extractedValue, fieldName);
      if (suggestion) {
        return suggestion;
      }
    }

    return null;
  }

  /**
   * Detect date adjustment pattern (e.g., user always adds 30 days)
   * @private
   */
  private _detectDateAdjustmentPattern(
    feedback: UserFeedback[],
  ): DateAdjustmentPattern | null {
    const corrections = feedback.filter(
      (f) => f.feedback_type === "correction",
    );

    if (corrections.length < 3) return null;

    const adjustments: number[] = [];

    for (const correction of corrections) {
      try {
        if (!correction.corrected_value || !correction.original_value) continue;
        const original = new Date(correction.original_value);
        const corrected = new Date(correction.corrected_value);

        if (isNaN(original.getTime()) || isNaN(corrected.getTime())) continue;

        const diffDays = Math.round(
          (corrected.getTime() - original.getTime()) / (1000 * 60 * 60 * 24),
        );
        adjustments.push(diffDays);
      } catch {
        continue;
      }
    }

    if (adjustments.length < 3) return null;

    // Check if adjustments are consistent
    const avg =
      adjustments.reduce((sum, val) => sum + val, 0) / adjustments.length;
    const variance =
      adjustments.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      adjustments.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is low, we have a pattern
    if (stdDev < 5 && Math.abs(avg) > 1) {
      return {
        type: "date_adjustment",
        adjustment_days: Math.round(avg),
        confidence: Math.max(0, 100 - stdDev * 10),
        sample_size: adjustments.length,
      };
    }

    return null;
  }

  /**
   * Detect substitution pattern (e.g., user always changes "purchase" to "sale")
   * @private
   */
  private _detectSubstitutionPattern(
    feedback: UserFeedback[],
  ): SubstitutionPattern | null {
    const corrections = feedback.filter(
      (f) => f.feedback_type === "correction",
    );

    if (corrections.length < 3) return null;

    // Count frequency of specific substitutions
    const substitutions: Record<string, number> = {};

    for (const correction of corrections) {
      if (!correction.original_value || !correction.corrected_value) continue;
      const key = `${correction.original_value} -> ${correction.corrected_value}`;
      substitutions[key] = (substitutions[key] || 0) + 1;
    }

    // Find most common substitution
    let maxCount = 0;
    let mostCommon: string = "";

    Object.entries(substitutions).forEach(([sub, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = sub;
      }
    });

    // If substitution appears in >50% of corrections, it's a pattern
    if (mostCommon && maxCount / corrections.length > 0.5) {
      const parts = mostCommon.split(" -> ");
      if (parts.length < 2) return null;
      const [original, corrected] = parts;
      return {
        type: "substitution",
        from_value: original || "",
        to_value: corrected || "",
        frequency: maxCount / corrections.length,
        sample_size: corrections.length,
      };
    }

    return null;
  }

  /**
   * Detect rejection pattern (e.g., user always rejects certain values)
   * @private
   */
  private _detectRejectionPattern(
    feedback: UserFeedback[],
  ): RejectionPattern | null {
    const rejections = feedback.filter((f) => f.feedback_type === "rejection");

    if (rejections.length < 2) return null;

    // Find common values that get rejected
    const rejectedValues: Record<string, number> = {};

    for (const rejection of rejections) {
      const key = rejection.original_value || "unknown";
      rejectedValues[key] = (rejectedValues[key] || 0) + 1;
    }

    const frequentlyRejected = Object.entries(rejectedValues)
      .filter(([, count]) => count >= 2)
      .map(([value]) => value);

    if (frequentlyRejected.length > 0) {
      return {
        type: "rejection",
        rejected_values: frequentlyRejected,
        sample_size: rejections.length,
      };
    }

    return null;
  }

  /**
   * Detect number adjustment pattern (e.g., user always subtracts earnest money)
   * @private
   */
  private _detectNumberAdjustmentPattern(
    feedback: UserFeedback[],
  ): NumberAdjustmentPattern | null {
    const corrections = feedback.filter(
      (f) => f.feedback_type === "correction",
    );

    if (corrections.length < 3) return null;

    const adjustments: Array<{ absolute: number; percent: number }> = [];

    for (const correction of corrections) {
      try {
        if (!correction.corrected_value || !correction.original_value) continue;
        const original = parseFloat(
          correction.original_value.replace(/[^0-9.-]/g, ""),
        );
        const corrected = parseFloat(
          correction.corrected_value.replace(/[^0-9.-]/g, ""),
        );

        if (isNaN(original) || isNaN(corrected)) continue;

        const diff = corrected - original;
        const percentDiff = (diff / original) * 100;

        adjustments.push({ absolute: diff, percent: percentDiff });
      } catch {
        continue;
      }
    }

    if (adjustments.length < 3) return null;

    // Check for consistent percentage adjustment
    const avgPercent =
      adjustments.reduce((sum, val) => sum + val.percent, 0) /
      adjustments.length;
    const variance =
      adjustments.reduce(
        (sum, val) => sum + Math.pow(val.percent - avgPercent, 2),
        0,
      ) / adjustments.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 10 && Math.abs(avgPercent) > 1) {
      return {
        type: "number_adjustment",
        percent_adjustment: avgPercent,
        confidence: Math.max(0, 100 - stdDev * 5),
        sample_size: adjustments.length,
      };
    }

    return null;
  }

  /**
   * Apply pattern to generate suggestion
   * @private
   */
  private _applyPattern(
    pattern: Pattern,
    extractedValue: unknown,
    _fieldName: string,
  ): Suggestion | null {
    try {
      switch (pattern.type) {
        case "date_adjustment": {
          const datePattern = pattern as DateAdjustmentPattern;
          const date = new Date(extractedValue as string | number | Date);
          if (isNaN(date.getTime())) return null;

          const adjusted = new Date(date);
          adjusted.setDate(adjusted.getDate() + datePattern.adjustment_days);

          return {
            value: adjusted.toISOString().split("T")[0], // YYYY-MM-DD format
            reason: `Based on ${datePattern.sample_size} past corrections, you typically adjust dates by ${datePattern.adjustment_days > 0 ? "+" : ""}${datePattern.adjustment_days} days`,
            confidence: datePattern.confidence,
          };
        }

        case "substitution": {
          const subPattern = pattern as SubstitutionPattern;
          if (String(extractedValue) === subPattern.from_value) {
            return {
              value: subPattern.to_value,
              reason: `You've changed "${subPattern.from_value}" to "${subPattern.to_value}" in ${Math.round(subPattern.frequency * 100)}% of past cases`,
              confidence: subPattern.frequency * 100,
            };
          }
          return null;
        }

        case "rejection": {
          const rejPattern = pattern as RejectionPattern;
          if (rejPattern.rejected_values.includes(String(extractedValue))) {
            return {
              value: null,
              reason: `You've rejected this value in past transactions`,
              confidence: 70,
              isWarning: true,
            };
          }
          return null;
        }

        case "number_adjustment": {
          const numPattern = pattern as NumberAdjustmentPattern;
          const num = parseFloat(
            String(extractedValue).replace(/[^0-9.-]/g, ""),
          );
          if (isNaN(num)) return null;

          const adjusted = num * (1 + numPattern.percent_adjustment / 100);

          return {
            value: `$${adjusted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            reason: `Based on ${numPattern.sample_size} past corrections, you typically adjust by ${numPattern.percent_adjustment > 0 ? "+" : ""}${numPattern.percent_adjustment.toFixed(1)}%`,
            confidence: numPattern.confidence,
          };
        }

        default:
          return null;
      }
    } catch (error) {
      logService.error("[FeedbackLearning] Pattern application failed:", "FeedbackLearning", { error });
      return null;
    }
  }

  /**
   * Clear pattern cache (call after new feedback is submitted)
   */
  clearCache(userId: string, fieldName: string | null = null): void {
    if (fieldName) {
      this.patternCache.delete(`${userId}_${fieldName}`);
    } else {
      // Clear all patterns for user
      for (const key of this.patternCache.keys()) {
        if (key.startsWith(`${userId}_`)) {
          this.patternCache.delete(key);
        }
      }
    }
  }

  /**
   * Get learning statistics for a field
   */
  async getLearningStats(
    userId: string,
    fieldName: string,
  ): Promise<LearningStats> {
    const feedback = await databaseService.getFeedbackByField(
      userId,
      fieldName,
      100,
    );
    const patterns = await this.detectPatterns(userId, fieldName);

    const stats: LearningStats = {
      total_feedback: feedback.length,
      confirmations: feedback.filter((f) => f.feedback_type === "confirmation")
        .length,
      corrections: feedback.filter((f) => f.feedback_type === "correction")
        .length,
      rejections: feedback.filter((f) => f.feedback_type === "rejection")
        .length,
      patterns_detected: patterns.length,
      patterns: patterns,
    };

    return stats;
  }

  // ============================================
  // LLM FEEDBACK ANALYSIS METHODS
  // ============================================

  /**
   * Parse model/prompt version from feedback original_value JSON
   * @private
   */
  private _parseMetadata(
    originalValue: string | undefined,
  ): { modelVersion?: string; promptVersion?: string; action?: string } {
    if (!originalValue) return {};
    try {
      const parsed = JSON.parse(originalValue);
      return {
        modelVersion: parsed.modelVersion,
        promptVersion: parsed.promptVersion,
        action: parsed.action,
      };
    } catch {
      return {};
    }
  }

  /**
   * Get accuracy statistics grouped by LLM provider/model
   * Analyzes feedback from llm_transaction_action field
   * @param userId - User ID to analyze
   * @returns Record of provider -> accuracy stats
   */
  async getAccuracyByProvider(
    userId: string,
  ): Promise<Record<string, AccuracyStats>> {
    try {
      // Get all LLM transaction feedback for this user
      const feedback = await databaseService.getFeedbackByField(
        userId,
        "transaction_link",
        1000,
      );

      const result: Record<string, AccuracyStats> = {};

      for (const f of feedback) {
        const metadata = this._parseMetadata(f.original_value);
        const modelVersion = metadata.modelVersion || "unknown";
        const action = metadata.action;

        if (!result[modelVersion]) {
          result[modelVersion] = { approvals: 0, rejections: 0, rate: 0 };
        }

        // transaction_approved and transaction_edited count as approvals
        if (action === "transaction_approved" || action === "transaction_edited") {
          result[modelVersion].approvals++;
        } else if (action === "transaction_rejected") {
          result[modelVersion].rejections++;
        }
      }

      // Calculate rates
      for (const stats of Object.values(result)) {
        const total = stats.approvals + stats.rejections;
        stats.rate = total > 0 ? stats.approvals / total : 0;
      }

      return result;
    } catch (error) {
      logService.error("[FeedbackLearning] getAccuracyByProvider failed:", "FeedbackLearning", { error });
      return {};
    }
  }

  /**
   * Get accuracy statistics grouped by prompt version
   * Analyzes feedback from llm_transaction_action field
   * @param userId - User ID to analyze
   * @returns Record of prompt version -> accuracy stats
   */
  async getAccuracyByPromptVersion(
    userId: string,
  ): Promise<Record<string, AccuracyStats>> {
    try {
      // Get all LLM transaction feedback for this user
      const feedback = await databaseService.getFeedbackByField(
        userId,
        "transaction_link",
        1000,
      );

      const result: Record<string, AccuracyStats> = {};

      for (const f of feedback) {
        const metadata = this._parseMetadata(f.original_value);
        const promptVersion = metadata.promptVersion || "unknown";
        const action = metadata.action;

        if (!result[promptVersion]) {
          result[promptVersion] = { approvals: 0, rejections: 0, rate: 0 };
        }

        // transaction_approved and transaction_edited count as approvals
        if (action === "transaction_approved" || action === "transaction_edited") {
          result[promptVersion].approvals++;
        } else if (action === "transaction_rejected") {
          result[promptVersion].rejections++;
        }
      }

      // Calculate rates
      for (const stats of Object.values(result)) {
        const total = stats.approvals + stats.rejections;
        stats.rate = total > 0 ? stats.approvals / total : 0;
      }

      return result;
    } catch (error) {
      logService.error("[FeedbackLearning] getAccuracyByPromptVersion failed:", "FeedbackLearning", { error });
      return {};
    }
  }

  /**
   * Identify systematic errors in LLM feedback
   * Analyzes rejection patterns to find common failure modes
   * @param userId - User ID to analyze
   * @returns Array of systematic error patterns with suggestions
   */
  async identifySystematicErrors(userId: string): Promise<SystematicError[]> {
    try {
      // Get all LLM transaction feedback for this user
      const feedback = await databaseService.getFeedbackByField(
        userId,
        "transaction_link",
        1000,
      );

      // Filter to rejections only (check metadata for dbFeedbackType or action)
      const rejections = feedback.filter((f) => {
        // Check original_value metadata for rejection indicators
        try {
          if (f.original_value) {
            const metadata = JSON.parse(f.original_value);
            return metadata.dbFeedbackType === "rejection" || metadata.action === "transaction_rejected";
          }
        } catch {
          // Ignore parse errors
        }
        return false;
      });

      if (rejections.length === 0) {
        return [];
      }

      // Count patterns in corrected_value (contains rejection reasons/corrections)
      const patternCounts: Record<string, number> = {};

      for (const rejection of rejections) {
        try {
          if (!rejection.corrected_value) continue;

          const data = JSON.parse(rejection.corrected_value);
          // Look for reason field or other pattern indicators
          const pattern = data.reason || data.rejectionReason || "unknown_reason";

          patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        } catch {
          // If corrected_value is not JSON, use it directly as pattern
          if (rejection.corrected_value) {
            const pattern = rejection.corrected_value;
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
          }
        }
      }

      // Convert to array and filter for patterns that appear more than once
      const errors: SystematicError[] = [];

      for (const [pattern, frequency] of Object.entries(patternCounts)) {
        if (frequency > 1 && pattern !== "unknown_reason") {
          errors.push({
            pattern,
            frequency,
            suggestion: `Review detection logic for: ${pattern}`,
          });
        }
      }

      // Sort by frequency descending
      errors.sort((a, b) => b.frequency - a.frequency);

      // Limit to top 10
      return errors.slice(0, 10);
    } catch (error) {
      logService.error("[FeedbackLearning] identifySystematicErrors failed:", "FeedbackLearning", { error });
      return [];
    }
  }

  /**
   * Get comprehensive LLM feedback analysis
   * Combines all analysis methods into a single report
   * @param userId - User ID to analyze
   * @returns Complete LLM feedback analysis
   */
  async getLLMFeedbackAnalysis(userId: string): Promise<LLMFeedbackAnalysis> {
    try {
      const [byProvider, byPromptVersion, systematicErrors] = await Promise.all([
        this.getAccuracyByProvider(userId),
        this.getAccuracyByPromptVersion(userId),
        this.identifySystematicErrors(userId),
      ]);

      // Calculate totals from provider stats
      let totalApprovals = 0;
      let totalRejections = 0;
      for (const stats of Object.values(byProvider)) {
        totalApprovals += stats.approvals;
        totalRejections += stats.rejections;
      }

      const totalLLMFeedback = totalApprovals + totalRejections;

      return {
        accuracyByProvider: byProvider,
        accuracyByPromptVersion: byPromptVersion,
        systematicErrors,
        totalLLMFeedback,
        overallAccuracy: totalLLMFeedback > 0 ? totalApprovals / totalLLMFeedback : 0,
      };
    } catch (error) {
      logService.error("[FeedbackLearning] getLLMFeedbackAnalysis failed:", "FeedbackLearning", { error });
      return {
        accuracyByProvider: {},
        accuracyByPromptVersion: {},
        systematicErrors: [],
        totalLLMFeedback: 0,
        overallAccuracy: 0,
      };
    }
  }
}

export default new FeedbackLearningService();
