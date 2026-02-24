# TASK-2066: Extract EmailSyncService with unified orchestration

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Sprint
SPRINT-098

## Status
Pending

## Prerequisites

**Depends on:** TASK-2065 (handler split must be complete first)

## Description

Move the ~460-line sync orchestration logic from `emailSyncHandlers.ts` into a proper service class.

**New file:** `electron/services/emailSyncService.ts`

**Service API:**
```typescript
class EmailSyncService {
  async syncTransactionEmails(params: {
    transactionId: string;
    userId: string;
    contactAssignments: ContactAssignment[];
    contactEmails: string[];
    transactionDetails: TransactionDetails;
  }): Promise<SyncResult>
}
```

**What moves to the service:**
- `fetchStoreAndDedup()` helper function
- `computeEmailFetchSinceDate()` function
- Provider fetch orchestration (Outlook inbox/sent/all-folders + Gmail search/all-labels)
- Auto-link loop logic
- Constants: `EMAIL_FETCH_SAFETY_CAP`, `SENT_ITEMS_SAFETY_CAP`
- Network resilience wrapping (`retryOnNetwork`)

**Handler becomes:** Thin wrapper (~80 lines) handling input validation, rate limiting, and delegation to service.

**Also update:** `electron/handlers/__tests__/emailSyncHelpers.test.ts` -- point imports at new service location.

## Non-Goals

- Do NOT change sync logic -- this is a pure extraction
- Do NOT add new features to the service
- Do NOT modify the IPC channel or response shape
- Do NOT touch the linking or auto-link handlers (those were extracted in TASK-2065)

## Files to Modify

- `electron/handlers/emailSyncHandlers.ts` -- slim down to thin wrapper
- `electron/handlers/__tests__/emailSyncHelpers.test.ts` -- update imports

## Files to Create

- `electron/services/emailSyncService.ts` -- new service with extracted logic

## Acceptance Criteria

- [ ] `EmailSyncService` class exists in `electron/services/emailSyncService.ts`
- [ ] `syncTransactionEmails()` method encapsulates full sync orchestration
- [ ] `fetchStoreAndDedup()` moved to service (or service-internal helper)
- [ ] `computeEmailFetchSinceDate()` moved to service
- [ ] Handler reduced to ~80 lines (validation + rate limit + delegate)
- [ ] All constants moved to service
- [ ] Network resilience preserved
- [ ] Individual email save pattern preserved
- [ ] Existing tests pass with updated imports
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Estimation

- **Category:** refactor (extraction, no logic changes)
- **Base estimate:** ~50K tokens
- **SR overhead:** +15K
- **Final estimate:** ~65K tokens
- **Token Cap:** 200K (4x of 50K)

## PR Preparation

- **Title:** `refactor(email): extract EmailSyncService from handler`
- **Branch:** `refactor/task-2066-extract-email-sync-service`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: session start
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: _To be filled by engineer_
- **After**: _To be filled by engineer_
- **Actual Tokens**: _To be filled by engineer_
- **PR**: _To be filled by engineer_

### Notes

_To be filled by engineer_

---

## Guardrails

**STOP and ask PM if:**
- `fetchStoreAndDedup` has additional callers outside the sync handler
- Moving constants breaks other imports
- The handler has grown beyond ~700 lines after TASK-2065 split
- Circular dependency issues arise between service and handlers
- More than 4 files need modification (scope creep)
