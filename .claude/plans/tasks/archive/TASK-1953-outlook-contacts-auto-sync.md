# Task TASK-1953: Wire Outlook contacts sync into auto-refresh flow

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

Wire the existing `contacts:syncOutlookContacts` IPC handler into the auto-refresh flow (SyncOrchestratorService) so that Outlook contacts are automatically fetched when the app starts, alongside the existing macOS Contacts sync. Users who have connected their Microsoft mailbox should get their Outlook contacts imported without any manual trigger.

## Non-Goals

- Do NOT refactor the SyncOrchestratorService architecture
- Do NOT add new IPC handlers -- the handler already exists at `electron/contact-handlers.ts:1427`
- Do NOT modify the outlookFetchService or externalContactDbService
- Do NOT add UI elements for manual Outlook contact sync (already exists in Settings)
- Do NOT handle re-authentication / scope migration for users missing `Contacts.Read`

## Deliverables

1. Update: `src/services/SyncOrchestratorService.ts` -- Add Outlook contacts sync as part of the 'contacts' sync function
2. Update: `src/hooks/useAutoRefresh.ts` -- Ensure contacts sync triggers for email-connected users (not just macOS)
3. Update: (if needed) `electron/preload/contactBridge.ts` -- Ensure `syncOutlookContacts` is exposed

## Acceptance Criteria

- [ ] When a user has a Microsoft email connected and the app starts, Outlook contacts are synced automatically
- [ ] The existing macOS Contacts sync still works as before (no regression)
- [ ] Outlook contacts sync only runs when the user has email connected (hasEmailConnected)
- [ ] Outlook contacts sync respects the `contactSources.direct.outlookContacts` preference (already gated in handler)
- [ ] If Outlook sync fails (e.g., token expired), it does not block other syncs
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Current Flow

The SyncOrchestratorService registers a 'contacts' sync function that only calls `window.api.contacts.getAll(userId)` -- this syncs macOS Contacts only. Outlook contacts are synced via a separate IPC handler `contacts:syncOutlookContacts` that is never called during auto-refresh.

### Approach: Extend the 'contacts' sync function

In `SyncOrchestratorService.initializeSyncFunctions()`, the 'contacts' sync function (line 94-117) should be modified to ALSO call the Outlook contacts sync after the macOS contacts sync:

```typescript
// Inside the contacts sync function, after macOS contacts sync:
// Also sync Outlook contacts if available
try {
  const outlookResult = await window.api.contacts.syncOutlookContacts(userId);
  if (outlookResult.success) {
    console.log('[SyncOrchestrator] Outlook contacts synced:', outlookResult.count);
  } else if (outlookResult.reconnectRequired) {
    console.warn('[SyncOrchestrator] Outlook contacts need reconnection');
  }
} catch (err) {
  // Don't fail the whole contacts sync if Outlook fails
  console.warn('[SyncOrchestrator] Outlook contacts sync failed (non-fatal):', err);
}
```

### Key Design Decision: Non-blocking Outlook failure

Outlook sync should be wrapped in its own try/catch so that if it fails (expired token, network error), the rest of the sync pipeline continues. This is important because macOS contacts sync and Outlook contacts sync are independent.

### Verify contactBridge exposure

Check that `window.api.contacts.syncOutlookContacts` is exposed in the preload bridge. If not, add it.

### Platform Consideration

Currently, 'contacts' sync is only registered on macOS. However, Outlook contacts sync works on ALL platforms. The 'contacts' sync function should be registered unconditionally (or add a separate registration for non-macOS that only does Outlook sync).

Recommended approach:
- Always register the 'contacts' sync function
- Inside, conditionally run macOS contacts sync (if macOS)
- Always attempt Outlook contacts sync (all platforms)

### Auto-refresh trigger

In `useAutoRefresh.ts`, the `runAutoRefresh` function (line 195-227) only adds 'contacts' to `typesToSync` if `isMacOS && hasPermissions`. This needs to also add 'contacts' when `hasEmailConnected` is true (since Outlook contacts work on all platforms):

```typescript
// Changed from: if (isMacOS && hasPermissions)
// To:
if (isMacOS && hasPermissions) {
  typesToSync.push('contacts');
} else if (hasEmailConnected) {
  // Outlook contacts sync works on all platforms
  typesToSync.push('contacts');
}
```

Or simplified: `if ((isMacOS && hasPermissions) || hasEmailConnected)`

## Integration Notes

- Imports from: `electron/contact-handlers.ts` (existing IPC handler)
- Used by: `src/hooks/useAutoRefresh.ts` (triggers sync on app load)
- Depends on: Nothing (all infrastructure exists)
- Related to: TASK-1920/1921 (Outlook contacts Graph API feature)

## Do / Don't

### Do:
- Wrap Outlook sync in its own try/catch (non-fatal failure)
- Log sync results for debugging
- Respect existing contact source preferences
- Keep changes minimal and focused

### Don't:
- Refactor SyncOrchestratorService architecture
- Add new UI for Outlook contact sync triggering
- Modify the Outlook fetch service or DB service
- Change the sequential sync order (contacts -> emails -> messages)

## When to Stop and Ask

- If `window.api.contacts.syncOutlookContacts` is not exposed in the preload bridge and the bridge file structure is unclear
- If the SyncOrchestratorService has been significantly refactored since investigation
- If there are conflicts between macOS and Outlook contacts sync that could cause data issues

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (existing handler tests cover the IPC handler; orchestrator tests would require significant mocking of window.api)
- The sync function registration is runtime-tested via integration

### Coverage

- Coverage impact: Minimal -- mostly wiring changes

### Integration / Feature Tests

- Manual verification required:
  - App starts with Microsoft email connected -> Outlook contacts appear
  - App starts on macOS with permissions -> both macOS and Outlook contacts sync
  - Outlook sync failure does not block messages sync

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(contacts): wire Outlook contacts sync into auto-refresh flow`
- **Labels**: `bug`, `contacts`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K (apply service multiplier x0.5 = ~10K-12.5K billable)

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 2-3 files (scope: small) | +15K |
| Code volume | ~30-50 lines | +5K |
| Test complexity | Low (no new tests required) | +0K |

**Confidence:** High

**Risk factors:**
- contactBridge may need updates (minor)
- Platform-conditional registration needs care

**Similar past tasks:** TASK-1950 (wire direct imports, actual: ~3K billable)

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
- [ ] Outlook contacts sync wired into SyncOrchestratorService
- [ ] Auto-refresh triggers contacts sync for email-connected users
- [ ] Non-fatal Outlook sync failure handling

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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~25K | ~XK | +/-X% |
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
