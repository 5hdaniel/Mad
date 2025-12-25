# TASK-504: Thread Grouping Service

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Create a service to group emails by thread_id, preparing for first-email-only analysis.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 2 (Thread Grouping)
- **Dependencies**: TASK-503 (Phase 1 complete)
- **Estimated Turns**: 25

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-504-thread-grouping-service
```

## Technical Specification

### New Service

**File:** `electron/services/llm/threadGroupingService.ts` (NEW)

```typescript
// NOTE: Import path fixed per SR Engineer review
import { Message } from '../../types';

export interface ThreadGroup {
  threadId: string;
  emails: Message[];
  firstEmail: Message;
  emailCount: number;
  hasTransaction?: boolean;
}

export interface ThreadGroupingResult {
  threads: Map<string, ThreadGroup>;
  orphanEmails: Message[];  // Emails without thread_id
  stats: {
    totalEmails: number;
    totalThreads: number;
    orphanCount: number;
    avgEmailsPerThread: number;
  };
}

/**
 * Group emails by thread_id and identify the first email in each thread
 */
export function groupEmailsByThread(emails: Message[]): ThreadGroupingResult {
  const threads = new Map<string, ThreadGroup>();
  const orphanEmails: Message[] = [];

  for (const email of emails) {
    if (!email.thread_id) {
      orphanEmails.push(email);
      continue;
    }

    if (!threads.has(email.thread_id)) {
      threads.set(email.thread_id, {
        threadId: email.thread_id,
        emails: [],
        firstEmail: email,
        emailCount: 0
      });
    }

    const thread = threads.get(email.thread_id)!;
    thread.emails.push(email);
    thread.emailCount++;

    // Update first email if this one is older
    if (isEarlier(email, thread.firstEmail)) {
      thread.firstEmail = email;
    }
  }

  const totalThreads = threads.size;
  const totalEmails = emails.length;
  const orphanCount = orphanEmails.length;

  return {
    threads,
    orphanEmails,
    stats: {
      totalEmails,
      totalThreads,
      orphanCount,
      avgEmailsPerThread: totalThreads > 0
        ? (totalEmails - orphanCount) / totalThreads
        : 0
    }
  };
}

/**
 * Check if email A is earlier than email B
 */
function isEarlier(a: Message, b: Message): boolean {
  const dateA = a.sent_at || a.received_at || a.created_at;
  const dateB = b.sent_at || b.received_at || b.created_at;

  if (!dateA) return false;
  if (!dateB) return true;

  return new Date(dateA) < new Date(dateB);
}

/**
 * Get only first emails from thread groups (for LLM analysis)
 */
export function getFirstEmailsFromThreads(result: ThreadGroupingResult): Message[] {
  const firstEmails: Message[] = [];

  for (const thread of result.threads.values()) {
    firstEmails.push(thread.firstEmail);
  }

  // Include orphan emails (they get analyzed individually)
  return [...firstEmails, ...result.orphanEmails];
}
```

### Unit Tests

**File:** `electron/services/llm/__tests__/threadGroupingService.test.ts`

```typescript
describe('threadGroupingService', () => {
  describe('groupEmailsByThread', () => {
    it('should group emails by thread_id', () => {
      const emails = [
        { id: '1', thread_id: 'T1', sent_at: '2024-01-01' },
        { id: '2', thread_id: 'T1', sent_at: '2024-01-02' },
        { id: '3', thread_id: 'T2', sent_at: '2024-01-01' }
      ];

      const result = groupEmailsByThread(emails);

      expect(result.threads.size).toBe(2);
      expect(result.stats.totalThreads).toBe(2);
    });

    it('should identify first email by date', () => {
      const emails = [
        { id: '2', thread_id: 'T1', sent_at: '2024-01-02' },
        { id: '1', thread_id: 'T1', sent_at: '2024-01-01' }  // Earlier
      ];

      const result = groupEmailsByThread(emails);
      const thread = result.threads.get('T1')!;

      expect(thread.firstEmail.id).toBe('1');
    });

    it('should handle orphan emails (no thread_id)', () => {
      const emails = [
        { id: '1', thread_id: 'T1' },
        { id: '2', thread_id: undefined }  // Orphan (use undefined, not null per SR Engineer review)
      ];

      const result = groupEmailsByThread(emails);

      expect(result.orphanEmails.length).toBe(1);
      expect(result.orphanEmails[0].id).toBe('2');
    });
  });

  describe('getFirstEmailsFromThreads', () => {
    it('should return first emails plus orphans', () => {
      const result = groupEmailsByThread([
        { id: '1', thread_id: 'T1', sent_at: '2024-01-01' },
        { id: '2', thread_id: 'T1', sent_at: '2024-01-02' },
        { id: '3', thread_id: undefined }  // Use undefined per SR Engineer review
      ]);

      const firstEmails = getFirstEmailsFromThreads(result);

      expect(firstEmails.length).toBe(2);  // 1 first email + 1 orphan
    });
  });
});
```

## Acceptance Criteria

- [ ] `groupEmailsByThread()` function created
- [ ] Groups emails correctly by thread_id
- [ ] Identifies earliest email per thread
- [ ] Handles orphan emails (no thread_id)
- [ ] Returns useful stats
- [ ] Unit tests pass with >90% coverage

## Files to Create

| File | Action |
|------|--------|
| `electron/services/llm/threadGroupingService.ts` | CREATE |
| `electron/services/llm/__tests__/threadGroupingService.test.ts` | CREATE |

**Note:** Test file location matches service location per SR Engineer review.

## Guardrails

- DO NOT integrate into extraction pipeline yet (TASK-505)
- DO NOT modify database schema
- Pure utility functions only

## Definition of Done

- [ ] Service created and exported
- [ ] Unit tests passing
- [ ] `npm test` passes
- [ ] PR created targeting `int/cost-optimization`

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [x] Approved as-is

### Branch Information
- **Branch From:** `int/cost-optimization` (after Phase 1 complete)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-504-thread-grouping-service`

### Execution Classification
- **Parallel Safe:** No - starts Phase 2 sequential chain
- **Depends On:** TASK-503 (Phase 1 complete)
- **Blocks:** TASK-505, TASK-506

### Technical Notes

1. **Import path issue:** The task imports `Message` from `'../../types/models'` but the actual path from `llm/` folder would be `'../../types'` (the models are re-exported from types/index.ts).

2. **Thread ID field mapping:** The `Message` type uses `thread_id` (snake_case) but Gmail returns `threadId` (camelCase). The fetch services normalize this - Gmail's `_parseMessage()` returns `threadId: message.threadId`. Ensure the service handles both naming conventions or documents which is expected.

3. **Date field hierarchy is correct:** Using `sent_at || received_at || created_at` is the right fallback order.

4. **Pure utility approach is good:** No side effects, easy to test, follows functional patterns.

5. **Test data issue:** The test uses `{ id: '2', thread_id: null }` but the `Message` type defines `thread_id?: string` (optional string, not nullable). Should use `undefined` instead of `null` or handle both.

### Risk Notes

- **Low risk:** Pure utility function with no external dependencies.
- **Type compatibility:** Ensure `thread_id` vs `threadId` naming is consistent with what comes from fetch services.

### Dependencies

Confirmed: Must wait for TASK-503 (Phase 1 integration complete).

### Shared File Analysis
- Files created: New `threadGroupingService.ts` - no conflicts
- Test file: New `__tests__/threadGroupingService.test.ts`

### Recommended Changes

1. **Minor:** Fix import path: `'../../types'` instead of `'../../types/models'`

2. **Minor:** In tests, use `thread_id: undefined` instead of `thread_id: null` to match TypeScript type

3. **Optional:** Consider adding a `ThreadGroupingConfig` for future customization:
   ```typescript
   export interface ThreadGroupingConfig {
     includeOrphansInAnalysis: boolean;  // default: true
     orphanThreadIdPrefix: string;  // default: 'orphan_'
   }
   ```

4. **Test enhancement:** Add test case for emails with same thread_id but different providers (edge case)
