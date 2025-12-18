/**
 * LLM IPC Handlers
 * Exposes LLM configuration service to the renderer process through the preload bridge.
 *
 * SECURITY:
 * - No sensitive data (API keys) in logs or error responses
 * - Uses consistent LLMHandlerResponse wrapper
 * - Handlers are thin wrappers delegating to LLMConfigService
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import {
  LLMConfigService,
  type LLMUserConfig,
  type LLMPreferences,
  type LLMUsageStats,
  type LLMAvailability,
} from './services/llm/llmConfigService';
import { LLMError, type LLMProvider } from './services/llm/types';

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
 * Wraps successful response data in standard response format.
 */
function wrapResponse<T>(data: T): LLMHandlerResponse<T> {
  return { success: true, data };
}

/**
 * Wraps errors in standard response format.
 * SECURITY: Never exposes internal error details or sensitive data.
 */
function wrapError(error: unknown): LLMHandlerResponse<never> {
  if (error instanceof LLMError) {
    return {
      success: false,
      error: {
        message: error.message,
        type: error.type,
        retryable: error.retryable,
      },
    };
  }
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        message: error.message,
        type: 'unknown',
        retryable: false,
      },
    };
  }
  return {
    success: false,
    error: {
      message: String(error),
      type: 'unknown',
      retryable: false,
    },
  };
}

/**
 * Registers all LLM-related IPC handlers.
 * @param configService - Instance of LLMConfigService to delegate operations to.
 */
export function registerLLMHandlers(configService: LLMConfigService): void {
  /**
   * Get user's LLM configuration summary.
   * Channel: llm:get-config
   */
  ipcMain.handle(
    'llm:get-config',
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<LLMHandlerResponse<LLMUserConfig>> => {
      try {
        const config = await configService.getUserConfig(userId);
        return wrapResponse(config);
      } catch (error) {
        console.error('[LLM Handler] Get config failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Set API key for a provider.
   * Channel: llm:set-api-key
   * SECURITY: API key is encrypted before storage by the config service.
   */
  ipcMain.handle(
    'llm:set-api-key',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      provider: LLMProvider,
      apiKey: string
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.setApiKey(userId, provider, apiKey);
        // Log success without exposing the API key
        console.log(`[LLM Handler] API key set for provider: ${provider}`);
        return wrapResponse(undefined);
      } catch (error) {
        console.error('[LLM Handler] Set API key failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Validate API key without storing.
   * Channel: llm:validate-key
   * Makes a minimal API call to verify the key works.
   */
  ipcMain.handle(
    'llm:validate-key',
    async (
      _event: IpcMainInvokeEvent,
      provider: LLMProvider,
      apiKey: string
    ): Promise<LLMHandlerResponse<boolean>> => {
      try {
        const isValid = await configService.validateApiKey(provider, apiKey);
        return wrapResponse(isValid);
      } catch (error) {
        console.error('[LLM Handler] Validate key failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Remove API key for a provider.
   * Channel: llm:remove-api-key
   */
  ipcMain.handle(
    'llm:remove-api-key',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      provider: LLMProvider
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.removeApiKey(userId, provider);
        console.log(`[LLM Handler] API key removed for provider: ${provider}`);
        return wrapResponse(undefined);
      } catch (error) {
        console.error('[LLM Handler] Remove API key failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Update LLM preferences.
   * Channel: llm:update-preferences
   */
  ipcMain.handle(
    'llm:update-preferences',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      preferences: LLMPreferences
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.updatePreferences(userId, preferences);
        return wrapResponse(undefined);
      } catch (error) {
        console.error('[LLM Handler] Update preferences failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Record user consent for LLM data processing.
   * Channel: llm:record-consent
   * SECURITY: Consent is required before any LLM operation.
   */
  ipcMain.handle(
    'llm:record-consent',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      consent: boolean
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.recordConsent(userId, consent);
        console.log(`[LLM Handler] Consent recorded: ${consent}`);
        return wrapResponse(undefined);
      } catch (error) {
        console.error('[LLM Handler] Record consent failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Get usage statistics.
   * Channel: llm:get-usage
   */
  ipcMain.handle(
    'llm:get-usage',
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<LLMHandlerResponse<LLMUsageStats>> => {
      try {
        const stats = await configService.getUsageStats(userId);
        return wrapResponse(stats);
      } catch (error) {
        console.error('[LLM Handler] Get usage failed:', error);
        return wrapError(error);
      }
    }
  );

  /**
   * Check if user can use LLM features.
   * Channel: llm:can-use
   * Checks consent, API key availability, and budget limits.
   */
  ipcMain.handle(
    'llm:can-use',
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<LLMHandlerResponse<LLMAvailability>> => {
      try {
        const result = await configService.canUseLLM(userId);
        return wrapResponse(result);
      } catch (error) {
        console.error('[LLM Handler] Can use check failed:', error);
        return wrapError(error);
      }
    }
  );
}
