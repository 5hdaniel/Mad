/**
 * Feedback Learning Service
 * Analyzes user corrections to detect patterns and generate smart suggestions
 */

import databaseService from './databaseService';
import { UserFeedback } from '../types/models';

interface Pattern {
  type: 'date_adjustment' | 'substitution' | 'rejection' | 'number_adjustment';
  [key: string]: any;
}

interface DateAdjustmentPattern extends Pattern {
  type: 'date_adjustment';
  adjustment_days: number;
  confidence: number;
  sample_size: number;
}

interface SubstitutionPattern extends Pattern {
  type: 'substitution';
  from_value: string;
  to_value: string;
  frequency: number;
  sample_size: number;
}

interface RejectionPattern extends Pattern {
  type: 'rejection';
  rejected_values: string[];
  sample_size: number;
}

interface NumberAdjustmentPattern extends Pattern {
  type: 'number_adjustment';
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
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    try {
      // Get recent feedback for this field
      const feedback = await databaseService.getFeedbackByField(userId, fieldName, 50);

      if (feedback.length < 3) {
        return []; // Need at least 3 corrections to detect patterns
      }

      const patterns: Pattern[] = [];

      // Pattern 1: Consistent date adjustment
      if (fieldName === 'closing_date') {
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
      if (fieldName === 'sale_price' || fieldName.includes('price') || fieldName.includes('amount')) {
        const numberPattern = this._detectNumberAdjustmentPattern(feedback);
        if (numberPattern) patterns.push(numberPattern);
      }

      // Cache patterns
      this.patternCache.set(cacheKey, patterns);

      return patterns;
    } catch (error) {
      console.error('[FeedbackLearning] Pattern detection failed:', error);
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
    confidence?: number
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
  private _detectDateAdjustmentPattern(feedback: UserFeedback[]): DateAdjustmentPattern | null {
    const corrections = feedback.filter(f => f.feedback_type === 'correction');

    if (corrections.length < 3) return null;

    const adjustments: number[] = [];

    for (const correction of corrections) {
      try {
        if (!correction.corrected_value || !correction.original_value) continue;
        const original = new Date(correction.original_value);
        const corrected = new Date(correction.corrected_value);

        if (isNaN(original.getTime()) || isNaN(corrected.getTime())) continue;

        const diffDays = Math.round((corrected.getTime() - original.getTime()) / (1000 * 60 * 60 * 24));
        adjustments.push(diffDays);
      } catch {
        continue;
      }
    }

    if (adjustments.length < 3) return null;

    // Check if adjustments are consistent
    const avg = adjustments.reduce((sum, val) => sum + val, 0) / adjustments.length;
    const variance = adjustments.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / adjustments.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is low, we have a pattern
    if (stdDev < 5 && Math.abs(avg) > 1) {
      return {
        type: 'date_adjustment',
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
  private _detectSubstitutionPattern(feedback: UserFeedback[]): SubstitutionPattern | null {
    const corrections = feedback.filter(f => f.feedback_type === 'correction');

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
    let mostCommon: string = '';

    Object.entries(substitutions).forEach(([sub, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = sub;
      }
    });

    // If substitution appears in >50% of corrections, it's a pattern
    if (mostCommon && maxCount / corrections.length > 0.5) {
      const parts = mostCommon.split(' -> ');
      if (parts.length < 2) return null;
      const [original, corrected] = parts;
      return {
        type: 'substitution',
        from_value: original || '',
        to_value: corrected || '',
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
  private _detectRejectionPattern(feedback: UserFeedback[]): RejectionPattern | null {
    const rejections = feedback.filter(f => f.feedback_type === 'rejection');

    if (rejections.length < 2) return null;

    // Find common values that get rejected
    const rejectedValues: Record<string, number> = {};

    for (const rejection of rejections) {
      const key = rejection.original_value || 'unknown';
      rejectedValues[key] = (rejectedValues[key] || 0) + 1;
    }

    const frequentlyRejected = Object.entries(rejectedValues)
      .filter(([, count]) => count >= 2)
      .map(([value]) => value);

    if (frequentlyRejected.length > 0) {
      return {
        type: 'rejection',
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
  private _detectNumberAdjustmentPattern(feedback: UserFeedback[]): NumberAdjustmentPattern | null {
    const corrections = feedback.filter(f => f.feedback_type === 'correction');

    if (corrections.length < 3) return null;

    const adjustments: Array<{ absolute: number; percent: number }> = [];

    for (const correction of corrections) {
      try {
        if (!correction.corrected_value || !correction.original_value) continue;
        const original = parseFloat(correction.original_value.replace(/[^0-9.-]/g, ''));
        const corrected = parseFloat(correction.corrected_value.replace(/[^0-9.-]/g, ''));

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
    const avgPercent = adjustments.reduce((sum, val) => sum + val.percent, 0) / adjustments.length;
    const variance = adjustments.reduce((sum, val) => sum + Math.pow(val.percent - avgPercent, 2), 0) / adjustments.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 10 && Math.abs(avgPercent) > 1) {
      return {
        type: 'number_adjustment',
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
  private _applyPattern(pattern: Pattern, extractedValue: unknown, _fieldName: string): Suggestion | null {
    try {
      switch (pattern.type) {
        case 'date_adjustment': {
          const datePattern = pattern as DateAdjustmentPattern;
          const date = new Date(extractedValue as string | number | Date);
          if (isNaN(date.getTime())) return null;

          const adjusted = new Date(date);
          adjusted.setDate(adjusted.getDate() + datePattern.adjustment_days);

          return {
            value: adjusted.toISOString().split('T')[0], // YYYY-MM-DD format
            reason: `Based on ${datePattern.sample_size} past corrections, you typically adjust dates by ${datePattern.adjustment_days > 0 ? '+' : ''}${datePattern.adjustment_days} days`,
            confidence: datePattern.confidence,
          };
        }

        case 'substitution': {
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

        case 'rejection': {
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

        case 'number_adjustment': {
          const numPattern = pattern as NumberAdjustmentPattern;
          const num = parseFloat(String(extractedValue).replace(/[^0-9.-]/g, ''));
          if (isNaN(num)) return null;

          const adjusted = num * (1 + numPattern.percent_adjustment / 100);

          return {
            value: `$${adjusted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            reason: `Based on ${numPattern.sample_size} past corrections, you typically adjust by ${numPattern.percent_adjustment > 0 ? '+' : ''}${numPattern.percent_adjustment.toFixed(1)}%`,
            confidence: numPattern.confidence,
          };
        }

        default:
          return null;
      }
    } catch (error) {
      console.error('[FeedbackLearning] Pattern application failed:', error);
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
  async getLearningStats(userId: string, fieldName: string): Promise<LearningStats> {
    const feedback = await databaseService.getFeedbackByField(userId, fieldName, 100);
    const patterns = await this.detectPatterns(userId, fieldName);

    const stats: LearningStats = {
      total_feedback: feedback.length,
      confirmations: feedback.filter(f => f.feedback_type === 'confirmation').length,
      corrections: feedback.filter(f => f.feedback_type === 'correction').length,
      rejections: feedback.filter(f => f.feedback_type === 'rejection').length,
      patterns_detected: patterns.length,
      patterns: patterns,
    };

    return stats;
  }
}

export default new FeedbackLearningService();
