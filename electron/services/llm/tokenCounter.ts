/**
 * Token estimation utilities for LLM API calls.
 * Uses approximation: ~4 characters per token for English text.
 */

import { LLMProvider, OPENAI_MODELS, ANTHROPIC_MODELS } from './types';

// Approximate characters per token (conservative estimate)
const CHARS_PER_TOKEN = 4;

export interface TokenEstimate {
  promptTokens: number;
  maxCompletionTokens: number;
  totalEstimate: number;
  estimatedCost: number; // USD
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number; // USD
}

/**
 * Estimate token count for a text string.
 * This is a rough approximation - actual counts vary by model.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Count characters, divide by average chars per token
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a complete prompt (messages array).
 */
export function estimatePromptTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const msg of messages) {
    // Add overhead for role formatting (~4 tokens per message)
    total += 4;
    total += estimateTokens(msg.content);
  }
  // Add overhead for message structure (~3 tokens)
  total += 3;
  return total;
}

/**
 * Get cost per 1000 tokens for a model.
 */
export function getModelCosts(
  provider: LLMProvider,
  model: string
): { inputPer1k: number; outputPer1k: number } {
  if (provider === 'openai') {
    const modelInfo = OPENAI_MODELS[model as keyof typeof OPENAI_MODELS];
    if (modelInfo) {
      return {
        inputPer1k: modelInfo.costPer1kInput,
        outputPer1k: modelInfo.costPer1kOutput,
      };
    }
  } else if (provider === 'anthropic') {
    const modelInfo = ANTHROPIC_MODELS[model as keyof typeof ANTHROPIC_MODELS];
    if (modelInfo) {
      return {
        inputPer1k: modelInfo.costPer1kInput,
        outputPer1k: modelInfo.costPer1kOutput,
      };
    }
  }
  // Default fallback costs
  return { inputPer1k: 0.001, outputPer1k: 0.002 };
}

/**
 * Calculate cost for token usage.
 */
export function calculateCost(
  usage: { promptTokens: number; completionTokens: number },
  provider: LLMProvider,
  model: string
): number {
  const costs = getModelCosts(provider, model);
  const inputCost = (usage.promptTokens / 1000) * costs.inputPer1k;
  const outputCost = (usage.completionTokens / 1000) * costs.outputPer1k;
  return inputCost + outputCost;
}

/**
 * Create a full token estimate before making an API call.
 */
export function createTokenEstimate(
  messages: Array<{ role: string; content: string }>,
  maxCompletionTokens: number,
  provider: LLMProvider,
  model: string
): TokenEstimate {
  const promptTokens = estimatePromptTokens(messages);
  const totalEstimate = promptTokens + maxCompletionTokens;
  const estimatedCost = calculateCost(
    { promptTokens, completionTokens: maxCompletionTokens },
    provider,
    model
  );

  return {
    promptTokens,
    maxCompletionTokens,
    totalEstimate,
    estimatedCost,
  };
}

/**
 * Create usage record from actual API response.
 */
export function createTokenUsage(
  promptTokens: number,
  completionTokens: number,
  provider: LLMProvider,
  model: string
): TokenUsage {
  const totalTokens = promptTokens + completionTokens;
  const cost = calculateCost({ promptTokens, completionTokens }, provider, model);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
  };
}
