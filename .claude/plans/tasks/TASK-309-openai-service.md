# Task TASK-309: OpenAI Service Implementation

## Goal

Implement the OpenAI provider service, extending the base LLM service with OpenAI API integration for chat completions.

## Non-Goals

- Do NOT implement function/tool calling (future enhancement)
- Do NOT implement streaming responses (future enhancement)
- Do NOT implement image/vision capabilities

## Deliverables

1. New file: `electron/services/llm/openAIService.ts` - OpenAI implementation
2. Update: `package.json` - Add openai SDK dependency

## Acceptance Criteria

- [ ] Chat completion working with GPT-4o-mini
- [ ] API key validation endpoint working
- [ ] Proper error mapping from OpenAI errors
- [ ] JSON mode supported for structured outputs
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (with mocked API)

## Implementation Notes

### Install Dependency

```bash
npm install openai
```

### OpenAI Service

Create `electron/services/llm/openAIService.ts`:

```typescript
import OpenAI from 'openai';
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

export class OpenAIService extends BaseLLMService {
  private client: OpenAI | null = null;

  constructor(
    requestsPerMinute: number = 60,
    retryConfig?: RetryConfig
  ) {
    super('openai', requestsPerMinute, retryConfig);
  }

  /**
   * Initialize the OpenAI client with an API key.
   */
  initialize(apiKey: string): void {
    this.client = new OpenAI({
      apiKey,
      timeout: this.defaultTimeout,
    });
  }

  /**
   * Complete a chat conversation using OpenAI.
   */
  async complete(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.client) {
      throw this.createError(
        'OpenAI client not initialized. Call initialize() first.',
        'invalid_api_key',
        401,
        false
      );
    }

    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: config.maxTokens ?? 1000,
        temperature: config.temperature ?? 0.7,
        // Enable JSON mode if requested
        response_format: config.model.includes('gpt-4') ? { type: 'json_object' } : undefined,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      return {
        content: choice.message.content ?? '',
        tokensUsed: {
          prompt: response.usage?.prompt_tokens ?? 0,
          completion: response.usage?.completion_tokens ?? 0,
          total: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
        finishReason: this.mapFinishReason(choice.finish_reason),
        latencyMs,
      };
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Validate an API key by making a minimal API call.
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    const testClient = new OpenAI({
      apiKey,
      timeout: 10000,  // 10 second timeout for validation
    });

    try {
      // Use models.list as a lightweight validation endpoint
      await testClient.models.list();
      return true;
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) {
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
   * Map OpenAI errors to our error types.
   */
  private handleOpenAIError(error: unknown): LLMError {
    if (error instanceof OpenAI.APIError) {
      const type = this.mapOpenAIErrorType(error);
      const retryable = this.isRetryableError(type);

      // Extract retry-after header if present
      let retryAfterMs: number | undefined;
      if (error.headers?.['retry-after']) {
        retryAfterMs = parseInt(error.headers['retry-after'], 10) * 1000;
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
      // Network/timeout errors
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

  private mapOpenAIErrorType(error: OpenAI.APIError): LLMErrorType {
    if (error instanceof OpenAI.AuthenticationError) {
      return 'invalid_api_key';
    }
    if (error instanceof OpenAI.RateLimitError) {
      return 'rate_limit';
    }
    if (error instanceof OpenAI.BadRequestError) {
      if (error.message.includes('context_length') || error.message.includes('maximum context')) {
        return 'context_length';
      }
      return 'unknown';
    }
    if (error.status === 402 || error.status === 403) {
      return 'quota_exceeded';
    }
    return this.mapStatusToErrorType(error.status ?? 500);
  }

  private mapFinishReason(reason: string | null): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}
```

### Test File (Mocked)

Create `electron/services/llm/__tests__/openAIService.test.ts`:

```typescript
import { OpenAIService } from '../openAIService';
import OpenAI from 'openai';

// Mock the OpenAI SDK
jest.mock('openai');

describe('OpenAIService', () => {
  let service: OpenAIService;

  beforeEach(() => {
    service = new OpenAIService();
    jest.clearAllMocks();
  });

  describe('complete', () => {
    it('should return formatted response on success', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'gpt-4o-mini',
      });

      (OpenAI as jest.Mock).mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }));

      service.initialize('test-key');
      const result = await service.complete(
        [{ role: 'user', content: 'Hi' }],
        { provider: 'openai', apiKey: 'test', model: 'gpt-4o-mini' }
      );

      expect(result.content).toBe('Hello!');
      expect(result.tokensUsed.total).toBe(15);
    });

    it('should throw LLMError on authentication failure', async () => {
      (OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(
              new OpenAI.AuthenticationError('Invalid API key', undefined, undefined)
            ),
          },
        },
      }));

      service.initialize('bad-key');
      await expect(
        service.complete(
          [{ role: 'user', content: 'Hi' }],
          { provider: 'openai', apiKey: 'bad', model: 'gpt-4o-mini' }
        )
      ).rejects.toMatchObject({ type: 'invalid_api_key' });
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      (OpenAI as jest.Mock).mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
      }));

      const result = await service.validateApiKey('valid-key');
      expect(result).toBe(true);
    });

    it('should return false for invalid key', async () => {
      (OpenAI as jest.Mock).mockImplementation(() => ({
        models: {
          list: jest.fn().mockRejectedValue(
            new OpenAI.AuthenticationError('Invalid', undefined, undefined)
          ),
        },
      }));

      const result = await service.validateApiKey('invalid-key');
      expect(result).toBe(false);
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
- Use the official OpenAI SDK
- Handle all error types explicitly
- Support JSON mode for structured outputs
- Mock SDK in tests (don't make real API calls)

### Don't:
- Don't expose API key in logs or errors
- Don't hardcode model names
- Don't implement streaming (future task)
- Don't make real API calls in tests

## When to Stop and Ask

- If SDK version has breaking changes
- If JSON mode behavior differs from expected
- If additional response formats needed
- If function calling needed earlier than planned

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (with mocked SDK)
- New tests to write:
  - Successful completion
  - Error handling for all error types
  - API key validation
- Existing tests to update: None

### Coverage

- Coverage impact: >70% for OpenAI service

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-309-openai-service`
- **Title**: `feat(llm): implement OpenAI service`
- **Labels**: `llm`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-308

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] electron/services/llm/openAIService.ts
- [ ] electron/services/llm/__tests__/openAIService.test.ts

Files modified:
- [ ] package.json (add openai dependency)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Native module rebuild completed
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Reviewer notes:**
<Anything reviewer should pay attention to>

---

## SR Engineer Review Notes

**Review Date:** 2025-12-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/llm-infrastructure (after TASK-308 merged)
- **Branch Into:** int/llm-infrastructure
- **Suggested Branch Name:** feature/TASK-309-openai-service

### Execution Classification
- **Parallel Safe:** Yes (with TASK-310, TASK-313, TASK-314)
- **Depends On:** TASK-308 (Token Tracking)
- **Blocks:** TASK-311 (Config Service)

### Shared File Analysis
- Files modified:
  - `package.json` (add openai dependency)
- Files created:
  - `electron/services/llm/openAIService.ts`
  - `electron/services/llm/__tests__/openAIService.test.ts`
- Conflicts with:
  - **TASK-310:** Both modify `package.json` - **MERGE ORDER: Either first, resolve package.json**
  - No code file conflicts with TASK-310

### Technical Considerations
- Uses official `openai` SDK
- JSON mode supported for structured outputs (GPT-4 models)
- API key validation via models.list endpoint (lightweight)
- Error mapping: AuthenticationError, RateLimitError, BadRequestError
- Tests MUST use mocked SDK (no real API calls)
- >70% coverage required

### Dependency Note
- `npm install openai` adds new dependency
- Native module rebuild may be needed after npm install

### Security Notes
- API key never logged
- Decrypted only when initializing client
