/**
 * LLM Service Types and Interfaces
 * Foundation for AI-powered transaction detection
 */

// Provider configuration
export type LLMProvider = 'openai' | 'anthropic';

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
