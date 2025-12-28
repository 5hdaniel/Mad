# TASK-507: Batch LLM Request Builder

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Create a service to batch multiple emails into a single LLM request, optimizing for token limits.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 3 (Batching)
- **Dependencies**: TASK-506 (Phase 2 complete)
- **Estimated Turns**: 25

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-507-batch-request-builder
```

## Technical Specification

### New Service

**File:** `electron/services/llm/batchLLMService.ts` (NEW)

```typescript
import { Message } from '../../types/models';

export interface BatchConfig {
  maxTokensPerBatch: number;  // Default: 50000
  maxEmailsPerBatch: number;  // Default: 30
  avgTokensPerEmail: number;  // Default: 1000
}

export interface EmailBatch {
  batchId: string;
  emails: Message[];
  estimatedTokens: number;
}

export interface BatchingResult {
  batches: EmailBatch[];
  stats: {
    totalEmails: number;
    totalBatches: number;
    avgEmailsPerBatch: number;
    estimatedTotalTokens: number;
  };
}

const DEFAULT_CONFIG: BatchConfig = {
  maxTokensPerBatch: 50000,
  maxEmailsPerBatch: 30,
  avgTokensPerEmail: 1000
};

/**
 * Estimate tokens for an email (subject + body preview)
 */
export function estimateEmailTokens(email: Message): number {
  const subject = email.subject || '';
  const body = email.body_plain || email.body || '';
  const preview = body.substring(0, 2000);  // First 2000 chars

  // Rough estimate: 4 chars = 1 token
  return Math.ceil((subject.length + preview.length) / 4);
}

/**
 * Group emails into batches optimized for LLM context
 */
export function createBatches(
  emails: Message[],
  config: BatchConfig = DEFAULT_CONFIG
): BatchingResult {
  const batches: EmailBatch[] = [];
  let currentBatch: Message[] = [];
  let currentTokens = 0;
  let batchCount = 0;

  for (const email of emails) {
    const emailTokens = estimateEmailTokens(email);

    // Check if adding this email would exceed limits
    const wouldExceedTokens = currentTokens + emailTokens > config.maxTokensPerBatch;
    const wouldExceedCount = currentBatch.length >= config.maxEmailsPerBatch;

    if (wouldExceedTokens || wouldExceedCount) {
      // Save current batch and start new one
      if (currentBatch.length > 0) {
        batches.push({
          batchId: `batch_${++batchCount}`,
          emails: [...currentBatch],
          estimatedTokens: currentTokens
        });
      }
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(email);
    currentTokens += emailTokens;
  }

  // Don't forget the last batch
  if (currentBatch.length > 0) {
    batches.push({
      batchId: `batch_${++batchCount}`,
      emails: currentBatch,
      estimatedTokens: currentTokens
    });
  }

  const totalEmails = emails.length;
  const totalBatches = batches.length;

  return {
    batches,
    stats: {
      totalEmails,
      totalBatches,
      avgEmailsPerBatch: totalBatches > 0 ? totalEmails / totalBatches : 0,
      estimatedTotalTokens: batches.reduce((sum, b) => sum + b.estimatedTokens, 0)
    }
  };
}

/**
 * Format batch for LLM prompt
 */
export function formatBatchPrompt(batch: EmailBatch): string {
  let prompt = `Analyze the following ${batch.emails.length} emails for real estate transactions.\n`;
  prompt += `Return results as a JSON array with one object per email, matching the input order.\n\n`;

  batch.emails.forEach((email, index) => {
    prompt += `--- EMAIL ${index + 1} (ID: ${email.id}) ---\n`;
    prompt += `Subject: ${email.subject || '(no subject)'}\n`;
    prompt += `From: ${email.sender || 'unknown'}\n`;
    prompt += `Date: ${email.sent_at || email.received_at || 'unknown'}\n`;
    prompt += `Body:\n${(email.body_plain || email.body || '').substring(0, 2000)}\n\n`;
  });

  return prompt;
}
```

### Unit Tests

**File:** `electron/services/__tests__/batchLLMService.test.ts`

```typescript
describe('batchLLMService', () => {
  describe('createBatches', () => {
    it('should create batches within token limits', () => {
      const emails = Array(50).fill(null).map((_, i) => ({
        id: `email_${i}`,
        subject: 'Test',
        body_plain: 'x'.repeat(1000)  // ~250 tokens each
      }));

      const result = createBatches(emails, {
        maxTokensPerBatch: 5000,
        maxEmailsPerBatch: 30,
        avgTokensPerEmail: 250
      });

      expect(result.batches.length).toBeGreaterThan(1);
      result.batches.forEach(batch => {
        expect(batch.estimatedTokens).toBeLessThanOrEqual(5000);
      });
    });

    it('should respect max emails per batch', () => {
      const emails = Array(100).fill(null).map((_, i) => ({
        id: `email_${i}`,
        subject: 'Test',
        body_plain: 'Short'
      }));

      const result = createBatches(emails, {
        maxTokensPerBatch: 100000,
        maxEmailsPerBatch: 30,
        avgTokensPerEmail: 10
      });

      result.batches.forEach(batch => {
        expect(batch.emails.length).toBeLessThanOrEqual(30);
      });
    });
  });
});
```

## Acceptance Criteria

- [ ] `createBatches()` function creates optimal batches
- [ ] Token estimation works reasonably
- [ ] Respects max tokens per batch
- [ ] Respects max emails per batch
- [ ] `formatBatchPrompt()` creates valid prompt
- [ ] Unit tests pass with >90% coverage

## Files to Create

| File | Action |
|------|--------|
| `electron/services/llm/batchLLMService.ts` | CREATE |
| `electron/services/__tests__/batchLLMService.test.ts` | CREATE |

## Guardrails

- DO NOT integrate with LLM calls yet (TASK-509)
- DO NOT parse responses yet (TASK-508)
- Pure batching logic only

## Definition of Done

- [ ] Service created
- [ ] Unit tests passing
- [ ] PR created targeting `int/cost-optimization`

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [x] Approved as-is

### Branch Information
- **Branch From:** `int/cost-optimization` (after Phase 2 complete)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-507-batch-request-builder`

### Execution Classification
- **Parallel Safe:** No - starts Phase 3 sequential chain
- **Depends On:** TASK-506 (Phase 2 complete)
- **Blocks:** TASK-508, TASK-509

### Technical Notes

1. **Import path:** Same issue as TASK-504 - use `'../../types'` not `'../../types/models'`

2. **Token estimation is reasonable:** The 4 chars = 1 token approximation is a common heuristic. More accurate would be to use a tokenizer library, but this is fine for batching decisions.

3. **Batch ID generation:** Using `batch_${++batchCount}` is simple but won't be unique across sessions. Consider using UUID or timestamp-based IDs for production logging/debugging.

4. **Body field mismatch:** The code uses `email.body_plain || email.body` but `MessageInput` (from extraction/types.ts) only has `body: string`. The `body_plain` field is on the `Message` type. Need to clarify which type is being used.

5. **formatBatchPrompt is well-designed:** Clear structure with email IDs preserved for response mapping.

6. **Default config is sensible:**
   - 50,000 tokens per batch is well under Claude's 200K context
   - 30 emails per batch is reasonable
   - 1000 avg tokens per email is conservative

### Risk Notes

- **Low risk:** Pure utility functions with no external dependencies.
- **Token estimation accuracy:** The 4:1 ratio may under-estimate tokens for non-ASCII text. Consider a 3:1 ratio for safety buffer.

### Dependencies

Confirmed: Must wait for Phase 2 (TASK-506) to complete.

### Shared File Analysis
- Files created: New `batchLLMService.ts` - no conflicts
- This file will be MODIFIED by TASK-508 (parser) and used by TASK-509 (integration)

### Recommended Changes

1. **Minor:** Fix import path: `'../../types'` instead of `'../../types/models'`

2. **Minor:** Use consistent field names with `MessageInput`:
   ```typescript
   // MessageInput has 'body', not 'body_plain'
   const body = email.body || '';
   const preview = body.substring(0, 2000);
   ```

3. **Optional:** Use UUID for batch IDs:
   ```typescript
   import { v4 as uuidv4 } from 'uuid';
   // ...
   batchId: uuidv4(),
   ```

4. **Safety margin:** Consider 3:1 char-to-token ratio instead of 4:1:
   ```typescript
   return Math.ceil((subject.length + preview.length) / 3);
   ```

5. **Test enhancement:** Add test for empty email array handling
