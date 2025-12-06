/**
 * Unit tests for Feedback Handlers
 * Tests feedback IPC handlers including:
 * - Feedback submission
 * - Transaction feedback retrieval
 * - Extraction metrics
 * - Smart suggestions
 * - Learning statistics
 */

import type { IpcMainInvokeEvent } from 'electron';

// Mock electron module
const mockIpcHandle = jest.fn();

jest.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

// Mock services - inline since jest.mock is hoisted
jest.mock('../services/databaseService', () => ({
  __esModule: true,
  default: {
    saveFeedback: jest.fn(),
    getFeedbackByTransaction: jest.fn(),
  },
}));

jest.mock('../services/feedbackLearningService', () => ({
  __esModule: true,
  default: {
    clearCache: jest.fn(),
    generateSuggestion: jest.fn(),
    getLearningStats: jest.fn(),
  },
}));

// Import after mocks are set up
import { registerFeedbackHandlers } from '../feedback-handlers';
import databaseService from '../services/databaseService';

// Get the feedbackLearningService mock - need to use require since it's a CommonJS require in source
const feedbackLearningService = require('../services/feedbackLearningService').default;

// Get typed references to mocked services
const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockFeedbackLearningService = feedbackLearningService as jest.Mocked<typeof feedbackLearningService>;

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_TXN_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('Feedback Handlers', () => {
  let registeredHandlers: Map<string, Function>;
  const mockEvent = {} as IpcMainInvokeEvent;

  beforeAll(() => {
    // Capture registered handlers
    registeredHandlers = new Map();
    mockIpcHandle.mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    // Register all handlers
    registerFeedbackHandlers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('feedback:submit', () => {
    const validFeedbackData = {
      transaction_id: TEST_TXN_ID,
      field_name: 'property_address',
      original_value: '123 Main',
      corrected_value: '123 Main Street',
      feedback_type: 'correction',
    };

    it('should submit feedback successfully', async () => {
      mockDatabaseService.saveFeedback.mockResolvedValue({
        id: 'feedback-new',
        ...validFeedbackData,
      });

      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, TEST_USER_ID, validFeedbackData);

      expect(result.success).toBe(true);
      expect(result.feedbackId).toBe('feedback-new');
      expect(mockFeedbackLearningService.clearCache).toHaveBeenCalledWith(
        TEST_USER_ID,
        'property_address'
      );
    });

    it('should handle feedback without field_name', async () => {
      const feedbackWithoutField = {
        transaction_id: TEST_TXN_ID,
        feedback_type: 'general',
        comment: 'Good extraction',
      };
      mockDatabaseService.saveFeedback.mockResolvedValue({
        id: 'feedback-new',
        ...feedbackWithoutField,
      });

      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, TEST_USER_ID, feedbackWithoutField);

      expect(result.success).toBe(true);
      expect(mockFeedbackLearningService.clearCache).not.toHaveBeenCalled();
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, '', validFeedbackData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle invalid feedback data (non-object)', async () => {
      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, TEST_USER_ID, 'not-an-object');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle null feedback data', async () => {
      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, TEST_USER_ID, null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle database save failure', async () => {
      mockDatabaseService.saveFeedback.mockRejectedValue(
        new Error('Save failed')
      );

      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, TEST_USER_ID, validFeedbackData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Save failed');
    });

    it('should validate field_name length', async () => {
      const feedbackWithLongFieldName = {
        ...validFeedbackData,
        field_name: 'a'.repeat(150), // Too long
      };

      const handler = registeredHandlers.get('feedback:submit');
      const result = await handler(mockEvent, TEST_USER_ID, feedbackWithLongFieldName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('feedback:get-for-transaction', () => {
    it('should return feedback for transaction', async () => {
      const mockFeedback = [
        { id: 'fb-1', field_name: 'price', corrected_value: '$500,000' },
        { id: 'fb-2', field_name: 'closing_date', corrected_value: '2024-12-01' },
      ];
      mockDatabaseService.getFeedbackByTransaction.mockResolvedValue(mockFeedback);

      const handler = registeredHandlers.get('feedback:get-for-transaction');
      const result = await handler(mockEvent, TEST_TXN_ID);

      expect(result.success).toBe(true);
      expect(result.feedback).toHaveLength(2);
    });

    it('should return empty array when no feedback exists', async () => {
      mockDatabaseService.getFeedbackByTransaction.mockResolvedValue([]);

      const handler = registeredHandlers.get('feedback:get-for-transaction');
      const result = await handler(mockEvent, TEST_TXN_ID);

      expect(result.success).toBe(true);
      expect(result.feedback).toHaveLength(0);
    });

    it('should handle null transaction ID', async () => {
      const handler = registeredHandlers.get('feedback:get-for-transaction');
      const result = await handler(mockEvent, null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(result.feedback).toEqual([]);
    });

    it('should handle invalid transaction ID', async () => {
      const handler = registeredHandlers.get('feedback:get-for-transaction');
      const result = await handler(mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle database error', async () => {
      mockDatabaseService.getFeedbackByTransaction.mockRejectedValue(
        new Error('Database error')
      );

      const handler = registeredHandlers.get('feedback:get-for-transaction');
      const result = await handler(mockEvent, TEST_TXN_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(result.feedback).toEqual([]);
    });
  });

  describe('feedback:get-metrics', () => {
    it('should return extraction metrics', async () => {
      const handler = registeredHandlers.get('feedback:get-metrics');
      const result = await handler(mockEvent, TEST_USER_ID, 'property_address');

      expect(result.success).toBe(true);
      expect(result.metrics).toEqual([]);
    });

    it('should work without field name filter', async () => {
      const handler = registeredHandlers.get('feedback:get-metrics');
      const result = await handler(mockEvent, TEST_USER_ID, null);

      expect(result.success).toBe(true);
      expect(result.metrics).toEqual([]);
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('feedback:get-metrics');
      const result = await handler(mockEvent, '', 'property_address');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(result.metrics).toEqual([]);
    });

    it('should validate field name length', async () => {
      const handler = registeredHandlers.get('feedback:get-metrics');
      const result = await handler(mockEvent, TEST_USER_ID, 'a'.repeat(150));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('feedback:get-suggestion', () => {
    it('should return suggestion based on past patterns', async () => {
      mockFeedbackLearningService.generateSuggestion.mockResolvedValue({
        suggestedValue: '123 Main Street',
        confidence: 0.85,
        basedOnPatterns: 5,
      });

      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        TEST_USER_ID,
        'property_address',
        '123 Main',
        0.5
      );

      expect(result.success).toBe(true);
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion.suggestedValue).toBe('123 Main Street');
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        '',
        'property_address',
        '123 Main',
        0.5
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle empty field name', async () => {
      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        TEST_USER_ID,
        '',
        '123 Main',
        0.5
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle null extracted value', async () => {
      mockFeedbackLearningService.generateSuggestion.mockResolvedValue({
        suggestedValue: null,
        confidence: 0,
      });

      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        TEST_USER_ID,
        'property_address',
        '',
        null
      );

      expect(result.success).toBe(true);
    });

    it('should validate confidence range', async () => {
      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        TEST_USER_ID,
        'property_address',
        '123 Main',
        1.5 // Invalid - should be 0-1
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
      // The validation message contains 'Confidence' (capitalized)
      expect(result.error.toLowerCase()).toContain('confidence');
    });

    it('should handle negative confidence', async () => {
      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        TEST_USER_ID,
        'property_address',
        '123 Main',
        -0.5
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle suggestion generation failure', async () => {
      mockFeedbackLearningService.generateSuggestion.mockRejectedValue(
        new Error('Suggestion failed')
      );

      const handler = registeredHandlers.get('feedback:get-suggestion');
      const result = await handler(
        mockEvent,
        TEST_USER_ID,
        'property_address',
        '123 Main',
        0.5
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Suggestion failed');
      expect(result.suggestion).toBeNull();
    });
  });

  describe('feedback:get-learning-stats', () => {
    it('should return learning statistics for field', async () => {
      mockFeedbackLearningService.getLearningStats.mockResolvedValue({
        totalCorrections: 10,
        patternMatches: 8,
        accuracy: 0.8,
        topPatterns: ['pattern1', 'pattern2'],
      });

      const handler = registeredHandlers.get('feedback:get-learning-stats');
      const result = await handler(mockEvent, TEST_USER_ID, 'property_address');

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalCorrections).toBe(10);
    });

    it('should handle invalid user ID', async () => {
      const handler = registeredHandlers.get('feedback:get-learning-stats');
      const result = await handler(mockEvent, '', 'property_address');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
      expect(result.stats).toBeNull();
    });

    it('should handle empty field name', async () => {
      const handler = registeredHandlers.get('feedback:get-learning-stats');
      const result = await handler(mockEvent, TEST_USER_ID, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should validate field name length', async () => {
      const handler = registeredHandlers.get('feedback:get-learning-stats');
      const result = await handler(mockEvent, TEST_USER_ID, 'a'.repeat(150));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should handle stats retrieval failure', async () => {
      mockFeedbackLearningService.getLearningStats.mockRejectedValue(
        new Error('Stats retrieval failed')
      );

      const handler = registeredHandlers.get('feedback:get-learning-stats');
      const result = await handler(mockEvent, TEST_USER_ID, 'property_address');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stats retrieval failed');
      expect(result.stats).toBeNull();
    });
  });
});
