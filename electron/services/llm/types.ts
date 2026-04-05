/**
 * LLM Service Types and Interfaces
 * Foundation for AI-powered transaction detection
 */

// Provider configuration
export type LLMProvider = 'openai' | 'anthropic' | 'local';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number; // ms
}

// API Response
export interface LLMResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  latencyMs: number;
}

// Error types
export type LLMErrorType =
  | 'rate_limit'
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'context_length'
  | 'content_filter'
  | 'network'
  | 'timeout'
  | 'unknown';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly type: LLMErrorType,
    public readonly provider: LLMProvider,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// Tool/Function calling (for future use)
export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

// Message format for chat completions
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Provider-specific models with cost information
export const OPENAI_MODELS = {
  'gpt-4o-mini': {
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  'gpt-4o': {
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
  'gpt-4-turbo': {
    contextWindow: 128000,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
  },
} as const;

export const ANTHROPIC_MODELS = {
  'claude-3-haiku-20240307': {
    contextWindow: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
  },
  'claude-3-5-sonnet-20241022': {
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  'claude-3-opus-20240229': {
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
} as const;

export type OpenAIModel = keyof typeof OPENAI_MODELS;
export type AnthropicModel = keyof typeof ANTHROPIC_MODELS;

// Local Gemma 4 models (free, on-device via node-llama-cpp)
export const GEMMA_MODELS = {
  'gemma-4-e2b-it-q4': {
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    ramRequired: 1536, // MB
    label: 'Gemma 4 E2B (Lightweight, ~1.5 GB)',
    description: 'Ultra-light model for basic tasks. Runs on any machine.',
    ggufFile: 'gemma-4-e2b-it-Q4_K_M.gguf',
    huggingFaceRepo: 'google/gemma-4-e2b-it-GGUF',
    downloadSizeMB: 1400,
  },
  'gemma-4-e4b-it-q4': {
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    ramRequired: 5120, // MB
    label: 'Gemma 4 E4B (Recommended, ~5 GB)',
    description: 'Best balance of quality and speed for most users.',
    ggufFile: 'gemma-4-e4b-it-Q4_K_M.gguf',
    huggingFaceRepo: 'google/gemma-4-e4b-it-GGUF',
    downloadSizeMB: 4800,
  },
  'gemma-4-26b-a4b-it-q4': {
    contextWindow: 32000,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    ramRequired: 18432, // MB
    label: 'Gemma 4 26B MoE (Power, ~18 GB)',
    description: 'High-quality MoE model for power users with 18GB+ RAM.',
    ggufFile: 'gemma-4-26b-a4b-it-Q4_K_M.gguf',
    huggingFaceRepo: 'google/gemma-4-26b-a4b-it-GGUF',
    downloadSizeMB: 17000,
  },
} as const;

export type GemmaModel = keyof typeof GEMMA_MODELS;
