/**
 * Confidence Aggregator Service
 * TASK-322: Combines pattern matching and LLM confidence scores
 *
 * This service aggregates confidence scores from different extraction methods
 * and provides:
 * - Weighted combination of pattern and LLM confidence
 * - Categorical levels (high/medium/low) for UI display
 * - Threshold-based decision making
 * - UI helper methods (colors, labels)
 *
 * Key principles:
 * - Pattern matching uses 0-100 scale, LLM uses 0-1 - normalize!
 * - LLM weighted 60%, Pattern weighted 40%
 * - Agreement bonus (+15%) when both methods classify same way
 * - Single-method penalty (-10%) when only one source available
 */

// ============================================================================
// Types
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AggregatedConfidence {
  score: number; // 0-1 normalized
  level: ConfidenceLevel;
  components: {
    pattern: number | null;
    llm: number | null;
    agreement: boolean;
  };
  explanation: string;
}

export interface ConfidenceThresholds {
  high: number; // e.g., 0.8
  medium: number; // e.g., 0.5
  // Below medium = low
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  high: 0.8,
  medium: 0.5,
};

// ============================================================================
// Service Implementation
// ============================================================================

export class ConfidenceAggregatorService {
  private thresholds: ConfidenceThresholds;

  // Weight factors for different scenarios
  private readonly WEIGHTS = {
    llmWeight: 0.6, // LLM typically more accurate
    patternWeight: 0.4, // Pattern matching as baseline
    agreementBonus: 0.15, // Bonus when both agree
    singleMethodPenalty: 0.1, // Penalty when only one method available
  };

  constructor(thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = { ...thresholds };
  }

  /**
   * Aggregate confidence scores from pattern and LLM analysis
   *
   * @param patternConfidence - Pattern matching confidence (0-100 scale from extractor)
   * @param llmConfidence - LLM confidence (0-1 scale)
   * @param agreement - Whether both methods classified the same way
   */
  aggregate(
    patternConfidence: number | null,
    llmConfidence: number | null,
    agreement: boolean = true
  ): AggregatedConfidence {
    // Normalize pattern confidence to 0-1
    const normalizedPattern =
      patternConfidence !== null ? patternConfidence / 100 : null;

    // Calculate base score
    let score: number;
    let explanation: string;

    if (normalizedPattern !== null && llmConfidence !== null) {
      // Both methods available - weighted combination
      score = this.combineScores(normalizedPattern, llmConfidence, agreement);
      explanation = agreement
        ? `Both methods agree (pattern: ${(normalizedPattern * 100).toFixed(0)}%, LLM: ${(llmConfidence * 100).toFixed(0)}%)`
        : `Methods disagree - weighted average applied`;
    } else if (llmConfidence !== null) {
      // LLM only
      score = llmConfidence - this.WEIGHTS.singleMethodPenalty;
      explanation = `LLM analysis only (${(llmConfidence * 100).toFixed(0)}%)`;
    } else if (normalizedPattern !== null) {
      // Pattern only
      score = normalizedPattern - this.WEIGHTS.singleMethodPenalty;
      explanation = `Pattern matching only (${(normalizedPattern * 100).toFixed(0)}%)`;
    } else {
      // No confidence data
      score = 0;
      explanation = 'No confidence data available';
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      level: this.scoreToLevel(score),
      components: {
        pattern: normalizedPattern,
        llm: llmConfidence,
        agreement,
      },
      explanation,
    };
  }

  /**
   * Aggregate confidence for transaction detection
   * (convenience method with standard interpretation)
   */
  aggregateForTransaction(
    patternResult: { isRealEstateRelated: boolean; confidence: number } | null,
    llmResult: { isRealEstateRelated: boolean; confidence: number } | null
  ): AggregatedConfidence {
    const patternConf = patternResult?.confidence ?? null;
    const llmConf = llmResult?.confidence ?? null;

    // Determine agreement on classification
    const agreement =
      patternResult !== null &&
      llmResult !== null &&
      patternResult.isRealEstateRelated === llmResult.isRealEstateRelated;

    return this.aggregate(patternConf, llmConf, agreement);
  }

  /**
   * Get the confidence level for a score
   */
  scoreToLevel(score: number): ConfidenceLevel {
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Check if confidence meets minimum threshold
   */
  meetsThreshold(score: number, minLevel: ConfidenceLevel): boolean {
    const minScore =
      minLevel === 'high'
        ? this.thresholds.high
        : minLevel === 'medium'
          ? this.thresholds.medium
          : 0;

    return score >= minScore;
  }

  /**
   * Get thresholds for display
   */
  getThresholds(): ConfidenceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds (e.g., from user preferences)
   */
  setThresholds(thresholds: Partial<ConfidenceThresholds>): void {
    if (thresholds.high !== undefined) {
      this.thresholds.high = thresholds.high;
    }
    if (thresholds.medium !== undefined) {
      this.thresholds.medium = thresholds.medium;
    }
  }

  /**
   * Get color for confidence level (for UI)
   */
  getLevelColor(level: ConfidenceLevel): string {
    switch (level) {
      case 'high':
        return '#22c55e'; // green
      case 'medium':
        return '#f59e0b'; // amber
      case 'low':
        return '#ef4444'; // red
    }
  }

  /**
   * Get display label for confidence level
   */
  getLevelLabel(level: ConfidenceLevel): string {
    switch (level) {
      case 'high':
        return 'High Confidence';
      case 'medium':
        return 'Medium Confidence';
      case 'low':
        return 'Low Confidence';
    }
  }

  // ============ Private Methods ============

  private combineScores(
    patternScore: number,
    llmScore: number,
    agreement: boolean
  ): number {
    // Weighted average
    const baseScore =
      patternScore * this.WEIGHTS.patternWeight +
      llmScore * this.WEIGHTS.llmWeight;

    // Add bonus if methods agree
    const bonus = agreement ? this.WEIGHTS.agreementBonus : 0;

    return baseScore + bonus;
  }
}

// Export singleton
export const confidenceAggregator = new ConfidenceAggregatorService();
