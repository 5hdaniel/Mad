# TASK-2068: Unify date-range calculation

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

## Description

Create one canonical date-range calculation function that replaces 3 separate implementations scattered across the codebase.

**New file:** `electron/utils/emailDateRange.ts`

```typescript
export function computeTransactionDateRange(params: {
  started_at?: Date | string;
  created_at?: Date | string;
  closed_at?: Date | string;
}): { start: Date; end: Date }
```

**Logic:**
- **Start:** `started_at` > `created_at` > 2 years ago (matches current `computeEmailFetchSinceDate`)
- **End:** `closed_at` + 30 days buffer, or today (matches current autoLinkService)

**Replaces these 3 implementations:**
1. `computeEmailFetchSinceDate()` in `emailSyncHandlers.ts`
2. `getTransactionDateRange()` + `getDefaultDateRange()` in `autoLinkService.ts`
3. Removes `DEFAULT_LOOKBACK_MONTHS = 6` from `autoLinkService.ts`

## Non-Goals

- Do NOT change date-range behavior -- consolidate existing logic, don't alter it
- Do NOT modify the provider fetch services
- Do NOT change how dates are passed to Outlook/Gmail APIs

## Files to Modify

- `electron/handlers/emailSyncHandlers.ts` (or `electron/services/emailSyncService.ts` if TASK-2066 is done) -- replace `computeEmailFetchSinceDate()` with new utility
- `electron/services/autoLinkService.ts` -- replace `getTransactionDateRange()` and `getDefaultDateRange()` with new utility, remove `DEFAULT_LOOKBACK_MONTHS`
- Existing test files -- update imports and assertions

## Files to Create

- `electron/utils/emailDateRange.ts` -- canonical date-range function
- `electron/utils/__tests__/emailDateRange.test.ts` -- unit tests for the new utility

## Acceptance Criteria

- [ ] `computeTransactionDateRange()` exists in `electron/utils/emailDateRange.ts`
- [ ] Start date logic: `started_at` > `created_at` > 2 years ago fallback
- [ ] End date logic: `closed_at` + 30 days buffer, or today
- [ ] `computeEmailFetchSinceDate()` removed from handler/service, replaced with new utility
- [ ] `getTransactionDateRange()` and `getDefaultDateRange()` removed from autoLinkService.ts
- [ ] `DEFAULT_LOOKBACK_MONTHS = 6` removed from autoLinkService.ts
- [ ] All callers updated to use the new canonical function
- [ ] Unit tests cover: all date field combinations, fallback to 2 years, closed_at buffer, edge cases
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Estimation

- **Category:** refactor (consolidation of duplicated logic)
- **Base estimate:** ~35K tokens
- **SR overhead:** +10K
- **Final estimate:** ~45K tokens
- **Token Cap:** 140K (4x of 35K)

## PR Preparation

- **Title:** `refactor(email): unify date-range calculation into canonical utility`
- **Branch:** `refactor/task-2068-unify-date-range-calculation`
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
- The 3 date-range implementations have diverged more than expected (different edge case handling)
- `autoLinkService.ts` has additional callers of `getTransactionDateRange` beyond what the plan identified
- The `DEFAULT_LOOKBACK_MONTHS` constant is used outside of `autoLinkService.ts`
- More than 5 files need modification (scope creep)
- Existing date-range tests reveal behavior differences between the implementations
