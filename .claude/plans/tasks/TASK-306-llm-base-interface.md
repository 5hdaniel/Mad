# Task TASK-306: LLM Base Interface and Abstract Class

## Goal

Create the foundational abstract class and interfaces for LLM provider implementations, establishing the contract that OpenAI and Anthropic services will implement.

## Non-Goals

- Do NOT implement actual API calls (TASK-309, TASK-310)
- Do NOT implement retry logic here (TASK-307)
- Do NOT implement token counting here (TASK-308)
- Do NOT add IPC handlers

## Deliverables

1. New file: `electron/services/llm/types.ts` - All LLM-related interfaces
2. New file: `electron/services/llm/baseLLMService.ts` - Abstract base class

## Acceptance Criteria

- [ ] All interfaces defined and exported
- [ ] Abstract class with abstract methods for completion
- [ ] Concrete logging and error handling methods
- [ ] TypeScript compiles without errors
- [ ] npm run type-check passes
- [ ] npm run lint passes

## Implementation Notes

### Types File

Create `electron/services/llm/types.ts`:

```typescript
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
  timeout?: number;  // ms
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
  arguments: string;  // JSON string
}

// Message format for chat completions
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Provider-specific models
export const OPENAI_MODELS = {
  'gpt-4o-mini': { contextWindow: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  'gpt-4o': { contextWindow: 128000, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
  'gpt-4-turbo': { contextWindow: 128000, costPer1kInput: 0.01, costPer1kOutput: 0.03 },
} as const;

export const ANTHROPIC_MODELS = {
  'claude-3-haiku-20240307': { contextWindow: 200000, costPer1kInput: 0.00025, costPer1kOutput: 0.00125 },
  'claude-3-5-sonnet-20241022': { contextWindow: 200000, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
  'claude-3-opus-20240229': { contextWindow: 200000, costPer1kInput: 0.015, costPer1kOutput: 0.075 },
} as const;

export type OpenAIModel = keyof typeof OPENAI_MODELS;
export type AnthropicModel = keyof typeof ANTHROPIC_MODELS;
```

### Base Service

Create `electron/services/llm/baseLLMService.ts`:

```typescript
import {
  LLMConfig,
  LLMResponse,
  LLMMessage,
  LLMError,
  LLMErrorType,
  LLMProvider,
} from './types';

/**
 * Abstract base class for LLM provider implementations.
 * Provides common functionality and defines the contract for specific providers.
 */
export abstract class BaseLLMService {
  protected readonly provider: LLMProvider;
  protected readonly defaultTimeout = 30000;  // 30 seconds

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * Complete a chat conversation with the LLM.
   * Must be implemented by provider-specific classes.
   */
  abstract complete(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse>;

  /**
   * Validate an API key by making a minimal API call.
   * Must be implemented by provider-specific classes.
   */
  abstract validateApiKey(apiKey: string): Promise<boolean>;

  /**
   * Get the provider name for this service.
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Create a standardized error from provider-specific errors.
   * Subclasses should call this to create consistent error objects.
   */
  protected createError(
    message: string,
    type: LLMErrorType,
    statusCode?: number,
    retryable: boolean = false,
    retryAfterMs?: number
  ): LLMError {
    return new LLMError(
      message,
      type,
      this.provider,
      statusCode,
      retryable,
      retryAfterMs
    );
  }

  /**
   * Map HTTP status codes to error types.
   */
  protected mapStatusToErrorType(status: number): LLMErrorType {
    switch (status) {
      case 401:
        return 'invalid_api_key';
      case 429:
        return 'rate_limit';
      case 402:
      case 403:
        return 'quota_exceeded';
      case 400:
        return 'context_length';  // Often indicates token limit
      default:
        return 'unknown';
    }
  }

  /**
   * Check if an error is retryable.
   */
  protected isRetryableError(type: LLMErrorType): boolean {
    return ['rate_limit', 'network', 'timeout'].includes(type);
  }

  /**
   * Log LLM operation (for debugging/monitoring).
   * Override in subclasses for custom logging.
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const logMessage = `[LLM:${this.provider}] ${message}`;
    switch (level) {
      case 'info':
        console.log(logMessage, data ?? '');
        break;
      case 'warn':
        console.warn(logMessage, data ?? '');
        break;
      case 'error':
        console.error(logMessage, data ?? '');
        break;
    }
  }

  /**
   * Build a simple completion prompt from a single user message.
   * Convenience method for simple use cases.
   */
  protected buildSimplePrompt(systemPrompt: string, userMessage: string): LLMMessage[] {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
  }
}
```

### Directory Structure

Ensure directory exists:
```
electron/services/llm/
├── types.ts
├── baseLLMService.ts
├── openAIService.ts       (TASK-309)
├── anthropicService.ts    (TASK-310)
├── llmConfigService.ts    (TASK-311)
└── contentSanitizer.ts    (TASK-314)
```

## Integration Notes

- Imports from: None (foundation)
- Exports to: All other LLM services
- Used by: TASK-307, TASK-308, TASK-309, TASK-310, TASK-311
- Depends on: Phase 1 complete (TASK-305)

## Do / Don't

### Do:
- Define clear interfaces that both providers can implement
- Include cost information for token tracking
- Make error types comprehensive and actionable
- Keep base class focused on shared functionality

### Don't:
- Don't add provider-specific code here
- Don't implement actual API calls
- Don't add retry logic (TASK-307)
- Don't add token counting logic (TASK-308)

## When to Stop and Ask

- If OpenAI or Anthropic SDK types conflict with these interfaces
- If there's existing LLM-related code that should be extended
- If the error handling pattern differs from other services
- If directory structure should be different

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `baseLLMService.test.ts` - Error mapping, helper methods
- Existing tests to update: None

### Coverage

- Coverage impact: New code, aim for >80% on utilities

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-306-llm-base-interface`
- **Title**: `feat(llm): add base LLM interfaces and abstract class`
- **Labels**: `llm`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-305 (Phase 1 complete)

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
- [ ] electron/services/llm/types.ts
- [ ] electron/services/llm/baseLLMService.ts
- [ ] electron/services/llm/__tests__/baseLLMService.test.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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
- **Branch From:** int/schema-foundation (after Phase 1 complete) OR develop (if schema-foundation merged)
- **Branch Into:** int/llm-infrastructure
- **Suggested Branch Name:** feature/TASK-306-llm-base-interface

### Execution Classification
- **Parallel Safe:** NO - Sequential (Phase 2 foundation)
- **Depends On:** TASK-305 (Phase 1 complete)
- **Blocks:** TASK-307, TASK-308, TASK-309, TASK-310, TASK-313, TASK-314 (all Phase 2 tasks depend on this)

### Shared File Analysis
- Files created:
  - `electron/services/llm/types.ts`
  - `electron/services/llm/baseLLMService.ts`
  - `electron/services/llm/__tests__/baseLLMService.test.ts`
- Conflicts with:
  - **NONE** - Creates new directory and files

### Technical Considerations
- **FOUNDATION TASK** - All Phase 2 tasks import from these files
- Creates `electron/services/llm/` directory structure
- Abstract class pattern with concrete helper methods
- LLMError class extends Error with typed properties
- Model cost constants for token tracking
- Tests should cover error mapping and helper methods (>80% coverage)

### Integration Branch Note
- `int/llm-infrastructure` must be created from `develop` (after int/schema-foundation merged)
- This is the FIRST task in Phase 2 - must complete before any other Phase 2 work

### Architectural Notes
