# BACKLOG-076: AI MVP Phase 3 - Hybrid Extraction Pipeline

**Priority:** High
**Type:** Backend / Integration
**Sprint:** SPRINT-005
**Estimated Effort:** 34 turns (~2.5h)
**Dependencies:** BACKLOG-075 (AI Analysis Tools)

---

## Description

Integrate AI analysis tools with existing pattern matching to create a hybrid extraction pipeline. This phase connects the AI tools to the transaction detection flow and merges results intelligently.

---

## Tasks

### H01a: Create Hybrid Extractor Service Scaffold
**Estimated:** 3 turns
**File:** `electron/services/extraction/hybridExtractorService.ts`

Define interfaces and service structure:

```typescript
interface HybridExtractorService {
  analyzeMessages(
    messages: ParsedEmail[],
    options: {
      usePatternMatching: boolean;
      useLLM: boolean;
      llmConfig: LLMConfig;
    }
  ): Promise<AnalyzedMessage[]>;

  clusterIntoTransactions(
    analyzedMessages: AnalyzedMessage[],
    existingTransactions: Transaction[]
  ): Promise<DetectedTransaction[]>;

  extractContactRoles(
    cluster: DetectedTransaction,
    knownContacts: Contact[]
  ): Promise<ContactRoleExtraction>;
}
```

**Acceptance Criteria:**
- [ ] Interfaces defined
- [ ] Service class skeleton created
- [ ] Dependency injection for LLM services

### H01b: Integrate Pattern Matching into Hybrid Service
**Estimated:** 3 turns
**File:** `electron/services/extraction/hybridExtractorService.ts`

Wire existing `TransactionExtractorService` into hybrid flow:
- Call pattern matcher for initial analysis
- Format results for combination with LLM results
- Handle pattern-only mode (fallback)

**Acceptance Criteria:**
- [ ] Pattern matcher called first
- [ ] Results formatted for merging
- [ ] Works when LLM unavailable

### H01c: Integrate LLM Analysis into Hybrid Service
**Estimated:** 4 turns
**File:** `electron/services/extraction/hybridExtractorService.ts`

Wire LLM tools into hybrid flow:
- Call A01-A03 tools for AI analysis
- Handle LLM failures gracefully (fallback to pattern)
- Use content sanitizer before sending to LLM

**Acceptance Criteria:**
- [ ] LLM tools called when enabled
- [ ] Content sanitized before API calls
- [ ] Graceful fallback on LLM failure

### H01d: Implement Result Merging Logic
**Estimated:** 3 turns
**File:** `electron/services/extraction/hybridExtractorService.ts`

Combine pattern + LLM results:
- Merge extracted entities from both sources
- Resolve conflicts (prefer higher confidence)
- Generate combined confidence score

**Acceptance Criteria:**
- [ ] Entities merged without duplicates
- [ ] Conflicts resolved by confidence
- [ ] Combined score calculated

### H02: Create Extraction Strategy Selector
**Estimated:** 3 turns
**File:** `electron/services/extraction/extractionStrategyService.ts`

Decides which extraction method to use:

```typescript
interface ExtractionStrategy {
  method: 'pattern' | 'llm' | 'hybrid';
  reason: string;
}

interface ExtractionStrategyService {
  selectStrategy(userId: string): Promise<ExtractionStrategy>;
  // Considers: budget, API key availability, user preferences
}
```

**Acceptance Criteria:**
- [ ] Checks user's LLM budget
- [ ] Checks API key availability
- [ ] Fallback chain: LLM → Pattern → Manual
- [ ] Returns reason for strategy selection

### H03: Create Confidence Aggregator
**Estimated:** 2 turns
**File:** `electron/services/extraction/confidenceAggregatorService.ts`

Combines pattern + LLM confidence scores:

```typescript
interface ConfidenceAggregator {
  aggregate(
    patternConfidence: number | null,
    llmConfidence: number | null,
    agreement: boolean  // Did both methods agree?
  ): { score: number; level: 'high' | 'medium' | 'low' };
}
```

**Acceptance Criteria:**
- [ ] Higher score when methods agree
- [ ] Weighted average when they disagree
- [ ] Returns categorical level for UI

### H04: Update Transaction Service
**Estimated:** 5 turns
**File:** `electron/services/transactionService.ts`

Modify `scanAndExtractTransactions()` to use hybrid extraction:

1. Fetch emails (existing)
2. Run hybrid analysis (new)
3. Cluster into detected transactions (new)
4. Save with detection fields (pending user review)
5. Return for UI display

**Acceptance Criteria:**
- [ ] Uses hybrid extractor when available
- [ ] Sets `detection_source` and `detection_status`
- [ ] Saves `suggested_contacts` JSON
- [ ] Works with existing transaction list UI

### Unit Tests: LLM Service Tests (T01)
**Estimated:** 3 turns
**File:** `electron/services/llm/__tests__/`

Test LLM services with mocked APIs:
- Mock OpenAI/Anthropic responses
- Test retry logic with simulated failures
- Test rate limiting behavior
- Test budget enforcement

### Unit Tests: Prompt Regression Tests (T02)
**Estimated:** 3 turns
**File:** `electron/services/llm/prompts/__tests__/`

Snapshot tests for prompt templates:
- Test prompt generation with sample inputs
- Test edge cases (empty body, very long messages)
- Detect unintended prompt changes

### Unit Tests: Confidence Aggregation Tests (T03)
**Estimated:** 3 turns
**File:** `electron/services/extraction/__tests__/`

Test confidence score combination:
- Test pattern + LLM score merging
- Test edge cases (one method fails)
- Test threshold behavior (high/medium/low)

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/extraction/hybridExtractorService.ts` | Main hybrid extraction logic |
| `electron/services/extraction/extractionStrategyService.ts` | Strategy selection |
| `electron/services/extraction/confidenceAggregatorService.ts` | Score merging |
| `electron/services/llm/__tests__/llmService.test.ts` | LLM service tests |
| `electron/services/llm/prompts/__tests__/prompts.test.ts` | Prompt tests |
| `electron/services/extraction/__tests__/confidence.test.ts` | Aggregation tests |

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/transactionService.ts` | Integrate hybrid extraction |

---

## Quality Gate: Pipeline Ready

Before marking complete, verify:
- [ ] Hybrid extraction produces pending transactions
- [ ] Pattern matching works when LLM unavailable
- [ ] Confidence scores display correctly
- [ ] Fallback to pattern-only is seamless
- [ ] All unit tests pass

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
