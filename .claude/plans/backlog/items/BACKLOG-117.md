# BACKLOG-117: Fix Sprint 009 Auth Regressions (Preload Sandbox + Google Login)

## Priority: Critical

## Category: service

## Summary

Sprint 009's `auth-handlers.ts` split refactor introduced two critical regressions that break authentication:

1. **Preload Sandbox Issue**: Electron 35+ defaults `sandbox: true` in BrowserWindow webPreferences, which prevents the preload script from exposing `window.api` to the renderer. This breaks all IPC communication.

2. **Google Login Flow Incomplete**: During the refactor (commit 7930e9f), the `setTimeout` block that awaits `codePromise` and completes the OAuth flow was accidentally omitted from `googleAuthHandlers.ts`. The authorization code is obtained but never processed.

## Problem

### Preload Script Broken

```
Electron 35+ changed sandbox default from false to true.
Preload script cannot expose window.api when sandboxed.
All IPC calls fail silently.
```

### Google Login Stalls

The refactored `handleGoogleLogin` function:
1. Opens OAuth popup
2. Obtains authorization code via `codePromise`
3. **MISSING**: Code is never awaited or processed
4. Login never completes

**Root cause commit**: 7930e9f (Sprint 009 auth-handlers split)

## Solution

### 1. Fix Preload Sandbox

Add `sandbox: false` to BrowserWindow webPreferences in `electron/main.ts`:

```typescript
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false, // Required for preload script to expose window.api
}
```

### 2. Restore Google Login Completion

Add the missing `setTimeout` block to `handleGoogleLogin` that:
- Awaits `codePromise` for the OAuth authorization code
- Exchanges code for tokens
- Syncs user to Supabase
- Creates/finds local user
- Creates session
- Sends `google:login-complete` event to renderer

**Reference**: The original logic existed in `auth-handlers.ts` before the split.

## Implementation Status

**PR #242** on branch `hotfix/preload-sandbox-and-login-flow` contains the fix.

The code changes are complete. SR Engineer has reviewed and provided enhancement suggestions (see BACKLOG-116 for feature parity improvements).

## Acceptance Criteria

- [x] `sandbox: false` added to BrowserWindow webPreferences
- [x] Google OAuth flow completes successfully
- [x] User is created/found in local database after login
- [x] Session is created
- [x] Renderer receives `google:login-complete` event
- [x] Microsoft login still works (not affected)
- [x] Preload script exposes `window.api` correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] CI passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 4-6 | Code already exists in PR #242 |
| Tokens | ~20K | Mostly validation and SR suggestions |
| Time | 30-60 min | Implement SR feedback + test |

**Adjustment**: Service category x 1.0 (no historical data)

## Dependencies

- None (standalone critical fix)

## Related Items

| ID | Title | Relationship |
|----|-------|--------------|
| BACKLOG-116 | Google Login Feature Parity | Enhancement work after this fix |
| PR #242 | hotfix/preload-sandbox-and-login-flow | Contains the fix code |
| Sprint 009 | Codebase Standards Remediation | Introduced the regression |

## SR Engineer Review Notes (from PR #242)

SR Engineer reviewed PR #242 and provided these suggestions for robustness:

1. **Add timeout protection (120s)**: Use `Promise.race` like Microsoft handler
2. **Consider rate limiting**: Check rate limit before processing
3. **Note**: The fix is simplified compared to Microsoft's full flow

These enhancements are tracked in BACKLOG-116 (feature parity), not required for this critical fix.

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing login flows | Test both Google and Microsoft |
| Preload change affecting security | sandbox: false is required for our architecture |

## Notes

**Why this is separate from BACKLOG-116:**
- This backlog item tracks the **critical regression fix** (restore functionality)
- BACKLOG-116 tracks the **enhancement work** (add timeout, rate limiting, parity)

The fix in PR #242 restores basic functionality. Feature parity with Microsoft can be done as follow-up work without blocking the critical fix.

**Files changed in PR #242:**
- `electron/main.ts` - Added `sandbox: false`
- `electron/handlers/googleAuthHandlers.ts` - Added missing login completion flow
