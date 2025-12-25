# Task TASK-310: Anthropic Service Implementation

## Goal

Implement the Anthropic provider service, extending the base LLM service with Claude API integration for chat completions.

## Non-Goals

- Do NOT implement tool use (future enhancement)
- Do NOT implement streaming responses (future enhancement)
- Do NOT implement vision capabilities

## Deliverables

1. New file: `electron/services/llm/anthropicService.ts` - Anthropic implementation
2. Update: `package.json` - Add @anthropic-ai/sdk dependency

## Acceptance Criteria

- [ ] Chat completion working with Claude 3 Haiku
- [ ] API key validation endpoint working
- [ ] Proper error mapping from Anthropic errors
- [ ] System prompt handled correctly (Anthropic format)
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (with mocked API)

## Implementation Notes

### Install Dependency

```bash
npm install @anthropic-ai/sdk
```

### Anthropic Service

Create `electron/services/llm/anthropicService.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import {
  BaseLLMService,
  RetryConfig,
} from './baseLLMService';
import {
  LLMConfig,
  LLMResponse,
  LLMMessage,
  LLMError,
  LLMErrorType,
} from './types';

export class AnthropicService extends BaseLLMService {
  private client: Anthropic | null = null;

  constructor(
    requestsPerMinute: number = 60,
    retryConfig?: RetryConfig
  ) {
    super('anthropic', requestsPerMinute, retryConfig);
  }

  /**
   * Initialize the Anthropic client with an API key.
   */
  initialize(apiKey: string): void {
    this.client = new Anthropic({
      apiKey,
      timeout: this.defaultTimeout,
    });
  }

  /**
   * Complete a chat conversation using Anthropic Claude.
   */
  async complete(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.client) {
      throw this.createError(
        'Anthropic client not initialized. Call initialize() first.',
        'invalid_api_key',
        401,
        false
      );
    }

    const startTime = Date.now();

    // Extract system message (Anthropic handles system separately)
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    try {
      const response = await this.client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens ?? 1000,
        system: systemMessage?.content,
        messages: chatMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      const latencyMs = Date.now() - startTime;

      // Extract text content from response
      const textContent = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('');

      return {
        content: textContent,
        tokensUsed: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: this.mapStopReason(response.stop_reason),
        latencyMs,
      };
    } catch (error) {
      throw this.handleAnthropicError(error);
    }
  }

  /**
   * Validate an API key by making a minimal API call.
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    const testClient = new Anthropic({
      apiKey,
      timeout: 10000,
    });

    try {
      // Make a minimal completion to validate key
      // Anthropic doesn't have a models.list endpoint like OpenAI
      await testClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      // Network errors etc. - key might be valid, can't verify
      this.log('warn', 'API key validation failed with non-auth error', error);
      throw this.createError(
        'Could not validate API key due to network error',
        'network',
        undefined,
        true
      );
    }
  }

  /**
   * Map Anthropic errors to our error types.
   */
  private handleAnthropicError(error: unknown): LLMError {
    if (error instanceof Anthropic.APIError) {
      const type = this.mapAnthropicErrorType(error);
      const retryable = this.isRetryableError(type);

      // Extract retry-after if present
      let retryAfterMs: number | undefined;
      const headers = (error as any).headers;
      if (headers?.['retry-after']) {
        retryAfterMs = parseInt(headers['retry-after'], 10) * 1000;
      }

      return this.createError(
        error.message,
        type,
        error.status,
        retryable,
        retryAfterMs
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return this.createError(error.message, 'timeout', undefined, true);
      }
      if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
        return this.createError(error.message, 'network', undefined, true);
      }
    }

    return this.createError(
      `Unknown error: ${error}`,
      'unknown',
      undefined,
      false
    );
  }

  private mapAnthropicErrorType(error: Anthropic.APIError): LLMErrorType {
    if (error instanceof Anthropic.AuthenticationError) {
      return 'invalid_api_key';
    }
    if (error instanceof Anthropic.RateLimitError) {
      return 'rate_limit';
    }
    if (error instanceof Anthropic.BadRequestError) {
      if (error.message.includes('context') || error.message.includes('too long')) {
        return 'context_length';
      }
      return 'unknown';
    }
    if (error.status === 402 || error.status === 403) {
      return 'quota_exceeded';
    }
    return this.mapStatusToErrorType(error.status ?? 500);
  }

  private mapStopReason(reason: string | null): LLMResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}
```

### Test File (Mocked)

Create `electron/services/llm/__tests__/anthropicService.test.ts`:

```typescript
import { AnthropicService } from '../anthropicService';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

describe('AnthropicService', () => {
  let service: AnthropicService;

  beforeEach(() => {
    service = new AnthropicService();
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('should return formatted response on success', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
      });

      (Anthropic as jest.Mock).mockImplementation(() => ({
        messages: { create: mockCreate },
      }));

      service.initialize('test-key');
      const result = await service.complete(
        [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hi' },
        ],
        { provider: 'anthropic', apiKey: 'test', model: 'claude-3-haiku-20240307' }
      );

      expect(result.content).toBe('Hello!');
      expect(result.tokensUsed.total).toBe(15);
      // Verify system message extracted correctly
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful',
          messages: [{ role: 'user', content: 'Hi' }],
        })
      );
    });

    it('should throw LLMError on authentication failure', async () => {
      (Anthropic as jest.Mock).mockImplementation(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(
            new Anthropic.AuthenticationError('Invalid API key')
          ),
        },
      }));

      service.initialize('bad-key');
      await expect(
        service.complete(
          [{ role: 'user', content: 'Hi' }],
          { provider: 'anthropic', apiKey: 'bad', model: 'claude-3-haiku-20240307' }
        )
      ).rejects.toMatchObject({ type: 'invalid_api_key' });
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      (Anthropic as jest.Mock).mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: '' }],
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        },
      }));

      const result = await service.validateApiKey('valid-key');
      expect(result).toBe(true);
    });
  });
});
```

## Integration Notes

- Imports from: `./baseLLMService.ts`, `./types.ts`
- Exports to: `./llmConfigService.ts`
- Used by: TASK-311, TASK-312
- Depends on: TASK-308

## Do / Don't

### Do:
- Use the official @anthropic-ai/sdk
- Handle system message separately (Anthropic's format)
- Handle multi-block responses (text + tool use)
- Mock SDK in tests

### Don't:
- Don't expose API key in logs
- Don't assume single text block in response
- Don't implement tool use yet
- Don't make real API calls in tests

## When to Stop and Ask

- If SDK has breaking changes
- If system message handling differs
- If tool use needed earlier

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (with mocked SDK)
- New tests to write:
  - Successful completion
  - System message extraction
  - Error handling
  - API key validation

### Coverage

- Coverage impact: >70%

### CI Requirements

- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-310-anthropic-service`
- **Title**: `feat(llm): implement Anthropic service`
- **Labels**: `llm`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-308

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**

*Completed: 2025-12-17*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (task file has complete implementation)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 0 | ~0K | 0 min |
| Revision(s) | 0 | ~0K | 0 min |
| **Plan Total** | 0 | ~0K | 0 min |

Note: Task file provided complete code - no separate planning needed.
```

### Checklist

```
Files created:
- [x] electron/services/llm/anthropicService.ts
- [x] electron/services/llm/__tests__/anthropicService.test.ts

Files modified:
- [x] package.json (@anthropic-ai/sdk dependency)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (pre-existing warnings only)
- [x] npm test passes (30 new tests, all passing)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | ~0K | 0 min |
| Implementation (Impl) | 3 | ~8K | 5 min |
| Debugging (Debug) | 0 | ~0K | 0 min |
| **Engineer Total** | 3 | ~8K | 5 min |
```

### Notes

**Planning notes:**
- Task file provided complete TypeScript implementation
- Applied same error handling pattern as OpenAI service for consistency

**Deviations from plan:**
- Refactored error handling to use status codes instead of `instanceof` checks
- This allows proper mocking in Jest tests without complex module manipulation

**Design decisions:**
- `isAnthropicAPIError` type guard checks for `status` and `message` properties
- `mapAnthropicErrorType` uses switch on status codes (401, 429, 402/403, 400)
- System message extracted separately (Anthropic's format)
- Multiple text blocks joined in response content
- Uses Anthropic.TextBlock type guard for proper type safety

**Issues encountered:**
- None (applied lessons learned from OpenAI service)

**Reviewer notes:**
- 30 new tests covering: constructor, initialize, complete, stop reasons, error handling, validateApiKey
- System message extraction tested separately
- Multiple text blocks response tested
- All LLM error types tested: invalid_api_key, rate_limit, context_length, quota_exceeded, timeout, network, unknown
- Validation uses claude-3-haiku for minimal API call

---

## SR Engineer Review Notes

**Review Date:** 2025-12-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/llm-infrastructure (after TASK-308 merged)
- **Branch Into:** int/llm-infrastructure
- **Suggested Branch Name:** feature/TASK-310-anthropic-service

### Execution Classification
- **Parallel Safe:** Yes (with TASK-309, TASK-313, TASK-314)
- **Depends On:** TASK-308 (Token Tracking)
- **Blocks:** TASK-311 (Config Service)

### Shared File Analysis
- Files modified:
  - `package.json` (add @anthropic-ai/sdk dependency)
- Files created:
  - `electron/services/llm/anthropicService.ts`
  - `electron/services/llm/__tests__/anthropicService.test.ts`
- Conflicts with:
  - **TASK-309:** Both modify `package.json` - **MERGE ORDER: Either first, resolve package.json**
  - No code file conflicts with TASK-309

### Technical Considerations
- Uses official `@anthropic-ai/sdk`
- System message handled separately (Anthropic's format)
- Response may have multiple content blocks (text + tool_use)
- API key validation requires actual API call (no models.list equivalent)
- Tests MUST use mocked SDK (no real API calls)
- >70% coverage required

### Anthropic-Specific Notes
- System prompt is a separate parameter, not in messages array
- Messages must alternate user/assistant roles
- Response content is array of blocks, extract text blocks

### Dependency Note
- `npm install @anthropic-ai/sdk` adds new dependency
- Native module rebuild may be needed after npm install
