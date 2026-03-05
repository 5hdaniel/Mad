# Task TASK-2102: Add Sentry Instrumentation to Sync Paths

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

Add Sentry instrumentation to sync failure paths in three files. The scope varies per file based on existing error handling:

- **`emailSyncHandlers.ts`** -- ENRICHMENT only (add breadcrumbs with context tags). This file uses `wrapHandler` which already calls `Sentry.captureException()`. Adding captureException here would cause double-reporting.
- **`messageImportHandlers.ts`** -- Full captureException scope (does NOT use wrapHandler).
- **`useAutoRefresh.ts`** -- Full captureException scope (2 catch points).

## Non-Goals

- Do NOT refactor existing Sentry patterns in files that already have good coverage (emailSyncService, submissionSyncService, supabaseService, etc.)
- Do NOT add Sentry to files that don't import it yet (scope is the 3 known gap files)
- Do NOT change error handling logic or control flow
- Do NOT add Sentry performance tracing / transactions (breadcrumbs + captureException is sufficient)

## Scope Scan (Pre-Implementation)

**Scan Date:** 2026-03-04

**Gap files (Sentry imported but only breadcrumbs, no captureException):**

| File | Lines | Sentry Refs | captureException | Breadcrumbs | Catch Blocks |
|------|-------|------------|------------------|-------------|--------------|
| `electron/handlers/emailSyncHandlers.ts` | 254 | 2 | 0 (but wrapHandler already captures) | 1 | 0 (uses wrapHandler) |
| `electron/handlers/messageImportHandlers.ts` | 483 | 3 | 0 | 2 | 9 |
| `src/hooks/useAutoRefresh.ts` | 338 | 4 | 0 | 3 | 2 |

**Already well-instrumented (no changes needed):**
- `emailSyncService.ts` (11 Sentry refs)
- `submissionSyncService.ts` (9 refs)
- `supabaseService.ts` (21 refs)
- `connectionStatusService.ts` (5 refs)
- 20+ other files with proper captureException usage

## Acceptance Criteria

- [ ] `emailSyncHandlers.ts` -- Enrichment breadcrumbs added with context tags (sync_type, provider, transactionId). Do NOT add captureException (wrapHandler already captures exceptions; adding it would cause double-reporting).
- [ ] `messageImportHandlers.ts` -- `Sentry.captureException()` called in catch blocks with import context. Note: does NOT use wrapHandler, so full captureException scope applies. Some catch blocks (~lines 113, 197, 212, 227) are non-critical -- engineer should assess severity and use appropriate Sentry level.
- [ ] `useAutoRefresh.ts` -- `Sentry.captureException()` called in both catch points (one try/catch, one `.catch()`) with refresh context. Uses `@sentry/electron/renderer` (correct for renderer process).
- [ ] Each captureException includes context tags: `{ sync_type, provider?, error_message }`
- [ ] Each captureException includes breadcrumb trail (sync start/complete/fail)
- [ ] Existing breadcrumb calls are preserved (add captureException alongside, do NOT replace breadcrumbs)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Pattern to Follow

Use the same pattern already established in `emailSyncService.ts`:

```typescript
// EXISTING PATTERN (emailSyncService.ts) -- follow this
try {
  Sentry.addBreadcrumb({
    category: "sync",
    message: "Starting email sync",
    level: "info",
    data: { provider, transactionId },
  });

  // ... sync logic ...

  Sentry.addBreadcrumb({
    category: "sync",
    message: "Email sync completed",
    level: "info",
    data: { provider, emailCount },
  });
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      sync_type: "email",
      provider: provider,
    },
    extra: {
      transactionId,
      error_message: error instanceof Error ? error.message : String(error),
    },
  });
  throw error; // or handle as appropriate
}
```

### File-Specific Guidance

#### `electron/handlers/emailSyncHandlers.ts` (254 lines) -- ENRICHMENT ONLY

**SR Finding:** `electron/utils/wrapHandler.ts` line 60 already calls `Sentry.captureException(error)`. Since emailSyncHandlers uses wrapHandler, errors ARE already captured -- but without context tags.

**CRITICAL -- Double-Reporting Risk:** If the engineer adds `captureException` inside a wrapHandler-wrapped function AND the error re-throws, Sentry gets TWO reports (one from the handler, one from wrapHandler). This is the primary risk to avoid.

**Scope for this file is ENRICHMENT only:**
- Add `Sentry.addBreadcrumb()` calls with context tags (sync_type, provider, transactionId) at handler entry/exit points
- Do NOT add `Sentry.captureException()` -- wrapHandler handles that

```typescript
// Add breadcrumbs with context to each handler function
Sentry.addBreadcrumb({
  category: "sync",
  message: "Email sync handler started",
  level: "info",
  data: { handler: "scanEmailsForTransaction", sync_type: "email", provider, transactionId },
});
```

#### `electron/handlers/messageImportHandlers.ts` (483 lines, 9 catch blocks) -- FULL SCOPE

This file does NOT use wrapHandler, so full `captureException` scope applies. Note that some catch blocks (~lines 113, 197, 212, 227) are non-critical catches -- engineer should assess severity and consider using `Sentry.Severity.Warning` for minor/expected failures vs `Sentry.Severity.Error` for critical ones.

Each catch block needs a `captureException` call. The breadcrumbs are already there for some operations -- add captureException alongside:

```typescript
} catch (error) {
  // EXISTING breadcrumb (keep it)
  Sentry.addBreadcrumb({ ... });

  // NEW: capture the exception for Sentry alerts
  Sentry.captureException(error, {
    tags: {
      sync_type: "message_import",
      import_source: "iphone" | "macos" | "wire",  // use appropriate value
    },
    extra: {
      handler: "handleImportMessages",
      error_message: error instanceof Error ? error.message : String(error),
    },
  });
}
```

#### `src/hooks/useAutoRefresh.ts` (338 lines, 2 catch points)

This is a renderer-side file. It has 2 catch points: one try/catch block and one `.catch()` chain. Uses `@sentry/electron/renderer` (confirmed correct for renderer process):

```typescript
} catch (error) {
  // EXISTING breadcrumbs (keep them)

  // NEW: capture exception
  Sentry.captureException(error, {
    tags: {
      sync_type: "auto_refresh",
    },
    extra: {
      error_message: error instanceof Error ? error.message : String(error),
    },
  });
}
```

### Important Details

- **CONFIRMED:** `wrapHandler` (electron/utils/wrapHandler.ts:60) already calls `Sentry.captureException(error)`. Any handler using wrapHandler (like emailSyncHandlers) must NOT add its own captureException to avoid double-reporting.
- Sentry is already imported in all 3 files, so no new imports needed
- Use `level: "error"` for captureException context (this is the default)
- Include `error instanceof Error ? error.message : String(error)` pattern for safe error serialization

## Integration Notes

- **Imports from:** `@sentry/electron/main` (electron files), `@sentry/electron/renderer` or `@sentry/react` (src files)
- **Exports to:** No export changes
- **Used by:** These are handler/hook files called by the app framework
- **Depends on:** No other sprint tasks

## Do / Don't

### Do:
- Follow the existing captureException pattern from `emailSyncService.ts`
- Include meaningful tags (sync_type, provider) and extras (error_message)
- Add breadcrumbs for sync start/complete where missing
- Preserve all existing error handling behavior

### Don't:
- Remove existing breadcrumb calls
- Change error handling flow (don't swallow errors, don't add throws)
- Add Sentry imports to files that don't already import it
- Add Sentry performance tracing (spans/transactions)
- Double-report errors -- specifically, do NOT add captureException in emailSyncHandlers.ts (wrapHandler already captures). Adding captureException in a wrapHandler-wrapped function that re-throws WILL cause two Sentry reports per error.

## When to Stop and Ask

- ~~If `wrapHandler` already calls `captureException`~~ -- **RESOLVED by SR review:** Yes it does (line 60). emailSyncHandlers scope is enrichment-only.
- If the Sentry import in any file uses a different package than expected
- If any catch block re-throws and is caught again higher up (double-reporting risk)
- If you find additional sync files that are missing captureException

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No
- Rationale: Sentry instrumentation is observability code -- verifying it calls captureException would require mocking Sentry, which adds test maintenance burden with low value. Manual verification via Sentry dashboard is more appropriate.

### Coverage

- Coverage impact: Not expected to change (catch blocks already exist)

### Integration / Feature Tests

- Required scenarios:
  - None -- this is observability-only code that doesn't change behavior

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(observability): add Sentry captureException to sync error paths`
- **Labels**: `bug`, `observability`, `sentry`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 3 files | +6K |
| Code volume | ~11 catch blocks to instrument, ~5 lines each | +3K |
| Test complexity | None (no new tests) | +0K |

**Adjustment:** service x 0.5 applied. Base estimate ~20K, adjusted to ~10K.

**Confidence:** High (small, well-defined scope)

**Risk factors:**
- wrapHandler may already capture exceptions (would reduce scope)
- Double-reporting risk if error propagation isn't traced carefully

**Similar past tasks:** TASK-2041 (Sentry captureException in SPRINT-092) -- similar pattern

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] (none)

Features implemented:
- [ ] emailSyncHandlers.ts instrumented
- [ ] messageImportHandlers.ts instrumented (9 catch blocks)
- [ ] useAutoRefresh.ts instrumented (2 catch blocks)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~10K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete

---

## SR Technical Review Notes (Pre-Implementation)

*Review Date: 2026-03-04*

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `claude/task-2102-sentry-sync-instrumentation`

### Technical Corrections Applied

1. **wrapHandler finding:** `electron/utils/wrapHandler.ts` line 60 already calls `Sentry.captureException(error)`. `emailSyncHandlers.ts` uses wrapHandler, so errors ARE already captured (without context tags). Scope for emailSyncHandlers.ts changed from "add captureException" to "add enrichment breadcrumbs only."

2. **Double-reporting risk documented:** If engineer adds captureException inside a wrapHandler-wrapped function AND the error re-throws, Sentry gets TWO reports. Acceptance criteria and Do/Don't sections updated to explicitly warn.

3. **messageImportHandlers.ts:** Does NOT use wrapHandler -- full captureException scope applies. Some catch blocks (~lines 113, 197, 212, 227) are non-critical catches; engineer should assess severity.

4. **useAutoRefresh.ts:** Has 2 catch points (one try/catch, one `.catch()`). Uses `@sentry/electron/renderer` (confirmed correct for renderer process).

5. **PR title prefix corrected:** `feat(observability)` not `fix(observability)` -- this is new instrumentation, not a bug fix.

### Parallel Safety

- **Confirmed parallel-safe.** Zero file overlaps with TASK-2099, TASK-2100, or TASK-2101.
- Smallest scope in the sprint -- recommended as first task to execute/merge.
