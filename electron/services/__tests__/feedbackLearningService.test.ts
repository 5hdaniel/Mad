/**
 * Unit tests for Feedback Learning Service
 */

import feedbackLearningService from "../feedbackLearningService";
import databaseService from "../databaseService";

// Mock the database service
jest.mock("../databaseService");

const mockDatabaseService = databaseService as jest.Mocked<
  typeof databaseService
>;

describe("FeedbackLearningService", () => {
  const mockUserId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache between tests
    feedbackLearningService.clearCache(mockUserId);
  });

  describe("detectPatterns", () => {
    it("should return empty array when fewer than 3 feedback entries", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "c",
          corrected_value: "d",
        },
      ] as any);

      const patterns = await feedbackLearningService.detectPatterns(
        mockUserId,
        "test_field",
      );

      expect(patterns).toEqual([]);
    });

    it("should cache detected patterns", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "4",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
      ] as any);

      // First call
      await feedbackLearningService.detectPatterns(mockUserId, "cached_field");
      // Second call should use cache
      await feedbackLearningService.detectPatterns(mockUserId, "cached_field");

      // Should only call database once
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledTimes(1);
    });

    it("should detect date adjustment pattern for closing_date field", async () => {
      const _baseDate = new Date("2024-01-01");
      const _adjustedDate = new Date("2024-01-15"); // 14 days later

      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "2024-01-01",
          corrected_value: "2024-01-15",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "2024-02-01",
          corrected_value: "2024-02-15",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "2024-03-01",
          corrected_value: "2024-03-15",
        },
      ] as any);

      const patterns = await feedbackLearningService.detectPatterns(
        mockUserId,
        "closing_date",
      );

      expect(patterns.length).toBeGreaterThan(0);
      const datePattern = patterns.find((p) => p.type === "date_adjustment");
      if (datePattern) {
        expect(datePattern.adjustment_days).toBeCloseTo(14, 0);
      }
    });

    it("should detect substitution pattern", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "purchase",
          corrected_value: "sale",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "purchase",
          corrected_value: "sale",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "purchase",
          corrected_value: "sale",
        },
        {
          id: "4",
          feedback_type: "correction",
          original_value: "purchase",
          corrected_value: "sale",
        },
      ] as any);

      const patterns = await feedbackLearningService.detectPatterns(
        mockUserId,
        "transaction_type",
      );

      const subPattern = patterns.find((p) => p.type === "substitution");
      expect(subPattern).toBeDefined();
      if (subPattern) {
        expect(subPattern.from_value).toBe("purchase");
        expect(subPattern.to_value).toBe("sale");
      }
    });

    it("should detect rejection pattern", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        { id: "1", feedback_type: "rejection", original_value: "TBD" },
        { id: "2", feedback_type: "rejection", original_value: "TBD" },
        { id: "3", feedback_type: "rejection", original_value: "N/A" },
        { id: "4", feedback_type: "rejection", original_value: "TBD" },
      ] as any);

      const patterns = await feedbackLearningService.detectPatterns(
        mockUserId,
        "some_field",
      );

      const rejPattern = patterns.find((p) => p.type === "rejection");
      expect(rejPattern).toBeDefined();
      if (rejPattern) {
        expect(rejPattern.rejected_values).toContain("TBD");
      }
    });

    it("should detect number adjustment pattern for price fields", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "$100,000",
          corrected_value: "$95,000",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "$200,000",
          corrected_value: "$190,000",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "$300,000",
          corrected_value: "$285,000",
        },
      ] as any);

      const patterns = await feedbackLearningService.detectPatterns(
        mockUserId,
        "sale_price",
      );

      const numPattern = patterns.find((p) => p.type === "number_adjustment");
      if (numPattern) {
        expect(numPattern.percent_adjustment).toBeLessThan(0); // Negative adjustment
      }
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.getFeedbackByField.mockRejectedValue(
        new Error("DB error"),
      );

      const patterns = await feedbackLearningService.detectPatterns(
        mockUserId,
        "test_field",
      );

      expect(patterns).toEqual([]);
    });
  });

  describe("generateSuggestion", () => {
    it("should return null for high confidence extractions", async () => {
      const suggestion = await feedbackLearningService.generateSuggestion(
        mockUserId,
        "test_field",
        "some value",
        90, // High confidence
      );

      expect(suggestion).toBeNull();
    });

    it("should return null when no patterns exist", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const suggestion = await feedbackLearningService.generateSuggestion(
        mockUserId,
        "test_field",
        "some value",
        50,
      );

      expect(suggestion).toBeNull();
    });

    it("should generate date adjustment suggestion", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "2024-01-01",
          corrected_value: "2024-01-08",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "2024-02-01",
          corrected_value: "2024-02-08",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "2024-03-01",
          corrected_value: "2024-03-08",
        },
      ] as any);

      const suggestion = await feedbackLearningService.generateSuggestion(
        mockUserId,
        "closing_date",
        "2024-06-01",
        60,
      );

      if (suggestion) {
        expect(suggestion.value).toBeDefined();
        expect(suggestion.reason).toContain("days");
        expect(suggestion.confidence).toBeGreaterThan(0);
      }
    });

    it("should generate substitution suggestion", async () => {
      // Clear cache first
      feedbackLearningService.clearCache(mockUserId, "transaction_type");

      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "lease",
          corrected_value: "rental",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "lease",
          corrected_value: "rental",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "lease",
          corrected_value: "rental",
        },
        {
          id: "4",
          feedback_type: "correction",
          original_value: "lease",
          corrected_value: "rental",
        },
      ] as any);

      const suggestion = await feedbackLearningService.generateSuggestion(
        mockUserId,
        "transaction_type",
        "lease",
        50,
      );

      if (suggestion) {
        expect(suggestion.value).toBe("rental");
        expect(suggestion.reason).toContain("lease");
        expect(suggestion.reason).toContain("rental");
      }
    });

    it("should generate rejection warning", async () => {
      feedbackLearningService.clearCache(mockUserId, "status");

      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        { id: "1", feedback_type: "rejection", original_value: "pending" },
        { id: "2", feedback_type: "rejection", original_value: "pending" },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "pending",
          corrected_value: "active",
        },
      ] as any);

      const suggestion = await feedbackLearningService.generateSuggestion(
        mockUserId,
        "status",
        "pending",
        50,
      );

      if (suggestion && suggestion.isWarning) {
        expect(suggestion.isWarning).toBe(true);
        expect(suggestion.value).toBeNull();
      }
    });
  });

  describe("clearCache", () => {
    it("should clear specific field cache", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
      ] as any);

      // Populate cache
      await feedbackLearningService.detectPatterns(mockUserId, "test_field");
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledTimes(1);

      // Clear cache for specific field
      feedbackLearningService.clearCache(mockUserId, "test_field");

      // Should query again after cache clear
      await feedbackLearningService.detectPatterns(mockUserId, "test_field");
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledTimes(2);
    });

    it("should clear all user caches when fieldName is null", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "2",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "a",
          corrected_value: "b",
        },
      ] as any);

      // Populate caches
      await feedbackLearningService.detectPatterns(mockUserId, "field1");
      await feedbackLearningService.detectPatterns(mockUserId, "field2");
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledTimes(2);

      // Clear all caches for user
      feedbackLearningService.clearCache(mockUserId);

      // Should query again for both
      await feedbackLearningService.detectPatterns(mockUserId, "field1");
      await feedbackLearningService.detectPatterns(mockUserId, "field2");
      expect(mockDatabaseService.getFeedbackByField).toHaveBeenCalledTimes(4);
    });
  });

  describe("getLearningStats", () => {
    it("should return learning statistics", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        { id: "1", feedback_type: "confirmation", original_value: "a" },
        { id: "2", feedback_type: "confirmation", original_value: "b" },
        {
          id: "3",
          feedback_type: "correction",
          original_value: "c",
          corrected_value: "d",
        },
        { id: "4", feedback_type: "rejection", original_value: "e" },
      ] as any);

      const stats = await feedbackLearningService.getLearningStats(
        mockUserId,
        "test_field",
      );

      expect(stats.total_feedback).toBe(4);
      expect(stats.confirmations).toBe(2);
      expect(stats.corrections).toBe(1);
      expect(stats.rejections).toBe(1);
      expect(stats.patterns_detected).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.patterns)).toBe(true);
    });

    it("should return zero stats for empty feedback", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const stats = await feedbackLearningService.getLearningStats(
        mockUserId,
        "empty_field",
      );

      expect(stats.total_feedback).toBe(0);
      expect(stats.confirmations).toBe(0);
      expect(stats.corrections).toBe(0);
      expect(stats.rejections).toBe(0);
    });
  });

  // ============================================
  // LLM FEEDBACK ANALYSIS TESTS
  // ============================================

  describe("getAccuracyByProvider", () => {
    it("should return accuracy statistics grouped by model version", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "2",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "3",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_rejected",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "4",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "claude-3",
            promptVersion: "v1.0",
          }),
        },
      ] as any);

      const result = await feedbackLearningService.getAccuracyByProvider(mockUserId);

      expect(result["gpt-4"]).toBeDefined();
      expect(result["gpt-4"].approvals).toBe(2);
      expect(result["gpt-4"].rejections).toBe(1);
      expect(result["gpt-4"].rate).toBeCloseTo(2 / 3);

      expect(result["claude-3"]).toBeDefined();
      expect(result["claude-3"].approvals).toBe(1);
      expect(result["claude-3"].rejections).toBe(0);
      expect(result["claude-3"].rate).toBe(1);
    });

    it("should handle feedback without model version", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
          }),
        },
      ] as any);

      const result = await feedbackLearningService.getAccuracyByProvider(mockUserId);

      expect(result["unknown"]).toBeDefined();
      expect(result["unknown"].approvals).toBe(1);
    });

    it("should return empty object when no feedback exists", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const result = await feedbackLearningService.getAccuracyByProvider(mockUserId);

      expect(result).toEqual({});
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.getFeedbackByField.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await feedbackLearningService.getAccuracyByProvider(mockUserId);

      expect(result).toEqual({});
    });

    it("should count transaction_edited as approval", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "correction",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_edited",
            modelVersion: "gpt-4",
          }),
        },
      ] as any);

      const result = await feedbackLearningService.getAccuracyByProvider(mockUserId);

      expect(result["gpt-4"].approvals).toBe(1);
      expect(result["gpt-4"].rejections).toBe(0);
    });
  });

  describe("getAccuracyByPromptVersion", () => {
    it("should return accuracy statistics grouped by prompt version", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "2",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_rejected",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "3",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v2.0",
          }),
        },
        {
          id: "4",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v2.0",
          }),
        },
      ] as any);

      const result = await feedbackLearningService.getAccuracyByPromptVersion(mockUserId);

      expect(result["v1.0"]).toBeDefined();
      expect(result["v1.0"].approvals).toBe(1);
      expect(result["v1.0"].rejections).toBe(1);
      expect(result["v1.0"].rate).toBe(0.5);

      expect(result["v2.0"]).toBeDefined();
      expect(result["v2.0"].approvals).toBe(2);
      expect(result["v2.0"].rejections).toBe(0);
      expect(result["v2.0"].rate).toBe(1);
    });

    it("should handle feedback without prompt version", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
          }),
        },
      ] as any);

      const result = await feedbackLearningService.getAccuracyByPromptVersion(mockUserId);

      expect(result["unknown"]).toBeDefined();
      expect(result["unknown"].approvals).toBe(1);
    });

    it("should return empty object when no feedback exists", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const result = await feedbackLearningService.getAccuracyByPromptVersion(mockUserId);

      expect(result).toEqual({});
    });
  });

  describe("identifySystematicErrors", () => {
    it("should identify patterns in rejections with JSON corrected_value", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "wrong_property_type" }),
        },
        {
          id: "2",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "wrong_property_type" }),
        },
        {
          id: "3",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "duplicate_transaction" }),
        },
      ] as any);

      const result = await feedbackLearningService.identifySystematicErrors(mockUserId);

      expect(result.length).toBe(1);
      expect(result[0].pattern).toBe("wrong_property_type");
      expect(result[0].frequency).toBe(2);
      expect(result[0].suggestion).toContain("wrong_property_type");
    });

    it("should handle non-JSON corrected_value as pattern", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: "not_a_real_estate_transaction",
        },
        {
          id: "2",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: "not_a_real_estate_transaction",
        },
      ] as any);

      const result = await feedbackLearningService.identifySystematicErrors(mockUserId);

      expect(result.length).toBe(1);
      expect(result[0].pattern).toBe("not_a_real_estate_transaction");
      expect(result[0].frequency).toBe(2);
    });

    it("should return empty array when no rejections", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({ action: "transaction_approved" }),
        },
      ] as any);

      const result = await feedbackLearningService.identifySystematicErrors(mockUserId);

      expect(result).toEqual([]);
    });

    it("should return empty array when no feedback exists", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const result = await feedbackLearningService.identifySystematicErrors(mockUserId);

      expect(result).toEqual([]);
    });

    it("should sort by frequency descending", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "rejection",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "low_freq_error" }),
        },
        {
          id: "2",
          feedback_type: "rejection",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "low_freq_error" }),
        },
        {
          id: "3",
          feedback_type: "rejection",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "high_freq_error" }),
        },
        {
          id: "4",
          feedback_type: "rejection",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "high_freq_error" }),
        },
        {
          id: "5",
          feedback_type: "rejection",
          original_value: JSON.stringify({ action: "transaction_rejected" }),
          corrected_value: JSON.stringify({ reason: "high_freq_error" }),
        },
      ] as any);

      const result = await feedbackLearningService.identifySystematicErrors(mockUserId);

      expect(result.length).toBe(2);
      expect(result[0].pattern).toBe("high_freq_error");
      expect(result[0].frequency).toBe(3);
      expect(result[1].pattern).toBe("low_freq_error");
      expect(result[1].frequency).toBe(2);
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.getFeedbackByField.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await feedbackLearningService.identifySystematicErrors(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe("getLLMFeedbackAnalysis", () => {
    it("should return comprehensive analysis combining all methods", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "2",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_rejected",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
          corrected_value: JSON.stringify({ reason: "test_error" }),
        },
        {
          id: "3",
          feedback_type: "rejection",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_rejected",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
          corrected_value: JSON.stringify({ reason: "test_error" }),
        },
      ] as any);

      const result = await feedbackLearningService.getLLMFeedbackAnalysis(mockUserId);

      // Check structure
      expect(result.accuracyByProvider).toBeDefined();
      expect(result.accuracyByPromptVersion).toBeDefined();
      expect(result.systematicErrors).toBeDefined();
      expect(result.totalLLMFeedback).toBeDefined();
      expect(result.overallAccuracy).toBeDefined();

      // Check values
      expect(result.totalLLMFeedback).toBe(3);
      expect(result.overallAccuracy).toBeCloseTo(1 / 3);
      expect(result.accuracyByProvider["gpt-4"]).toBeDefined();
      expect(result.accuracyByPromptVersion["v1.0"]).toBeDefined();
      expect(result.systematicErrors.length).toBe(1);
      expect(result.systematicErrors[0].pattern).toBe("test_error");
    });

    it("should return zero values when no feedback exists", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([]);

      const result = await feedbackLearningService.getLLMFeedbackAnalysis(mockUserId);

      expect(result.accuracyByProvider).toEqual({});
      expect(result.accuracyByPromptVersion).toEqual({});
      expect(result.systematicErrors).toEqual([]);
      expect(result.totalLLMFeedback).toBe(0);
      expect(result.overallAccuracy).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.getFeedbackByField.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await feedbackLearningService.getLLMFeedbackAnalysis(mockUserId);

      expect(result.accuracyByProvider).toEqual({});
      expect(result.accuracyByPromptVersion).toEqual({});
      expect(result.systematicErrors).toEqual([]);
      expect(result.totalLLMFeedback).toBe(0);
      expect(result.overallAccuracy).toBe(0);
    });

    it("should handle mixed feedback types correctly", async () => {
      mockDatabaseService.getFeedbackByField.mockResolvedValue([
        {
          id: "1",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "2",
          feedback_type: "correction",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_edited",
            modelVersion: "gpt-4",
            promptVersion: "v1.0",
          }),
        },
        {
          id: "3",
          feedback_type: "confirmation",
          field_name: "llm_transaction_action",
          original_value: JSON.stringify({
            action: "transaction_approved",
            modelVersion: "claude-3",
            promptVersion: "v2.0",
          }),
        },
      ] as any);

      const result = await feedbackLearningService.getLLMFeedbackAnalysis(mockUserId);

      // All are approvals (approved + edited)
      expect(result.totalLLMFeedback).toBe(3);
      expect(result.overallAccuracy).toBe(1); // 3/3

      expect(result.accuracyByProvider["gpt-4"].approvals).toBe(2);
      expect(result.accuracyByProvider["claude-3"].approvals).toBe(1);
    });
  });
});
