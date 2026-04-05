/**
 * Local LLM Service
 * Runs Gemma 4 models on-device via node-llama-cpp.
 * No API key needed, no cloud costs, data stays on the user's machine.
 */

import { BaseLLMService, RetryConfig } from './baseLLMService';
import {
  LLMConfig,
  LLMResponse,
  LLMMessage,
  GEMMA_MODELS,
  GemmaModel,
} from './types';

// Dynamic imports for node-llama-cpp to avoid blocking startup
type LlamaInstance = Awaited<ReturnType<typeof import('node-llama-cpp')['getLlama']>>;
type LlamaModelInstance = Awaited<ReturnType<LlamaInstance['loadModel']>>;
type LlamaContextInstance = Awaited<ReturnType<LlamaModelInstance['createContext']>>;

/**
 * Status of the local LLM engine.
 */
export interface LocalLLMStatus {
  engineReady: boolean;
  modelLoaded: boolean;
  currentModel: GemmaModel | null;
  modelPath: string | null;
}

/**
 * Local LLM provider implementation using node-llama-cpp.
 * Runs Gemma 4 GGUF models entirely on the user's device.
 */
export class LocalLLMService extends BaseLLMService {
  private llama: LlamaInstance | null = null;
  private model: LlamaModelInstance | null = null;
  private context: LlamaContextInstance | null = null;
  private currentModelId: GemmaModel | null = null;
  private currentModelPath: string | null = null;
  private initializing = false;

  constructor(retryConfig?: RetryConfig) {
    // Local inference doesn't need rate limiting (no API limits)
    super('local', 999, retryConfig);
  }

  /**
   * Initialize the llama.cpp engine (lazy, only once).
   */
  private async ensureEngine(): Promise<LlamaInstance> {
    if (this.llama) return this.llama;
    if (this.initializing) {
      // Wait for existing initialization
      while (this.initializing) {
        await this.sleep(100);
      }
      if (this.llama) return this.llama;
    }

    this.initializing = true;
    try {
      const { getLlama } = await import('node-llama-cpp');
      this.llama = await getLlama();
      this.log('info', 'Local LLM engine initialized');
      return this.llama;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Load a GGUF model from disk.
   * @param modelPath - Full path to the .gguf file
   * @param modelId - The model identifier from GEMMA_MODELS
   */
  async initialize(modelPath: string, modelId?: GemmaModel): Promise<void> {
    // If same model is already loaded, skip
    if (this.model && this.currentModelPath === modelPath) {
      this.log('info', `Model already loaded: ${modelPath}`);
      return;
    }

    // Unload previous model if any
    await this.unload();

    const llama = await this.ensureEngine();

    this.log('info', `Loading model: ${modelPath}`);
    const startTime = Date.now();

    this.model = await llama.loadModel({
      modelPath,
    });

    this.context = await this.model.createContext({
      contextSize: modelId ? GEMMA_MODELS[modelId].contextWindow : 32000,
    });

    this.currentModelPath = modelPath;
    this.currentModelId = modelId ?? null;

    const loadTime = Date.now() - startTime;
    this.log('info', `Model loaded in ${loadTime}ms`);
  }

  /**
   * Run chat completion using the loaded local model.
   */
  async complete(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    if (!this.model || !this.context) {
      throw this.createError(
        'Local model not loaded. Call initialize() first.',
        'invalid_api_key',
        500,
        false
      );
    }

    const startTime = Date.now();

    try {
      const { LlamaChatSession } = await import('node-llama-cpp');

      // Extract system prompt and build conversation
      const systemPrompt = messages.find(m => m.role === 'system')?.content;
      const userMessages = messages.filter(m => m.role !== 'system');

      const sequence = this.context.getSequence();
      const session = new LlamaChatSession({
        contextSequence: sequence,
        systemPrompt: systemPrompt ?? undefined,
      });

      try {
        // Build the user prompt from messages
        const userPrompt = userMessages
          .map(m => m.content)
          .join('\n\n');

        const responseText = await session.prompt(userPrompt, {
          maxTokens: config.maxTokens ?? 1000,
          temperature: config.temperature ?? 0.7,
        });

        const latencyMs = Date.now() - startTime;

        // Estimate token counts (session.prompt returns string, not metadata)
        const promptTokens = this.estimateTokenCount(userPrompt);
        const completionTokens = this.estimateTokenCount(responseText);

        return {
          content: responseText,
          tokensUsed: {
            prompt: promptTokens,
            completion: completionTokens,
            total: promptTokens + completionTokens,
          },
          model: this.currentModelId ?? 'local',
          finishReason: 'stop',
          latencyMs,
        };
      } finally {
        session.dispose();
        sequence.dispose();
      }
    } catch (error) {
      throw this.handleLocalError(error);
    }
  }

  /**
   * Local provider doesn't need API key validation.
   */
  async validateApiKey(_apiKey: string): Promise<boolean> {
    return true;
  }

  /**
   * Check if a model is currently loaded and ready.
   */
  isLoaded(): boolean {
    return this.model !== null && this.context !== null;
  }

  /**
   * Get current status of the local LLM.
   */
  getStatus(): LocalLLMStatus {
    return {
      engineReady: this.llama !== null,
      modelLoaded: this.isLoaded(),
      currentModel: this.currentModelId,
      modelPath: this.currentModelPath,
    };
  }

  /**
   * Unload the current model and free memory.
   */
  async unload(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    this.currentModelId = null;
    this.currentModelPath = null;
    this.log('info', 'Local model unloaded');
  }

  /**
   * Fully dispose the engine (call on app quit).
   */
  async dispose(): Promise<void> {
    await this.unload();
    if (this.llama) {
      await this.llama.dispose();
      this.llama = null;
    }
  }

  /**
   * Rough token count estimation (4 chars per token heuristic).
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Map local inference errors to LLMError.
   */
  private handleLocalError(error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('out of memory') || error.message.includes('OOM')) {
        return this.createError(
          'Not enough memory to run this model. Try a smaller model.',
          'context_length',
          507,
          false
        );
      }
      if (error.message.includes('model file')) {
        return this.createError(
          'Model file not found or corrupted. Please re-download.',
          'invalid_api_key',
          404,
          false
        );
      }
      return this.createError(error.message, 'unknown', undefined, false);
    }
    return this.createError(`Local inference error: ${error}`, 'unknown', undefined, false);
  }
}
