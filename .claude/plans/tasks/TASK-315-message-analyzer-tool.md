# Task TASK-315: Message Analyzer Tool

## Goal

Create a pure-function AI tool that analyzes a single email message for real estate relevance, extracting transaction indicators, entities (addresses, amounts, dates, contacts), and providing a confidence score.

## Non-Goals

- Do NOT implement the hybrid extraction pipeline (TASK-320)
- Do NOT modify transactionService or transactionExtractorService
- Do NOT create prompt templates in this task (TASK-318)
- Do NOT implement prompt versioning (TASK-319)
- Do NOT add IPC handlers or UI components

## Deliverables

1. New file: `electron/services/llm/tools/analyzeMessageTool.ts`
2. New file: `electron/services/llm/tools/types.ts` (shared tool types)

## Acceptance Criteria

- [ ] `analyzeMessage()` accepts sanitized email content and returns `MessageAnalysis` JSON
- [ ] Returns `isRealEstateRelated: boolean` with confidence 0-1
- [ ] Extracts addresses with individual confidence scores
- [ ] Extracts monetary amounts with context (e.g., "sale price", "earnest money")
- [ ] Extracts dates with type classification (closing, inspection, other)
- [ ] Extracts contacts with suggested roles
- [ ] Includes `reasoning` field explaining the analysis
- [ ] Works with both OpenAI and Anthropic providers via BaseLLMService
- [ ] Validates LLM response against JSON schema before returning
- [ ] Handles malformed LLM responses gracefully (returns error result)
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/services/llm/tools/types.ts
export interface MessageAnalysis {
  isRealEstateRelated: boolean;
  confidence: number; // 0-1
  transactionIndicators: {
    type: 'purchase' | 'sale' | 'lease' | null;
    stage: 'prospecting' | 'active' | 'pending' | 'closing' | 'closed' | null;
  };
  extractedEntities: {
    addresses: Array<{ value: string; confidence: number }>;
    amounts: Array<{ value: number; context: string }>;
    dates: Array<{ value: string; type: 'closing' | 'inspection' | 'other' }>;
    contacts: Array<{
      name: string;
      email?: string;
      phone?: string;
      suggestedRole?: string;
    }>;
  };
  reasoning: string;
  promptVersion?: string; // SHA of prompt used
}

export interface AnalyzeMessageInput {
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  date: string;
}

export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: { prompt: number; completion: number; total: number };
  latencyMs?: number;
}
```

```typescript
// electron/services/llm/tools/analyzeMessageTool.ts
import { BaseLLMService } from '../baseLLMService';
import { LLMConfig, LLMMessage } from '../types';
import { MessageAnalysis, AnalyzeMessageInput, ToolResult } from './types';
import { ContentSanitizer } from '../contentSanitizer';

export class AnalyzeMessageTool {
  private llmService: BaseLLMService;
  private sanitizer: ContentSanitizer;

  constructor(llmService: BaseLLMService) {
    this.llmService = llmService;
    this.sanitizer = new ContentSanitizer();
  }

  async analyze(
    input: AnalyzeMessageInput,
    config: LLMConfig
  ): Promise<ToolResult<MessageAnalysis>> {
    const startTime = Date.now();

    try {
      // Sanitize input before sending to LLM
      const sanitizedBody = this.sanitizer.sanitize(input.body);
      const sanitizedSubject = this.sanitizer.sanitize(input.subject);

      const messages = this.buildPrompt({
        ...input,
        body: sanitizedBody,
        subject: sanitizedSubject,
      });

      const response = await this.llmService.completeWithRetry(messages, {
        ...config,
        maxTokens: 1500, // Sufficient for JSON response
      });

      // Parse and validate response
      const analysis = this.parseResponse(response.content);

      return {
        success: true,
        data: analysis,
        tokensUsed: response.tokensUsed,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private buildPrompt(input: AnalyzeMessageInput): LLMMessage[] {
    const systemPrompt = `You are a real estate transaction analyst. Analyze the provided email and extract structured information.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "isRealEstateRelated": boolean,
  "confidence": number (0-1),
  "transactionIndicators": {
    "type": "purchase" | "sale" | "lease" | null,
    "stage": "prospecting" | "active" | "pending" | "closing" | "closed" | null
  },
  "extractedEntities": {
    "addresses": [{ "value": string, "confidence": number }],
    "amounts": [{ "value": number, "context": string }],
    "dates": [{ "value": string (ISO format), "type": "closing" | "inspection" | "other" }],
    "contacts": [{ "name": string, "email": string?, "phone": string?, "suggestedRole": string? }]
  },
  "reasoning": string (brief explanation of analysis)
}

Real estate indicators include: property addresses, MLS numbers, closing/escrow terms, buyer/seller mentions, offer amounts, inspection dates, title/deed references.`;

    const userPrompt = `Analyze this email:

From: ${input.sender}
To: ${input.recipients.join(', ')}
Date: ${input.date}
Subject: ${input.subject}

Body:
${input.body}`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private parseResponse(content: string): MessageAnalysis {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (typeof parsed.isRealEstateRelated !== 'boolean') {
      throw new Error('Invalid response: missing isRealEstateRelated');
    }
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Invalid response: confidence must be 0-1');
    }

    // Ensure arrays exist with defaults
    return {
      isRealEstateRelated: parsed.isRealEstateRelated,
      confidence: parsed.confidence,
      transactionIndicators: {
        type: parsed.transactionIndicators?.type ?? null,
        stage: parsed.transactionIndicators?.stage ?? null,
      },
      extractedEntities: {
        addresses: parsed.extractedEntities?.addresses ?? [],
        amounts: parsed.extractedEntities?.amounts ?? [],
        dates: parsed.extractedEntities?.dates ?? [],
        contacts: parsed.extractedEntities?.contacts ?? [],
      },
      reasoning: parsed.reasoning ?? '',
    };
  }
}
```

### Important Details

- Use `ContentSanitizer` from SPRINT-004 to remove PII before LLM call
- Request JSON mode from LLM when supported (OpenAI supports this)
- Include robust error handling for malformed JSON responses
- Log analysis requests for debugging (sanitized content only)
- The prompt is inline for now; TASK-318 will extract to separate files

## Integration Notes

- Imports from: `electron/services/llm/baseLLMService.ts`, `electron/services/llm/contentSanitizer.ts`
- Exports to: `electron/services/extraction/hybridExtractorService.ts` (TASK-320)
- Used by: TASK-320 (Hybrid Extractor Service)
- Depends on: SPRINT-004 LLM infrastructure (complete)

## Do / Don't

### Do:
- Use defensive JSON parsing with try/catch
- Validate all required fields in response
- Return structured error results instead of throwing
- Keep prompts concise but complete
- Log performance metrics (latency, token usage)

### Don't:
- Send unsanitized content to LLM
- Assume LLM always returns valid JSON
- Block on network errors (use timeouts from config)
- Include sensitive data in log messages
- Hardcode model names (use config)

## When to Stop and Ask

- If ContentSanitizer is missing or has different API than expected
- If BaseLLMService.completeWithRetry has different signature
- If you need to modify existing LLM services
- If the prompt exceeds context window limits

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `analyzeMessageTool.test.ts`:
    - Test successful analysis of RE email (mock LLM response)
    - Test non-RE email returns low confidence
    - Test JSON parsing with code block wrapper
    - Test JSON parsing without code block
    - Test malformed JSON handling
    - Test missing required fields handling
    - Test content sanitization is called
    - Test error result structure

### Coverage

- Coverage impact:
  - Target 80%+ for this new file

### Integration / Feature Tests

- Required scenarios:
  - Real estate email produces confidence > 0.7
  - Marketing email produces confidence < 0.3
  - Extracted addresses match expected format

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(llm): add message analyzer tool [TASK-315]`
- **Labels**: `llm`, `ai-mvp`, `phase-1`
- **Depends on**: None (Phase 1 start)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Estimated Totals:**
- **Turns:** 6-8
- **Tokens:** ~25K-35K
- **Time:** ~30-45m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 2 new files (tool + types) | +2 |
| Files to modify | 0 files | +0 |
| Code volume | ~200 lines | +2 |
| Functions/handlers | 3 main functions (analyze, buildPrompt, parseResponse) | +1 |
| Core files touched | No (electron main/preload unchanged) | +0 |
| New patterns | Following existing LLM service patterns | +0 |
| Test complexity | Medium (mocking LLM responses) | +2 |
| Dependencies | 1 service (BaseLLMService, ContentSanitizer) | +0 |

**Confidence:** Medium

**Risk factors:**
- JSON parsing edge cases may require more validation
- Prompt engineering may need iteration

**Similar past tasks:** TASK-309/310 (LLM provider implementations, ~5 turns actual)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: 2025-12-18*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (inline - task spec was comprehensive)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 1 | ~4K | 2 min |
| Revision(s) | 0 | 0 | 0 min |
| **Plan Total** | 1 | ~4K | 2 min |
```

### Checklist

```
Files created:
- [x] electron/services/llm/tools/analyzeMessageTool.ts
- [x] electron/services/llm/tools/types.ts
- [x] electron/services/llm/tools/__tests__/analyzeMessageTool.test.ts

Features implemented:
- [x] MessageAnalysis interface defined
- [x] analyzeMessage() function working
- [x] JSON parsing with validation (code block and raw JSON)
- [x] Error handling for malformed responses
- [x] Content sanitization via ContentSanitizer

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (warnings only)
- [x] npm test passes (14 tests)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 1 | ~4K | 2 min |
| Implementation (Impl) | 3 | ~15K | 10 min |
| Debugging (Debug) | 1 | ~3K | 3 min |
| **Engineer Total** | 5 | ~22K | 15 min |
```

### Notes

**Planning notes:**
Task spec was comprehensive with code examples. ContentSanitizer.sanitize() returns SanitizationResult object, needed to access .sanitizedContent property.

**Deviations from plan:**
None - followed task spec closely.

**Design decisions:**
Added additional JSON parsing path to extract JSON from mixed content responses. Added comprehensive validation helper methods for type safety.

**Issues encountered:**
Minor test fix needed - error messages get wrapped by BaseLLMService, adjusted test assertion to use toContain().

**Reviewer notes:**
Implementation includes 6 validation helper methods beyond the 3 specified in task. This improves robustness when parsing LLM responses.

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 2 | 3 | +1 | Added test file |
| Files to modify | 0 | 2 | +2 | package.json for @types/uuid |
| Code volume | ~200 lines | ~215 lines | +15 | Extra validation helpers |
| Functions/handlers | 3 | 9 | +6 | Added 6 validation helpers |
| Core files touched | No | No | - | - |
| New patterns | No | No | - | Following existing patterns |
| Test complexity | Medium | Medium | - | As expected |

**Total Variance:** Est 6-8 turns -> Actual 5 turns (25% under)

**Root cause of variance:**
Task spec was comprehensive with working code examples, reducing implementation time.

**Suggestion for similar tasks:**
When task spec includes complete code examples, reduce estimate by 20%.

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** int/ai-tools
- **Suggested Branch Name:** feature/TASK-315-message-analyzer-tool

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None (Phase 1 start)
- **Blocks:** TASK-318 (prompt extraction), TASK-320 (hybrid extractor)

### Shared File Analysis
- Files created:
  - `electron/services/llm/tools/analyzeMessageTool.ts` (new)
  - `electron/services/llm/tools/types.ts` (new)
- Conflicts with: TASK-316 and TASK-317 both add to `types.ts`
- **Resolution:** TASK-315 creates `types.ts`, TASK-316 and TASK-317 append to it. However, since all three are parallel-safe from develop, they will each create their own version and merge conflicts will be resolved when merging to int/ai-tools. Recommend: First to merge establishes the file, others rebase and add types.

### Technical Considerations
- Follows established LLM service patterns from SPRINT-004
- Uses ContentSanitizer (already exists from TASK-314)
- Uses BaseLLMService.completeWithRetry (exists from SPRINT-004)
- JSON parsing with code block handling is a reusable pattern
- Prompt is inline for now, TASK-318 will extract it
- No core file modifications (App.tsx, main.ts unchanged)

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/ai-tools
