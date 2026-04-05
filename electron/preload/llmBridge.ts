/**
 * LLM Bridge
 * LLM configuration, API key management, and usage tracking
 */

import { ipcRenderer } from "electron";

export const llmBridge = {
  /**
   * Gets user's LLM configuration summary
   */
  getConfig: (userId: string) => ipcRenderer.invoke("llm:get-config", userId),

  /**
   * Sets API key for a provider
   */
  setApiKey: (
    userId: string,
    provider: "openai" | "anthropic" | "local",
    apiKey: string
  ) => ipcRenderer.invoke("llm:set-api-key", userId, provider, apiKey),

  /**
   * Validates API key without storing
   */
  validateKey: (provider: "openai" | "anthropic" | "local", apiKey: string) =>
    ipcRenderer.invoke("llm:validate-key", provider, apiKey),

  /**
   * Removes API key for a provider
   */
  removeApiKey: (userId: string, provider: "openai" | "anthropic" | "local") =>
    ipcRenderer.invoke("llm:remove-api-key", userId, provider),

  /**
   * Updates LLM preferences
   */
  updatePreferences: (
    userId: string,
    preferences: {
      preferredProvider?: "openai" | "anthropic" | "local";
      openAIModel?: string;
      anthropicModel?: string;
      localModel?: string;
      enableAutoDetect?: boolean;
      enableRoleExtraction?: boolean;
      usePlatformAllowance?: boolean;
      budgetLimit?: number;
    }
  ) => ipcRenderer.invoke("llm:update-preferences", userId, preferences),

  /**
   * Records user consent for LLM data processing
   */
  recordConsent: (userId: string, consent: boolean) =>
    ipcRenderer.invoke("llm:record-consent", userId, consent),

  /**
   * Gets usage statistics
   */
  getUsage: (userId: string) => ipcRenderer.invoke("llm:get-usage", userId),

  /**
   * Checks if user can use LLM features
   */
  canUse: (userId: string) => ipcRenderer.invoke("llm:can-use", userId),

  // ============================================
  // LOCAL AI (Gemma 4 model management)
  // ============================================

  /**
   * Get local AI status — system info, downloaded models, recommendation
   */
  getLocalStatus: () => ipcRenderer.invoke("llm:local-status"),

  /**
   * Download a Gemma model from HuggingFace
   */
  downloadModel: (modelId: string) =>
    ipcRenderer.invoke("llm:download-model", modelId),

  /**
   * Cancel an in-progress model download
   */
  cancelDownload: () => ipcRenderer.invoke("llm:cancel-download"),

  /**
   * Delete a downloaded model to free disk space
   */
  deleteLocalModel: (modelId: string) =>
    ipcRenderer.invoke("llm:delete-local-model", modelId),

  /**
   * Get system capabilities for model recommendation
   */
  getSystemCapabilities: () =>
    ipcRenderer.invoke("llm:get-system-capabilities"),

  /**
   * Listen for model download progress events
   */
  onDownloadProgress: (
    callback: (event: unknown, progress: { modelId: string; percent: number; bytesDownloaded: number; totalBytes: number; speed: number }) => void
  ) => {
    ipcRenderer.on("llm:download-progress", callback);
  },

  /**
   * Stop listening for download progress events
   */
  offDownloadProgress: (callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener("llm:download-progress", callback);
  },

  // ============================================
  // TIMELINE (AI Transaction Timeline)
  // ============================================

  /**
   * Get cached timeline for a transaction
   */
  getTimeline: (transactionId: string) =>
    ipcRenderer.invoke("timeline:get", transactionId),

  /**
   * Generate timeline for a transaction
   */
  generateTimeline: (transactionId: string, userId: string) =>
    ipcRenderer.invoke("timeline:generate", transactionId, userId),
};
