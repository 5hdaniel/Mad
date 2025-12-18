/**
 * Extraction Strategy Service
 * TASK-321: Decides which extraction method to use based on user configuration.
 *
 * This service determines whether to use pattern matching, LLM analysis, or both
 * (hybrid) based on:
 * - User's LLM enablement settings
 * - API key availability
 * - Budget status (platform allowance or personal budget)
 * - Feature flags
 *
 * DESIGN DECISIONS:
 * - Never throws errors - always returns pattern fallback
 * - Provides clear, user-friendly reason strings
 * - Estimates costs conservatively
 * - Uses LLMConfigService's getUserConfig for safe access (no raw API keys)
 */

import { LLMConfigService, LLMUserConfig } from '../llm/llmConfigService';
import { LLMProvider } from '../llm/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Extraction method options.
 * - 'pattern': Pattern matching only (fast, no API cost)
 * - 'llm': LLM analysis only
 * - 'hybrid': Both methods used, results merged
 */
export type ExtractionStrategyMethod = 'pattern' | 'llm' | 'hybrid';

/**
 * Result of strategy selection.
 */
export interface ExtractionStrategy {
  /** The recommended extraction method */
  method: ExtractionStrategyMethod;
  /** The LLM provider to use (if applicable) */
  provider?: LLMProvider;
  /** Human-readable reason for this strategy selection */
  reason: string;
  /** Method to use if primary fails */
  fallbackMethod: ExtractionStrategyMethod;
  /** Remaining budget in tokens (if applicable) */
  budgetRemaining?: number;
  /** Estimated token cost for this extraction */
  estimatedTokenCost?: number;
}

/**
 * Additional context for strategy selection.
 */
export interface StrategyContext {
  /** Number of messages to process */
  messageCount: number;
  /** Previous extraction method used (for consistency) */
  previousExtractionMethod?: ExtractionStrategyMethod;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Token cost estimation factors.
 * Conservative estimates to avoid budget overruns.
 */
export const TOKEN_COST_ESTIMATES = {
  /** Tokens per message (prompt + completion) */
  perMessage: 800,
  /** Base tokens for clustering operation */
  clustering: 1500,
  /** Base tokens for contact extraction */
  contactExtraction: 1200,
} as const;

/**
 * Minimum tokens required to attempt LLM extraction.
 * Prevents starting extraction that will fail mid-way.
 */
export const MIN_TOKENS_FOR_EXTRACTION = 2000;

// ============================================================================
// Service Implementation
// ============================================================================

export class ExtractionStrategyService {
  private configService: LLMConfigService;

  constructor(configService: LLMConfigService) {
    this.configService = configService;
  }

  /**
   * Select the best extraction strategy for a user.
   *
   * Decision hierarchy:
   * 1. Check if user has consent for LLM usage
   * 2. Check if any API key is available
   * 3. Check preferred provider availability
   * 4. Check budget capacity
   * 5. Return hybrid if all checks pass
   *
   * @param userId - The user ID to check configuration for
   * @param context - Optional context (message count, etc.)
   * @returns Strategy with method, provider, reason, and fallback
   */
  async selectStrategy(
    userId: string,
    context?: StrategyContext
  ): Promise<ExtractionStrategy> {
    try {
      // Get user's LLM configuration
      const config = await this.configService.getUserConfig(userId);

      // Check if user has given consent for LLM usage
      if (!config.hasConsent) {
        return {
          method: 'pattern',
          reason: 'LLM data consent not granted',
          fallbackMethod: 'pattern',
        };
      }

      // Check API key availability
      if (!config.hasOpenAI && !config.hasAnthropic) {
        return {
          method: 'pattern',
          reason: 'No LLM API keys configured',
          fallbackMethod: 'pattern',
        };
      }

      // Determine provider based on preference and availability
      const providerResult = this.selectProvider(config);
      if (!providerResult.available) {
        return {
          method: 'pattern',
          reason: providerResult.reason,
          fallbackMethod: 'pattern',
        };
      }

      // Check budget
      const messageCount = context?.messageCount || 0;
      const budgetCheck = this.checkBudget(config, messageCount);

      if (!budgetCheck.hasCapacity) {
        return {
          method: 'pattern',
          reason: budgetCheck.reason,
          fallbackMethod: 'pattern',
          budgetRemaining: budgetCheck.remaining,
        };
      }

      // All checks passed - recommend hybrid
      return {
        method: 'hybrid',
        provider: providerResult.provider,
        reason: 'LLM available and within budget',
        fallbackMethod: 'pattern',
        budgetRemaining: budgetCheck.remaining,
        estimatedTokenCost: this.estimateTokenCost(messageCount),
      };
    } catch (error) {
      console.error('[StrategySelector] Error selecting strategy:', error);
      return {
        method: 'pattern',
        reason: 'Error checking LLM availability, using pattern matching',
        fallbackMethod: 'pattern',
      };
    }
  }

  /**
   * Select LLM-only strategy if available.
   * Falls back to pattern if LLM is not available.
   *
   * @param userId - The user ID to check configuration for
   * @param context - Optional context (message count, etc.)
   * @returns Strategy configured for LLM-only mode
   */
  async selectLLMOnlyStrategy(
    userId: string,
    context?: StrategyContext
  ): Promise<ExtractionStrategy> {
    const strategy = await this.selectStrategy(userId, context);

    if (strategy.method === 'pattern') {
      // Can't do LLM-only if LLM not available
      return {
        ...strategy,
        reason: `LLM-only not available: ${strategy.reason}`,
      };
    }

    return {
      ...strategy,
      method: 'llm',
      reason: 'LLM-only mode requested and available',
    };
  }

  /**
   * Force pattern-only mode.
   * Useful for testing, user override, or when LLM is known to be unavailable.
   *
   * @returns Strategy configured for pattern-only mode
   */
  getPatternOnlyStrategy(): ExtractionStrategy {
    return {
      method: 'pattern',
      reason: 'Pattern-only mode explicitly requested',
      fallbackMethod: 'pattern',
    };
  }

  /**
   * Determine the best provider based on preference and availability.
   */
  private selectProvider(config: LLMUserConfig): {
    available: boolean;
    provider?: LLMProvider;
    reason: string;
  } {
    const preferred = config.preferredProvider;
    const hasPreferredKey =
      preferred === 'openai' ? config.hasOpenAI : config.hasAnthropic;

    // Preferred provider is available
    if (hasPreferredKey) {
      return {
        available: true,
        provider: preferred,
        reason: `Using preferred provider: ${preferred}`,
      };
    }

    // Try alternate provider
    const altProvider: LLMProvider = preferred === 'openai' ? 'anthropic' : 'openai';
    const hasAltKey = altProvider === 'openai' ? config.hasOpenAI : config.hasAnthropic;

    if (hasAltKey) {
      return {
        available: true,
        provider: altProvider,
        reason: `Preferred provider ${preferred} not available, using ${altProvider}`,
      };
    }

    // No providers available
    return {
      available: false,
      reason: `No API key available for ${preferred} or ${altProvider}`,
    };
  }

  /**
   * Check if user has budget capacity for LLM usage.
   *
   * Checks in order:
   * 1. Platform allowance (if enabled)
   * 2. Personal budget limit (if set)
   * 3. Unlimited (if no limits configured)
   */
  private checkBudget(
    config: LLMUserConfig,
    messageCount: number
  ): { hasCapacity: boolean; remaining: number; reason: string } {
    const estimatedTokens = this.estimateTokenCost(messageCount);

    // Check platform allowance first
    if (config.usePlatformAllowance) {
      const remaining = config.platformAllowanceRemaining;

      if (remaining < MIN_TOKENS_FOR_EXTRACTION) {
        return {
          hasCapacity: false,
          remaining,
          reason: `Platform allowance too low (${remaining.toLocaleString()} tokens remaining, need ~${estimatedTokens.toLocaleString()})`,
        };
      }

      if (remaining < estimatedTokens) {
        return {
          hasCapacity: false,
          remaining,
          reason: `Platform allowance insufficient for this extraction (${remaining.toLocaleString()} remaining, need ~${estimatedTokens.toLocaleString()})`,
        };
      }

      return {
        hasCapacity: true,
        remaining,
        reason: 'Within platform allowance',
      };
    }

    // Check personal budget
    const budgetLimit = config.budgetLimit;
    const tokensUsed = config.tokensUsed;

    if (budgetLimit !== undefined && budgetLimit > 0) {
      const remaining = budgetLimit - tokensUsed;

      if (remaining < MIN_TOKENS_FOR_EXTRACTION) {
        return {
          hasCapacity: false,
          remaining,
          reason: `Monthly budget too low (${remaining.toLocaleString()} tokens remaining, need ~${estimatedTokens.toLocaleString()})`,
        };
      }

      if (remaining < estimatedTokens) {
        return {
          hasCapacity: false,
          remaining,
          reason: `Monthly budget insufficient for this extraction (${remaining.toLocaleString()} remaining, need ~${estimatedTokens.toLocaleString()})`,
        };
      }

      return {
        hasCapacity: true,
        remaining,
        reason: 'Within monthly budget',
      };
    }

    // No budget limit set
    return {
      hasCapacity: true,
      remaining: Infinity,
      reason: 'No budget limit configured',
    };
  }

  /**
   * Estimate token cost for processing messages.
   *
   * Conservative estimates:
   * - Message analysis: ~800 tokens per message (prompt + completion)
   * - Clustering: ~1500 tokens (once per batch)
   * - Contact extraction: ~1200 tokens (once per cluster)
   *
   * @param messageCount - Number of messages to process
   * @returns Estimated total token cost
   */
  estimateTokenCost(messageCount: number): number {
    if (messageCount <= 0) {
      // Minimum cost even for 0 messages (clustering + contact extraction)
      return TOKEN_COST_ESTIMATES.clustering + TOKEN_COST_ESTIMATES.contactExtraction;
    }

    const messageTokens = messageCount * TOKEN_COST_ESTIMATES.perMessage;
    const clusteringTokens = TOKEN_COST_ESTIMATES.clustering;
    const contactTokens = TOKEN_COST_ESTIMATES.contactExtraction;

    return messageTokens + clusteringTokens + contactTokens;
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let _instance: ExtractionStrategyService | null = null;

/**
 * Get the extraction strategy service instance.
 * Creates a singleton on first call.
 *
 * @param configService - LLMConfigService instance to use
 * @returns ExtractionStrategyService instance
 */
export function getExtractionStrategyService(
  configService: LLMConfigService
): ExtractionStrategyService {
  if (!_instance) {
    _instance = new ExtractionStrategyService(configService);
  }
  return _instance;
}

/**
 * Reset the singleton instance.
 * Useful for testing.
 */
export function resetExtractionStrategyService(): void {
  _instance = null;
}
