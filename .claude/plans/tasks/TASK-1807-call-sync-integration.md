# Task TASK-1807: Call Sync Integration

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

Integrate call log import into the SyncOrchestrator service so call history syncs automatically alongside contacts, emails, and messages on the dashboard.

## Non-Goals

- Do NOT implement the import services (TASK-1801, TASK-1803)
- Do NOT implement UI components (TASK-1805)
- Do NOT implement manual trigger UI (use existing sync button)
- Do NOT create a separate "Calls" sync pill initially (bundle with Messages)

## Deliverables

1. Update: `src/services/SyncOrchestratorService.ts` - Add calls sync function
2. Update: `src/hooks/useAutoRefresh.ts` - Register calls sync
3. Update: `src/components/onboarding/steps/PermissionsStep.tsx` - Trigger call import
4. Update: `src/components/settings/MacOSMessagesImportSettings.tsx` - Include calls in re-import

## Acceptance Criteria

- [ ] Call import runs as part of the "messages" sync on macOS
- [ ] Call import runs as part of Windows iPhone sync flow
- [ ] Dashboard auto-refresh includes call import
- [ ] Onboarding imports calls along with messages
- [ ] Settings "Re-import" option includes calls
- [ ] Sync progress shows call import phase
- [ ] Sync errors for calls are non-fatal (don't block other syncs)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Integration Strategy

Call import will be bundled with messages sync because:
1. Both require Full Disk Access on macOS
2. Both come from the same iPhone backup on Windows
3. Simpler UX (one sync = all phone data)

### SyncOrchestrator Integration

Add calls to the messages sync function:

```typescript
// In SyncOrchestratorService.ts

// Modify the messages sync registration to include calls
registerSyncFunction('messages', async (userId, onProgress) => {
  const platform = await getPlatform();

  if (platform === 'darwin') {
    // macOS: Import from system databases
    onProgress?.({ phase: 'messages', current: 0, total: 2, percent: 0 });

    // Import messages
    const messageResult = await window.api.messages.importMacOS(userId, false);
    onProgress?.({ phase: 'messages', current: 1, total: 2, percent: 50 });

    // Import calls (new)
    try {
      const callResult = await window.api.callLogs.importMacOS(userId, false);
      logService.info('Calls imported', { imported: callResult.callsImported });
    } catch (error) {
      // Non-fatal - log and continue
      logService.warn('Call import failed (non-fatal)', { error });
    }

    onProgress?.({ phase: 'messages', current: 2, total: 2, percent: 100 });
    return messageResult;
  }

  // Windows: Calls are imported in sync-handlers.ts (TASK-1803)
  // No changes needed here - sync result already includes calls
  return window.api.messages.importFromBackup(userId);
});
```

### Onboarding Integration

In `PermissionsStep.tsx`, calls import is automatic via sync orchestrator:

```typescript
// When initiating sync after permissions granted:
await syncOrchestrator.requestSync('messages');
// This now includes calls import on macOS
```

### Settings Integration

In `MacOSMessagesImportSettings.tsx`, add calls to re-import:

```typescript
const handleReimport = async () => {
  setIsImporting(true);

  try {
    // Re-import messages
    const messageResult = await window.api.messages.importMacOS(userId, true);

    // Re-import calls
    try {
      await window.api.callLogs.importMacOS(userId, true);
    } catch (callError) {
      logService.warn('Call re-import failed', { error: callError });
      // Non-fatal
    }

    setLastImportResult(messageResult);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsImporting(false);
  }
};
```

### Progress Reporting

Update progress to show call import phase:

```typescript
// Progress phases for messages sync:
type MessageSyncPhase = 'messages' | 'calls' | 'complete';

// Progress callback receives:
{
  phase: 'calls',
  current: 1,
  total: 2,
  percent: 75,  // 75% = messages done, calls in progress
  message: 'Importing call history...'
}
```

### Error Handling

Call import failures should NOT block other syncs:

```typescript
try {
  await window.api.callLogs.importMacOS(userId, forceReimport);
} catch (error) {
  // Log error but don't throw
  logService.warn('Call import failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    context: 'messages-sync',
  });
  // Continue with sync completion
}
```

## Integration Notes

- Imports from: Call import IPC API (TASK-1802)
- Modifies: `SyncOrchestratorService.ts`, `useAutoRefresh.ts`, onboarding/settings
- Used by: Dashboard auto-refresh, onboarding flow, settings
- Depends on: TASK-1802 (macOS IPC), TASK-1803 (Windows integration)
- Pattern follows: Existing messages sync integration

## Do / Don't

### Do:

- Bundle calls with messages sync (same permission requirements)
- Make call import failures non-fatal
- Log call import results for debugging
- Update progress to show call phase

### Don't:

- Don't create a separate "Calls" sync pill (keep it simple)
- Don't block sync completion on call import failure
- Don't skip Windows integration (already done in TASK-1803)
- Don't forget to check platform before calling macOS-only API

## When to Stop and Ask

- If SyncOrchestratorService structure has changed significantly
- If sync registration patterns differ from expected
- If progress reporting requirements change

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test messages sync includes calls import
  - Test call import failure doesn't block sync
  - Test progress reporting includes call phase
- Existing tests to update:
  - SyncOrchestrator tests - add call import mocks
  - useAutoRefresh tests - verify calls included

### Coverage

- Coverage impact: Existing sync tests should be updated

### Integration / Feature Tests

- Required scenarios:
  - Dashboard sync imports calls on macOS
  - Onboarding imports calls
  - Settings re-import includes calls
  - Call import failure logs warning but sync completes

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(sync): integrate call import with messages sync`
- **Labels**: `feature`, `sync`
- **Depends on**: TASK-1802, TASK-1803, TASK-1805

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~10K-12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 4 files (orchestrator, hook, onboarding, settings) | +6K |
| Code volume | ~100 lines additions | +3K |
| Test complexity | Low - mocked calls | +3K |

**Confidence:** High

**Risk factors:**
- SyncOrchestrator may have evolved

**Similar past tasks:** Refactor tasks use x0.5 multiplier = ~10K

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
Files modified:
- [ ] src/services/SyncOrchestratorService.ts
- [ ] src/hooks/useAutoRefresh.ts
- [ ] src/components/onboarding/steps/PermissionsStep.tsx
- [ ] src/components/settings/MacOSMessagesImportSettings.tsx

Features implemented:
- [ ] Calls bundled with messages sync
- [ ] Non-fatal error handling
- [ ] Progress reporting
- [ ] Settings re-import

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
