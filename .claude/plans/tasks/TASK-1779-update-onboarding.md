# Task TASK-1779: Update Onboarding PermissionsStep

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

Update PermissionsStep in onboarding to use SyncQueueService directly for tracking import state, replacing the call to `markOnboardingImportComplete()`.

## Non-Goals

- Do NOT change the onboarding flow or UI
- Do NOT modify SyncQueueService
- Do NOT remove `markOnboardingImportComplete` yet (that's TASK-1780)

## Deliverables

1. Update: `src/components/onboarding/steps/PermissionsStep.tsx`

## Acceptance Criteria

- [ ] Import `syncQueue` from SyncQueueService
- [ ] Use `syncQueue.start/complete` for contacts and messages imports
- [ ] Keep the `markOnboardingImportComplete()` call for now (backward compatibility)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current State (Before)

```typescript
// PermissionsStep.tsx currently has:
import { markOnboardingImportComplete } from "../../../hooks/useAutoRefresh";

// In triggerImport:
hasStartedImportRef.current = true;
markOnboardingImportComplete();  // Sets module-level flags

// Then runs imports without tracking via SyncQueue
const messagesPromise = window.api.messages.importMacOSMessages(userId)
  .then((result) => { /* ... */ });

const contactsPromise = (async () => {
  // Import contacts...
})();
```

### Target State (After)

```typescript
import { markOnboardingImportComplete } from "../../../hooks/useAutoRefresh";
import { syncQueue } from "../../../services/SyncQueueService";

// In triggerImport:
hasStartedImportRef.current = true;
markOnboardingImportComplete();  // Keep for now (removed in TASK-1780)

// Reset and queue syncs
syncQueue.reset();
syncQueue.queue('contacts');
syncQueue.queue('messages');

// Track import state with SyncQueue
syncQueue.start('contacts');
const contactsPromise = (async () => {
  try {
    // ... existing contacts import logic ...
    syncQueue.complete('contacts');
  } catch (error) {
    syncQueue.error('contacts', String(error));
  }
})();

syncQueue.start('messages');
const messagesPromise = window.api.messages.importMacOSMessages(userId)
  .then((result) => {
    // ... existing result handling ...
    syncQueue.complete('messages');
  })
  .catch((error) => {
    syncQueue.error('messages', String(error));
  });
```

### Important Details

- The imports run in parallel, so queue both upfront, then start each before its async operation
- Keep the existing progress state for UI display (`messagesProgress`, `contactsProgress`)
- The `setTimeout` that transitions to next step can stay as-is
- This allows SyncStatusIndicator on the dashboard to show accurate state when user arrives

## Integration Notes

- Imports from: `SyncQueueService`
- Exports to: Used by OnboardingShell
- Used by: None
- Depends on: TASK-1777 (useAutoRefresh simplified)

## Do / Don't

### Do:

- Import `syncQueue` from SyncQueueService
- Add `syncQueue.reset/queue/start/complete/error` calls
- Keep existing UI state management for progress display
- Keep `markOnboardingImportComplete()` call (will be removed in TASK-1780)

### Don't:

- Change the onboarding UI or flow
- Remove `markOnboardingImportComplete()` yet
- Remove the progress state or IPC listeners

## When to Stop and Ask

- If the import promises structure is complex and needs significant refactoring
- If there are race conditions between SyncQueue state and existing UI state
- If the transition to dashboard doesn't work correctly

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- New tests to write: None
- Existing tests to update: None in this task

### Coverage

- Coverage impact: No change expected

### Integration / Feature Tests

- Required scenarios:
  - Manual: Complete onboarding, verify imports tracked in SyncQueue
  - Manual: Dashboard shows correct sync state after onboarding

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(onboarding): use syncQueue for import tracking`
- **Labels**: `refactor`, `onboarding`
- **Depends on**: TASK-1777

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (PermissionsStep.tsx) | +10K |
| Code volume | ~20-30 lines added | +2K |
| Test complexity | Low | +0K |

**Confidence:** Medium

**Risk factors:**
- Parallel import logic may need careful ordering of syncQueue calls

**Similar past tasks:** Adding service calls to existing component

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
- [ ] src/components/onboarding/steps/PermissionsStep.tsx

Features implemented:
- [ ] Import syncQueue from SyncQueueService
- [ ] Add syncQueue.reset/queue calls before imports
- [ ] Add syncQueue.start before each import
- [ ] Add syncQueue.complete/error in promise handlers

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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

**Variance:** PM Est ~12K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~12K | ~XK | +/-X% |
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
