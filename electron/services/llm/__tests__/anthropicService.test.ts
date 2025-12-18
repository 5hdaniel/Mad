/**
 * @jest-environment node
 */

import { LLMConfig } from '../types';

// Create mock functions
const mockCreate = jest.fn();

// Mock the Anthropic module
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Import after mocking
import { AnthropicService } from '../anthropicService';
import Anthropic from '@anthropic-ai/sdk';

describe('AnthropicService', () => {
  let service: AnthropicService;

  const testConfig: LLMConfig = {
    provider: 'anthropic',
    apiKey: 'test-key',
    model: 'claude-3-haiku-20240307',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnthropicService();

    // Reset mock implementations
    mockCreate.mockReset();
  });

  describe('constructor', () => {
    it('should create service with default settings', () => {
      expect(service.getProvider()).toBe('anthropic');
    });

    it('should accept custom requestsPerMinute', () => {
      const customService = new AnthropicService(100);
      expect(customService.getProvider()).toBe('anthropic');
    });
  });

  describe('initialize', () => {
    it('should initialize Anthropic client with API key', () => {
      service.initialize('test-api-key');
      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
        })
      );
    });
  });

  describe('complete', () => {
    it('should throw error if client not initialized', async () => {
      const uninitializedService = new AnthropicService();
      await expect(
        uninitializedService.complete([{ role: 'user', content: 'Hi' }], testConfig)
      ).rejects.toMatchObject({
        type: 'invalid_api_key',
        message: expect.stringContaining('not initialized'),
      });
    });

    it('should return formatted response on success', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      service.initialize('test-key');
      const result = await service.complete([{ role: 'user', content: 'Hi' }], testConfig);

      expect(result.content).toBe('Hello!');
      expect(result.tokensUsed.total).toBe(15);
      expect(result.tokensUsed.prompt).toBe(10);
      expect(result.tokensUsed.completion).toBe(5);
      expect(result.model).toBe('claude-3-haiku-20240307');
      expect(result.finishReason).toBe('stop');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should extract system message separately', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 15, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      service.initialize('test-key');
      await service.complete(
        [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
        testConfig
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
          messages: [{ role: 'user', content: 'Hi' }],
        })
      );
    });

    it('should handle multiple text blocks in response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: ' Part 2' },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      service.initialize('test-key');
      const result = await service.complete([{ role: 'user', content: 'Hi' }], testConfig);

      expect(result.content).toBe('Part 1 Part 2');
    });

    it('should handle empty content array', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      service.initialize('test-key');
      const result = await service.complete([{ role: 'user', content: 'Hi' }], testConfig);

      expect(result.content).toBe('');
    });

    it('should use config maxTokens', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      service.initialize('test-key');
      await service.complete([{ role: 'user', content: 'Hi' }], {
        ...testConfig,
        maxTokens: 500,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 500,
        })
      );
    });

    it('should use default maxTokens if not provided', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      service.initialize('test-key');
      await service.complete([{ role: 'user', content: 'Hi' }], testConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1000,
        })
      );
    });

    it('should map multiple messages correctly', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 20, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
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
          system: 'You are helpful',
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
            { role: 'user', content: 'How are you?' },
          ],
        })
      );
    });
  });

  describe('complete - stop reasons', () => {
    const testStopReason = async (apiReason: string | null, expectedReason: string) => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: apiReason,
      });

      service.initialize('test-key');
      const result = await service.complete([{ role: 'user', content: 'Hi' }], testConfig);

      expect(result.finishReason).toBe(expectedReason);
    };

    it('should map end_turn stop reason', async () => {
      await testStopReason('end_turn', 'stop');
    });

    it('should map stop_sequence stop reason', async () => {
      await testStopReason('stop_sequence', 'stop');
    });

    it('should map max_tokens stop reason', async () => {
      await testStopReason('max_tokens', 'length');
    });

    it('should map tool_use stop reason', async () => {
      await testStopReason('tool_use', 'tool_calls');
    });

    it('should default to stop for unknown stop reason', async () => {
      await testStopReason('unknown', 'stop');
    });

    it('should default to stop for null stop reason', async () => {
      await testStopReason(null, 'stop');
    });
  });

  describe('complete - error handling', () => {
    it('should throw LLMError on authentication failure', async () => {
      // Create error object with status property (Anthropic API error structure)
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
      // Create error object with status 400 and context-related message
      const badRequestError = {
        status: 400,
        message: 'Prompt is too long for this context window',
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
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      const result = await service.validateApiKey('valid-key');
      expect(result).toBe(true);
    });

    it('should return false for invalid key (status 401)', async () => {
      // Create error object with status 401 for authentication error
      const authError = { status: 401, message: 'Invalid API key' };
      mockCreate.mockRejectedValue(authError);

      const result = await service.validateApiKey('invalid-key');
      expect(result).toBe(false);
    });

    it('should return false for AuthenticationError by name', async () => {
      // Create error with AuthenticationError name
      const authError = new Error('Invalid API key');
      authError.name = 'AuthenticationError';
      mockCreate.mockRejectedValue(authError);

      const result = await service.validateApiKey('invalid-key');
      expect(result).toBe(false);
    });

    it('should throw network error for non-auth failures', async () => {
      const networkError = new Error('Network error');
      mockCreate.mockRejectedValue(networkError);

      await expect(service.validateApiKey('some-key')).rejects.toMatchObject({
        type: 'network',
        retryable: true,
      });
    });

    it('should use claude-3-haiku model for validation', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      await service.validateApiKey('valid-key');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
        })
      );
    });
  });
});
