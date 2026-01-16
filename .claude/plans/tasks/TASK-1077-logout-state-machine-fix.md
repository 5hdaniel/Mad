# Task TASK-1077: Fix Logout State Machine Transition (Security)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1077 |
| **Sprint** | Ad-hoc Critical Fix |
| **Backlog Item** | BACKLOG-287 |
| **Priority** | CRITICAL |
| **Category** | security |
| **Estimated Tokens** | ~20K |
| **Token Cap** | 80K |

---

## Goal

Fix the critical security bug where the dashboard remains visible after logout. The root cause is that the logout handler does NOT dispatch `LOGOUT` to the state machine, so the UI stays in "ready" state even though the backend session is cleared.

## Non-Goals

- Do NOT change backend logout logic (it's working correctly)
- Do NOT change AuthContext logout (it's working correctly)
- Do NOT refactor the state machine beyond this fix
- Do NOT add new features

## Root Cause Analysis

The investigation (BACKLOG-287) found:

1. **Backend logout works** (`sessionHandlers.ts`): Session deleted from DB, cleared from memory
2. **AuthContext logout works** (`AuthContext.tsx`): Sets `isAuthenticated: false`
3. **State machine NOT updated** (`useAuthFlow.ts`): `handleLogout()` does NOT dispatch `LOGOUT` action
4. **Navigation stays "dashboard"**: State machine is still "ready", so `deriveAppStep()` returns "dashboard"

### The Bug Location

**File**: `src/appCore/state/flows/useAuthFlow.ts` (around line 158-165)

```typescript
const handleLogout = useCallback(async (): Promise<void> => {
  await logout();                              // Clears AuthContext ✓
  // MISSING: dispatch({ type: "LOGOUT" });    // ❌ State machine not updated
  onCloseProfile();
  setIsNewUserFlow(false);
  onSetHasSelectedPhoneType(false);
  onSetSelectedPhoneType(null);
  onSetCurrentStep("login");                   // ❌ This is a NO-OP!
}, [logout, ...]);
```

The `onSetCurrentStep("login")` call is intentionally a no-op (see `useNavigationFlow.ts:108-110`) because navigation is derived from state machine, not set imperatively.

### The Fix

Dispatch `LOGOUT` action to the state machine:

```typescript
const handleLogout = useCallback(async (): Promise<void> => {
  await logout();
  dispatch({ type: "LOGOUT" });                // ADD THIS LINE
  onCloseProfile();
  // ... rest stays the same
}, [logout, dispatch, ...]);
```

The reducer already handles LOGOUT (`reducer.ts:488-491`):
```typescript
case "LOGOUT": {
  return { status: "unauthenticated" };  // Transitions to login screen
}
```

## Deliverables

1. Update: `src/appCore/state/flows/useAuthFlow.ts` - Add dispatch LOGOUT
2. Verify: State machine transitions to "unauthenticated" after logout
3. Test: Manual verification that dashboard is no longer visible after logout

## Acceptance Criteria

- [ ] After clicking logout, state machine transitions to "unauthenticated"
- [ ] User is redirected to login screen after logout
- [ ] Dashboard is NOT visible after logout
- [ ] Refreshing page after logout shows login screen
- [ ] No regression in login flow

## Implementation Notes

### Step 1: Add dispatch to handleLogout

In `src/appCore/state/flows/useAuthFlow.ts`, find `handleLogout` and add the dispatch call.

The `dispatch` function should already be available in the hook - check if it's destructured from `useAppStateMachine` or needs to be imported.

### Step 2: Verify dispatch is in dependencies

Make sure `dispatch` is in the `useCallback` dependency array.

### Step 3: Test the fix

1. Log in to the application
2. Navigate to dashboard
3. Click logout
4. Verify: Redirected to login screen
5. Verify: Cannot navigate back to dashboard without logging in

## Files to Modify

| File | Change |
|------|--------|
| `src/appCore/state/flows/useAuthFlow.ts` | Add `dispatch({ type: "LOGOUT" })` in handleLogout |

## Do / Don't

### Do:
- Add the dispatch call as the first action after `await logout()`
- Verify the dependency array includes `dispatch`
- Test manually after the fix

### Don't:
- Change the reducer's LOGOUT handler
- Modify AuthContext logout
- Remove the existing cleanup code (onCloseProfile, etc.)
- Add extra state changes beyond the dispatch

## When to Stop and Ask

- If `dispatch` is not available in useAuthFlow.ts
- If the state machine doesn't have a LOGOUT action type defined
- If adding dispatch causes type errors
- If other components depend on the current (broken) behavior

## Testing Expectations (MANDATORY)

### Manual Testing

- Required: Yes (this is a UI flow fix)
- Test scenario: Login → Dashboard → Logout → Verify redirected to login

### Unit Tests

- Required: If existing tests for useAuthFlow exist, update them
- May need to mock dispatch and verify it's called with `{ type: "LOGOUT" }`

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Existing tests (no regressions)

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x estimate)

> Simple fix - one line addition, but need to verify integration and test.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +5K |
| Code change | 1-2 lines | +5K |
| Verification | Manual testing, possibly unit tests | +10K |

**Confidence:** High

**Risk factors:**
- dispatch may not be readily available in the hook
- May need to check how other flows handle state transitions

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/appCore/state/flows/useAuthFlow.ts

Features implemented:
- [ ] Dispatch LOGOUT to state machine

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Manual test: logout redirects to login
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Notes

**Planning notes:**
<Notes from planning phase>

**Deviations from plan:**
<Any changes from original plan>

**Design decisions:**
<Key decisions made>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-287 | Dashboard Visible After Logout | Source backlog item |
