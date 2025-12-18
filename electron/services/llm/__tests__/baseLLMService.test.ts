/**
 * @jest-environment node
 */

import {
  LLMError,
  LLMErrorType,
  LLMProvider,
  LLMConfig,
  LLMResponse,
  LLMMessage,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
} from '../types';
import { BaseLLMService } from '../baseLLMService';

// Concrete implementation for testing abstract class
class TestLLMService extends BaseLLMService {
  constructor(provider: LLMProvider = 'openai') {
    super(provider);
  }

  // Implement abstract methods
  async complete(
    _messages: LLMMessage[],
    _config: LLMConfig
  ): Promise<LLMResponse> {
    return {
      content: 'test response',
      tokensUsed: { prompt: 10, completion: 20, total: 30 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
      latencyMs: 100,
    };
  }

  async validateApiKey(_apiKey: string): Promise<boolean> {
    return true;
  }

  // Expose protected methods for testing
  public testCreateError(
    message: string,
    type: LLMErrorType,
    statusCode?: number,
    retryable?: boolean,
    retryAfterMs?: number
  ): LLMError {
    return this.createError(message, type, statusCode, retryable, retryAfterMs);
  }

  public testMapStatusToErrorType(status: number): LLMErrorType {
    return this.mapStatusToErrorType(status);
  }

  public testIsRetryableError(type: LLMErrorType): boolean {
    return this.isRetryableError(type);
  }

  public testBuildSimplePrompt(
    systemPrompt: string,
    userMessage: string
  ): LLMMessage[] {
    return this.buildSimplePrompt(systemPrompt, userMessage);
  }

  public testLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void {
    this.log(level, message, data);
  }
}

describe('BaseLLMService', () => {
  let service: TestLLMService;

  beforeEach(() => {
    service = new TestLLMService('openai');
  });

  describe('constructor and getProvider', () => {
    it('should set provider on construction', () => {
      expect(service.getProvider()).toBe('openai');
    });

    it('should allow different providers', () => {
      const anthropicService = new TestLLMService('anthropic');
      expect(anthropicService.getProvider()).toBe('anthropic');
    });
  });

  describe('createError', () => {
    it('should create an LLMError with all properties', () => {
      const error = service.testCreateError(
        'Test error',
        'rate_limit',
        429,
        true,
        5000
      );

      expect(error).toBeInstanceOf(LLMError);
      expect(error.message).toBe('Test error');
      expect(error.type).toBe('rate_limit');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(5000);
      expect(error.name).toBe('LLMError');
    });

    it('should default retryable to false', () => {
      const error = service.testCreateError('Test error', 'unknown');
      expect(error.retryable).toBe(false);
    });

    it('should work without optional parameters', () => {
      const error = service.testCreateError('Test error', 'network');
      expect(error.statusCode).toBeUndefined();
      expect(error.retryAfterMs).toBeUndefined();
    });
  });

  describe('mapStatusToErrorType', () => {
    it('should map 401 to invalid_api_key', () => {
      expect(service.testMapStatusToErrorType(401)).toBe('invalid_api_key');
    });

    it('should map 429 to rate_limit', () => {
      expect(service.testMapStatusToErrorType(429)).toBe('rate_limit');
    });

    it('should map 402 to quota_exceeded', () => {
      expect(service.testMapStatusToErrorType(402)).toBe('quota_exceeded');
    });

    it('should map 403 to quota_exceeded', () => {
      expect(service.testMapStatusToErrorType(403)).toBe('quota_exceeded');
    });

    it('should map 400 to context_length', () => {
      expect(service.testMapStatusToErrorType(400)).toBe('context_length');
    });

    it('should map unknown status codes to unknown', () => {
      expect(service.testMapStatusToErrorType(500)).toBe('unknown');
      expect(service.testMapStatusToErrorType(503)).toBe('unknown');
      expect(service.testMapStatusToErrorType(404)).toBe('unknown');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for rate_limit', () => {
      expect(service.testIsRetryableError('rate_limit')).toBe(true);
    });

    it('should return true for network', () => {
      expect(service.testIsRetryableError('network')).toBe(true);
    });

    it('should return true for timeout', () => {
      expect(service.testIsRetryableError('timeout')).toBe(true);
    });

    it('should return false for invalid_api_key', () => {
      expect(service.testIsRetryableError('invalid_api_key')).toBe(false);
    });

    it('should return false for quota_exceeded', () => {
      expect(service.testIsRetryableError('quota_exceeded')).toBe(false);
    });

    it('should return false for context_length', () => {
      expect(service.testIsRetryableError('context_length')).toBe(false);
    });

    it('should return false for content_filter', () => {
      expect(service.testIsRetryableError('content_filter')).toBe(false);
    });

    it('should return false for unknown', () => {
      expect(service.testIsRetryableError('unknown')).toBe(false);
    });
  });

  describe('buildSimplePrompt', () => {
    it('should build messages array with system and user roles', () => {
      const messages = service.testBuildSimplePrompt(
        'You are a helpful assistant.',
        'Hello, world!'
      );

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
      expect(messages[1]).toEqual({
        role: 'user',
        content: 'Hello, world!',
      });
    });

    it('should handle empty strings', () => {
      const messages = service.testBuildSimplePrompt('', '');

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('');
      expect(messages[1].content).toBe('');
    });
  });

  describe('log', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log info messages with provider prefix', () => {
      service.testLog('info', 'Test message');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[LLM:openai] Test message',
        ''
      );
    });

    it('should log warn messages with provider prefix', () => {
      service.testLog('warn', 'Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[LLM:openai] Test warning',
        ''
      );
    });

    it('should log error messages with provider prefix', () => {
      service.testLog('error', 'Test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LLM:openai] Test error',
        ''
      );
    });

    it('should include data when provided', () => {
      const data = { key: 'value' };
      service.testLog('info', 'Test with data', data);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[LLM:openai] Test with data',
        data
      );
    });
  });
});

describe('LLMError', () => {
  it('should be an instance of Error', () => {
    const error = new LLMError('Test', 'rate_limit', 'openai');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const error = new LLMError('Test', 'rate_limit', 'openai');
    expect(error.name).toBe('LLMError');
  });

  it('should store all properties correctly', () => {
    const error = new LLMError(
      'Rate limited',
      'rate_limit',
      'anthropic',
      429,
      true,
      10000
    );

    expect(error.message).toBe('Rate limited');
    expect(error.type).toBe('rate_limit');
    expect(error.provider).toBe('anthropic');
    expect(error.statusCode).toBe(429);
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(10000);
  });
});

describe('Model Constants', () => {
  describe('OPENAI_MODELS', () => {
    it('should have gpt-4o-mini model', () => {
      expect(OPENAI_MODELS['gpt-4o-mini']).toBeDefined();
      expect(OPENAI_MODELS['gpt-4o-mini'].contextWindow).toBe(128000);
    });

    it('should have gpt-4o model', () => {
      expect(OPENAI_MODELS['gpt-4o']).toBeDefined();
    });

    it('should have gpt-4-turbo model', () => {
      expect(OPENAI_MODELS['gpt-4-turbo']).toBeDefined();
    });

    it('should have cost information for all models', () => {
      Object.values(OPENAI_MODELS).forEach((model) => {
        expect(model.costPer1kInput).toBeDefined();
        expect(model.costPer1kOutput).toBeDefined();
        expect(typeof model.costPer1kInput).toBe('number');
        expect(typeof model.costPer1kOutput).toBe('number');
      });
    });
  });

  describe('ANTHROPIC_MODELS', () => {
    it('should have claude-3-haiku model', () => {
      expect(ANTHROPIC_MODELS['claude-3-haiku-20240307']).toBeDefined();
      expect(ANTHROPIC_MODELS['claude-3-haiku-20240307'].contextWindow).toBe(
        200000
      );
    });

    it('should have claude-3-5-sonnet model', () => {
      expect(ANTHROPIC_MODELS['claude-3-5-sonnet-20241022']).toBeDefined();
    });

    it('should have claude-3-opus model', () => {
      expect(ANTHROPIC_MODELS['claude-3-opus-20240229']).toBeDefined();
    });

    it('should have cost information for all models', () => {
      Object.values(ANTHROPIC_MODELS).forEach((model) => {
        expect(model.costPer1kInput).toBeDefined();
        expect(model.costPer1kOutput).toBeDefined();
        expect(typeof model.costPer1kInput).toBe('number');
        expect(typeof model.costPer1kOutput).toBe('number');
      });
    });
  });
});
