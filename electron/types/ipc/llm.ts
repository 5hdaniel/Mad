/**
 * LLM (Large Language Model) IPC types
 */

// ============================================
// LLM TYPE DEFINITIONS
// ============================================

/**
 * LLM provider type
 */
export type LLMProvider = "openai" | "anthropic";

/**
 * Response wrapper for consistent error handling across all LLM handlers.
 */
export interface LLMHandlerResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    type: string;
    retryable: boolean;
  };
}

/**
 * User-facing LLM configuration summary.
 * Never exposes raw API keys or sensitive settings.
 */
export interface LLMUserConfig {
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  preferredProvider: LLMProvider;
  openAIModel: string;
  anthropicModel: string;
  tokensUsed: number;
  budgetLimit?: number;
  platformAllowanceRemaining: number;
  usePlatformAllowance: boolean;
  autoDetectEnabled: boolean;
  roleExtractionEnabled: boolean;
  hasConsent: boolean;
}

/**
 * Preferences that can be updated by the user.
 */
export interface LLMPreferences {
  preferredProvider?: LLMProvider;
  openAIModel?: string;
  anthropicModel?: string;
  enableAutoDetect?: boolean;
  enableRoleExtraction?: boolean;
  usePlatformAllowance?: boolean;
  budgetLimit?: number;
}

/**
 * Usage statistics for display.
 */
export interface LLMUsageStats {
  tokensThisMonth: number;
  budgetLimit?: number;
  budgetRemaining?: number;
  platformAllowance: number;
  platformUsed: number;
  resetDate?: string;
}

/**
 * Result of canUseLLM check.
 */
export interface LLMAvailability {
  canUse: boolean;
  reason?: string;
}
