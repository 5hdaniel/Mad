# Task TASK-308: LLM Token Counting and Usage Tracking

## Goal

Add token estimation before API calls and usage tracking after calls, persisting usage to the database for budget enforcement.

## Non-Goals

- Do NOT implement budget enforcement UI (TASK-311)
- Do NOT implement actual API calls (TASK-309, TASK-310)
- Do NOT implement the config service (TASK-311)

## Deliverables

1. New file: `electron/services/llm/tokenCounter.ts` - Token estimation utilities
2. Update: `electron/services/llm/baseLLMService.ts` - Add usage tracking methods

## Acceptance Criteria

- [ ] Token estimation for prompts before API call
- [ ] Actual token tracking from API response
- [ ] Usage persisted to llm_settings table
- [ ] Monthly reset logic implemented
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes

## Implementation Notes

### Token Counter

Create `electron/services/llm/tokenCounter.ts`:

```typescript
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
  estimatedCost: number;  // USD
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;  // USD
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
export function estimatePromptTokens(messages: Array<{ role: string; content: string }>): number {
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
```

### Base Service Usage Tracking

Add to `electron/services/llm/baseLLMService.ts`:

```typescript
import {
  estimatePromptTokens,
  createTokenEstimate,
  createTokenUsage,
  TokenEstimate,
  TokenUsage,
} from './tokenCounter';
import { LLMSettingsDbService } from '../db/llmSettingsDbService';

export abstract class BaseLLMService {
  protected dbService?: LLMSettingsDbService;

  /**
   * Set the database service for usage tracking.
   * Must be called before tracking is enabled.
   */
  setDbService(dbService: LLMSettingsDbService): void {
    this.dbService = dbService;
  }

  /**
   * Estimate tokens before making an API call.
   */
  estimateTokens(
    messages: LLMMessage[],
    maxCompletionTokens: number,
    model: string
  ): TokenEstimate {
    return createTokenEstimate(messages, maxCompletionTokens, this.provider, model);
  }

  /**
   * Check if user has budget for estimated tokens.
   */
  async checkBudget(
    userId: string,
    estimate: TokenEstimate
  ): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    if (!this.dbService) {
      return { allowed: true, remaining: Infinity };  // No tracking enabled
    }

    const settings = this.dbService.getByUserId(userId);
    if (!settings) {
      return { allowed: true, remaining: Infinity };  // No settings = no limit
    }

    // Check monthly reset
    if (this.shouldResetMonthly(settings.budget_reset_date)) {
      this.dbService.resetMonthlyUsage(userId);
    }

    const limit = settings.use_platform_allowance
      ? settings.platform_allowance_tokens
      : settings.budget_limit_tokens;

    if (!limit) {
      return { allowed: true, remaining: Infinity };  // No limit set
    }

    const used = settings.use_platform_allowance
      ? settings.platform_allowance_used
      : settings.tokens_used_this_month;

    const remaining = limit - used;

    if (estimate.totalEstimate > remaining) {
      return {
        allowed: false,
        remaining,
        reason: `Estimated ${estimate.totalEstimate} tokens exceeds remaining budget of ${remaining}`,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * Record actual token usage after API call.
   */
  async recordUsage(
    userId: string,
    usage: TokenUsage
  ): Promise<void> {
    if (!this.dbService) return;

    this.dbService.incrementTokenUsage(userId, usage.totalTokens);
    this.log('info', `Recorded ${usage.totalTokens} tokens for user ${userId}`);
  }

  /**
   * Complete with budget check and usage tracking.
   */
  async completeWithTracking(
    userId: string,
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    const maxTokens = config.maxTokens ?? 1000;
    const estimate = this.estimateTokens(messages, maxTokens, config.model);

    // Check budget
    const budgetCheck = await this.checkBudget(userId, estimate);
    if (!budgetCheck.allowed) {
      throw this.createError(
        budgetCheck.reason ?? 'Budget exceeded',
        'quota_exceeded',
        402,
        false
      );
    }

    // Make the API call
    const response = await this.completeWithRetry(messages, config);

    // Record actual usage
    const usage = createTokenUsage(
      response.tokensUsed.prompt,
      response.tokensUsed.completion,
      this.provider,
      config.model
    );
    await this.recordUsage(userId, usage);

    return response;
  }

  private shouldResetMonthly(resetDate?: string): boolean {
    if (!resetDate) return true;
    const reset = new Date(resetDate);
    const now = new Date();
    return reset.getMonth() !== now.getMonth() || reset.getFullYear() !== now.getFullYear();
  }
}
```

## Integration Notes

- Imports from: `./types.ts`, `./rateLimiter.ts`, `../db/llmSettingsDbService.ts`
- Exports to: Provider implementations
- Used by: TASK-309, TASK-310, TASK-311
- Depends on: TASK-307, TASK-302 (llmSettingsDbService)

## Do / Don't

### Do:
- Use conservative token estimates (better to overestimate)
- Track both prompt and completion tokens
- Persist usage immediately after each call
- Handle missing/null settings gracefully

### Don't:
- Don't block on budget check if DB unavailable
- Don't expose token costs in UI (can change)
- Don't hardcode model names (use types)

## When to Stop and Ask

- If token estimation needs to be more accurate (use tiktoken?)
- If cost tracking needs to be exposed to users
- If budget enforcement should be stricter

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `tokenCounter.test.ts` - Estimation accuracy, cost calculation
  - Budget check scenarios
- Existing tests to update: baseLLMService tests

### Coverage

- Coverage impact: >80% for token counter

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-308-llm-token-tracking`
- **Title**: `feat(llm): add token counting and usage tracking`
- **Labels**: `llm`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-307, TASK-302

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
- [ ] electron/services/llm/tokenCounter.ts
- [ ] electron/services/llm/__tests__/tokenCounter.test.ts

Files modified:
- [ ] electron/services/llm/baseLLMService.ts

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
