/**
 * Unit tests for ConfidenceAggregatorService
 * TASK-322: Confidence Aggregator
 *
 * Tests cover:
 * - Both methods agree, high confidence
 * - Both methods agree, low confidence
 * - Methods disagree
 * - Pattern only
 * - LLM only
 * - Neither available
 * - Score to level conversion
 * - meetsThreshold
 * - Threshold updates
 * - Edge cases (0, 100, negative)
 * - UI helpers (colors, labels)
 * - aggregateForTransaction convenience method
 */

import {
  ConfidenceAggregatorService,
  confidenceAggregator,
} from '../confidenceAggregatorService';

describe('ConfidenceAggregatorService', () => {
  let service: ConfidenceAggregatorService;

  beforeEach(() => {
    // Create fresh instance for each test
    service = new ConfidenceAggregatorService();
  });

  // ===========================================================================
  // Both Methods Available - Agreement Tests
  // ===========================================================================

  describe('both methods agree', () => {
    it('should return high confidence when both methods agree with high scores', () => {
      // Pattern: 90 (0-100), LLM: 0.95 (0-1), agreement: true
      const result = service.aggregate(90, 0.95, true);

      // Expected: (0.9 * 0.4) + (0.95 * 0.6) + 0.15 = 0.36 + 0.57 + 0.15 = 1.08 -> capped at 1.0
      expect(result.score).toBeCloseTo(1.0, 2);
      expect(result.level).toBe('high');
      expect(result.components.pattern).toBeCloseTo(0.9, 2);
      expect(result.components.llm).toBe(0.95);
      expect(result.components.agreement).toBe(true);
      expect(result.explanation).toContain('Both methods agree');
    });

    it('should return medium confidence when both methods agree with medium scores', () => {
      // Pattern: 60 (0-100), LLM: 0.6 (0-1), agreement: true
      const result = service.aggregate(60, 0.6, true);

      // Expected: (0.6 * 0.4) + (0.6 * 0.6) + 0.15 = 0.24 + 0.36 + 0.15 = 0.75
      expect(result.score).toBeCloseTo(0.75, 2);
      expect(result.level).toBe('medium');
      expect(result.components.agreement).toBe(true);
    });

    it('should return low confidence when both methods agree with low scores', () => {
      // Pattern: 30 (0-100), LLM: 0.2 (0-1), agreement: true
      const result = service.aggregate(30, 0.2, true);

      // Expected: (0.3 * 0.4) + (0.2 * 0.6) + 0.15 = 0.12 + 0.12 + 0.15 = 0.39
      expect(result.score).toBeCloseTo(0.39, 2);
      expect(result.level).toBe('low');
      expect(result.components.agreement).toBe(true);
    });

    it('should include agreement bonus in calculation', () => {
      // Same scores with agreement=true vs agreement=false
      const withAgreement = service.aggregate(70, 0.8, true);
      const withoutAgreement = service.aggregate(70, 0.8, false);

      // Difference should be the agreement bonus (0.15)
      expect(withAgreement.score - withoutAgreement.score).toBeCloseTo(0.15, 2);
    });
  });

  // ===========================================================================
  // Both Methods Available - Disagreement Tests
  // ===========================================================================

  describe('methods disagree', () => {
    it('should return weighted average without bonus when methods disagree', () => {
      // Pattern: 80 (0-100), LLM: 0.9 (0-1), agreement: false
      const result = service.aggregate(80, 0.9, false);

      // Expected: (0.8 * 0.4) + (0.9 * 0.6) + 0 = 0.32 + 0.54 = 0.86
      expect(result.score).toBeCloseTo(0.86, 2);
      expect(result.level).toBe('high');
      expect(result.components.agreement).toBe(false);
      expect(result.explanation).toContain('Methods disagree');
    });

    it('should give higher weight to LLM when methods disagree', () => {
      // Pattern high, LLM low
      const result1 = service.aggregate(90, 0.3, false);
      // Expected: (0.9 * 0.4) + (0.3 * 0.6) = 0.36 + 0.18 = 0.54

      // Pattern low, LLM high
      const result2 = service.aggregate(30, 0.9, false);
      // Expected: (0.3 * 0.4) + (0.9 * 0.6) = 0.12 + 0.54 = 0.66

      // LLM high should result in higher overall score due to 60% weight
      expect(result2.score).toBeGreaterThan(result1.score);
    });
  });

  // ===========================================================================
  // Single Method Available Tests
  // ===========================================================================

  describe('pattern only', () => {
    it('should apply penalty when only pattern is available', () => {
      const result = service.aggregate(80, null, true);

      // Expected: 0.8 - 0.1 (penalty) = 0.7
      expect(result.score).toBeCloseTo(0.7, 2);
      expect(result.level).toBe('medium');
      expect(result.components.pattern).toBeCloseTo(0.8, 2);
      expect(result.components.llm).toBeNull();
      expect(result.explanation).toContain('Pattern matching only');
      expect(result.explanation).toContain('80%');
    });

    it('should handle high pattern confidence with penalty', () => {
      const result = service.aggregate(100, null, true);

      // Expected: 1.0 - 0.1 = 0.9
      expect(result.score).toBeCloseTo(0.9, 2);
      expect(result.level).toBe('high');
    });

    it('should handle low pattern confidence with penalty', () => {
      const result = service.aggregate(20, null, true);

      // Expected: 0.2 - 0.1 = 0.1
      expect(result.score).toBeCloseTo(0.1, 2);
      expect(result.level).toBe('low');
    });
  });

  describe('LLM only', () => {
    it('should apply penalty when only LLM is available', () => {
      const result = service.aggregate(null, 0.9, true);

      // Expected: 0.9 - 0.1 (penalty) = 0.8
      expect(result.score).toBeCloseTo(0.8, 2);
      expect(result.level).toBe('high');
      expect(result.components.pattern).toBeNull();
      expect(result.components.llm).toBe(0.9);
      expect(result.explanation).toContain('LLM analysis only');
      expect(result.explanation).toContain('90%');
    });

    it('should handle medium LLM confidence with penalty', () => {
      const result = service.aggregate(null, 0.6, true);

      // Expected: 0.6 - 0.1 = 0.5
      expect(result.score).toBeCloseTo(0.5, 2);
      expect(result.level).toBe('medium');
    });

    it('should handle low LLM confidence with penalty', () => {
      const result = service.aggregate(null, 0.15, true);

      // Expected: 0.15 - 0.1 = 0.05
      expect(result.score).toBeCloseTo(0.05, 2);
      expect(result.level).toBe('low');
    });
  });

  // ===========================================================================
  // Neither Method Available Tests
  // ===========================================================================

  describe('neither method available', () => {
    it('should return zero confidence when no data available', () => {
      const result = service.aggregate(null, null, true);

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.components.pattern).toBeNull();
      expect(result.components.llm).toBeNull();
      expect(result.explanation).toBe('No confidence data available');
    });

    it('should return zero regardless of agreement flag', () => {
      const result1 = service.aggregate(null, null, true);
      const result2 = service.aggregate(null, null, false);

      expect(result1.score).toBe(0);
      expect(result2.score).toBe(0);
    });
  });

  // ===========================================================================
  // Score to Level Conversion Tests
  // ===========================================================================

  describe('scoreToLevel', () => {
    it('should return high for scores >= 0.8', () => {
      expect(service.scoreToLevel(0.8)).toBe('high');
      expect(service.scoreToLevel(0.9)).toBe('high');
      expect(service.scoreToLevel(1.0)).toBe('high');
    });

    it('should return medium for scores >= 0.5 and < 0.8', () => {
      expect(service.scoreToLevel(0.5)).toBe('medium');
      expect(service.scoreToLevel(0.6)).toBe('medium');
      expect(service.scoreToLevel(0.79)).toBe('medium');
    });

    it('should return low for scores < 0.5', () => {
      expect(service.scoreToLevel(0)).toBe('low');
      expect(service.scoreToLevel(0.1)).toBe('low');
      expect(service.scoreToLevel(0.49)).toBe('low');
    });

    it('should handle boundary cases exactly', () => {
      expect(service.scoreToLevel(0.8)).toBe('high');
      expect(service.scoreToLevel(0.7999)).toBe('medium');
      expect(service.scoreToLevel(0.5)).toBe('medium');
      expect(service.scoreToLevel(0.4999)).toBe('low');
    });
  });

  // ===========================================================================
  // meetsThreshold Tests
  // ===========================================================================

  describe('meetsThreshold', () => {
    it('should check if score meets high threshold', () => {
      expect(service.meetsThreshold(0.9, 'high')).toBe(true);
      expect(service.meetsThreshold(0.8, 'high')).toBe(true);
      expect(service.meetsThreshold(0.79, 'high')).toBe(false);
      expect(service.meetsThreshold(0.5, 'high')).toBe(false);
    });

    it('should check if score meets medium threshold', () => {
      expect(service.meetsThreshold(0.9, 'medium')).toBe(true);
      expect(service.meetsThreshold(0.5, 'medium')).toBe(true);
      expect(service.meetsThreshold(0.49, 'medium')).toBe(false);
      expect(service.meetsThreshold(0.1, 'medium')).toBe(false);
    });

    it('should always pass low threshold (min = 0)', () => {
      expect(service.meetsThreshold(0.9, 'low')).toBe(true);
      expect(service.meetsThreshold(0.5, 'low')).toBe(true);
      expect(service.meetsThreshold(0.1, 'low')).toBe(true);
      expect(service.meetsThreshold(0, 'low')).toBe(true);
    });
  });

  // ===========================================================================
  // Threshold Configuration Tests
  // ===========================================================================

  describe('threshold configuration', () => {
    it('should return default thresholds', () => {
      const thresholds = service.getThresholds();

      expect(thresholds.high).toBe(0.8);
      expect(thresholds.medium).toBe(0.5);
    });

    it('should allow custom thresholds in constructor', () => {
      const customService = new ConfidenceAggregatorService({
        high: 0.9,
        medium: 0.6,
      });
      const thresholds = customService.getThresholds();

      expect(thresholds.high).toBe(0.9);
      expect(thresholds.medium).toBe(0.6);
    });

    it('should update thresholds via setThresholds', () => {
      service.setThresholds({ high: 0.85 });
      expect(service.getThresholds().high).toBe(0.85);
      expect(service.getThresholds().medium).toBe(0.5); // unchanged

      service.setThresholds({ medium: 0.4 });
      expect(service.getThresholds().high).toBe(0.85); // unchanged
      expect(service.getThresholds().medium).toBe(0.4);
    });

    it('should update both thresholds at once', () => {
      service.setThresholds({ high: 0.75, medium: 0.35 });

      expect(service.getThresholds().high).toBe(0.75);
      expect(service.getThresholds().medium).toBe(0.35);
    });

    it('should use updated thresholds for level calculation', () => {
      service.setThresholds({ high: 0.9, medium: 0.6 });

      // 0.85 would normally be high, but with threshold 0.9 it's medium
      expect(service.scoreToLevel(0.85)).toBe('medium');
      // 0.55 would normally be medium, but with threshold 0.6 it's low
      expect(service.scoreToLevel(0.55)).toBe('low');
    });

    it('should return a copy of thresholds (not reference)', () => {
      const thresholds = service.getThresholds();
      thresholds.high = 0.99;

      // Original should be unchanged
      expect(service.getThresholds().high).toBe(0.8);
    });
  });

  // ===========================================================================
  // Edge Cases Tests
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle pattern confidence of 0', () => {
      const result = service.aggregate(0, null, true);

      // Expected: 0 - 0.1 = -0.1 -> clamped to 0
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });

    it('should handle pattern confidence of 100', () => {
      const result = service.aggregate(100, null, true);

      // Expected: 1.0 - 0.1 = 0.9
      expect(result.score).toBeCloseTo(0.9, 2);
      expect(result.level).toBe('high');
    });

    it('should handle LLM confidence of 0', () => {
      const result = service.aggregate(null, 0, true);

      // Expected: 0 - 0.1 = -0.1 -> clamped to 0
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });

    it('should handle LLM confidence of 1', () => {
      const result = service.aggregate(null, 1, true);

      // Expected: 1.0 - 0.1 = 0.9
      expect(result.score).toBeCloseTo(0.9, 2);
      expect(result.level).toBe('high');
    });

    it('should clamp score to maximum of 1', () => {
      // High pattern + high LLM + agreement bonus could exceed 1
      const result = service.aggregate(100, 1, true);

      // (1.0 * 0.4) + (1.0 * 0.6) + 0.15 = 1.15 -> clamped to 1.0
      expect(result.score).toBe(1);
      expect(result.level).toBe('high');
    });

    it('should clamp score to minimum of 0', () => {
      // Very low scores with penalty could go negative
      const result = service.aggregate(5, null, true);

      // 0.05 - 0.1 = -0.05 -> clamped to 0
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
    });

    it('should handle both methods at 0 confidence', () => {
      const result = service.aggregate(0, 0, true);

      // Expected: (0 * 0.4) + (0 * 0.6) + 0.15 = 0.15
      expect(result.score).toBeCloseTo(0.15, 2);
      expect(result.level).toBe('low');
    });

    it('should handle both methods at 100/1 confidence', () => {
      const result = service.aggregate(100, 1, true);

      // Expected: clamped to 1.0
      expect(result.score).toBe(1);
    });

    it('should handle default agreement parameter', () => {
      // Test that agreement defaults to true
      const result = service.aggregate(70, 0.8);

      expect(result.components.agreement).toBe(true);
      // Should include agreement bonus
      expect(result.score).toBeCloseTo(
        0.7 * 0.4 + 0.8 * 0.6 + 0.15,
        2
      );
    });
  });

  // ===========================================================================
  // UI Helper Tests
  // ===========================================================================

  describe('getLevelColor', () => {
    it('should return green for high confidence', () => {
      expect(service.getLevelColor('high')).toBe('#22c55e');
    });

    it('should return amber for medium confidence', () => {
      expect(service.getLevelColor('medium')).toBe('#f59e0b');
    });

    it('should return red for low confidence', () => {
      expect(service.getLevelColor('low')).toBe('#ef4444');
    });
  });

  describe('getLevelLabel', () => {
    it('should return correct label for high confidence', () => {
      expect(service.getLevelLabel('high')).toBe('High Confidence');
    });

    it('should return correct label for medium confidence', () => {
      expect(service.getLevelLabel('medium')).toBe('Medium Confidence');
    });

    it('should return correct label for low confidence', () => {
      expect(service.getLevelLabel('low')).toBe('Low Confidence');
    });
  });

  // ===========================================================================
  // aggregateForTransaction Tests
  // ===========================================================================

  describe('aggregateForTransaction', () => {
    it('should aggregate when both results agree on classification', () => {
      const patternResult = { isRealEstateRelated: true, confidence: 80 };
      const llmResult = { isRealEstateRelated: true, confidence: 0.9 };

      const result = service.aggregateForTransaction(patternResult, llmResult);

      expect(result.components.agreement).toBe(true);
      expect(result.score).toBeGreaterThan(0.8); // Should include bonus
    });

    it('should aggregate when both results disagree on classification', () => {
      const patternResult = { isRealEstateRelated: true, confidence: 80 };
      const llmResult = { isRealEstateRelated: false, confidence: 0.9 };

      const result = service.aggregateForTransaction(patternResult, llmResult);

      expect(result.components.agreement).toBe(false);
      // No agreement bonus
      expect(result.score).toBeCloseTo(0.8 * 0.4 + 0.9 * 0.6, 2);
    });

    it('should handle pattern only result', () => {
      const patternResult = { isRealEstateRelated: true, confidence: 75 };

      const result = service.aggregateForTransaction(patternResult, null);

      expect(result.components.pattern).toBeCloseTo(0.75, 2);
      expect(result.components.llm).toBeNull();
      expect(result.components.agreement).toBe(false); // Can't agree with null
    });

    it('should handle LLM only result', () => {
      const llmResult = { isRealEstateRelated: true, confidence: 0.85 };

      const result = service.aggregateForTransaction(null, llmResult);

      expect(result.components.pattern).toBeNull();
      expect(result.components.llm).toBe(0.85);
      expect(result.components.agreement).toBe(false); // Can't agree with null
    });

    it('should handle neither result', () => {
      const result = service.aggregateForTransaction(null, null);

      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.components.pattern).toBeNull();
      expect(result.components.llm).toBeNull();
    });

    it('should correctly identify agreement when both say false', () => {
      const patternResult = { isRealEstateRelated: false, confidence: 20 };
      const llmResult = { isRealEstateRelated: false, confidence: 0.1 };

      const result = service.aggregateForTransaction(patternResult, llmResult);

      expect(result.components.agreement).toBe(true);
    });
  });

  // ===========================================================================
  // Singleton Export Tests
  // ===========================================================================

  describe('singleton export', () => {
    it('should export a default singleton instance', () => {
      expect(confidenceAggregator).toBeInstanceOf(ConfidenceAggregatorService);
    });

    it('should have default thresholds on singleton', () => {
      const thresholds = confidenceAggregator.getThresholds();

      expect(thresholds.high).toBe(0.8);
      expect(thresholds.medium).toBe(0.5);
    });

    it('should be usable without instantiating', () => {
      const result = confidenceAggregator.aggregate(70, 0.8, true);

      expect(result.score).toBeGreaterThan(0);
      expect(result.level).toBeDefined();
    });
  });

  // ===========================================================================
  // Explanation String Tests
  // ===========================================================================

  describe('explanation strings', () => {
    it('should include percentage values for both methods', () => {
      const result = service.aggregate(85, 0.75, true);

      expect(result.explanation).toContain('85%');
      expect(result.explanation).toContain('75%');
    });

    it('should include percentage for pattern only', () => {
      const result = service.aggregate(65, null, true);

      expect(result.explanation).toContain('65%');
      expect(result.explanation).toContain('Pattern matching only');
    });

    it('should include percentage for LLM only', () => {
      const result = service.aggregate(null, 0.82, true);

      expect(result.explanation).toContain('82%');
      expect(result.explanation).toContain('LLM analysis only');
    });

    it('should indicate disagreement in explanation', () => {
      const result = service.aggregate(70, 0.8, false);

      expect(result.explanation).toContain('disagree');
    });
  });

  // ===========================================================================
  // Weight Verification Tests
  // ===========================================================================

  describe('weight verification', () => {
    it('should apply 60/40 weighting correctly', () => {
      // Pattern: 100, LLM: 0 (no agreement bonus)
      const result1 = service.aggregate(100, 0, false);
      // Expected: (1.0 * 0.4) + (0 * 0.6) = 0.4

      // Pattern: 0, LLM: 1 (no agreement bonus)
      const result2 = service.aggregate(0, 1, false);
      // Expected: (0 * 0.4) + (1.0 * 0.6) = 0.6

      expect(result1.score).toBeCloseTo(0.4, 2);
      expect(result2.score).toBeCloseTo(0.6, 2);
    });

    it('should apply 15% agreement bonus correctly', () => {
      const withBonus = service.aggregate(50, 0.5, true);
      const withoutBonus = service.aggregate(50, 0.5, false);

      // Expected difference is exactly 0.15
      expect(withBonus.score - withoutBonus.score).toBeCloseTo(0.15, 5);
    });

    it('should apply 10% single-method penalty correctly', () => {
      // LLM only at 0.5 should be 0.4 after penalty
      const llmOnly = service.aggregate(null, 0.5, true);
      expect(llmOnly.score).toBeCloseTo(0.4, 2);

      // Pattern only at 50 should be 0.4 after penalty
      const patternOnly = service.aggregate(50, null, true);
      expect(patternOnly.score).toBeCloseTo(0.4, 2);
    });
  });

  // ===========================================================================
  // Result Structure Tests
  // ===========================================================================

  describe('result structure', () => {
    it('should return all required properties', () => {
      const result = service.aggregate(70, 0.8, true);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('explanation');
      expect(result.components).toHaveProperty('pattern');
      expect(result.components).toHaveProperty('llm');
      expect(result.components).toHaveProperty('agreement');
    });

    it('should return correct types for all properties', () => {
      const result = service.aggregate(70, 0.8, true);

      expect(typeof result.score).toBe('number');
      expect(['high', 'medium', 'low']).toContain(result.level);
      expect(typeof result.explanation).toBe('string');
      expect(typeof result.components.pattern).toBe('number');
      expect(typeof result.components.llm).toBe('number');
      expect(typeof result.components.agreement).toBe('boolean');
    });

    it('should have null components when data not provided', () => {
      const result = service.aggregate(null, null, true);

      expect(result.components.pattern).toBeNull();
      expect(result.components.llm).toBeNull();
    });
  });
});
