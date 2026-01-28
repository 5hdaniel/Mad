# BACKLOG-074: AI MVP Phase 1 - LLM Infrastructure

**Priority:** Critical
**Type:** Backend / LLM
**Sprint:** SPRINT-004
**Estimated Effort:** 28 turns (~2h)
**Dependencies:** BACKLOG-073 (Schema Foundation)

---

## Description

Build the core LLM service layer with provider abstraction, supporting both OpenAI and Anthropic. This phase establishes the foundation for all AI-powered features.

---

## Tasks

### L01a: Create LLM Base Interface and Abstract Class
**Estimated:** 3 turns
**File:** `electron/services/llm/baseLLMService.ts`

Define core interfaces and abstract class:
```typescript
interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

interface LLMResponse {
  content: string;
  tokensUsed: { prompt: number; completion: number };
  model: string;
  finishReason: string;
}

abstract class BaseLLMService {
  abstract complete(prompt: string, config: LLMConfig): Promise<LLMResponse>;
  abstract completeWithTools(prompt: string, tools: Tool[], config: LLMConfig): Promise<LLMResponse>;
}
```

**Acceptance Criteria:**
- [ ] Interfaces defined and exported
- [ ] Abstract class with common methods
- [ ] Error types defined

### L01b: Implement Retry and Rate Limiting
**Estimated:** 3 turns
**File:** `electron/services/llm/baseLLMService.ts`

Add to base class:
- Exponential backoff retry (max 3 attempts)
- Rate limiting (configurable requests/minute)
- Circuit breaker pattern for repeated failures

**Acceptance Criteria:**
- [ ] Retry logic with exponential backoff
- [ ] Rate limiter prevents excessive calls
- [ ] Circuit breaker opens after repeated failures

### L01c: Implement Token Counting and Usage Tracking
**Estimated:** 2 turns
**File:** `electron/services/llm/baseLLMService.ts`

- Token estimation before API call
- Token tracking after API call
- Usage persistence to database
- Budget enforcement (block requests when exceeded)

**Acceptance Criteria:**
- [ ] Token estimation works for both providers
- [ ] Usage saved to llm_settings table
- [ ] Requests blocked when budget exceeded

### L02: Create OpenAI Service
**Estimated:** 5 turns
**File:** `electron/services/llm/openAIService.ts`

Implements BaseLLMService for OpenAI API:
- GPT-4o-mini (default, cost-effective)
- GPT-4o (higher accuracy option)
- JSON mode for structured outputs
- Function calling support

**Acceptance Criteria:**
- [ ] Extends BaseLLMService
- [ ] API calls work with valid key
- [ ] JSON mode returns valid JSON
- [ ] Error handling for API failures

### L03: Create Anthropic Service
**Estimated:** 5 turns
**File:** `electron/services/llm/anthropicService.ts`

Implements BaseLLMService for Anthropic API:
- Claude 3 Haiku (cost-effective)
- Claude 3.5 Sonnet (higher accuracy)
- Tool use support

**Acceptance Criteria:**
- [ ] Extends BaseLLMService
- [ ] API calls work with valid key
- [ ] Tool use returns structured data
- [ ] Error handling for API failures

### L04: Create LLM Config Service
**Estimated:** 3 turns
**File:** `electron/services/llm/llmConfigService.ts`

Manages API keys and usage:
```typescript
interface LLMConfigService {
  getUserConfig(userId: string): Promise<LLMUserConfig>;
  setApiKey(userId: string, provider: string, key: string): Promise<void>;
  validateApiKey(provider: string, key: string): Promise<boolean>;
  trackUsage(userId: string, tokens: number): Promise<void>;
  checkBudget(userId: string): Promise<{ canProceed: boolean; remaining: number }>;
  syncPlatformAllowance(userId: string): Promise<void>;
}
```

**Acceptance Criteria:**
- [ ] API keys encrypted via databaseEncryptionService
- [ ] Usage tracking increments correctly
- [ ] Budget check blocks when exceeded
- [ ] Platform allowance syncs from Supabase

### L05: Create LLM Handlers
**Estimated:** 2 turns
**File:** `electron/llm-handlers.ts`

IPC handlers for frontend communication:
- `llm:get-config` - Get user's LLM settings
- `llm:set-api-key` - Store API key securely
- `llm:validate-key` - Test API key validity
- `llm:get-usage` - Get usage stats
- `llm:sync-allowance` - Sync platform allowance from Supabase

**Acceptance Criteria:**
- [ ] All handlers registered in main.ts
- [ ] Preload bridge methods added
- [ ] Error responses properly formatted

### L06: LLM Error Boundary Component
**Estimated:** 3 turns
**File:** `src/components/LLMErrorBoundary.tsx`

UI component to handle LLM API failures gracefully:
- Display user-friendly error messages
- Retry button for transient failures
- Link to settings if API key invalid
- Fallback to pattern-matching notification

**Acceptance Criteria:**
- [ ] Catches LLM-specific errors
- [ ] Shows actionable error messages
- [ ] Retry functionality works
- [ ] Links to settings page

### NEW: Content Sanitizer (Security - Option A)
**Estimated:** 2 turns
**File:** `electron/services/llm/contentSanitizer.ts`

Sanitize email content before sending to LLM:
- Strip email signatures
- Remove confidential footers/disclaimers
- Redact SSN patterns, credit card numbers
- Truncate excessive quoted threads

**Acceptance Criteria:**
- [ ] PII patterns redacted
- [ ] Signatures stripped
- [ ] Content length reasonable for token limits

---

## Quality Gate: LLM Infrastructure Ready

Before marking complete, verify:
- [ ] OpenAI key validation works (manual test)
- [ ] Anthropic key validation works (manual test)
- [ ] Usage tracking increments correctly
- [ ] Budget enforcement blocks when exceeded
- [ ] Content sanitization removes PII
- [ ] Unit tests pass with mocked LLM responses

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/llm/baseLLMService.ts` | Abstract base class |
| `electron/services/llm/openAIService.ts` | OpenAI implementation |
| `electron/services/llm/anthropicService.ts` | Anthropic implementation |
| `electron/services/llm/llmConfigService.ts` | API key + usage management |
| `electron/services/llm/contentSanitizer.ts` | Security - content sanitization |
| `electron/llm-handlers.ts` | IPC handlers |
| `src/components/LLMErrorBoundary.tsx` | Error handling UI |

## Files to Modify

| File | Changes |
|------|---------|
| `electron/main.ts` | Register llm-handlers |
| `electron/preload.ts` | Add LLM bridge methods |
| `package.json` | Add openai, @anthropic-ai/sdk dependencies |

---

## Dependencies (npm)

```json
{
  "openai": "^4.x",
  "@anthropic-ai/sdk": "^0.x"
}
```

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
