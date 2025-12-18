/**
 * Unit tests for ExtractionStrategyService
 * TASK-321: Extraction Strategy Selector
 *
 * Tests cover:
 * - Strategy with LLM disabled (no consent)
 * - Strategy with no API keys
 * - Strategy with OpenAI only
 * - Strategy with Anthropic only
 * - Strategy with both providers
 * - Budget exceeded scenario
 * - Platform allowance exceeded
 * - LLM-only mode request
 * - Pattern-only override
 * - Error handling returns pattern
 * - Token cost estimation
 *
 * Target: 90%+ coverage
 */

// Mock LLMConfigService before importing
const mockGetUserConfig = jest.fn();

jest.mock('../../llm/llmConfigService', () => ({
  LLMConfigService: jest.fn().mockImplementation(() => ({
    getUserConfig: mockGetUserConfig,
  })),
}));

import {
  ExtractionStrategyService,
  getExtractionStrategyService,
  resetExtractionStrategyService,
  TOKEN_COST_ESTIMATES,
  MIN_TOKENS_FOR_EXTRACTION,
  ExtractionStrategy,
  StrategyContext,
} from '../extractionStrategyService';
import { LLMConfigService, LLMUserConfig } from '../../llm/llmConfigService';

describe('ExtractionStrategyService', () => {
  let service: ExtractionStrategyService;
  let mockConfigService: LLMConfigService;

  // Base configuration for testing
  const baseConfig: LLMUserConfig = {
    hasOpenAI: true,
    hasAnthropic: true,
    preferredProvider: 'openai',
    openAIModel: 'gpt-4o-mini',
    anthropicModel: 'claude-3-haiku-20240307',
    tokensUsed: 0,
    budgetLimit: 100000,
    platformAllowanceRemaining: 50000,
    usePlatformAllowance: false,
    autoDetectEnabled: true,
    roleExtractionEnabled: true,
    hasConsent: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetExtractionStrategyService();

    // Create mock config service
    mockConfigService = new LLMConfigService();
    service = new ExtractionStrategyService(mockConfigService);

    // Default to fully configured user
    mockGetUserConfig.mockResolvedValue({ ...baseConfig });
  });

  // ===========================================================================
  // Basic Strategy Selection Tests
  // ===========================================================================

  describe('selectStrategy', () => {
    it('should return hybrid strategy when fully configured', async () => {
      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBe('openai');
      expect(result.reason).toBe('LLM available and within budget');
      expect(result.fallbackMethod).toBe('pattern');
      expect(result.budgetRemaining).toBeDefined();
      expect(result.estimatedTokenCost).toBeDefined();
    });

    it('should include context in estimation when provided', async () => {
      const context: StrategyContext = { messageCount: 10 };
      const result = await service.selectStrategy('user-1', context);

      expect(result.method).toBe('hybrid');
      expect(result.estimatedTokenCost).toBe(service.estimateTokenCost(10));
    });

    it('should call getUserConfig with correct userId', async () => {
      await service.selectStrategy('test-user-123');

      expect(mockGetUserConfig).toHaveBeenCalledWith('test-user-123');
      expect(mockGetUserConfig).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // LLM Consent Tests
  // ===========================================================================

  describe('consent checking', () => {
    it('should return pattern when user has not given consent', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasConsent: false,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toBe('LLM data consent not granted');
      expect(result.fallbackMethod).toBe('pattern');
      expect(result.provider).toBeUndefined();
    });
  });

  // ===========================================================================
  // API Key Availability Tests
  // ===========================================================================

  describe('API key availability', () => {
    it('should return pattern when no API keys configured', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: false,
        hasAnthropic: false,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toBe('No LLM API keys configured');
      expect(result.provider).toBeUndefined();
    });

    it('should use OpenAI when only OpenAI is configured', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: true,
        hasAnthropic: false,
        preferredProvider: 'openai',
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBe('openai');
    });

    it('should use Anthropic when only Anthropic is configured', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: false,
        hasAnthropic: true,
        preferredProvider: 'anthropic',
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBe('anthropic');
    });

    it('should fallback to alternate provider when preferred is not available', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: false,
        hasAnthropic: true,
        preferredProvider: 'openai', // Preferred but not available
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBe('anthropic');
      // Reason reflects the final status, not the fallback note
      expect(result.reason).toBe('LLM available and within budget');
    });

    it('should use OpenAI as fallback when Anthropic is preferred but unavailable', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: true,
        hasAnthropic: false,
        preferredProvider: 'anthropic', // Preferred but not available
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBe('openai');
      // Reason reflects the final status, not the fallback note
      expect(result.reason).toBe('LLM available and within budget');
    });

    it('should use preferred provider when both are available', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: true,
        hasAnthropic: true,
        preferredProvider: 'anthropic',
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBe('anthropic');
    });
  });

  // ===========================================================================
  // Budget Checking Tests
  // ===========================================================================

  describe('budget checking', () => {
    it('should return pattern when monthly budget exceeded', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 100000, // Used all tokens
        budgetLimit: 100000,
        usePlatformAllowance: false,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('Monthly budget too low');
      expect(result.budgetRemaining).toBe(0);
    });

    it('should return pattern when budget insufficient for estimated extraction', async () => {
      const messageCount = 100; // Large extraction
      const estimatedCost = service.estimateTokenCost(messageCount);

      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 95000,
        budgetLimit: 100000, // Only 5000 remaining, not enough
        usePlatformAllowance: false,
      });

      const result = await service.selectStrategy('user-1', { messageCount });

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('Monthly budget insufficient');
      expect(result.budgetRemaining).toBe(5000);
    });

    it('should succeed when budget has capacity', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 10000,
        budgetLimit: 100000, // Plenty remaining
        usePlatformAllowance: false,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.reason).toBe('LLM available and within budget');
      expect(result.budgetRemaining).toBe(90000);
    });

    it('should allow extraction when no budget limit is set', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 1000000,
        budgetLimit: undefined, // No limit
        usePlatformAllowance: false,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.reason).toBe('LLM available and within budget');
      expect(result.budgetRemaining).toBe(Infinity);
    });

    it('should allow extraction when budget limit is 0 (no limit)', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 1000000,
        budgetLimit: 0, // No limit
        usePlatformAllowance: false,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.budgetRemaining).toBe(Infinity);
    });
  });

  // ===========================================================================
  // Platform Allowance Tests
  // ===========================================================================

  describe('platform allowance', () => {
    it('should use platform allowance when enabled', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        usePlatformAllowance: true,
        platformAllowanceRemaining: 25000,
        tokensUsed: 90000,
        budgetLimit: 100000, // Would be over personal budget
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('hybrid');
      expect(result.reason).toBe('LLM available and within budget');
      expect(result.budgetRemaining).toBe(25000); // Platform allowance, not personal
    });

    it('should return pattern when platform allowance exhausted', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        usePlatformAllowance: true,
        platformAllowanceRemaining: 0,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('Platform allowance too low');
      expect(result.budgetRemaining).toBe(0);
    });

    it('should return pattern when platform allowance below minimum', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        usePlatformAllowance: true,
        platformAllowanceRemaining: MIN_TOKENS_FOR_EXTRACTION - 1,
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('Platform allowance too low');
    });

    it('should return pattern when platform allowance insufficient for extraction', async () => {
      const messageCount = 50;
      const estimatedCost = service.estimateTokenCost(messageCount);

      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        usePlatformAllowance: true,
        platformAllowanceRemaining: estimatedCost - 1, // Just under estimated
      });

      const result = await service.selectStrategy('user-1', { messageCount });

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('Platform allowance insufficient');
    });
  });

  // ===========================================================================
  // LLM-Only Mode Tests
  // ===========================================================================

  describe('selectLLMOnlyStrategy', () => {
    it('should return LLM-only when available', async () => {
      const result = await service.selectLLMOnlyStrategy('user-1');

      expect(result.method).toBe('llm');
      expect(result.reason).toBe('LLM-only mode requested and available');
      expect(result.provider).toBe('openai');
    });

    it('should return pattern with explanation when LLM unavailable', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasOpenAI: false,
        hasAnthropic: false,
      });

      const result = await service.selectLLMOnlyStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('LLM-only not available');
      expect(result.reason).toContain('No LLM API keys configured');
    });

    it('should return pattern with explanation when no consent', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        hasConsent: false,
      });

      const result = await service.selectLLMOnlyStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('LLM-only not available');
      expect(result.reason).toContain('LLM data consent not granted');
    });

    it('should respect context in LLM-only mode', async () => {
      const context: StrategyContext = { messageCount: 20 };
      const result = await service.selectLLMOnlyStrategy('user-1', context);

      expect(result.method).toBe('llm');
      expect(result.estimatedTokenCost).toBe(service.estimateTokenCost(20));
    });

    it('should preserve budget information in LLM-only mode', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 50000,
        budgetLimit: 100000,
      });

      const result = await service.selectLLMOnlyStrategy('user-1');

      expect(result.method).toBe('llm');
      expect(result.budgetRemaining).toBe(50000);
    });
  });

  // ===========================================================================
  // Pattern-Only Mode Tests
  // ===========================================================================

  describe('getPatternOnlyStrategy', () => {
    it('should always return pattern strategy', () => {
      const result = service.getPatternOnlyStrategy();

      expect(result.method).toBe('pattern');
      expect(result.reason).toBe('Pattern-only mode explicitly requested');
      expect(result.fallbackMethod).toBe('pattern');
      expect(result.provider).toBeUndefined();
      expect(result.budgetRemaining).toBeUndefined();
      expect(result.estimatedTokenCost).toBeUndefined();
    });

    it('should work without any configuration', () => {
      // No mocks needed - this is a pure function
      const result = service.getPatternOnlyStrategy();

      expect(result.method).toBe('pattern');
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should return pattern on getUserConfig error', async () => {
      mockGetUserConfig.mockRejectedValue(new Error('Database error'));

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toBe('Error checking LLM availability, using pattern matching');
      expect(result.fallbackMethod).toBe('pattern');
    });

    it('should return pattern on unexpected exception', async () => {
      mockGetUserConfig.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await service.selectStrategy('user-1');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('Error checking LLM availability');
    });

    it('should log errors when they occur', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockGetUserConfig.mockRejectedValue(new Error('Test error'));

      await service.selectStrategy('user-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[StrategySelector] Error selecting strategy:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Token Cost Estimation Tests
  // ===========================================================================

  describe('estimateTokenCost', () => {
    it('should estimate cost for given message count', () => {
      const cost = service.estimateTokenCost(10);

      const expected =
        10 * TOKEN_COST_ESTIMATES.perMessage +
        TOKEN_COST_ESTIMATES.clustering +
        TOKEN_COST_ESTIMATES.contactExtraction;

      expect(cost).toBe(expected);
    });

    it('should return minimum cost for zero messages', () => {
      const cost = service.estimateTokenCost(0);

      const expected =
        TOKEN_COST_ESTIMATES.clustering + TOKEN_COST_ESTIMATES.contactExtraction;

      expect(cost).toBe(expected);
    });

    it('should return minimum cost for negative messages', () => {
      const cost = service.estimateTokenCost(-5);

      const expected =
        TOKEN_COST_ESTIMATES.clustering + TOKEN_COST_ESTIMATES.contactExtraction;

      expect(cost).toBe(expected);
    });

    it('should scale linearly with message count', () => {
      const cost1 = service.estimateTokenCost(1);
      const cost10 = service.estimateTokenCost(10);

      const difference = cost10 - cost1;
      const expectedDifference = 9 * TOKEN_COST_ESTIMATES.perMessage;

      expect(difference).toBe(expectedDifference);
    });

    it('should handle large message counts', () => {
      const cost = service.estimateTokenCost(1000);

      expect(cost).toBeGreaterThan(TOKEN_COST_ESTIMATES.perMessage * 1000);
    });
  });

  // ===========================================================================
  // Singleton Factory Tests
  // ===========================================================================

  describe('singleton factory', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getExtractionStrategyService(mockConfigService);
      const instance2 = getExtractionStrategyService(mockConfigService);

      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getExtractionStrategyService(mockConfigService);
      resetExtractionStrategyService();
      const instance2 = getExtractionStrategyService(mockConfigService);

      expect(instance1).not.toBe(instance2);
    });

    it('should use provided config service', async () => {
      const instance = getExtractionStrategyService(mockConfigService);
      await instance.selectStrategy('test-user');

      expect(mockGetUserConfig).toHaveBeenCalledWith('test-user');
    });
  });

  // ===========================================================================
  // Strategy Context Tests
  // ===========================================================================

  describe('strategy context', () => {
    it('should use messageCount from context for estimation', async () => {
      const context: StrategyContext = { messageCount: 25 };
      const result = await service.selectStrategy('user-1', context);

      expect(result.estimatedTokenCost).toBe(service.estimateTokenCost(25));
    });

    it('should default to 0 messageCount when context not provided', async () => {
      const result = await service.selectStrategy('user-1');

      expect(result.estimatedTokenCost).toBe(service.estimateTokenCost(0));
    });

    it('should default to 0 messageCount when context has no messageCount', async () => {
      const context: StrategyContext = {} as StrategyContext;
      const result = await service.selectStrategy('user-1', context);

      expect(result.estimatedTokenCost).toBe(service.estimateTokenCost(0));
    });

    it('should accept previousExtractionMethod in context', async () => {
      const context: StrategyContext = {
        messageCount: 5,
        previousExtractionMethod: 'pattern',
      };

      // Should not throw and should work normally
      const result = await service.selectStrategy('user-1', context);

      expect(result.method).toBe('hybrid');
    });
  });

  // ===========================================================================
  // Integration Scenario Tests
  // ===========================================================================

  describe('integration scenarios', () => {
    it('new user should get pattern-only strategy', async () => {
      // New user: no consent, no keys
      mockGetUserConfig.mockResolvedValue({
        hasOpenAI: false,
        hasAnthropic: false,
        preferredProvider: 'openai',
        openAIModel: 'gpt-4o-mini',
        anthropicModel: 'claude-3-haiku-20240307',
        tokensUsed: 0,
        budgetLimit: undefined,
        platformAllowanceRemaining: 0,
        usePlatformAllowance: false,
        autoDetectEnabled: false,
        roleExtractionEnabled: false,
        hasConsent: false,
      });

      const result = await service.selectStrategy('new-user');

      expect(result.method).toBe('pattern');
    });

    it('configured user should get hybrid strategy', async () => {
      // Already using baseConfig which is fully configured
      const result = await service.selectStrategy('configured-user');

      expect(result.method).toBe('hybrid');
      expect(result.provider).toBeDefined();
    });

    it('over-budget user should get pattern with reason', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 100000,
        budgetLimit: 100000,
        usePlatformAllowance: false,
      });

      const result = await service.selectStrategy('over-budget-user');

      expect(result.method).toBe('pattern');
      expect(result.reason).toContain('budget');
      expect(result.budgetRemaining).toBe(0);
    });

    it('platform user with allowance should use hybrid', async () => {
      mockGetUserConfig.mockResolvedValue({
        ...baseConfig,
        tokensUsed: 1000000, // Way over personal budget
        budgetLimit: 50000,
        usePlatformAllowance: true,
        platformAllowanceRemaining: 100000,
      });

      const result = await service.selectStrategy('platform-user');

      expect(result.method).toBe('hybrid');
      expect(result.budgetRemaining).toBe(100000); // Platform allowance
    });

    it('user switching from pattern should get hybrid if configured', async () => {
      const context: StrategyContext = {
        messageCount: 5,
        previousExtractionMethod: 'pattern',
      };

      const result = await service.selectStrategy('user-1', context);

      expect(result.method).toBe('hybrid');
    });
  });

  // ===========================================================================
  // Constants Export Tests
  // ===========================================================================

  describe('exported constants', () => {
    it('should export TOKEN_COST_ESTIMATES', () => {
      expect(TOKEN_COST_ESTIMATES).toBeDefined();
      expect(TOKEN_COST_ESTIMATES.perMessage).toBeGreaterThan(0);
      expect(TOKEN_COST_ESTIMATES.clustering).toBeGreaterThan(0);
      expect(TOKEN_COST_ESTIMATES.contactExtraction).toBeGreaterThan(0);
    });

    it('should export MIN_TOKENS_FOR_EXTRACTION', () => {
      expect(MIN_TOKENS_FOR_EXTRACTION).toBeDefined();
      expect(MIN_TOKENS_FOR_EXTRACTION).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Type Safety Tests
  // ===========================================================================

  describe('type safety', () => {
    it('should return properly typed ExtractionStrategy', async () => {
      const result: ExtractionStrategy = await service.selectStrategy('user-1');

      // Type assertions - these will fail at compile time if types are wrong
      expect(['pattern', 'llm', 'hybrid']).toContain(result.method);
      expect(typeof result.reason).toBe('string');
      expect(['pattern', 'llm', 'hybrid']).toContain(result.fallbackMethod);

      if (result.provider) {
        expect(['openai', 'anthropic']).toContain(result.provider);
      }
    });

    it('should accept valid StrategyContext', async () => {
      const context: StrategyContext = {
        messageCount: 10,
        previousExtractionMethod: 'hybrid',
      };

      const result = await service.selectStrategy('user-1', context);
      expect(result.method).toBeDefined();
    });
  });
});
