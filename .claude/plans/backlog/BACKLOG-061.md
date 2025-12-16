# BACKLOG-061: Fix EmailOnboardingScreen Pre-DB Flow Bugs

**Priority:** P1 (blocks test completion)
**Type:** Bug Fix
**Component:** `src/components/EmailOnboardingScreen.tsx`
**Discovered:** 2024-12-15 during TASK-204

---

## Problem

The pre-DB flow in EmailOnboardingScreen has two bugs that prevent proper functionality and block 2 skipped tests.

---

## Bug 1: existingPendingTokens Not Restoring UI State

**Location:** Lines 168-179

**Issue:** When `existingPendingTokens` prop is provided, the component initializes `pendingTokens` state but does NOT initialize `connections` state. The UI reads from `connections` to display "Connected: email@example.com", so the connected state is never shown when restoring tokens.

**Current Code:**
```typescript
const [pendingTokens, setPendingTokens] = useState<PendingEmailTokens | null>(
  existingPendingTokens || null,
);
// connections state is never initialized from existingPendingTokens
```

**Expected Behavior:** When `existingPendingTokens` is provided, the UI should immediately show the connected state.

**Fix:** Initialize `connections` state based on `existingPendingTokens`:
```typescript
const [connections, setConnections] = useState<Connections>(() => {
  if (existingPendingTokens) {
    return {
      google: existingPendingTokens.provider === 'google'
        ? { connected: true, email: existingPendingTokens.email }
        : null,
      microsoft: existingPendingTokens.provider === 'microsoft'
        ? { connected: true, email: existingPendingTokens.email }
        : null,
    };
  }
  return { google: null, microsoft: null };
});
```

---

## Bug 2: checkConnections Called in Pre-DB Mode

**Location:** Lines 237-241

**Issue:** `checkConnections()` is called unconditionally on mount, regardless of `isPreDbFlow`. In pre-DB mode, the database isn't ready, so this API call will fail or return incorrect data.

**Current Code:**
```typescript
useEffect(() => {
  if (userId) {
    checkConnections();
  }
}, [userId, checkConnections]);
```

**Expected Behavior:** In pre-DB mode, skip the connection check since DB isn't initialized.

**Fix:** Add `isPreDbFlow` check:
```typescript
useEffect(() => {
  if (userId && !isPreDbFlow) {
    checkConnections();
  }
}, [userId, isPreDbFlow, checkConnections]);
```

---

## Blocked Tests

These tests in `src/components/__tests__/EmailOnboardingScreen.test.tsx` are skipped due to these bugs:

1. `should restore pending tokens when navigating back` (line 355)
2. `should not check connections in pre-DB mode` (line 416)

---

## Acceptance Criteria

- [ ] `existingPendingTokens` prop properly initializes connected UI state
- [ ] `checkConnections()` is not called when `isPreDbFlow=true`
- [ ] Both blocked tests pass after component fixes
- [ ] Existing tests still pass
- [ ] No regressions in post-DB flow

---

## Estimated Effort

- **Complexity:** Simple
- **Turns:** 3-5
- **Risk:** Low (isolated to pre-DB flow)

---

## Related

- **TASK-204:** Discovered these bugs
- **Sprint:** TECHDEBT-2024-01 (Phase 1)
- **PR:** https://github.com/5hdaniel/Mad/pull/129 (documents the issues)
