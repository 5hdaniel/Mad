# BACKLOG-116: Bring Google Login Handler to Feature Parity with Microsoft

## Priority: Medium

## Category: service

## Summary

The `handleGoogleLogin` function in `googleAuthHandlers.ts` is missing several features that exist in `handleMicrosoftLogin`. This was identified during SR Engineer review of PR #242 after a hotfix restored basic Google login functionality that was accidentally simplified during the Sprint 009 refactor (commit 7930e9f).

## Problem

During SPRINT-009's `auth-handlers.ts` split refactor, the Google login flow was accidentally simplified. While PR #242 restored basic functionality, the Google login handler is missing the following features that exist in the Microsoft handler:

### Missing Features in `handleGoogleLogin` vs `handleMicrosoftLogin`

| Feature | Microsoft | Google | Impact |
|---------|-----------|--------|--------|
| Timeout protection (120s) | Yes | No | Potential infinite hang |
| Rate limiting check | Yes | No | Brute force vulnerability |
| Database initialization check | Yes | No | Error on cold start |
| Update existing user | Yes | No (only creates) | Profile updates lost |
| OAuth token persistence | Yes | No | Session-only auth |
| Last login update | Yes | No | Analytics gap |
| Device registration | Yes | No | Multi-device tracking broken |
| Event tracking | Yes | No | User login analytics lost |
| Audit logging | Yes | No | Security audit gap |
| Rate limit recording | Yes | No | Lockout doesn't work |
| Bidirectional terms sync | Yes | No | Terms state inconsistent |
| `setSyncUserId` call | Yes | No | Sync handler not initialized |

**Note:** The `handleGoogleCompleteLogin` function (used for a different flow) does have many of these features. The primary issue is in `handleGoogleLogin` which is the popup-based flow.

## Solution

Refactor `handleGoogleLogin` to match the structure of `handleMicrosoftLogin`:

### 1. Add timeout protection

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

### 2. Add rate limiting check

```typescript
const email = "pending@google.com"; // or actual email if available
const rateLimitCheck = await rateLimitService.checkRateLimit(email);
if (!rateLimitCheck.allowed) {
  // Send rate limit error to renderer
  return;
}
```

### 3. Add database initialization check

```typescript
if (!databaseService.isInitialized()) {
  mainWindow.webContents.send("google:login-pending", {
    success: true,
    pendingLogin: true,
    userInfo,
    tokens,
    cloudUser,
    subscription,
  });
  return;
}
```

### 4. Add update existing user logic

Currently only creates new users. Need to add the update branch with cloud sync.

### 5. Add missing service calls

- `databaseService.saveOAuthToken()` - persist tokens
- `databaseService.updateLastLogin()` - update last login timestamp
- `supabaseService.registerDevice()` - register device
- `supabaseService.trackEvent()` - track login event
- `auditService.log()` - audit log
- `rateLimitService.recordAttempt()` - record success for rate limiting
- Bidirectional terms sync logic
- `setSyncUserId()` - initialize sync handler

## Implementation Steps

1. Compare `handleMicrosoftLogin` and `handleGoogleLogin` line-by-line
2. Extract common auth processing logic into shared utilities (optional but recommended)
3. Add timeout protection wrapper around `codePromise`
4. Add rate limiting check before processing
5. Add database initialization check with pending flow
6. Add update existing user path (not just create)
7. Add OAuth token persistence
8. Add last login update
9. Add device registration
10. Add event tracking
11. Add audit logging
12. Add rate limit recording on success
13. Add bidirectional terms sync
14. Add `setSyncUserId` call
15. Test both new user and returning user flows
16. Test rate limiting behavior
17. Test timeout behavior

## Acceptance Criteria

- [ ] `handleGoogleLogin` includes 120s timeout protection
- [ ] Rate limiting is checked before login processing
- [ ] Database initialization is checked with pending flow support
- [ ] Existing users are updated (not just created)
- [ ] OAuth tokens are persisted to database
- [ ] Last login timestamp is updated
- [ ] Device registration occurs on login
- [ ] Login events are tracked in Supabase
- [ ] Login is audit logged
- [ ] Rate limit success is recorded
- [ ] Bidirectional terms sync works
- [ ] `setSyncUserId` is called after successful login
- [ ] All existing tests pass
- [ ] New tests added for timeout and rate limiting
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Raw Estimate | Notes |
|--------|--------------|-------|
| Turns | 15-20 | Moderate complexity, mostly copying patterns |
| Tokens | ~60K | |
| Time | 2-3 hours | |

## Dependencies

- None (standalone fix)

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking Google login | Test thoroughly before merge |
| Different OAuth flow semantics | Review Google vs Microsoft OAuth differences |
| Missing edge cases | Compare handleGoogleCompleteLogin for reference |

## Notes

**This item was sourced from SR Engineer review of PR #242.**

The good news is that `handleGoogleCompleteLogin` already implements many of these features, so the patterns exist in the same file. The work is largely about ensuring `handleGoogleLogin` (the popup flow) has parity with the Microsoft equivalent.

Consider whether to extract common auth processing logic into shared utilities to prevent future drift between providers.

**Related files:**
- `electron/handlers/googleAuthHandlers.ts` - Google auth handlers (main changes)
- `electron/handlers/microsoftAuthHandlers.ts` - Reference implementation
- `electron/sync-handlers.ts` - For `setSyncUserId` import

**Reference commits:**
- 7930e9f - Sprint 009 refactor that introduced the regression
- PR #242 - Hotfix that restored basic functionality
