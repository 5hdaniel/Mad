# Task TASK-1780: Remove Dead Code

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

Remove obsolete module-level flags, functions, and interfaces that are no longer needed now that SyncQueueService is the single source of truth for sync state.

## Non-Goals

- Do NOT remove SyncQueueService or useSyncQueue (these are the new architecture)
- Do NOT remove any functionality that is still in use
- Do NOT change behavior - only remove dead code

## Deliverables

1. Update: `src/hooks/useAutoRefresh.ts`
2. Update: `src/hooks/useMacOSMessagesImport.ts`
3. Update: `src/components/onboarding/steps/PermissionsStep.tsx`

## Acceptance Criteria

- [ ] Remove from useAutoRefresh.ts:
  - [ ] `skipNextMessagesSync` module-level flag
  - [ ] `skipNextContactsSync` module-level flag
  - [ ] `markOnboardingImportComplete()` function
  - [ ] `shouldSkipMessagesSync()` function
  - [ ] `SyncOperation` interface (if unused)
  - [ ] `SyncStatus` interface (if unused)
- [ ] Remove from useMacOSMessagesImport.ts:
  - [ ] `hasMessagesImportTriggered()` function (if no longer used)
  - [ ] `isOnboardingImportActive()` function (if no longer used)
  - [ ] Related module-level flags
- [ ] Remove from PermissionsStep.tsx:
  - [ ] Import of `markOnboardingImportComplete`
  - [ ] Call to `markOnboardingImportComplete()`
- [ ] All imports of removed functions updated
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Code to Remove from useAutoRefresh.ts

```typescript
// REMOVE these module-level flags:
let skipNextMessagesSync = false;
let skipNextContactsSync = false;

// REMOVE this function:
export function markOnboardingImportComplete(): void {
  skipNextMessagesSync = true;
  skipNextContactsSync = true;
}

// REMOVE this function:
export function shouldSkipMessagesSync(): boolean {
  return skipNextMessagesSync;
}

// REMOVE these interfaces if no longer exported/used:
export interface SyncOperation { ... }
export interface SyncStatus { ... }
```

### Code to Remove from useMacOSMessagesImport.ts

First, check if these are still used anywhere:
```bash
grep -r "hasMessagesImportTriggered" --include="*.ts" --include="*.tsx" src/
grep -r "isOnboardingImportActive" --include="*.ts" --include="*.tsx" src/
```

If only used in useAutoRefresh.ts (which now uses SyncQueue), remove:
```typescript
// REMOVE if unused:
let hasTriggeredImport = false;
let isOnboardingImportRunning = false;

export function hasMessagesImportTriggered(): boolean { ... }
export function isOnboardingImportActive(): boolean { ... }
```

### Code to Remove from PermissionsStep.tsx

```typescript
// REMOVE this import:
import { markOnboardingImportComplete } from "../../../hooks/useAutoRefresh";

// REMOVE this call in triggerImport:
markOnboardingImportComplete();
```

### Verification Before Removal

Run these searches to confirm code is unused:
```bash
# Check for usages of functions being removed
grep -r "markOnboardingImportComplete" --include="*.ts" --include="*.tsx" src/
grep -r "shouldSkipMessagesSync" --include="*.ts" --include="*.tsx" src/
grep -r "skipNextMessagesSync" --include="*.ts" --include="*.tsx" src/
grep -r "skipNextContactsSync" --include="*.ts" --include="*.tsx" src/
```

### Important Details

- The `resetAutoRefreshTrigger()` function may still be needed for testing - keep if used in tests
- `autoRefreshInitiatedMessages` flag may still be needed - check IPC listener logic
- Run full test suite after removal to catch any missed usages

## Integration Notes

- Imports from: None (removing code)
- Exports to: None (removing exports)
- Used by: None after TASK-1778, TASK-1779
- Depends on: TASK-1778, TASK-1779 (consumers updated to not use these)

## Do / Don't

### Do:

- Search for usages before removing any code
- Remove related imports when removing functions
- Keep functions that are still used (e.g., `resetAutoRefreshTrigger` for tests)
- Run type-check after each file change

### Don't:

- Remove `SyncQueueService` or `useSyncQueue`
- Remove code that is still referenced
- Break the build

## When to Stop and Ask

- If a function being removed is still used somewhere unexpected
- If removing code causes type errors in multiple files
- If tests fail due to missing exports

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- New tests to write: None
- Existing tests to update: May need to remove tests for removed functions (deferred to TASK-1781)

### Coverage

- Coverage impact: May improve (removing dead code)

### Integration / Feature Tests

- Required scenarios:
  - Manual: Full sync flow still works
  - Manual: Onboarding still works

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(sync): remove obsolete sync flags and functions`
- **Labels**: `refactor`, `cleanup`
- **Depends on**: TASK-1778, TASK-1779

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 3 files | +8K |
| Code volume | ~100-150 lines removed | +2K |
| Test complexity | Low | +0K |

**Confidence:** High

**Risk factors:**
- May discover unexpected usages during removal

**Similar past tasks:** Code cleanup task, historically 0.5x multiplier accurate

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

Files modified:
- [ ] src/hooks/useAutoRefresh.ts
- [ ] src/hooks/useMacOSMessagesImport.ts
- [ ] src/components/onboarding/steps/PermissionsStep.tsx

Code removed:
- [ ] skipNextMessagesSync flag
- [ ] skipNextContactsSync flag
- [ ] markOnboardingImportComplete()
- [ ] shouldSkipMessagesSync()
- [ ] hasMessagesImportTriggered() (if unused)
- [ ] isOnboardingImportActive() (if unused)
- [ ] SyncOperation interface (if unused)
- [ ] SyncStatus interface (if unused)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
```

### Lines Removed Count

**Document the actual lines removed for sprint summary:**

| File | Lines Removed |
|------|---------------|
| useAutoRefresh.ts | X |
| useMacOSMessagesImport.ts | X |
| PermissionsStep.tsx | X |
| **Total** | **X** |

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
<1-2 sentence explanation of why estimate was off>

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
**Test Coverage:** Adequate

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** feature/dynamic-import-batch-size

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
