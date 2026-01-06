/**
 * LLM Service
 *
 * Service abstraction for LLM configuration and usage API calls.
 * Centralizes all window.api.llm calls and provides type-safe wrappers.
 */

import type {
  LLMUserConfig,
  LLMPreferences,
  LLMUsageStats,
  LLMAvailability,
  LLMProvider,
} from "@/types";
import { type ApiResult, getErrorMessage } from "./index";

/**
 * LLM Service
 * Provides a clean abstraction over window.api.llm
 */
export const llmService = {
  /**
   * Get LLM configuration for a user
   * Returns user-facing config (never exposes raw API keys)
   */
  async getConfig(userId: string): Promise<ApiResult<LLMUserConfig>> {
    try {
      const result = await window.api.llm.getConfig(userId);
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to get LLM config",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Set an API key for a provider
   */
  async setApiKey(
    userId: string,
    provider: LLMProvider,
    apiKey: string
  ): Promise<ApiResult> {
    try {
      const result = await window.api.llm.setApiKey(userId, provider, apiKey);
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to set API key",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Validate an API key for a provider
   */
  async validateKey(
    provider: LLMProvider,
    apiKey: string
  ): Promise<ApiResult<boolean>> {
    try {
      const result = await window.api.llm.validateKey(provider, apiKey);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to validate API key",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Remove an API key for a provider
   */
  async removeApiKey(userId: string, provider: LLMProvider): Promise<ApiResult> {
    try {
      const result = await window.api.llm.removeApiKey(userId, provider);
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to remove API key",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Update LLM preferences
   */
  async updatePreferences(
    userId: string,
    preferences: LLMPreferences
  ): Promise<ApiResult> {
    try {
      const result = await window.api.llm.updatePreferences(userId, preferences);
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to update preferences",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Record user consent for LLM data processing
   */
  async recordConsent(userId: string, consent: boolean): Promise<ApiResult> {
    try {
      const result = await window.api.llm.recordConsent(userId, consent);
      if (result.success) {
        return { success: true };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to record consent",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get LLM usage statistics
   */
  async getUsage(userId: string): Promise<ApiResult<LLMUsageStats>> {
    try {
      const result = await window.api.llm.getUsage(userId);
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to get usage stats",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check if user can use LLM features
   */
  async canUse(userId: string): Promise<ApiResult<LLMAvailability>> {
    try {
      const result = await window.api.llm.canUse(userId);
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: result.error?.message || "Failed to check LLM availability",
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export default llmService;
