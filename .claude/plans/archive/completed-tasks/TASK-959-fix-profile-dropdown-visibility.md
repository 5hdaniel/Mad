# TASK-959: Fix User Profile Dropdown Intermittent Visibility Bug

**Backlog ID:** BACKLOG-148
**Sprint:** Unassigned
**Phase:** N/A
**Branch:** `fix/task-959-profile-dropdown-visibility`
**Estimated Tokens:** ~35K (UI/state category, apply 1.0x)
**Token Cap:** 100K

---

## Objective

Investigate and fix the intermittent issue where the user profile avatar/dropdown in the top-right corner of the application sometimes does not appear, being replaced by "Magic Audit" text. This prevents users from accessing logout, settings, and other account functions.

---

## Context

### Bug Report
- **Platform:** Windows PC
- **Symptom:** Top-right corner shows "Magic Audit" text instead of user profile avatar/dropdown
- **Impact:** Users cannot access logout or settings when this occurs
- **Frequency:** Intermittent (sometimes works, sometimes doesn't)

### Current Implementation

The profile button is rendered in `src/appCore/AppShell.tsx` (lines 60-79):

```typescript
{/* User Menu Button */}
{isAuthenticated && currentUser && (
  <button
    onClick={openProfile}
    className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500..."
    title={`${currentUser.display_name || currentUser.email} - Click for account settings`}
    data-tour="profile-button"
  >
    {currentUser.avatar_url ? (
      <img src={currentUser.avatar_url} alt="Profile" ... />
    ) : (
      currentUser.display_name?.[0]?.toUpperCase() ||
      currentUser.email?.[0]?.toUpperCase() ||
      "?"
    )}
  </button>
)}
```

The profile button only renders when BOTH conditions are true:
1. `isAuthenticated` is truthy
2. `currentUser` is not null

### Suspected Root Causes

1. **Race Condition:** `isAuthenticated` becomes true before `currentUser` is populated, causing a window where the button doesn't render
2. **State Desync:** During certain state transitions (e.g., returning from background, network reconnection), `currentUser` may become null while `isAuthenticated` remains true
3. **State Machine Transition Gap:** The new state machine (BACKLOG-142) may have edge cases where user state is temporarily inconsistent
4. **Page Title Logic:** The `getPageTitle()` function returning "Magic Audit" may be a symptom of being in an unexpected state

### Related Work

- **BACKLOG-142:** State Coordination Layer Overhaul (in progress) - may address underlying state coordination issues
- **BACKLOG-141:** Onboarding Flicker for Returning Users - potentially related state coordination bug
- **SPRINT-020:** State Coordination Foundation - implemented unified state machine

---

## Requirements

### Must Do:

1. **Investigate the root cause:**
   - Add logging/debugging to identify when `isAuthenticated` is true but `currentUser` is null
   - Check the state machine transitions that populate `currentUser`
   - Identify timing gaps between authentication and user data availability

2. **Identify reproduction steps:**
   - Document exact conditions that trigger the bug
   - Check if it happens on fresh login, returning user flow, or both
   - Check if network conditions affect it

3. **Implement fix:**
   - Ensure `currentUser` is always available when `isAuthenticated` is true
   - OR show loading/placeholder state while `currentUser` is being loaded
   - Consider adding fallback UI for edge cases

4. **Add defensive rendering:**
   - If `isAuthenticated` but no `currentUser`, show loading indicator or placeholder avatar
   - Prevent "Magic Audit" text from being the only content in header when user should be logged in

5. **Add tests:**
   - Test that profile button renders when authenticated
   - Test edge case where `isAuthenticated` is true but `currentUser` is null
   - Test state transitions don't cause profile button flicker

### Must NOT Do:

- Break existing authentication flow
- Remove existing conditional rendering without replacement
- Add significant performance overhead with excessive re-renders
- Modify the state machine architecture (that's BACKLOG-142 scope)

---

## Acceptance Criteria

- [ ] Profile avatar/dropdown always visible in top-right when user is logged in
- [ ] No flicker during page transitions or state changes
- [ ] Clicking profile button always opens profile modal when logged in
- [ ] Fallback/loading state displayed if user data is temporarily unavailable
- [ ] Root cause documented in Implementation Summary
- [ ] Unit tests added for edge cases
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/appCore/AppShell.tsx` - Profile button rendering logic (primary fix location)
- `src/appCore/AppShell.test.tsx` - Add tests for profile visibility edge cases (create if doesn't exist)

## Files to Read (for context)

- `src/appCore/state/types.ts` - AppStateMachine interface definition
- `src/appCore/state/useAppStateMachine.ts` - State machine implementation
- `src/appCore/state/machine/AppStateContext.tsx` - currentUser derivation logic
- `src/appCore/state/machine/types.ts` - State machine type definitions
- `src/contexts/AuthContext.tsx` - Authentication context

---

## Investigation Checklist

Before implementing a fix, verify:

- [ ] When does `isAuthenticated` become true vs when `currentUser` is populated?
- [ ] Is there a timing gap between these two state changes?
- [ ] Does the bug occur on:
  - [ ] Fresh login?
  - [ ] Returning user (app restart)?
  - [ ] Page navigation?
  - [ ] Network reconnection?
- [ ] What is the value of `currentStep` when the bug occurs?
- [ ] Is `getPageTitle()` returning "Magic Audit" as a fallback or intentionally?

---

## Implementation Notes

### Recommended Approach: Defensive Rendering with Loading State

```typescript
{/* User Menu Button - Always show something when authenticated */}
{isAuthenticated && (
  currentUser ? (
    <button
      onClick={openProfile}
      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500..."
      title={`${currentUser.display_name || currentUser.email} - Click for account settings`}
      data-tour="profile-button"
    >
      {currentUser.avatar_url ? (
        <img src={currentUser.avatar_url} alt="Profile" ... />
      ) : (
        currentUser.display_name?.[0]?.toUpperCase() ||
        currentUser.email?.[0]?.toUpperCase() ||
        "?"
      )}
    </button>
  ) : (
    // Loading placeholder while currentUser is being fetched
    <div
      className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"
      title="Loading user profile..."
    />
  )
)}
```

### Alternative: Ensure State Consistency

If the issue is a state machine bug, the fix may be in the state coordination layer:
- Ensure `currentUser` is set atomically with `isAuthenticated`
- Add state machine invariant: if `isAuthenticated`, `currentUser` must be non-null

---

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  - Profile button renders when `isAuthenticated=true` and `currentUser` exists
  - Loading placeholder renders when `isAuthenticated=true` but `currentUser` is null
  - Profile button onClick opens profile modal
  - Profile button does not render when `isAuthenticated=false`
- **Existing tests to update:** Check `src/components/__tests__/App.test.tsx` for related tests

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(ui): ensure profile dropdown always visible when authenticated`
- **Branch:** `fix/task-959-profile-dropdown-visibility`
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
- [ ] Recorded Agent ID: ___
- [ ] Read task file completely

Investigation:
- [ ] Identified root cause (document below)
- [ ] Found reproduction steps (document below)

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Agent ID in description
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Investigation Findings

**Root Cause:**
[Document what you discovered about why this bug occurs]

**Reproduction Steps:**
[Document exact steps to reproduce the bug]

### Results

- **Before**: Profile dropdown sometimes doesn't appear when logged in
- **After**: Profile dropdown always appears when authenticated (with loading state if needed)
- **Actual Tokens**: (auto-captured via SubagentStop hook)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The root cause is in the state machine architecture (may be BACKLOG-142 scope)
- The fix requires changes to authentication flow
- You discover this is related to the new state machine feature flag
- Multiple components need modification beyond AppShell.tsx
- The bug cannot be reproduced reliably
- You encounter blockers not covered in the task file
