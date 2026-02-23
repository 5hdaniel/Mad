# Task TASK-2059: Sentry Instrumentation for All Sync Paths

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

## Goal

Add Sentry instrumentation (captureException + breadcrumbs) to all sync paths so that when sync operations fail in production, we have full visibility into what failed, why, and what happened leading up to the failure.

## Non-Goals

- Do NOT restructure existing sync code. This is additive instrumentation only.
- Do NOT add Sentry to the electron-side `syncOrchestrator.ts` (iPhone/Windows sync) -- that already has Sentry coverage.
- Do NOT modify Sentry SDK configuration or upgrade the Sentry package.
- Do NOT add performance/transaction tracing (just error capture + breadcrumbs).
- Do NOT add instrumentation to non-sync code paths (auth, UI, etc.).

## Prerequisites

**Sprint:** SPRINT-096
**Depends on:** Nothing. This task is independent.
**Blocks:** Nothing directly, but improves observability for all future sync work.

## Context

Currently, Sentry coverage on sync operations is **zero** in the renderer-side code. The following files have no `Sentry.captureException` calls:

- `src/hooks/useAutoRefresh.ts` -- auto-sync orchestration
- `src/services/SyncOrchestratorService.ts` -- queue/state management, catches errors at line 393 but only logs them
- `electron/handlers/emailSyncHandlers.ts` -- Outlook/Gmail email fetch (the `sync-and-fetch-emails` handler has no Sentry)
- `electron/handlers/messageImportHandlers.ts` -- iMessage import (no Sentry at all)

The electron-side services that DO have Sentry already:
- `electron/services/syncOrchestrator.ts` (iPhone sync) -- has captureException
- `electron/handlers/sessionHandlers.ts` -- has captureException
- `electron/handlers/updaterHandlers.ts` -- has captureException
- `electron/main.ts` -- global error boundary

**Risk:** If auto-sync silently fails for a user, we have no visibility. No error, no reason, nothing. Users see stale data with no explanation.

## Requirements

### Must Do:

1. **Add Sentry to `SyncOrchestratorService.ts` (renderer-side)**:
   - In the `startSync()` method, the catch block at line ~386-394 currently calls `logger.error()` -- add `Sentry.captureException(error, { tags: { syncType: type, userId }, extra: { queue: validTypes } })` alongside the existing logger call.
   - Add `Sentry.addBreadcrumb()` calls for:
     - Sync request received (in `requestSync()`)
     - Each sync type starting (in `startSync()` before running the sync function)
     - Each sync type completing (in `startSync()` after successful run)
     - Sync cancelled (in `cancel()`)
   - Import Sentry: `import * as Sentry from "@sentry/electron/renderer";`

2. **Add Sentry to `emailSyncHandlers.ts` (main process)**:
   - The `transactions:sync-and-fetch-emails` handler (line ~893) has try/catch blocks for Outlook and Gmail fetches. Add `Sentry.captureException(error, { tags: { provider: 'outlook'|'gmail', operation: 'sync-and-fetch-emails' }, extra: { transactionId, contactEmailCount: contactEmails.length } })` to both catch blocks.
   - The main handler catch block should also capture to Sentry.
   - Add breadcrumbs for sync start, each provider fetch start/complete, and auto-link start/complete.
   - `import * as Sentry from "@sentry/electron/main";` -- note this file already imports other electron modules but does NOT import Sentry currently.

3. **Add Sentry to `messageImportHandlers.ts` (main process)**:
   - The `messages:import-macos` handler has try/catch blocks. Add `Sentry.captureException(error, { tags: { operation: 'messages-import', platform: 'macos' } })` to error paths.
   - Add breadcrumbs for import start, import complete (with message count), and any phase transitions.
   - `import * as Sentry from "@sentry/electron/main";` -- this file currently has no Sentry import.

4. **Add Sentry breadcrumbs to `useAutoRefresh.ts` (renderer)**:
   - Add a breadcrumb when auto-refresh triggers (in the `useEffect` that calls `runAutoRefresh`).
   - Add a breadcrumb when auto-refresh is skipped (e.g., `hasMessagesImportTriggered()` returns true, auto-sync disabled, etc.).
   - Do NOT add captureException here -- errors propagate to SyncOrchestratorService which will capture them.
   - `import * as Sentry from "@sentry/electron/renderer";`

5. **Add Sentry to contact sync handler** (in `SyncOrchestratorService.ts` contact sync function):
   - The contacts sync function registered at line ~114 has a catch block for Outlook contacts (line ~161). Add Sentry.captureException for the outer catch (macOS contacts failure) with `{ tags: { syncType: 'contacts', source: 'macos' } }`.
   - The Outlook contacts catch at line ~161 is currently non-fatal (logged as warning). Add `Sentry.addBreadcrumb()` for this warning case so it shows up in the timeline if a subsequent error occurs.

6. **Consistent tagging convention**:
   All Sentry captures MUST use these tags:
   ```typescript
   tags: {
     syncType: 'contacts' | 'emails' | 'messages',
     provider?: 'outlook' | 'gmail' | 'macos',
     operation: string,  // e.g., 'auto-refresh', 'sync-and-fetch-emails', 'messages-import'
   }
   ```

### Must NOT Do:

- Add Sentry to non-sync code paths
- Modify error handling logic (just add instrumentation alongside existing handling)
- Add performance tracing or custom transactions
- Log PII (user email addresses, message content) to Sentry -- user IDs are ok

## Acceptance Criteria

- [ ] `SyncOrchestratorService.ts` has `Sentry.captureException` in the startSync catch block
- [ ] `SyncOrchestratorService.ts` has breadcrumbs for sync lifecycle (request, start, complete, cancel)
- [ ] `emailSyncHandlers.ts` has `Sentry.captureException` for Outlook and Gmail fetch failures in `sync-and-fetch-emails`
- [ ] `messageImportHandlers.ts` has `Sentry.captureException` for import failures
- [ ] `useAutoRefresh.ts` has breadcrumbs for auto-refresh trigger/skip
- [ ] Contact sync errors (macOS + Outlook) are captured or breadcrumbed
- [ ] All Sentry tags follow the consistent convention defined above
- [ ] No PII is sent to Sentry (check: no email addresses, message content, subject lines in tags/extra)
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Create

None. This task only modifies existing files.

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/SyncOrchestratorService.ts` | Add `import * as Sentry`, add captureException in startSync catch, add breadcrumbs for sync lifecycle, add Sentry to contacts sync error paths |
| `electron/handlers/emailSyncHandlers.ts` | Add `import * as Sentry`, add captureException to `sync-and-fetch-emails` Outlook/Gmail catch blocks, add breadcrumbs |
| `electron/handlers/messageImportHandlers.ts` | Add `import * as Sentry`, add captureException to import error paths, add breadcrumbs |
| `src/hooks/useAutoRefresh.ts` | Add `import * as Sentry`, add breadcrumbs for auto-refresh trigger/skip |

### Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/syncOrchestrator.ts` | Reference for Sentry usage pattern in existing sync code (lines 567, 699, 879) |
| `electron/handlers/sessionHandlers.ts` | Reference for Sentry tag patterns in handlers |
| `src/main.tsx` | Confirm renderer Sentry init (`Sentry.init({})` at line 15) |
| `electron/main.ts` | Confirm main process Sentry init (line 144) |

## Implementation Notes

### Import patterns

**Renderer-side files** (`src/`):
```typescript
import * as Sentry from "@sentry/electron/renderer";
```

**Main process files** (`electron/`):
```typescript
import * as Sentry from "@sentry/electron/main";
```

### Breadcrumb pattern (copy this)

```typescript
Sentry.addBreadcrumb({
  category: 'sync',
  message: 'Sync started: contacts',
  level: 'info',
  data: {
    syncType: 'contacts',
    userId: userId.substring(0, 8) + '...',
  },
});
```

### captureException pattern (copy this)

```typescript
Sentry.captureException(error, {
  tags: {
    syncType: 'emails',
    provider: 'outlook',
    operation: 'sync-and-fetch-emails',
  },
  extra: {
    transactionId,
    contactEmailCount: contactEmails.length,
  },
});
```

### Specific locations in emailSyncHandlers.ts

The `sync-and-fetch-emails` handler starts at line 893. Within it:
- **Outlook fetch try/catch**: around lines 1007-1125. The catch block for Outlook is around line 1125 (look for the `catch` after `retryOnNetwork`).
- **Gmail fetch try/catch**: around lines 1128-1300. The catch block for Gmail follows the same pattern.
- **Main handler catch**: wrapping the entire handler.

Search for `} catch` within the `sync-and-fetch-emails` handler to find all error paths.

### Specific locations in messageImportHandlers.ts

The `messages:import-macos` handler starts at line 59. The main import logic is wrapped in a try/catch. Look for the catch block and add Sentry there.

### Specific locations in SyncOrchestratorService.ts

- `startSync()` method: line ~337. The catch block is at line ~386.
- `requestSync()` method: line ~272. Add breadcrumb here.
- `cancel()` method: line ~313. Add breadcrumb here.
- Contacts sync function: registered at line ~114. Outer try/catch for macOS contacts at line ~133. Outlook catch at line ~161.

## Testing Expectations

### Unit Tests

- **Required:** No new test files needed. Existing tests should continue to pass.
- **Verification:** Since Sentry is initialized with `{}` in renderer and is a no-op when no DSN is configured, the Sentry calls will not throw in test environments. Just verify existing tests still pass.

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** instrumentation (additive, no logic changes)
- **Base estimate:** ~20K tokens
- **SR overhead:** +10K
- **Final estimate:** ~30K tokens
- **Token Cap:** 120K (4x of 30K)

## PR Preparation

- **Title:** `feat(sentry): add instrumentation to all sync paths`
- **Branch:** `feature/task-2059-sentry-sync-instrumentation`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: 30K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find that Sentry is NOT initialized in the renderer (check `src/main.tsx` line 15)
- The Sentry import causes type errors (may need `@sentry/electron` types)
- Any existing tests mock Sentry and break with the new imports
- You need to modify error handling logic beyond adding Sentry calls
- More than 6 files need modification (scope creep)
