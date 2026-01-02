# TASK-911: LLM Pipeline Filter Update

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-090, BACKLOG-091
**Priority:** HIGH
**Category:** service
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 2-3 turns, ~10K tokens, 10-15 min

---

## Goal

Update LLM pipeline query to only process messages that are:
1. Not yet analyzed (`is_transaction_related IS NULL`)
2. Not duplicates (`duplicate_of IS NULL`)

## Non-Goals

- Do NOT modify LLM service logic
- Do NOT implement full dedup linking (Phase 2)
- Do NOT change extraction algorithms

---

## Prerequisites

**Depends on:** TASK-905 (schema migration) must be merged first.

---

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/services/databaseService.ts` | Add query method for LLM-eligible messages |
| `electron/services/llm/batchLLMService.ts` | Use new query method |

---

## Implementation Notes

### Database Query

```typescript
// In databaseService.ts

/**
 * Get messages that are eligible for LLM analysis.
 * Excludes already-analyzed messages and duplicates.
 */
async getMessagesForLLMAnalysis(userId: string, limit = 100): Promise<Message[]> {
  return await this.db.all(`
    SELECT * FROM messages
    WHERE user_id = ?
    AND is_transaction_related IS NULL  -- Not yet analyzed
    AND duplicate_of IS NULL            -- Not a duplicate
    ORDER BY received_at DESC
    LIMIT ?
  `, [userId, limit]);
}

/**
 * Get count of messages pending LLM analysis.
 */
async getPendingLLMAnalysisCount(userId: string): Promise<number> {
  const result = await this.db.get(`
    SELECT COUNT(*) as count FROM messages
    WHERE user_id = ?
    AND is_transaction_related IS NULL
    AND duplicate_of IS NULL
  `, [userId]);

  return result?.count ?? 0;
}
```

### Service Integration

```typescript
// In electron/services/llm/batchLLMService.ts or equivalent

async function processUnanalyzedMessages(userId: string): Promise<ProcessingResult> {
  // Use the new filtered query
  const messages = await databaseService.getMessagesForLLMAnalysis(userId);

  console.log(`[LLM] Found ${messages.length} messages pending analysis`);

  if (messages.length === 0) {
    return { processed: 0, skipped: 0 };
  }

  // ... existing LLM processing logic ...
}
```

### Logging Enhancement

```typescript
// Add at start of processing
const totalCount = await databaseService.getPendingLLMAnalysisCount(userId);
console.log(`[LLM] Total pending: ${totalCount}, Processing batch: ${messages.length}`);

// Add at end of processing
console.log(`[LLM] Processed ${processed} messages, ${skipped} skipped (duplicates/already analyzed)`);
```

---

## Acceptance Criteria

- [ ] `getMessagesForLLMAnalysis()` returns only unanalyzed, non-duplicate messages
- [ ] `getPendingLLMAnalysisCount()` returns accurate count
- [ ] LLM service uses new query methods
- [ ] Logs show message counts for debugging
- [ ] No behavior change for users without duplicates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use efficient indexed queries
- Add logging for visibility
- Maintain backwards compatibility
- Handle null `duplicate_of` gracefully

### Don't
- Change LLM prompts or models
- Implement duplicate detection logic (handled elsewhere)
- Backfill `duplicate_of` values

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- `duplicate_of` column doesn't exist (TASK-905 not merged)
- Existing query patterns differ significantly
- Performance concerns with large datasets

---

## Testing Expectations

- Unit test query methods with mock data
- Test with messages where `duplicate_of` is set
- Verify duplicate messages are excluded
- Performance test with 10K+ messages

---

## PR Preparation

**Branch:** `feature/TASK-911-llm-filter-update`
**Title:** `feat(llm): filter out duplicates and analyzed messages from LLM pipeline`
**Labels:** `feature`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-910)
- **Depends On:** TASK-905 (schema), TASK-906, TASK-907, TASK-908
- **Blocks:** TASK-912
