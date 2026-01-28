# Task TASK-1603: Remove Pending Email State

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Remove the `pendingEmailTokens`, `pendingOAuthData` complexity from email handlers now that the flow order ensures DB is always initialized before email connection.

## Non-Goals

- Do NOT change the UI design of email connection step
- Do NOT modify the OAuth flow itself (Google/Microsoft APIs)
- Do NOT change flow order (that's TASK-1601/1602)
- Do NOT remove all pending state (keep `pendingOnboardingData` for other uses)

## Deliverables

1. Update: `src/appCore/state/flows/useEmailHandlers.ts` - Simplify handlers, remove pending logic
2. Update: `src/appCore/state/types.ts` - Remove or deprecate PendingEmailTokens type
3. Update: `src/appCore/state/useAppStateMachine.ts` - Remove pendingEmailTokens state
4. Update: `src/services/authService.ts` - Remove pending API fallback logic
5. Update: Related test files - Update expectations

## Acceptance Criteria

- [ ] `useEmailHandlers` no longer has conditional "pending" vs "regular" API paths
- [ ] `PendingEmailTokens` type removed or marked deprecated
- [ ] `pendingEmailTokens` state removed from state machine
- [ ] Email OAuth flow works correctly (DB always ready)
- [ ] Google and Microsoft OAuth both tested working
- [ ] No regressions in email connection flow
- [ ] All CI checks pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current Complexity (to remove)

The `useEmailHandlers.ts` has dual paths because email might be connected before DB is ready:

```typescript
// Current pattern (in handleStartGoogleEmailConnect)
const usePendingApi = pendingOAuthData && !isAuthenticated;

if (usePendingApi) {
  // Path 1: DB not ready, use pending API
  result = await window.api.auth.googleConnectMailboxPending(emailHint);
  // ... set up pending listeners ...
} else if (currentUserId) {
  // Path 2: DB ready, use regular API
  result = await window.api.auth.googleConnectMailbox(currentUserId);
  // If regular fails with "DB not initialized", fall back to pending
  if (!result.success && result.error?.includes("Database is not initialized")) {
    // Path 2a: Fallback to pending
    result = await window.api.auth.googleConnectMailboxPending(emailHint);
  }
}
```

### Simplified Logic (after flow reorder)

After TASK-1601/1602, DB is always initialized before email-connect step:

```typescript
// New simplified pattern
const handleStartGoogleEmailConnect = useCallback(async (): Promise<void> => {
  if (!currentUserId) {
    console.error("[useEmailHandlers] No user ID available");
    return;
  }

  try {
    // DB is always ready now (flow reordered)
    const result = await window.api.auth.googleConnectMailbox(currentUserId);

    if (!result.success) {
      console.error("[useEmailHandlers] Failed to start Google OAuth:", result.error);
      return;
    }

    // Set up listener for OAuth completion
    const cleanup = window.api.onGoogleMailboxConnected(
      (connectionResult: { success: boolean; email?: string; error?: string }) => {
        if (connectionResult.success && connectionResult.email) {
          setHasEmailConnected(true, connectionResult.email, "google");
        }
        cleanup();
      }
    );
  } catch (error) {
    console.error("[useEmailHandlers] Error starting Google OAuth:", error);
  }
}, [currentUserId, setHasEmailConnected]);
```

### Files to Clean Up

| File | What to Remove |
|------|----------------|
| `useEmailHandlers.ts` | Remove `usePendingApi` checks, pending API calls, pending listeners |
| `types.ts` | Remove or deprecate `PendingEmailTokens` interface |
| `useAppStateMachine.ts` | Remove `pendingEmailTokens` state |
| `authService.ts` | Remove `googleConnectMailboxPending`, `microsoftConnectMailboxPending` handlers |
| `preload/index.ts` | Remove pending IPC handlers (if not used elsewhere) |

### State Machine Cleanup

Remove from `AppStateMachine` interface:
- `pendingEmailTokens: PendingEmailTokens | null`
- `setPendingEmailTokens` (if exposed)

Remove from state initialization:
- `pendingEmailTokens: null`

### Keep pendingOnboardingData

The `pendingOnboardingData` type is still useful for other onboarding state (termsAccepted, phoneType, etc.). Only remove the email-specific pending logic.

## Integration Notes

- Imports from: `../types`, `window.api`
- Exports to: Used by email step components
- Used by: `EmailConnectStep`, `OnboardingFlow`
- Depends on: TASK-1601 (macOS flow), TASK-1602 (Windows flow) - **MUST complete first**
- Blocks: TASK-1604 (user gate)

## Do / Don't

### Do:
- Remove all "pending" email API paths
- Simplify conditional logic in handlers
- Keep error handling (different errors may occur)
- Keep the OAuth listener setup (just remove pending variant)
- Document removed patterns for future reference

### Don't:
- Remove OAuth flow completely (just simplify)
- Remove `pendingOnboardingData` (still used)
- Change the OAuth APIs themselves
- Modify UI components

## When to Stop and Ask

- If you find pending APIs used outside email handlers
- If removing pending logic breaks other flows (login, etc.)
- If tests show DB is not initialized as expected
- If pendingEmailTokens is referenced in unexpected places

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test email handlers work without pending state
- Existing tests to update:
  - Remove tests for pending email flow
  - Update handler tests to expect simplified logic

### Coverage

- Coverage impact: May decrease slightly (removing pending paths)

### Integration / Feature Tests

- Required scenarios:
  - Google OAuth connection works after flow reorder
  - Microsoft OAuth connection works after flow reorder
  - Email connection persists correctly to DB

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(onboarding): remove pending email state complexity`
- **Labels**: `onboarding`, `refactor`, `sprint-063`
- **Depends on**: TASK-1601, TASK-1602 (MUST be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 5-6 files | +15K |
| Code volume | ~200 lines removed, ~50 simplified | +10K |
| Test complexity | Medium (update tests, verify flow) | +5K |

**Confidence:** Medium

**Risk factors:**
- Pending APIs may be used elsewhere
- Hidden dependencies on pending state

**Similar past tasks:** Refactor category applies 0.5x multiplier -> ~12.5K-15K

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
- [ ] src/appCore/state/flows/useEmailHandlers.ts
- [ ] src/appCore/state/types.ts
- [ ] src/appCore/state/useAppStateMachine.ts
- [ ] src/services/authService.ts (if pending APIs here)
- [ ] electron/preload/index.ts (if pending IPC handlers)
- [ ] Related test files

Features implemented:
- [ ] Pending email API paths removed
- [ ] PendingEmailTokens type removed/deprecated
- [ ] Email handlers simplified
- [ ] OAuth flow still works

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

### Pre-Implementation Technical Review

**Review Date:** 2026-01-28
**Reviewer:** SR Engineer

#### Branch Information
- **Branch From:** develop (after TASK-1601 and TASK-1602 merge)
- **Branch Into:** develop
- **Suggested Branch Name:** refactor/task-1603-remove-pending-email

#### Execution Classification
- **Parallel Safe:** **NO** - modifies multiple shared files
- **Depends On:** TASK-1601, TASK-1602 (MUST be merged first)
- **Blocks:** TASK-1604 (user gate)

#### Architecture Validation

**APPROVED WITH CAUTION** - This is the most complex task in Phase 1:
1. Removes technical debt (pending email complexity)
2. Simplifies OAuth flow architecture
3. Reduces code paths by ~50% in email handlers

**CAUTION**: This is a refactor with many touchpoints. Thorough testing required.

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Pending APIs used elsewhere | HIGH | **FULL SEARCH REQUIRED** - See analysis below |
| Breaking returning user flow | Medium | Test with existing user (not just new onboarding) |
| Removing type breaks compilation | Low | TypeScript will catch missing references |
| IPC handlers used by login | Medium | Login uses different handlers (verified) |

#### Comprehensive Reference Analysis

**Files referencing `pendingEmailTokens` (12 files found):**

| File | Usage | Action |
|------|-------|--------|
| `useEmailHandlers.ts` | setPendingEmailTokens calls | **MODIFY** - Remove pending paths |
| `useSecureStorage.ts` | Type import, unused in body | **VERIFY** - May just be interface compat |
| `returnHelpers.ts` | Unknown | **INVESTIGATE** |
| `types.ts` | Type definition | **MODIFY** - Remove or deprecate |
| `useAppStateMachine.ts` | useState, interface prop | **MODIFY** - Remove state |
| `AppRouter.tsx` | Prop passing? | **INVESTIGATE** |
| `App.test.tsx` | Test mock | **MODIFY** - Remove mock |
| `fullFlow.integration.test.tsx` | Test assertions | **MODIFY** - Update tests |
| `hookMigration.integration.test.tsx` | Test assertions | **MODIFY** - Update tests |
| `useSecureStorage.machine.test.tsx` | Test mock | **MODIFY** - Update mock |
| `useAppStateMachine.test.tsx` | Test assertions | **MODIFY** - Update tests |

**Files referencing pending mailbox APIs (10 files found):**

| File | API | Action |
|------|-----|--------|
| `useEmailHandlers.ts` | `googleConnectMailboxPending`, `microsoftConnectMailboxPending` | **REMOVE** calls |
| `authBridge.ts` | IPC method definitions | **KEEP** for now (backend cleanup separate) |
| `eventBridge.ts` | `onGoogleMailboxPendingConnected`, `onMicrosoftMailboxPendingConnected` | **KEEP** listeners in preload |
| `ipc.ts` | Type definitions | **KEEP** - backend types |
| `authService.ts` (renderer) | Service layer | **INVESTIGATE** |
| `authService.test.ts` | Test mocks | **MODIFY** |
| `window.d.ts` | Type declarations | **KEEP** for now |

#### Shared File Analysis

| File | Impact | Risk |
|------|--------|------|
| `useEmailHandlers.ts` | Major rewrite | High - test thoroughly |
| `types.ts` | Remove type | Low - TypeScript catches |
| `useAppStateMachine.ts` | Remove state | Medium - verify consumers |
| Various test files | Update mocks | Low |

**No conflict with TASK-1600, 1601, 1602** as those don't touch email handling.

#### Technical Considerations

1. **Keep Backend APIs**:
   Do NOT remove from `authBridge.ts`, `eventBridge.ts`, or `ipc.ts`. These are in the electron layer and may be needed for backwards compatibility or future use. Focus only on renderer-side removal.

2. **Keep `pendingOnboardingData`**:
   The task spec is clear - only remove EMAIL-specific pending state. `pendingOnboardingData` (termsAccepted, phoneType, emailConnected, emailProvider) is still used.

3. **Simplification Pattern**:
   ```typescript
   // BEFORE: Dual path
   const usePendingApi = pendingOAuthData && !isAuthenticated;
   if (usePendingApi) {
     result = await window.api.auth.googleConnectMailboxPending(emailHint);
   } else if (currentUserId) {
     result = await window.api.auth.googleConnectMailbox(currentUserId);
     if (DB_NOT_INIT_ERROR) {
       result = await window.api.auth.googleConnectMailboxPending(emailHint);
     }
   }

   // AFTER: Single path
   if (!currentUserId) { console.error(...); return; }
   result = await window.api.auth.googleConnectMailbox(currentUserId);
   ```

4. **Listener Simplification**:
   ```typescript
   // BEFORE: Two listener types
   if (actuallyUsedPendingApi) {
     window.api.onGoogleMailboxPendingConnected(...);
   } else {
     window.api.onGoogleMailboxConnected(...);
   }

   // AFTER: Single listener
   window.api.onGoogleMailboxConnected(...);
   ```

5. **State Machine Interface Update** (`AppStateMachine` in types.ts):
   ```typescript
   // REMOVE this property:
   pendingEmailTokens: PendingEmailTokens | null;
   ```

6. **useAppStateMachine.ts Changes**:
   - Remove `useState<PendingEmailTokens | null>` (line 74-75)
   - Remove `pendingEmailTokens` from useSecureStorageOptions (line 128)
   - Remove from stateMachine return object (lines 293, 320)

#### Do NOT Do (Gotchas)

1. **Do NOT remove electron-side IPC handlers** - Backend cleanup is separate
2. **Do NOT remove `pendingOnboardingData`** - Still used for other onboarding state
3. **Do NOT remove `savePendingMailboxTokens` IPC** - May be used for future offline-first
4. **Do NOT assume flow order is changed** - Wait for 1601/1602 to merge first

#### Verification Checklist Before PR

- [ ] `npm run type-check` passes (no missing `PendingEmailTokens` references)
- [ ] `npm test` passes (all test updates complete)
- [ ] Google OAuth still works in dev mode
- [ ] Microsoft OAuth still works in dev mode
- [ ] Returning user can still connect email

#### Status: APPROVED FOR IMPLEMENTATION

**BLOCKING DEPENDENCY**: Wait for TASK-1601 AND TASK-1602 PRs to be MERGED before starting.

**ESTIMATED COMPLEXITY**: Highest in Phase 1. Budget extra time for testing.

---

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
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
