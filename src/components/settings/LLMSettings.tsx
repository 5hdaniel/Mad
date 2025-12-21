import React, { useState, useEffect, useCallback } from "react";

/**
 * LLM Configuration types - matches electron/types/ipc.ts
 */
interface LLMUserConfig {
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  preferredProvider: "openai" | "anthropic" | null;
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

interface LLMUsageStats {
  tokensThisMonth: number;
  budgetLimit?: number;
  budgetRemaining?: number;
  platformAllowance: number;
  platformUsed: number;
  resetDate?: string;
}

interface LLMSettingsProps {
  userId: string;
}

type ProviderType = "openai" | "anthropic";
type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
];

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Recommended)" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Faster)" },
];

/**
 * Consent Modal Component
 * Displays before LLM features can be used
 */
function ConsentModal({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            AI Features - Data Processing Consent
          </h3>
        </div>

        <div className="text-sm text-gray-600 space-y-3 mb-6">
          <p>Before using AI features, please acknowledge:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Your email content will be sent to OpenAI or Anthropic for
              analysis.
            </li>
            <li>
              This includes email subjects, bodies, and sender/recipient
              information.
            </li>
            <li>
              Personal information is sanitized before sending, but some content
              may still be transmitted to the AI provider.
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            You can revoke consent at any time in settings.
          </p>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">
            I understand and consent to this data processing
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={!acknowledged}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Provider Settings Panel
 * Handles API key input, validation, and model selection for a single provider
 */
function ProviderSettings({
  provider,
  hasKey,
  apiKey,
  onKeyChange,
  showKey,
  onToggleShow,
  onValidate,
  validating,
  validationStatus,
  onSave,
  onRemove,
  selectedModel,
  onModelChange,
  models,
}: {
  provider: ProviderType;
  hasKey: boolean;
  apiKey: string;
  onKeyChange: (key: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  onValidate: () => void;
  validating: boolean;
  validationStatus: ValidationStatus;
  onSave: () => void;
  onRemove: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  models: Array<{ value: string; label: string }>;
}) {
  const providerName = provider === "openai" ? "OpenAI" : "Anthropic";
  const keyPrefix = provider === "openai" ? "sk-" : "sk-ant-";
  const isKeyChanged = apiKey && !apiKey.startsWith("*");

  return (
    <div className="space-y-4">
      {/* API Key Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {providerName} API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={`Enter your ${providerName} API key (${keyPrefix}...)`}
            className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700"
            title={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Validation Status */}
        {validationStatus !== "idle" && (
          <div className="mt-2 flex items-center gap-2">
            {validationStatus === "validating" && (
              <>
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">Validating...</span>
              </>
            )}
            {validationStatus === "valid" && (
              <>
                <svg
                  className="w-4 h-4 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm text-green-600">
                  API key is valid
                </span>
              </>
            )}
            {validationStatus === "invalid" && (
              <>
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <span className="text-sm text-red-600">
                  Invalid API key
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onValidate}
          disabled={!apiKey || validating || apiKey.startsWith("*")}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {validating ? "Validating..." : "Validate Key"}
        </button>
        {isKeyChanged && (
          <button
            onClick={onSave}
            disabled={validating || validationStatus !== "valid"}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Key
          </button>
        )}
        {hasKey && (
          <button
            onClick={onRemove}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-medium text-sm rounded-lg transition-colors"
          >
            Remove Key
          </button>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={!hasKey}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {models.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Usage Display Component
 */
function UsageDisplay({
  tokensUsed,
  budgetLimit,
}: {
  tokensUsed: number;
  budgetLimit?: number;
}) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const percentage = budgetLimit
    ? Math.min((tokensUsed / budgetLimit) * 100, 100)
    : 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">
        Usage This Month
      </h4>
      <div>
        <p className="text-2xl font-bold text-gray-900">
          {formatNumber(tokensUsed)}
        </p>
        <p className="text-xs text-gray-500">tokens used</p>
      </div>
      {budgetLimit && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Budget usage</span>
            <span>
              {formatNumber(tokensUsed)} / {formatNumber(budgetLimit)}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                percentage > 90
                  ? "bg-red-500"
                  : percentage > 70
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Feature Toggle Component
 */
function FeatureToggle({
  label,
  description,
  enabled,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900">{label}</h4>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`ml-4 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-purple-600" : "bg-gray-300"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * LLMSettings Component
 * Main settings panel for LLM configuration
 */
export function LLMSettings({ userId }: LLMSettingsProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ProviderType>("openai");

  // Config state
  const [config, setConfig] = useState<LLMUserConfig | null>(null);
  const [usage, setUsage] = useState<LLMUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API key state (per provider)
  const [openAIKey, setOpenAIKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [openAIValidation, setOpenAIValidation] =
    useState<ValidationStatus>("idle");
  const [anthropicValidation, setAnthropicValidation] =
    useState<ValidationStatus>("idle");

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Load config and usage on mount
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResult, usageResult] = await Promise.all([
        window.api.llm.getConfig(userId),
        window.api.llm.getUsage(userId),
      ]);

      if (configResult.success && configResult.data) {
        setConfig(configResult.data as LLMUserConfig);
        // Show masked keys if they exist
        if (configResult.data.hasOpenAI) {
          setOpenAIKey("********************************");
        }
        if (configResult.data.hasAnthropic) {
          setAnthropicKey("********************************");
        }
        // Show consent modal if consent not given
        if (!configResult.data.hasConsent) {
          setShowConsentModal(true);
        }
      }

      if (usageResult.success && usageResult.data) {
        setUsage(usageResult.data as LLMUsageStats);
      }
    } catch (err) {
      setError("Failed to load LLM settings");
      console.error("Error loading LLM config:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Handle API key validation
  const handleValidateKey = async (provider: ProviderType) => {
    const key = provider === "openai" ? openAIKey : anthropicKey;
    const setValidation =
      provider === "openai" ? setOpenAIValidation : setAnthropicValidation;

    if (!key || key.startsWith("*")) return;

    setValidation("validating");
    try {
      const result = await window.api.llm.validateKey(provider, key);
      setValidation(result.success && result.data ? "valid" : "invalid");
    } catch {
      setValidation("invalid");
    }
  };

  // Handle API key save
  const handleSaveKey = async (provider: ProviderType) => {
    const key = provider === "openai" ? openAIKey : anthropicKey;
    if (!key || key.startsWith("*")) return;

    try {
      const result = await window.api.llm.setApiKey(userId, provider, key);
      if (result.success) {
        // Reload config to get updated state
        await loadConfig();
        // Reset validation state
        if (provider === "openai") {
          setOpenAIValidation("idle");
        } else {
          setAnthropicValidation("idle");
        }
      }
    } catch (err) {
      console.error("Error saving API key:", err);
    }
  };

  // Handle API key removal
  const handleRemoveKey = async (provider: ProviderType) => {
    try {
      const result = await window.api.llm.removeApiKey(userId, provider);
      if (result.success) {
        if (provider === "openai") {
          setOpenAIKey("");
          setOpenAIValidation("idle");
        } else {
          setAnthropicKey("");
          setAnthropicValidation("idle");
        }
        await loadConfig();
      }
    } catch (err) {
      console.error("Error removing API key:", err);
    }
  };

  // Handle preference updates
  const handlePreferenceUpdate = async (
    preferences: Partial<{
      preferredProvider: ProviderType;
      openAIModel: string;
      anthropicModel: string;
      enableAutoDetect: boolean;
      enableRoleExtraction: boolean;
      usePlatformAllowance: boolean;
      budgetLimit: number;
    }>
  ) => {
    try {
      const result = await window.api.llm.updatePreferences(userId, preferences);
      if (result.success) {
        setConfig((prev) => (prev ? { ...prev, ...preferences } : prev));
      }
    } catch (err) {
      console.error("Error updating preferences:", err);
    }
  };

  // Handle consent
  const handleAcceptConsent = async () => {
    try {
      const result = await window.api.llm.recordConsent(userId, true);
      if (result.success) {
        setShowConsentModal(false);
        setConfig((prev) =>
          prev ? { ...prev, hasConsent: true } : prev
        );
      }
    } catch (err) {
      console.error("Error recording consent:", err);
    }
  };

  const handleDeclineConsent = () => {
    setShowConsentModal(false);
  };

  // Handle key change (reset validation)
  const handleKeyChange = (provider: ProviderType, value: string) => {
    if (provider === "openai") {
      setOpenAIKey(value);
      setOpenAIValidation("idle");
    } else {
      setAnthropicKey(value);
      setAnthropicValidation("idle");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadConfig}
          className="mt-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      {showConsentModal && (
        <ConsentModal
          onAccept={handleAcceptConsent}
          onDecline={handleDeclineConsent}
        />
      )}

      <div className="space-y-6">
        {/* Provider Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("openai")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "openai"
                  ? "border-b-2 border-purple-500 text-purple-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              OpenAI
            </button>
            <button
              onClick={() => setActiveTab("anthropic")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "anthropic"
                  ? "border-b-2 border-purple-500 text-purple-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Anthropic
            </button>
          </div>
        </div>

        {/* Provider Settings */}
        {activeTab === "openai" && (
          <ProviderSettings
            provider="openai"
            hasKey={config?.hasOpenAI || false}
            apiKey={openAIKey}
            onKeyChange={(key) => handleKeyChange("openai", key)}
            showKey={showOpenAIKey}
            onToggleShow={() => setShowOpenAIKey(!showOpenAIKey)}
            onValidate={() => handleValidateKey("openai")}
            validating={openAIValidation === "validating"}
            validationStatus={openAIValidation}
            onSave={() => handleSaveKey("openai")}
            onRemove={() => handleRemoveKey("openai")}
            selectedModel={config?.openAIModel || "gpt-4o"}
            onModelChange={(model) =>
              handlePreferenceUpdate({ openAIModel: model })
            }
            models={OPENAI_MODELS}
          />
        )}

        {activeTab === "anthropic" && (
          <ProviderSettings
            provider="anthropic"
            hasKey={config?.hasAnthropic || false}
            apiKey={anthropicKey}
            onKeyChange={(key) => handleKeyChange("anthropic", key)}
            showKey={showAnthropicKey}
            onToggleShow={() => setShowAnthropicKey(!showAnthropicKey)}
            onValidate={() => handleValidateKey("anthropic")}
            validating={anthropicValidation === "validating"}
            validationStatus={anthropicValidation}
            onSave={() => handleSaveKey("anthropic")}
            onRemove={() => handleRemoveKey("anthropic")}
            selectedModel={config?.anthropicModel || "claude-sonnet-4-20250514"}
            onModelChange={(model) =>
              handlePreferenceUpdate({ anthropicModel: model })
            }
            models={ANTHROPIC_MODELS}
          />
        )}

        {/* Usage Display */}
        {usage && (
          <UsageDisplay
            tokensUsed={usage.tokensThisMonth}
            budgetLimit={config?.budgetLimit}
          />
        )}

        {/* Platform Allowance Toggle */}
        <FeatureToggle
          label="Use Platform Allowance"
          description="Use your subscription's included AI tokens before using your own API keys"
          enabled={config?.usePlatformAllowance || false}
          onChange={(enabled) =>
            handlePreferenceUpdate({ usePlatformAllowance: enabled })
          }
        />

        {/* Feature Toggles */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">AI Features</h4>
          <FeatureToggle
            label="Auto-Detect Transactions"
            description="Automatically detect and categorize real estate transactions from emails"
            enabled={config?.autoDetectEnabled || false}
            onChange={(enabled) =>
              handlePreferenceUpdate({ enableAutoDetect: enabled })
            }
            disabled={!config?.hasConsent}
          />
          <FeatureToggle
            label="Role Extraction"
            description="Automatically extract contact roles from email content"
            enabled={config?.roleExtractionEnabled || false}
            onChange={(enabled) =>
              handlePreferenceUpdate({ enableRoleExtraction: enabled })
            }
            disabled={!config?.hasConsent}
          />
        </div>

        {/* Consent Status */}
        {config?.hasConsent && (
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-green-700">
                Data processing consent given
              </span>
            </div>
            <button
              onClick={() => setShowConsentModal(true)}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              View Details
            </button>
          </div>
        )}

        {!config?.hasConsent && (
          <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-sm text-yellow-700">
                Consent required to use AI features
              </span>
            </div>
            <button
              onClick={() => setShowConsentModal(true)}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
            >
              Give Consent
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default LLMSettings;
