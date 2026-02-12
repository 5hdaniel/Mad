# Task TASK-1955: Add sync-complete listener to ImportContactsModal for live refresh

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

Make the ImportContactsModal automatically refresh its contact list when a manual sync is triggered from Settings (macOS Contacts Import). Currently, the modal loads contacts on mount but does not subscribe to the `contacts:external-sync-complete` event, so users must close and reopen the modal to see newly synced contacts.

## Non-Goals

- Do NOT refactor the ImportContactsModal architecture
- Do NOT add auto-sync triggering from the modal itself
- Do NOT change the backend sync broadcast mechanism
- Do NOT modify the Settings page or macOS Contacts import flow
- Do NOT add a manual "Refresh" button (the listener is sufficient)

## Deliverables

1. Update: `src/components/contact/components/ImportContactsModal.tsx` -- Add sync-complete event listener that reloads available contacts

## Acceptance Criteria

- [ ] When ImportContactsModal is open and a manual contact sync completes (triggered from Settings), the modal refreshes its contact list automatically
- [ ] The `contacts:external-sync-complete` event listener is properly cleaned up on unmount
- [ ] Loading state is shown briefly during refresh
- [ ] No regression in existing import flow (selecting, importing, searching)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Current Behavior

`ImportContactsModal` (line 31-54) loads contacts once on mount:
```typescript
useEffect(() => {
  loadAvailableContacts();
}, []);
```

The `loadAvailableContacts` function (line 35-54) calls `window.api.contacts.getAvailable(userId)` and sets state.

### Backend Event

The backend sends `contacts:external-sync-complete` when a sync finishes. The preload bridge exposes this at:
```typescript
// electron/preload/contactBridge.ts:174-182
onExternalSyncComplete: (callback: () => void): (() => void) => {
  const handler = () => { callback(); };
  ipcRenderer.on("contacts:external-sync-complete", handler);
  return () => {
    ipcRenderer.removeListener("contacts:external-sync-complete", handler);
  };
};
```

### Implementation

Add a useEffect that subscribes to the sync-complete event:

```typescript
// Listen for external sync complete events to refresh contacts list
useEffect(() => {
  // Subscribe to sync completion broadcasts
  const contactsApi = window.api.contacts as {
    onExternalSyncComplete?: (callback: () => void) => () => void;
  };

  if (!contactsApi?.onExternalSyncComplete) return;

  const cleanup = contactsApi.onExternalSyncComplete(() => {
    // Reload contacts when sync completes
    loadAvailableContacts();
  });

  return cleanup;
}, []);
```

### Key Details

1. **Type safety**: The `onExternalSyncComplete` method may not be in the typed bridge interface. Use a type assertion similar to how `onImportProgress` is used in SyncOrchestratorService (line 100-101).

2. **loadAvailableContacts must be stable**: The current `loadAvailableContacts` is defined as a regular function in the component body. It should work fine being called from the listener since it captures `userId` from props. However, if you wrap it in `useCallback`, make sure the effect re-subscribes when it changes.

3. **Loading state**: The `loadAvailableContacts` function already sets `setLoading(true)` and `setLoading(false)`. When the listener triggers a reload, users will briefly see the loading spinner, which is acceptable feedback.

4. **No race condition risk**: If the modal is closed before the event fires, the cleanup function removes the listener. React's cleanup handles this correctly.

## Integration Notes

- Imports from: `electron/preload/contactBridge.ts` (event bridge)
- Exports to: Nothing (internal modal behavior)
- Used by: ContactSelectModal (opens ImportContactsModal)
- Depends on: Nothing (backend event already exists)

## Do / Don't

### Do:
- Clean up the event listener on unmount
- Use the existing `loadAvailableContacts` function for reload
- Handle the case where `onExternalSyncComplete` is not available gracefully
- Keep the change minimal (just add the listener)

### Don't:
- Add a manual "Refresh" button to the modal
- Modify the backend broadcast mechanism
- Refactor how contacts are loaded
- Add debouncing (sync-complete fires once per sync, not rapidly)

## When to Stop and Ask

- If `window.api.contacts.onExternalSyncComplete` is not exposed in the preload bridge
- If the ImportContactsModal has been significantly refactored since investigation
- If the `contacts:external-sync-complete` event is not being sent by the backend

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (event listener integration is best tested manually; mocking IPC events in Jest is fragile)
- If a test file exists for ImportContactsModal, add a basic test that the component renders without errors

### Coverage

- Coverage impact: Minimal

### Integration / Feature Tests

- Manual verification required:
  - Open ImportContactsModal, trigger manual sync from Settings -> modal refreshes
  - Close modal -> no errors from orphaned listener
  - Open modal with no sync running -> contacts load normally

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(contacts): auto-refresh ImportContactsModal on sync completion`
- **Labels**: `bug`, `contacts`, `ux`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~12K-15K (apply ui multiplier x1.0 = ~12K-15K billable)

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (scope: small) | +10K |
| Code volume | ~15-20 lines | +2K |
| Test complexity | None (manual verification) | +0K |

**Confidence:** High

**Risk factors:**
- Minimal -- straightforward event listener addition

**Similar past tasks:** TASK-1951 (wire inferred contacts, actual: ~3K billable)

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
- [ ] (none expected)

Features implemented:
- [ ] Sync-complete event listener added to ImportContactsModal
- [ ] Listener properly cleaned up on unmount

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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~15K | ~XK | +/-X% |
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
**Security Review:** PASS / FAIL / N/A
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
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
