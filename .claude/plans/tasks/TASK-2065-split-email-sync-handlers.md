# TASK-2065: Split emailSyncHandlers.ts into domain handler files

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

Break the 1,539-line `emailSyncHandlers.ts` monolith into 3 focused files organized by domain responsibility.

**Extract into new files:**
- `electron/handlers/emailLinkingHandlers.ts` -- 7 handlers: `get-unlinked-messages`, `get-unlinked-emails`, `link-emails`, `get-message-contacts`, `get-messages-by-contact`, `link-messages`, `unlink-messages` (~550 lines)
- `electron/handlers/emailAutoLinkHandlers.ts` -- 2 handlers: `auto-link-texts`, `resync-auto-link` (~160 lines)

**Remaining in emailSyncHandlers.ts:** scan handlers (2) + sync handler (1) + shared helpers + constants (~700 lines)

Each new file should export a `registerXHandlers()` function following the same pattern as existing handler registration.

**Also modify:** `electron/transaction-handlers.ts` -- add `registerEmailLinkingHandlers()` and `registerEmailAutoLinkHandlers()` calls.

**Rules:**
- No IPC channel name changes
- No logic changes -- this is a pure extraction/move
- No moving helpers yet (that is TASK-2066)
- Preserve all imports needed by each handler

## Non-Goals

- Do NOT change any handler logic
- Do NOT rename IPC channels
- Do NOT extract helpers or services (that is TASK-2066)
- Do NOT modify test files beyond updating import paths

## Files to Modify

- `electron/handlers/emailSyncHandlers.ts` -- remove extracted handlers
- `electron/transaction-handlers.ts` -- add registration calls for new handler files

## Files to Create

- `electron/handlers/emailLinkingHandlers.ts` -- 7 linking/unlinking handlers
- `electron/handlers/emailAutoLinkHandlers.ts` -- 2 auto-link handlers

## Acceptance Criteria

- [ ] `emailLinkingHandlers.ts` contains all 7 linking handlers with `registerEmailLinkingHandlers()` export
- [ ] `emailAutoLinkHandlers.ts` contains both auto-link handlers with `registerEmailAutoLinkHandlers()` export
- [ ] `emailSyncHandlers.ts` reduced to ~700 lines (scan + sync + helpers)
- [ ] `transaction-handlers.ts` calls all three registration functions
- [ ] No IPC channel names changed
- [ ] No handler logic changed
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Estimation

- **Category:** refactor (pure extraction, no logic changes)
- **Base estimate:** ~30K tokens
- **SR overhead:** +10K
- **Final estimate:** ~40K tokens
- **Token Cap:** 120K (4x of 30K)

## PR Preparation

- **Title:** `refactor(email): split emailSyncHandlers into domain handler files`
- **Branch:** `refactor/task-2065-split-email-sync-handlers`
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
- `emailSyncHandlers.ts` has changed significantly since the plan was written (line count differs by >200)
- Handler registration pattern in `transaction-handlers.ts` is different than expected
- More than 4 files need modification (scope creep)
- Circular dependency issues arise from the split
- Existing tests break in ways unrelated to import path changes
