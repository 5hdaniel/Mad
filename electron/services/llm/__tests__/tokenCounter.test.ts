/**
 * @jest-environment node
 */

import {
  estimateTokens,
  estimatePromptTokens,
  getModelCosts,
  calculateCost,
  createTokenEstimate,
  createTokenUsage,
} from '../tokenCounter';

describe('tokenCounter', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it('should estimate ~4 characters per token', () => {
      // 20 characters should be ~5 tokens (20/4 = 5)
      expect(estimateTokens('12345678901234567890')).toBe(5);
    });

    it('should round up token estimates', () => {
      // 5 characters should be 2 tokens (5/4 = 1.25, ceil = 2)
      expect(estimateTokens('12345')).toBe(2);
    });

    it('should handle short strings', () => {
      // 1 character should be 1 token
      expect(estimateTokens('a')).toBe(1);
    });

    it('should handle longer text', () => {
      // 100 characters should be 25 tokens
      const text = 'a'.repeat(100);
      expect(estimateTokens(text)).toBe(25);
    });
  });

  describe('estimatePromptTokens', () => {
    it('should estimate tokens for a single message', () => {
      const messages = [{ role: 'user', content: 'Hello world' }];
      // 11 characters = 3 tokens + 4 overhead per message + 3 structure = 10
      const estimate = estimatePromptTokens(messages);
      expect(estimate).toBe(10);
    });

    it('should estimate tokens for multiple messages', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' }, // 15 chars = 4 tokens + 4 = 8
        { role: 'user', content: 'Hello' }, // 5 chars = 2 tokens + 4 = 6
      ];
      // Total: 8 + 6 + 3 (structure) = 17
      const estimate = estimatePromptTokens(messages);
      expect(estimate).toBe(17);
    });

    it('should handle empty messages array', () => {
      const estimate = estimatePromptTokens([]);
      expect(estimate).toBe(3); // Just structure overhead
    });

    it('should handle empty content', () => {
      const messages = [{ role: 'user', content: '' }];
      // 0 content tokens + 4 overhead + 3 structure = 7
      const estimate = estimatePromptTokens(messages);
      expect(estimate).toBe(7);
    });
  });

  describe('getModelCosts', () => {
    it('should return OpenAI gpt-4o-mini costs', () => {
      const costs = getModelCosts('openai', 'gpt-4o-mini');
      expect(costs.inputPer1k).toBe(0.00015);
      expect(costs.outputPer1k).toBe(0.0006);
    });

    it('should return OpenAI gpt-4o costs', () => {
      const costs = getModelCosts('openai', 'gpt-4o');
      expect(costs.inputPer1k).toBe(0.005);
      expect(costs.outputPer1k).toBe(0.015);
    });

    it('should return Anthropic claude-3-haiku costs', () => {
      const costs = getModelCosts('anthropic', 'claude-3-haiku-20240307');
      expect(costs.inputPer1k).toBe(0.00025);
      expect(costs.outputPer1k).toBe(0.00125);
    });

    it('should return Anthropic claude-3-5-sonnet costs', () => {
      const costs = getModelCosts('anthropic', 'claude-3-5-sonnet-20241022');
      expect(costs.inputPer1k).toBe(0.003);
      expect(costs.outputPer1k).toBe(0.015);
    });

    it('should return fallback costs for unknown models', () => {
      const costs = getModelCosts('openai', 'unknown-model');
      expect(costs.inputPer1k).toBe(0.001);
      expect(costs.outputPer1k).toBe(0.002);
    });

    it('should return fallback costs for unknown providers', () => {
      const costs = getModelCosts('unknown' as 'openai', 'gpt-4o');
      expect(costs.inputPer1k).toBe(0.001);
      expect(costs.outputPer1k).toBe(0.002);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for OpenAI gpt-4o-mini', () => {
      const cost = calculateCost(
        { promptTokens: 1000, completionTokens: 500 },
        'openai',
        'gpt-4o-mini'
      );
      // Input: 1 * 0.00015 = 0.00015
      // Output: 0.5 * 0.0006 = 0.0003
      // Total: 0.00045
      expect(cost).toBeCloseTo(0.00045, 6);
    });

    it('should calculate cost for Anthropic claude-3-haiku', () => {
      const cost = calculateCost(
        { promptTokens: 2000, completionTokens: 1000 },
        'anthropic',
        'claude-3-haiku-20240307'
      );
      // Input: 2 * 0.00025 = 0.0005
      // Output: 1 * 0.00125 = 0.00125
      // Total: 0.00175
      expect(cost).toBeCloseTo(0.00175, 6);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost(
        { promptTokens: 0, completionTokens: 0 },
        'openai',
        'gpt-4o-mini'
      );
      expect(cost).toBe(0);
    });
  });

  describe('createTokenEstimate', () => {
    it('should create complete estimate with prompt tokens', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];
      const estimate = createTokenEstimate(messages, 500, 'openai', 'gpt-4o-mini');

      expect(estimate.promptTokens).toBe(17); // From estimatePromptTokens
      expect(estimate.maxCompletionTokens).toBe(500);
      expect(estimate.totalEstimate).toBe(517);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
    });

    it('should calculate estimated cost correctly', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const estimate = createTokenEstimate(messages, 1000, 'openai', 'gpt-4o-mini');

      // Cost calculation: promptTokens + maxCompletionTokens at model rates
      const expectedPromptTokens = 10; // 5 chars / 4 = 2 + 4 + 3 = 9, ceil to 10
      const expectedCost =
        (expectedPromptTokens / 1000) * 0.00015 + (1000 / 1000) * 0.0006;

      expect(estimate.estimatedCost).toBeCloseTo(expectedCost, 6);
    });
  });

  describe('createTokenUsage', () => {
    it('should create usage record with calculated cost', () => {
      const usage = createTokenUsage(500, 250, 'openai', 'gpt-4o-mini');

      expect(usage.promptTokens).toBe(500);
      expect(usage.completionTokens).toBe(250);
      expect(usage.totalTokens).toBe(750);
      expect(usage.cost).toBeGreaterThan(0);
    });

    it('should calculate cost correctly for usage', () => {
      const usage = createTokenUsage(1000, 500, 'anthropic', 'claude-3-haiku-20240307');

      // Input: 1 * 0.00025 = 0.00025
      // Output: 0.5 * 0.00125 = 0.000625
      // Total: 0.000875
      expect(usage.cost).toBeCloseTo(0.000875, 6);
    });

    it('should handle zero tokens', () => {
      const usage = createTokenUsage(0, 0, 'openai', 'gpt-4o');

      expect(usage.promptTokens).toBe(0);
      expect(usage.completionTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.cost).toBe(0);
    });
  });
});
