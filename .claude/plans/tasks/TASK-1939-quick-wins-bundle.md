# Task TASK-1939: Quick Wins Bundle (useMemo, Dup Notification, DOM, OAuth Logs)

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

Bundle of 4 quick-win fixes identified during SR Engineer code review. Each is small and independent but grouped to reduce PR overhead.

## Non-Goals

- Do NOT refactor entire files beyond the specific changes listed
- Do NOT add new features
- Do NOT modify any other files beyond those listed

## Deliverables

### 1. Memoize `contextState` in useAppStateMachine.ts

**File:** `src/appCore/state/useAppStateMachine.ts` (lines 274-338)

The `contextState` object is recreated every render, causing unnecessary re-renders of all consumers. Wrap with `useMemo` using individual state values as dependencies instead of the entire object.

```tsx
// Current (recreated every render):
const contextState = { ... };

// Fix:
const contextState = useMemo(() => ({
  // ... all fields
}), [field1, field2, field3, /* individual deps */]);
```

### 2. Remove duplicate BackgroundServices/UpdateNotification

**Files:**
- `src/App.tsx` — Remove `<BackgroundServices />` import and JSX usage
- `src/appCore/BackgroundServices.tsx` — Delete this file entirely

**Reason:** BackgroundServices.tsx only renders `<UpdateNotification />`, which is already rendered elsewhere (in AppShell). This creates duplicate notification UI.

### 3. Replace `document.getElementById` with React ref

**File:** `src/appCore/AppRouter.tsx` (line 183)

Replace direct DOM access with a React ref or callback ref pattern. The `document.getElementById` call for scrolling should use `useRef` instead.

### 4. Redact OAuth tokens from deep link logs

**File:** `electron/main.ts` (lines ~520, ~534, ~267, ~732)

Deep link URLs containing OAuth tokens/codes are logged to console. Redact the token values before logging to prevent credential leakage in log files.

```typescript
// Current (INSECURE):
console.log('[DeepLink] URL:', url);

// Fix:
const redactedUrl = url.replace(/(?:code|token|access_token|refresh_token)=[^&]+/gi, '$1=[REDACTED]');
console.log('[DeepLink] URL:', redactedUrl);
```

## Acceptance Criteria

- [ ] `contextState` is wrapped in `useMemo` with correct individual dependencies
- [ ] `BackgroundServices.tsx` deleted, no import in App.tsx
- [ ] `UpdateNotification` renders only once in the app
- [ ] No `document.getElementById` calls in AppRouter.tsx
- [ ] Deep link logs do not contain OAuth tokens/codes
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes

## Branch & Worktree

- **Branch:** `fix/TASK-1939-quick-wins-bundle`
- **Worktree:** `../Mad-TASK-1939`
- **Base:** `develop`
- **Target:** `develop`

## Sprint

- **Sprint:** SPRINT-076
- **Phase:** 1 (parallel with TASK-1938, TASK-1940)
- **Priority:** P1 High
- **Estimated Tokens:** ~30K
