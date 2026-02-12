# Task TASK-1938: Fix AppleDriverSetup Render-Time Callback

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

---

## Goal

Fix the render-time side effect in `AppleDriverSetup.tsx` where `onComplete()` is called directly during render (line 256) instead of inside a `useEffect`. This violates React's rules and can cause unpredictable behavior.

## Non-Goals

- Do NOT refactor the entire AppleDriverSetup component
- Do NOT change the Windows driver installation flow
- Do NOT add new features or UI changes

## Deliverables

1. Update: `src/components/AppleDriverSetup.tsx` — Move `onComplete()` at line 256 into a `useEffect` with a guard
2. Update: `src/components/AppleDriverSetup.tsx` — Remove `onComplete` from the mount effect dependency array (line 194)

## Technical Details

### Problem 1: Render-time side effect (line 254-257)
```tsx
// Current (BAD - called during render):
if (!isWindows) {
  onComplete();
  return null;
}
```

**Fix:** Move into a `useEffect`:
```tsx
// Return early from render without side effect
if (!isWindows) {
  return null;
}

// Add useEffect to handle non-Windows completion
useEffect(() => {
  if (!isWindows) {
    onComplete();
  }
}, [isWindows, onComplete]);
```

Note: The effect must be placed BEFORE any conditional returns (React hooks rules). The conditional `return null` stays where it is.

### Problem 2: onComplete in mount effect deps (line 194)
The `checkDriverStatus` effect includes `onComplete` in its dependency array but doesn't use it. Remove it to prevent unnecessary re-runs.

## Acceptance Criteria

- [ ] No `onComplete()` calls outside of `useEffect` hooks
- [ ] `onComplete` not in dependency arrays where it's not used inside the effect
- [ ] Non-Windows platforms still trigger `onComplete` (via useEffect, not render)
- [ ] Windows driver installation flow unchanged
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes

## Branch & Worktree

- **Branch:** `fix/TASK-1938-apple-driver-render-callback`
- **Worktree:** `../Mad-TASK-1938`
- **Base:** `develop`
- **Target:** `develop`

## Sprint

- **Sprint:** SPRINT-076
- **Phase:** 1 (parallel with TASK-1939, TASK-1940)
- **Priority:** P0 Critical
- **Estimated Tokens:** ~15K
