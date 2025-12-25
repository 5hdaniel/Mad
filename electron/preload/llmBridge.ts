/**
 * LLM Bridge
 * LLM configuration, API key management, and usage tracking
 */

import { ipcRenderer } from "electron";

export const llmBridge = {
  /**
   * Gets user's LLM configuration summary
   * @param userId - User ID
   * @returns Configuration result
   */
  getConfig: (userId: string) => ipcRenderer.invoke("llm:get-config", userId),

  /**
   * Sets API key for a provider
   * @param userId - User ID
   * @param provider - LLM provider
   * @param apiKey - API key to store (will be encrypted)
   * @returns Set result
   */
  setApiKey: (
    userId: string,
    provider: "openai" | "anthropic",
    apiKey: string
  ) => ipcRenderer.invoke("llm:set-api-key", userId, provider, apiKey),

  /**
   * Validates API key without storing
   * @param provider - LLM provider
   * @param apiKey - API key to validate
   * @returns Validation result
   */
  validateKey: (provider: "openai" | "anthropic", apiKey: string) =>
    ipcRenderer.invoke("llm:validate-key", provider, apiKey),

  /**
   * Removes API key for a provider
   * @param userId - User ID
   * @param provider - LLM provider
   * @returns Remove result
   */
  removeApiKey: (userId: string, provider: "openai" | "anthropic") =>
    ipcRenderer.invoke("llm:remove-api-key", userId, provider),

  /**
   * Updates LLM preferences
   * @param userId - User ID
   * @param preferences - Preferences to update
   * @returns Update result
   */
  updatePreferences: (
    userId: string,
    preferences: {
      preferredProvider?: "openai" | "anthropic";
      openAIModel?: string;
      anthropicModel?: string;
      enableAutoDetect?: boolean;
      enableRoleExtraction?: boolean;
      usePlatformAllowance?: boolean;
      budgetLimit?: number;
    }
  ) => ipcRenderer.invoke("llm:update-preferences", userId, preferences),

  /**
   * Records user consent for LLM data processing
   * @param userId - User ID
   * @param consent - Whether user consents
   * @returns Consent result
   */
  recordConsent: (userId: string, consent: boolean) =>
    ipcRenderer.invoke("llm:record-consent", userId, consent),

  /**
   * Gets usage statistics
   * @param userId - User ID
   * @returns Usage stats
   */
  getUsage: (userId: string) => ipcRenderer.invoke("llm:get-usage", userId),

  /**
   * Checks if user can use LLM features
   * @param userId - User ID
   * @returns Availability result
   */
  canUse: (userId: string) => ipcRenderer.invoke("llm:can-use", userId),
};
