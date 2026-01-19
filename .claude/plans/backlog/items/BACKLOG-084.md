# BACKLOG-084: Thread-Based Transaction Detection with Batching

## Status
- **Priority:** High
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-19
- **Type:** Enhancement / Cost Optimization

## Summary

Implement thread-aware transaction detection to dramatically reduce LLM API costs. If the first email in a thread is a transaction, all subsequent emails in that thread are automatically linked to that transaction without LLM analysis. Combined with batching, this achieves 90%+ cost reduction.

## Current Behavior

- Each email analyzed independently by LLM
- No awareness of email threads/conversations
- Thread relationships ignored during analysis
- Spam/junk emails sent to LLM (wasted cost)
- 600 emails = 600 LLM calls = ~$6.00 (Haiku)

## Proposed Behavior

1. **Skip spam/junk emails** - never send to LLM
2. Group emails by `thread_id` (already stored in database)
3. Analyze only the **first email** per thread
4. Propagate transaction detection to all emails in that thread
5. Batch the first-emails for additional savings

## Cost Analysis

| Optimization Stage | Emails | LLM Calls | Cost (Haiku) |
|-------------------|--------|-----------|--------------|
| Current (per-email) | 600 | 600 | ~$6.00 |
| After spam filter (~15%) | 510 | 510 | ~$5.10 |
| Thread propagation | 127 threads | 127 | ~$1.27 |
| Batching (30/batch) | 127 | 5 | ~$0.15 |
| **Total savings** | | | **97.5%** |

## Technical Design

### Data Already Available

**Thread IDs** (already captured):
- **Gmail**: `threadId` field → stored as `thread_id`
- **Outlook**: `conversationId` → mapped to `threadId` → stored as `thread_id`
- **Database**: `messages.thread_id` column exists

**Spam/Junk Detection:**
- **Gmail**: `labels` array already captured (check for `SPAM` label)
- **Outlook**: Need to add `inferenceClassification` or check `parentFolderId` for Junk folder

### Spam Detection Implementation

**Gmail** (already available):
```typescript
// Labels already captured in gmailFetchService.ts:368
labels: message.labelIds || []  // ["INBOX", "SPAM", "TRASH", etc.]

// Check for spam:
const isSpam = labels.includes('SPAM') || labels.includes('TRASH');
```

**Outlook** (needs enhancement):
```typescript
// Add to $select in outlookFetchService.ts:269
"$select=id,subject,...,inferenceClassification,parentFolderId"

// Check for junk:
const isJunk = inferenceClassification === 'other' || parentFolderName === 'Junk Email';
```

### Algorithm

```
1. Query all unprocessed emails
2. FILTER: Remove spam/junk emails (mark as non-transaction, skip LLM)
   - Gmail: labels.includes('SPAM') || labels.includes('TRASH')
   - Outlook: parentFolderId === junkFolderId
3. Group remaining emails by thread_id
4. Sort each thread by sent_at ASC (oldest first)
5. For each thread:
   a. Take first (oldest) email
   b. Run LLM analysis on first email only
   c. If transaction detected:
      - Create transaction record
      - Link ALL emails in thread to transaction
      - Mark all as processed
   d. If no transaction:
      - Mark all emails in thread as non-transaction
      - Skip remaining emails
6. Batch step 5b across multiple threads for efficiency
```

### Processing Flow

```
Thread A: "123 Main St Closing" (5 emails)
├── Email 1 (oldest) → LLM → TRANSACTION ✓
├── Email 2 → Skip LLM, inherit transaction
├── Email 3 → Skip LLM, inherit transaction
├── Email 4 → Skip LLM, inherit transaction
└── Email 5 → Skip LLM, inherit transaction

Thread B: "Newsletter" (3 emails)
├── Email 1 (oldest) → LLM → NOT TRANSACTION
├── Email 2 → Skip LLM, marked non-transaction
└── Email 3 → Skip LLM, marked non-transaction
```

### Batching Layer

After thread grouping, batch the first-emails:
```
Batch 1: [Thread A email 1, Thread B email 1, Thread C email 1, ...]
         → Single LLM call analyzing 30-40 emails
         → Parse results, propagate to all thread members
```

### Files to Modify

- `electron/services/llm/hybridExtractionService.ts` - Add thread grouping logic
- `electron/services/llm/tools/AnalyzeMessageTool.ts` - Add batch mode
- New: `electron/services/llm/threadAnalysisService.ts` - Thread grouping utilities

### Database Queries

```sql
-- Get threads with their emails
SELECT thread_id,
       MIN(sent_at) as first_email_date,
       COUNT(*) as email_count,
       GROUP_CONCAT(id) as email_ids
FROM messages
WHERE processed = 0 AND thread_id IS NOT NULL
GROUP BY thread_id
ORDER BY first_email_date;
```

## Acceptance Criteria

- [ ] Spam/junk emails filtered before LLM analysis
  - [ ] Gmail: Check for SPAM/TRASH labels
  - [ ] Outlook: Add inferenceClassification to fetch, check parentFolderId
- [ ] Emails grouped by `thread_id` before LLM analysis
- [ ] Only first email per thread sent to LLM
- [ ] Transaction detection propagated to all thread emails
- [ ] Batching applied to first-emails (configurable batch size)
- [ ] 90%+ reduction in LLM calls demonstrated
- [ ] No regression in transaction detection accuracy
- [ ] Handles edge cases:
  - [ ] Single-email threads (no grouping benefit, still works)
  - [ ] Null/missing thread_id (fall back to individual analysis)
  - [ ] Very large threads (100+ emails)
  - [ ] Spam threads (entire thread skipped)
- [ ] Progress reporting accurate for batched processing

## Edge Cases

1. **Null thread_id**: Some emails may not have thread info. Fall back to individual analysis.
2. **Large threads**: Thread with 100+ emails still only needs 1 LLM call.
3. **Mid-thread transactions**: If transaction discussed mid-thread, first email detection may miss it. Consider analyzing first AND any email with transaction keywords as fallback.

## Dependencies

- None (uses existing thread_id data)

## Related Items

- Thread ID storage: `electron/services/gmailFetchService.ts:355`
- Thread ID storage: `electron/services/outlookFetchService.ts:421`
- Database column: `messages.thread_id`
- LLM tools: `electron/services/llm/tools/`

## Notes

- Primary savings come from thread propagation (75% reduction)
- Secondary savings from batching (additional 67% of remaining)
- Combined: 92%+ total cost reduction
- Consider A/B testing accuracy before full rollout
