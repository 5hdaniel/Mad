/**
 * @jest-environment node
 */

import { LLMConfig } from '../types';

// Create mock functions
const mockCreate = jest.fn();
const mockModelsList = jest.fn();

// Mock the OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      models: {
        list: mockModelsList,
      },
    })),
  };
});

// Import after mocking
import { OpenAIService } from '../openAIService';
import OpenAI from 'openai';

describe('OpenAIService', () => {
  let service: OpenAIService;

  const testConfig: LLMConfig = {
    provider: 'openai',
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OpenAIService();

    // Reset mock implementations
    mockCreate.mockReset();
    mockModelsList.mockReset();
  });

  describe('constructor', () => {
    it('should create service with default settings', () => {
      expect(service.getProvider()).toBe('openai');
    });

    it('should accept custom requestsPerMinute', () => {
      const customService = new OpenAIService(100);
      expect(customService.getProvider()).toBe('openai');
    });
  });

  describe('initialize', () => {
    it('should initialize OpenAI client with API key', () => {
      service.initialize('test-api-key');
      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
        })
      );
    });
  });

  describe('complete', () => {
    it('should throw error if client not initialized', async () => {
      const uninitializedService = new OpenAIService();
      await expect(
        uninitializedService.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'invalid_api_key',
        message: expect.stringContaining('not initialized'),
      });
    });

    it('should return formatted response on success', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      const result = await service.complete(
        [{ role: 'user', content: 'Hi' }],
        testConfig
      );

      expect(result.content).toBe('Hello!');
      expect(result.tokensUsed.total).toBe(15);
      expect(result.tokensUsed.prompt).toBe(10);
      expect(result.tokensUsed.completion).toBe(5);
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.finishReason).toBe('stop');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle null content in response', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: null },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      const result = await service.complete(
        [{ role: 'user', content: 'Hi' }],
        testConfig
      );

      expect(result.content).toBe('');
    });

    it('should handle missing usage in response', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      const result = await service.complete(
        [{ role: 'user', content: 'Hi' }],
        testConfig
      );

      expect(result.tokensUsed.prompt).toBe(0);
      expect(result.tokensUsed.completion).toBe(0);
      expect(result.tokensUsed.total).toBe(0);
    });

    it('should use config maxTokens and temperature', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      await service.complete([{ role: 'user', content: 'Hi' }], {
        ...testConfig,
        maxTokens: 500,
        temperature: 0.5,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 500,
          temperature: 0.5,
        })
      );
    });

    it('should use default maxTokens and temperature if not provided', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      await service.complete([{ role: 'user', content: 'Hi' }], testConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1000,
          temperature: 0.7,
        })
      );
    });

    it('should map multiple messages correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      await service.complete(
        [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'How are you?' },
        ],
        testConfig
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
            { role: 'user', content: 'How are you?' },
          ],
        })
      );
    });
  });

  describe('complete - finish reasons', () => {
    const testFinishReason = async (
      apiReason: string | null,
      expectedReason: string
    ) => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Hello!' },
            finish_reason: apiReason,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o-mini',
      });

      service.initialize('test-key');
      const result = await service.complete(
        [{ role: 'user', content: 'Hi' }],
        testConfig
      );

      expect(result.finishReason).toBe(expectedReason);
    };

    it('should map stop finish reason', async () => {
      await testFinishReason('stop', 'stop');
    });

    it('should map length finish reason', async () => {
      await testFinishReason('length', 'length');
    });

    it('should map content_filter finish reason', async () => {
      await testFinishReason('content_filter', 'content_filter');
    });

    it('should map tool_calls finish reason', async () => {
      await testFinishReason('tool_calls', 'tool_calls');
    });

    it('should map function_call finish reason', async () => {
      await testFinishReason('function_call', 'tool_calls');
    });

    it('should default to stop for unknown finish reason', async () => {
      await testFinishReason('unknown', 'stop');
    });

    it('should default to stop for null finish reason', async () => {
      await testFinishReason(null, 'stop');
    });
  });

  describe('complete - error handling', () => {
    it('should throw LLMError on authentication failure', async () => {
      // Create error object with status property (OpenAI API error structure)
      const authError = { status: 401, message: 'Incorrect API key' };
      mockCreate.mockRejectedValue(authError);

      service.initialize('bad-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'invalid_api_key',
      });
    });

    it('should throw LLMError on rate limit', async () => {
      // Create error object with status 429 for rate limit
      const rateLimitError = { status: 429, message: 'Rate limit exceeded' };
      mockCreate.mockRejectedValue(rateLimitError);

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'rate_limit',
        retryable: true,
      });
    });

    it('should throw LLMError on context length error', async () => {
      // Create error object with status 400 and context_length message
      const badRequestError = {
        status: 400,
        message: "This model's maximum context_length is exceeded",
      };
      mockCreate.mockRejectedValue(badRequestError);

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'context_length',
      });
    });

    it('should handle quota exceeded error', async () => {
      // Create error object with status 402 for quota exceeded
      const quotaError = { status: 402, message: 'Quota exceeded' };
      mockCreate.mockRejectedValue(quotaError);

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'quota_exceeded',
      });
    });

    it('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout exceeded');
      mockCreate.mockRejectedValue(timeoutError);

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'timeout',
        retryable: true,
      });
    });

    it('should handle network error', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockCreate.mockRejectedValue(networkError);

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'network',
        retryable: true,
      });
    });

    it('should handle unknown error', async () => {
      mockCreate.mockRejectedValue('Some string error');

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'unknown',
        retryable: false,
      });
    });

    it('should extract retry-after header when present', async () => {
      const rateLimitError = {
        status: 429,
        message: 'Rate limit exceeded',
        headers: { 'retry-after': '30' },
      };
      mockCreate.mockRejectedValue(rateLimitError);

      service.initialize('test-key');
      await expect(
        service.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'rate_limit',
        retryable: true,
        retryAfterMs: 30000,
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      mockModelsList.mockResolvedValue({ data: [] });

      const result = await service.validateApiKey('valid-key');
      expect(result).toBe(true);
    });

    it('should return false for invalid key (status 401)', async () => {
      // Create error object with status 401 for authentication error
      const authError = { status: 401, message: 'Invalid API key' };
      mockModelsList.mockRejectedValue(authError);

      const result = await service.validateApiKey('invalid-key');
      expect(result).toBe(false);
    });

    it('should return false for AuthenticationError by name', async () => {
      // Create error with AuthenticationError name
      const authError = new Error('Invalid API key');
      authError.name = 'AuthenticationError';
      mockModelsList.mockRejectedValue(authError);

      const result = await service.validateApiKey('invalid-key');
      expect(result).toBe(false);
    });

    it('should throw network error for non-auth failures', async () => {
      const networkError = new Error('Network error');
      mockModelsList.mockRejectedValue(networkError);

      await expect(service.validateApiKey('some-key')).rejects.toMatchObject({
        type: 'network',
        retryable: true,
      });
    });
  });
});
