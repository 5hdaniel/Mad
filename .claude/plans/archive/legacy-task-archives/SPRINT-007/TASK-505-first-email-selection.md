# TASK-505: First-Email Selection Logic

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Integrate thread grouping into extraction pipeline so only first emails are sent to LLM.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 2 (Thread Grouping)
- **Dependencies**: TASK-504
- **Estimated Turns**: 15

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-505-first-email-selection
```

## Technical Specification

### Integration

**File:** `electron/services/extraction/hybridExtractorService.ts`

```typescript
import {
  groupEmailsByThread,
  getFirstEmailsFromThreads,
  ThreadGroupingResult
} from '../llm/threadGroupingService';

class HybridExtractorService {
  private threadGroupingResult: ThreadGroupingResult | null = null;

  async analyzeMessages(messages: Message[]): Promise<AnalysisResult[]> {
    // Step 1: Filter spam (from TASK-503)
    const nonSpamMessages = this.filterSpam(messages);

    // Step 2: Group by thread
    this.threadGroupingResult = groupEmailsByThread(nonSpamMessages);

    logService.info('Thread grouping results', 'HybridExtractor', {
      totalEmails: this.threadGroupingResult.stats.totalEmails,
      threads: this.threadGroupingResult.stats.totalThreads,
      orphans: this.threadGroupingResult.stats.orphanCount,
      avgPerThread: this.threadGroupingResult.stats.avgEmailsPerThread.toFixed(1)
    });

    // Step 3: Get only first emails for LLM analysis
    const emailsToAnalyze = getFirstEmailsFromThreads(this.threadGroupingResult);

    logService.info('Emails to analyze (first per thread)', 'HybridExtractor', {
      original: messages.length,
      toAnalyze: emailsToAnalyze.length,
      reduction: `${((1 - emailsToAnalyze.length / messages.length) * 100).toFixed(1)}%`
    });

    // Step 4: Run LLM analysis on first emails only
    const results: AnalysisResult[] = [];
    for (const email of emailsToAnalyze) {
      const result = await this.analyzeEmail(email);
      results.push(result);
    }

    return results;
  }

  // Store thread grouping for later propagation (TASK-506)
  getThreadGroupingResult(): ThreadGroupingResult | null {
    return this.threadGroupingResult;
  }
}
```

## Acceptance Criteria

- [ ] Thread grouping integrated into extraction
- [ ] Only first emails sent to LLM
- [ ] Stats logged (emails reduced by X%)
- [ ] Orphan emails still analyzed
- [ ] Thread grouping result stored for propagation
- [ ] No regression in detection accuracy

## Files to Modify

| File | Action |
|------|--------|
| `electron/services/extraction/hybridExtractorService.ts` | MODIFY |

## Guardrails

- DO NOT implement propagation yet (TASK-506)
- PRESERVE existing analysis logic
- Log all filtering decisions

## Definition of Done

- [ ] Integration complete
- [ ] Tests pass
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
- **Branch From:** `int/cost-optimization` (after TASK-504 merged)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-505-first-email-selection`

### Execution Classification
- **Parallel Safe:** No - modifies same file as TASK-504/506
- **Depends On:** TASK-504
- **Blocks:** TASK-506

### Technical Notes

1. **Class modification pattern:** The task shows adding a `private threadGroupingResult` property to `HybridExtractorService`. The current class already has similar instance properties (lines 49-60). This is appropriate.

2. **Method signature mismatch:** Current `analyzeMessages()` takes `(messages: MessageInput[], options: HybridExtractionOptions)` but the task shows `(messages: Message[])`. Must use `MessageInput[]` to match existing signature.

3. **Import statement is correct:** The imports from `'../llm/threadGroupingService'` are appropriate.

4. **filterSpam method doesn't exist yet:** The code references `this.filterSpam(messages)` which should be created in TASK-503. Verify TASK-503 adds this method.

5. **Logging uses correct pattern:** `logService.info()` with component name `'HybridExtractor'` matches existing patterns.

6. **Missing: Integration with existing flow:** The current `analyzeMessages()` has a different structure (lines 127-199). The integration needs to wrap the existing logic, not replace it.

### Risk Notes

- **Medium risk:** Modifying core extraction method. Must preserve existing functionality.
- **Regression risk:** Ensure LLM analysis still works for filtered emails.

### Dependencies

Confirmed: TASK-504 must be merged first. Sequential within Phase 2.

### Shared File Analysis
- Files modified: `hybridExtractorService.ts` - same as TASK-503 and TASK-506
- **CRITICAL:** Must merge after TASK-504, before TASK-506

### Recommended Changes

1. **Critical:** Fix method signature to use `MessageInput[]` not `Message[]`:
   ```typescript
   async analyzeMessages(
     messages: MessageInput[],
     options: HybridExtractionOptions
   ): Promise<AnalyzedMessage[]>
   ```

2. **Integration approach:** The task should WRAP the existing `analyzeMessages()` logic, not replace it. Suggested approach:
   ```typescript
   async analyzeMessages(messages: MessageInput[], options: HybridExtractionOptions): Promise<AnalyzedMessage[]> {
     // Step 1: Filter spam (from TASK-503)
     const nonSpamMessages = this.filterSpam(messages);

     // Step 2: Group by thread (NEW)
     this.threadGroupingResult = groupEmailsByThread(nonSpamMessages);
     const emailsToAnalyze = getFirstEmailsFromThreads(this.threadGroupingResult);

     // Step 3: Run EXISTING analysis logic on reduced set
     // ... existing loop logic from lines 142-197 ...
   }
   ```

3. **Add getter method:** Include the getter as shown:
   ```typescript
   getThreadGroupingResult(): ThreadGroupingResult | null {
     return this.threadGroupingResult;
   }
   ```

4. **Test coverage:** Add tests for:
   - Thread grouping integration
   - Stats logging verification
   - Orphan email handling
