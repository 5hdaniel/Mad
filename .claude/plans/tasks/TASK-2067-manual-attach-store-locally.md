# TASK-2067: Make manual-attach search store emails locally

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

**Depends on:** TASK-2066 (EmailSyncService must exist first)

## Description

Fix the gap where the manual-attach search (`get-unlinked-emails` handler) fetches emails from the provider API but discards them if the user doesn't attach them. The fetched emails should be stored locally via `fetchStoreAndDedup()` so they are available for future operations.

**Current flow (broken):**
```
get-unlinked-emails -> provider API -> return to renderer (emails vanish if not attached)
```

**New flow:**
```
get-unlinked-emails -> emailSyncService.searchProviderEmails()
  -> provider API -> fetchStoreAndDedup() (stores locally) -> return to renderer
```

**Add to EmailSyncService:**
```typescript
async searchProviderEmails(params: {
  userId: string;
  searchParams: EmailSearchParams;
  transactionId?: string;
}): Promise<SearchResult>
```

**Rules:**
- IPC response shape must remain unchanged
- Manual link confidence stays at 1.0
- Emails stored locally should be deduped against existing local emails

## Non-Goals

- Do NOT change the manual-attach UI
- Do NOT change link confidence values
- Do NOT add new IPC channels
- Do NOT change the response shape returned to the renderer

## Files to Modify

- `electron/handlers/emailLinkingHandlers.ts` -- update `get-unlinked-emails` handler to use service
- `electron/services/emailSyncService.ts` -- add `searchProviderEmails()` method

## Acceptance Criteria

- [ ] `searchProviderEmails()` method exists on `EmailSyncService`
- [ ] `get-unlinked-emails` handler routes through the new service method
- [ ] Provider-fetched emails are stored locally via `fetchStoreAndDedup()`
- [ ] Deduplication works correctly (no duplicate emails in local DB)
- [ ] IPC response shape unchanged
- [ ] Manual link confidence remains 1.0
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Estimation

- **Category:** feature + refactor (new service method + handler update)
- **Base estimate:** ~40K tokens
- **SR overhead:** +10K
- **Final estimate:** ~50K tokens
- **Token Cap:** 160K (4x of 40K)

## PR Preparation

- **Title:** `feat(email): store manual-attach search results locally`
- **Branch:** `feat/task-2067-manual-attach-store-locally`
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
- The `get-unlinked-emails` handler is more complex than expected (multiple provider paths)
- Storing emails locally changes the response timing significantly (UX impact)
- The `fetchStoreAndDedup` function needs modification to support the search use case
- More than 3 files need modification (scope creep)
- The response shape cannot remain unchanged while adding local storage
