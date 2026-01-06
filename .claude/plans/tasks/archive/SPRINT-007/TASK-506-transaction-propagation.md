# TASK-506: Transaction Propagation to Thread

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

When a transaction is detected in the first email of a thread, propagate that detection to all other emails in the same thread.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 2 (Thread Grouping)
- **Dependencies**: TASK-505
- **Estimated Turns**: 20

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-506-transaction-propagation
```

## Technical Specification

### Propagation Logic

**File:** `electron/services/llm/threadGroupingService.ts` (ADD)

```typescript
export interface PropagationResult {
  transactionId: string;
  threadId: string;
  sourceEmailId: string;
  propagatedEmailIds: string[];
  propagatedCount: number;
}

/**
 * Propagate transaction detection to all emails in the same thread
 */
export function getEmailsToPropagate(
  threadGrouping: ThreadGroupingResult,
  detectedTransactionThreadId: string
): string[] {
  const thread = threadGrouping.threads.get(detectedTransactionThreadId);
  if (!thread) return [];

  // Return all email IDs except the first (which was analyzed)
  return thread.emails
    .filter(e => e.id !== thread.firstEmail.id)
    .map(e => e.id);
}
```

### Integration

**File:** `electron/services/extraction/hybridExtractorService.ts`

**NOTE:** Per SR Engineer review, this method should work with `DetectedTransaction[]`
from clustering, not raw `AnalysisResult[]`. The transaction clustering already
identifies which communications belong to a transaction.

```typescript
import { DetectedTransaction } from './types';

/**
 * Propagate transaction detection to all emails in the same thread
 * Uses DetectedTransaction[] from clustering (not raw AnalysisResult[])
 */
async propagateTransactionsToThreads(
  detectedTransactions: DetectedTransaction[],
  threadGrouping: ThreadGroupingResult
): Promise<PropagationResult[]> {
  const propagationResults: PropagationResult[] = [];

  for (const transaction of detectedTransactions) {
    // Get the first email that was analyzed (communication that triggered detection)
    const analyzedEmailId = transaction.communicationIds[0];
    if (!analyzedEmailId) continue;

    // Find which thread this email belongs to
    let threadId: string | undefined;
    for (const [id, thread] of threadGrouping.threads) {
      if (thread.emails.some(e => e.id === analyzedEmailId)) {
        threadId = id;
        break;
      }
    }

    if (!threadId) continue;

    // Get other emails in this thread that weren't analyzed
    const emailsToPropagate = getEmailsToPropagate(
      threadGrouping,
      threadId
    );

    if (emailsToPropagate.length === 0) continue;

    // Check existing links before overwriting (per SR Engineer review)
    const safeToPropagate = await this.filterAlreadyLinked(
      emailsToPropagate,
      transaction.id
    );

    if (safeToPropagate.length > 0) {
      // Link all thread emails to this transaction
      await this.linkEmailsToTransaction(safeToPropagate, transaction.id);

      propagationResults.push({
        transactionId: transaction.id,
        threadId: threadId,
        sourceEmailId: analyzedEmailId,
        propagatedEmailIds: safeToPropagate,
        propagatedCount: safeToPropagate.length
      });
    }
  }

  logService.info('Transaction propagation complete', 'HybridExtractor', {
    transactionsFound: detectedTransactions.length,
    threadsPropagated: propagationResults.length,
    emailsLinked: propagationResults.reduce((sum, p) => sum + p.propagatedCount, 0)
  });

  return propagationResults;
}

/**
 * Filter out emails already linked to a different transaction
 */
private async filterAlreadyLinked(
  emailIds: string[],
  transactionId: string
): Promise<string[]> {
  const safeIds: string[] = [];

  for (const emailId of emailIds) {
    const existing = await communicationDbService.getCommunicationById(emailId);
    if (!existing?.transaction_id || existing.transaction_id === transactionId) {
      safeIds.push(emailId);
    } else {
      logService.warn('Email already linked to different transaction', 'HybridExtractor', {
        emailId,
        existingTransactionId: existing.transaction_id,
        newTransactionId: transactionId
      });
    }
  }

  return safeIds;
}

private async linkEmailsToTransaction(
  emailIds: string[],
  transactionId: string
): Promise<void> {
  // Use existing communication linking logic
  for (const emailId of emailIds) {
    await communicationDbService.linkCommunicationToTransaction(
      emailId,
      transactionId
    );
  }
}
```

## Acceptance Criteria

- [ ] Propagation function created
- [ ] All thread emails linked to detected transaction
- [ ] Logging shows propagation stats
- [ ] Database correctly updated
- [ ] Original first-email analysis unchanged
- [ ] Handles threads with no transaction (no propagation)

## Files to Modify

| File | Action |
|------|--------|
| `electron/services/llm/threadGroupingService.ts` | MODIFY |
| `electron/services/extraction/hybridExtractorService.ts` | MODIFY |

## Guardrails

- DO NOT re-analyze propagated emails
- PRESERVE original email analysis results
- Only propagate transaction LINKS, not full analysis

## Definition of Done

- [ ] Propagation logic implemented
- [ ] Integration tests pass
- [ ] `npm test` passes
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
- **Branch From:** `int/cost-optimization` (after TASK-505 merged)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-506-transaction-propagation`

### Execution Classification
- **Parallel Safe:** No - modifies same files as TASK-504/505
- **Depends On:** TASK-505
- **Blocks:** TASK-507 (Phase 3 start)

### Technical Notes

1. **Database service reference issue:** The task references `communicationDbService.linkCommunicationToTransaction()` but this method may not exist. Checking `communicationDbService.ts` - it has CRUD operations but linking is likely in `transactionDbService.ts` or needs to be created.

2. **AnalysisResult type mismatch:** The code uses `result.isTransaction` and `result.transactionId` but the current `AnalyzedMessage` type (from `extraction/types.ts`) doesn't have `transactionId`. This field comes from detected transactions, not analyzed messages.

3. **Propagation flow logic issue:** The task's `propagateTransactionsToThreads()` iterates over `analysisResults` but should iterate over `DetectedTransaction[]` from clustering, not raw analysis results.

4. **Correct approach:**
   ```typescript
   async propagateTransactionsToThreads(
     detectedTransactions: DetectedTransaction[]
   ): Promise<PropagationResult[]>
   ```
   Then propagate based on the `communicationIds` already in each detected transaction.

5. **Database update method:** Need to verify or create `linkEmailsToTransaction()` - this should update the `transaction_id` field in the `communications` table.

### Risk Notes

- **Medium risk:** Database operations involved. Must handle transaction ID linking correctly.
- **Data integrity:** Ensure propagation doesn't overwrite existing transaction links.

### Dependencies

Confirmed: TASK-505 must be merged first. Last task in Phase 2 sequential chain.

### Shared File Analysis
- Files modified:
  - `hybridExtractorService.ts` - same as TASK-503, 505
  - `threadGroupingService.ts` - adds `getEmailsToPropagate()`
- **Phase gate:** This completes Phase 2. Phase 3 (TASK-507) can start after this merges.

### Recommended Changes

1. **Critical:** Fix the propagation logic to work with `DetectedTransaction[]` not `AnalysisResult[]`:

   ```typescript
   async propagateTransactionsToThreads(
     detectedTransactions: DetectedTransaction[],
     threadGrouping: ThreadGroupingResult
   ): Promise<PropagationResult[]> {
     const results: PropagationResult[] = [];

     for (const transaction of detectedTransactions) {
       // Get first email's thread_id (the one that was analyzed)
       const firstEmailId = transaction.communicationIds[0];
       // Find thread containing this email
       // ... propagation logic
     }
     return results;
   }
   ```

2. **Database method:** Create or use existing method for linking:
   ```typescript
   // In communicationDbService.ts or similar
   async function linkCommunicationsToTransaction(
     communicationIds: string[],
     transactionId: string
   ): Promise<void>
   ```

3. **Add guard for existing links:** Don't overwrite if email already linked to a different transaction:
   ```typescript
   // Check if already linked
   const existing = await getCommunicationById(emailId);
   if (existing?.transaction_id && existing.transaction_id !== transactionId) {
     logService.warn('Email already linked to different transaction', ...);
     continue;
   }
   ```

4. **Test coverage:** Add tests for:
   - Successful propagation
   - Handling already-linked emails
   - Empty thread handling
   - Orphan emails (no propagation needed)
