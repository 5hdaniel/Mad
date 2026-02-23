# TASK-2069: Consolidate lookback settings to 2

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

**Depends on:** TASK-2066 (EmailSyncService extraction), TASK-2068 (date-range unification removes `DEFAULT_LOOKBACK_MONTHS`)

## Description

Remove redundant lookback settings, consolidating from 4 down to 2.

**KEEP (no changes needed):**
1. `scan.lookbackMonths` (default 9) -- how far back the transaction scanner looks
2. `messageImport.filters.lookbackMonths` (default 3) -- how far back iMessage import looks

**REMOVE:**
1. `emailSync.lookbackMonths` / `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS` in `electron/constants.ts` -- redundant after TASK-2060 made the audit period the primary date source. First-time scan uses `scan.lookbackMonths` instead.
2. `DEFAULT_LOOKBACK_MONTHS = 6` in `autoLinkService.ts` -- already removed by TASK-2068 (date-range unification).

**Update any code that references the removed settings** to use `scan.lookbackMonths` as the fallback for first-time scans where no audit period is available.

## Non-Goals

- Do NOT change `scan.lookbackMonths` behavior or default
- Do NOT change `messageImport.filters.lookbackMonths` behavior or default
- Do NOT modify UI settings pages
- Do NOT change how the transaction scanner works

## Files to Modify

- `electron/constants.ts` -- remove `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS` and related constants
- `electron/services/transactionService/transactionService.ts` -- update references from removed setting to `scan.lookbackMonths`
- Related test files -- update expectations

## Acceptance Criteria

- [ ] `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS` removed from `electron/constants.ts`
- [ ] `emailSync.lookbackMonths` references removed from all code
- [ ] `DEFAULT_LOOKBACK_MONTHS` confirmed removed (by TASK-2068)
- [ ] Code that previously used `emailSync.lookbackMonths` now falls back to `scan.lookbackMonths`
- [ ] `scan.lookbackMonths` (default 9) still works correctly
- [ ] `messageImport.filters.lookbackMonths` (default 3) still works correctly
- [ ] No dead code left referencing removed settings
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Estimation

- **Category:** refactor (cleanup of redundant settings)
- **Base estimate:** ~25K tokens
- **SR overhead:** +10K
- **Final estimate:** ~35K tokens
- **Token Cap:** 100K (4x of 25K)

## PR Preparation

- **Title:** `refactor(settings): consolidate lookback settings from 4 to 2`
- **Branch:** `refactor/task-2069-consolidate-lookback-settings`
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
- `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS` is used in more places than expected (beyond constants.ts and transactionService)
- Removing the setting affects the Settings UI (there may be a user-facing toggle)
- `scan.lookbackMonths` is not accessible from the code paths that need a fallback
- More than 4 files need modification (scope creep)
- Tests reveal that the removed settings had different behavior than `scan.lookbackMonths`
