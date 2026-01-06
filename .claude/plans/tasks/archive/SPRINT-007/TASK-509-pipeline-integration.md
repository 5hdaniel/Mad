# TASK-509: Extraction Pipeline Integration

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Integrate all optimizations (spam filter, thread grouping, batching) into the extraction pipeline.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 3 (Batching)
- **Dependencies**: TASK-508
- **Estimated Turns**: 20

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-509-pipeline-integration
```

## Technical Specification

### Full Pipeline

**File:** `electron/services/extraction/hybridExtractorService.ts`

```typescript
async analyzeMessagesOptimized(messages: Message[]): Promise<OptimizedAnalysisResult> {
  const startTime = Date.now();

  // STEP 1: Spam Filter
  const nonSpamMessages = this.filterSpam(messages);
  const spamFiltered = messages.length - nonSpamMessages.length;

  // STEP 2: Thread Grouping
  this.threadGroupingResult = groupEmailsByThread(nonSpamMessages);
  const firstEmails = getFirstEmailsFromThreads(this.threadGroupingResult);

  // STEP 3: Batching
  const batchingResult = createBatches(firstEmails);

  logService.info('Pipeline optimization summary', 'HybridExtractor', {
    originalEmails: messages.length,
    afterSpamFilter: nonSpamMessages.length,
    afterThreadGrouping: firstEmails.length,
    batches: batchingResult.stats.totalBatches,
    estimatedTokens: batchingResult.stats.estimatedTotalTokens
  });

  // STEP 4: Process Batches
  const allResults: BatchAnalysisResult[] = [];

  for (const batch of batchingResult.batches) {
    const batchResult = await this.processBatch(batch);
    allResults.push(...batchResult.results);

    // Handle errors with fallback
    if (batchResult.errors.length > 0) {
      const fallbackResults = await this.processFallback(batch, batchResult.errors);
      allResults.push(...fallbackResults);
    }
  }

  // STEP 5: Propagate to Threads
  const propagationResults = await this.propagateTransactionsToThreads(allResults);

  const endTime = Date.now();

  return {
    results: allResults,
    propagation: propagationResults,
    stats: {
      originalEmails: messages.length,
      spamFiltered,
      threadsAnalyzed: batchingResult.stats.totalEmails,
      batchesSent: batchingResult.stats.totalBatches,
      transactionsFound: allResults.filter(r => r.isTransaction).length,
      emailsLinkedByPropagation: propagationResults.reduce((sum, p) => sum + p.propagatedCount, 0),
      processingTimeMs: endTime - startTime,
      costReductionPercent: ((1 - batchingResult.stats.totalBatches / messages.length) * 100).toFixed(1)
    }
  };
}

/**
 * Process a batch of emails through LLM
 * NOTE: Per SR Engineer review - use existing LLM service pattern, not new llmService property
 */
private async processBatch(batch: EmailBatch): Promise<BatchParseResult> {
  const prompt = formatBatchPrompt(batch);

  // Get LLM config using existing pattern (per SR Engineer review)
  const llmConfig = await this.getLLMConfig({ userId: this.currentUserId });
  if (!llmConfig) {
    throw new Error('LLM not configured');
  }

  // Use existing service pattern (anthropicService or openAIService)
  const service = this.getOrCreateService(llmConfig.provider, llmConfig.apiKey);
  const response = await service.complete(prompt, {
    systemPrompt: BATCH_ANALYSIS_SYSTEM_PROMPT,
    maxTokens: 4000
  });

  return parseBatchResponse(batch, response);
}

private async processFallback(
  batch: EmailBatch,
  errors: Array<{ emailId: string; error: string }>
): Promise<BatchAnalysisResult[]> {
  logService.warn('Batch parse failed, falling back to individual', 'HybridExtractor', {
    batchId: batch.batchId,
    errorCount: errors.length
  });

  const emailMap = new Map(batch.emails.map(e => [e.id, e]));
  return processBatchErrors(errors, emailMap, (email) =>
    this.analyzeEmailIndividually(email)
  );
}

// NOTE: Per SR Engineer review - move prompt to proper location
// File: electron/services/llm/prompts/batchAnalysis.ts
// This keeps prompts organized with existing patterns (messageAnalysis.ts, transactionClustering.ts)

// For now, define inline (will be moved during implementation)
const BATCH_ANALYSIS_SYSTEM_PROMPT = `You are a real estate transaction analyzer.
Analyze each email and return a JSON array with results in the same order as input.
For each email, return:
{
  "isTransaction": boolean,
  "confidence": number (0-1),
  "transactionType": "purchase" | "sale" | "listing" | "rental" | null,
  "propertyAddress": string | null,
  "parties": [{ "name": string, "role": string }]
}`;

// Also create: electron/services/llm/prompts/batchAnalysis.ts with:
// export const BATCH_ANALYSIS_SYSTEM_PROMPT = `...`;
// export const BATCH_ANALYSIS_USER_PROMPT = (emailCount: number) => `Analyze the following ${emailCount} emails...`;
```

### Cost Tracking

Add cost estimation:
```typescript
interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  provider: 'anthropic' | 'openai';
  model: string;
}
```

## Acceptance Criteria

- [ ] Full pipeline integrated (spam → thread → batch → propagate)
- [ ] Stats logged at each step
- [ ] Fallback works for batch failures
- [ ] Cost reduction verified in logs
- [ ] All tests pass
- [ ] E2E flow works with real emails

## Files to Modify

| File | Action |
|------|--------|
| `electron/services/extraction/hybridExtractorService.ts` | MODIFY |
| `electron/services/extraction/types.ts` | MODIFY (add OptimizedAnalysisResult type) |
| `electron/services/llm/prompts/batchAnalysis.ts` | CREATE |

**Note:** Per SR Engineer review:
- Prompt moved to `prompts/` folder following existing patterns
- `OptimizedAnalysisResult` type added to `extraction/types.ts`
- Uses existing LLM service pattern (no new `llmService` property)

## Guardrails

- PRESERVE individual analysis fallback
- LOG all optimization decisions
- DO NOT break existing API contracts

## Definition of Done

- [ ] Pipeline integrated
- [ ] E2E test passes
- [ ] PR created targeting `int/cost-optimization`

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [ ] Approved as-is
- [x] Approved with minor changes
- [ ] Needs revision

### Branch Information
- **Branch From:** `int/cost-optimization` (after TASK-508 merged)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-509-pipeline-integration`

### Execution Classification
- **Parallel Safe:** No - final Phase 3 integration
- **Depends On:** TASK-508 (and transitively all Phase 1-2 tasks)
- **Blocks:** TASK-510, TASK-511 (Phase 4 validation)

### Technical Notes

1. **New method vs modifying existing:** The task creates `analyzeMessagesOptimized()` as a NEW method. This is safer than modifying `analyzeMessages()` - allows A/B testing and gradual rollout. Good pattern.

2. **LLM service access:** The code uses `this.llmService.analyze()` but the current `HybridExtractorService` doesn't have an `llmService` property. It has individual tools (`analyzeMessageTool`, etc.). Need to either:
   - Add a generic LLM service reference, OR
   - Use the existing `openAIService` / `anthropicService` directly

3. **processBatch method:** This calls `this.llmService.analyze()` which doesn't match current architecture. Should use the batch tools pattern being established.

4. **Cost tracking interface is good:** `CostEstimate` interface is well-designed for observability.

5. **BATCH_ANALYSIS_SYSTEM_PROMPT:** This should be in the prompts folder (`llm/prompts/`) following existing patterns (see `messageAnalysis.ts`, `transactionClustering.ts`).

6. **Import integration:** Will need imports from all prior tasks:
   - `spamFilterService` (TASK-501/502)
   - `threadGroupingService` (TASK-504)
   - `batchLLMService` (TASK-507/508)

### Risk Notes

- **High risk:** This is the main integration point. All prior work converges here.
- **Testing critical:** Must test full pipeline with real-ish data.
- **Fallback path:** The `processFallback` method is essential for reliability.

### Dependencies

Confirmed: TASK-508 must be merged first. This completes Phase 3.

### Shared File Analysis
- Files modified: `hybridExtractorService.ts` - final integration
- **Phase gate:** This completes Phase 3. Phase 4 (validation) starts after merge.

### Recommended Changes

1. **Critical:** Fix LLM service access pattern. Don't add new `llmService` - use existing architecture:

   ```typescript
   private async processBatch(batch: EmailBatch): Promise<BatchParseResult> {
     const prompt = formatBatchPrompt(batch);

     // Use existing tool pattern
     const llmConfig = await this.getLLMConfig({ userId: this.currentUserId });
     if (!llmConfig) {
       throw new Error('LLM not configured');
     }

     // Get the appropriate service
     const service = this.getOrCreateService(llmConfig.provider, llmConfig.apiKey);
     const response = await service.complete(prompt, {
       systemPrompt: BATCH_ANALYSIS_SYSTEM_PROMPT,
       maxTokens: 4000
     });

     return parseBatchResponse(batch, response);
   }
   ```

2. **Move prompt to proper location:** Create `electron/services/llm/prompts/batchAnalysis.ts`:
   ```typescript
   export const BATCH_ANALYSIS_SYSTEM_PROMPT = `...`;
   export const BATCH_ANALYSIS_USER_PROMPT = (emailCount: number) => `...`;
   ```

3. **Add OptimizedAnalysisResult type:** This new return type should be in `extraction/types.ts`:
   ```typescript
   export interface OptimizedAnalysisResult extends HybridExtractionResult {
     propagation: PropagationResult[];
     stats: OptimizedPipelineStats;
   }
   ```

4. **E2E test file:** Create `electron/services/__tests__/hybridExtractor.e2e.test.ts` with:
   - Full pipeline test with mock emails
   - Spam filtering verification
   - Thread grouping verification
   - Batch processing verification
   - Cost tracking verification
