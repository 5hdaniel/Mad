# Task TASK-900: Fix Sprint 009 Auth Regressions

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix the Sprint 009 auth regressions that break Google login and preload script functionality. Additionally, implement SR Engineer's suggested improvements for robustness.

**Backlog Reference:** BACKLOG-117 - Fix Sprint 009 Auth Regressions (Preload Sandbox + Google Login)

## Current State

**PR #242** exists on branch `hotfix/preload-sandbox-and-login-flow` with the basic fixes:
- Added `sandbox: false` to BrowserWindow webPreferences in `electron/main.ts`
- Added missing Google login completion flow in `electron/handlers/googleAuthHandlers.ts`

## Outstanding Work

SR Engineer reviewed PR #242 and identified these improvements needed:

### 1. Add Timeout Protection (Required)

The Google login flow should have timeout protection like the Microsoft handler:

```typescript
const timeoutMs = 120000;
const codeWithTimeout = Promise.race([
  codePromise,
  new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Authentication timed out")),
      timeoutMs
    )
  ),
]);
const code = await codeWithTimeout;
```

**Reference:** See `handleMicrosoftLogin` in `electron/handlers/microsoftAuthHandlers.ts` for the pattern.

### 2. Additional Enhancements (Optional - tracked in BACKLOG-116)

These are tracked in BACKLOG-116 for future work:
- Rate limiting check before login processing
- Database initialization check with pending flow support
- Update existing users (not just create)
- OAuth token persistence
- Last login update, device registration, event tracking, audit logging
- Bidirectional terms sync
- `setSyncUserId` call

## Deliverables

1. **Update:** `electron/handlers/googleAuthHandlers.ts` - Add timeout protection to `handleGoogleLogin`
2. **Verify:** All existing PR #242 changes remain intact
3. **Test:** Google login completes or times out properly

## Acceptance Criteria

- [x] `sandbox: false` added to BrowserWindow webPreferences (already in PR #242)
- [x] Google OAuth flow completes successfully (already in PR #242)
- [ ] Timeout protection added (120s like Microsoft)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (no new warnings)
- [ ] All CI checks pass
- [ ] PR approved by SR Engineer

## Implementation Notes

### Timeout Pattern (from microsoftAuthHandlers.ts)

```typescript
// Wrap the code promise with a timeout
const timeoutMs = 120000; // 2 minutes
const codeWithTimeout = Promise.race([
  codePromise,
  new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Authentication timed out")),
      timeoutMs
    )
  ),
]);

// Use the wrapped promise
const code = await codeWithTimeout;
```

### Location for Changes

In `electron/handlers/googleAuthHandlers.ts`, within the `handleGoogleLogin` function, wrap the existing `codePromise` with the timeout pattern.

## Integration Notes

- Part of: BACKLOG-117 (Critical priority)
- Related: BACKLOG-116 (Feature parity - future work)
- PR Branch: `hotfix/preload-sandbox-and-login-flow` (rename to `fix/TASK-900-sprint009-auth-regression` preferred)
- Target: `develop`

## PR Preparation

- **Title**: `fix(auth): add timeout protection to Google login (TASK-900)`
- **Labels**: `fix`, `service`, `auth`

---

## SR Engineer Pre-Review Notes

**Review Date:** 2025-12-28 | **Status:** APPROVED

### Technical Considerations
- Timeout pattern matches existing Microsoft implementation
- 120s timeout is consistent across both providers
- Error handling should match Microsoft's pattern for consistency

### Execution Classification
- **Parallel Safe:** Yes - isolated to googleAuthHandlers.ts
- **Depends On:** PR #242 base changes
- **Blocks:** None

---

## PM Estimate

**Category:** `service`

**Estimated Totals:**
- **Turns:** 3-5
- **Tokens:** ~20K-30K
- **Time:** ~30-45m
