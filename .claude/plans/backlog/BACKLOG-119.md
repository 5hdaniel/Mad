# BACKLOG-119: Audit and Ensure Parity Between Google and Microsoft OAuth Handlers

## Priority: Low

## Category: refactor

## Summary

Conduct a comprehensive audit of Google and Microsoft OAuth handlers to ensure parity in safety checks, error handling patterns, and authentication flows. Establish shared utilities or a base handler pattern to prevent future divergence between providers.

## Background

This backlog item was created after discovering that the Google OAuth handler in `googleAuthHandlers.ts` was missing a critical database initialization check that the Microsoft handler in `microsoftAuthHandlers.ts` already had. This caused a "Database is not initialized" error on macOS when users tried to log in with Google.

The immediate fix was adding this check before database operations:

```typescript
if (!databaseService.isInitialized()) {
  // Send login-pending event instead of trying to use DB
  mainWindow.webContents.send("google:login-pending", {...});
  return;
}
```

While BACKLOG-116 addresses bringing `handleGoogleLogin` to feature parity with `handleMicrosoftLogin`, this item takes a broader approach: auditing ALL handler functions across both providers and establishing patterns to prevent future drift.

## Problem

The current auth handlers evolved independently, leading to inconsistencies:

1. **No shared patterns** - Each handler implements safety checks differently
2. **Easy to miss features** - When adding a feature to one provider, easy to forget the other
3. **Multiple handler functions per provider** - Each provider has 3-4 handler functions, multiplying the parity problem
4. **No enforcement mechanism** - Nothing prevents future divergence

## Scope

### Handlers to Audit

**Google (`googleAuthHandlers.ts`):**
- `handleGoogleLogin` (popup login flow)
- `handleGoogleCompleteLogin` (code exchange flow)
- `handleGoogleConnectMailbox` (post-DB mailbox connection)
- `handleGoogleConnectMailboxPending` (pre-DB mailbox connection)

**Microsoft (`microsoftAuthHandlers.ts`):**
- `handleMicrosoftLogin` (popup login flow)
- `handleMicrosoftConnectMailbox` (post-DB mailbox connection)
- `handleMicrosoftConnectMailboxPending` (pre-DB mailbox connection)

### Areas to Check

| Area | Description |
|------|-------------|
| **Database initialization** | Check `databaseService.isInitialized()` before DB operations |
| **Rate limiting** | Check rate limits before processing, record attempts after |
| **Timeout protection** | Wrap async operations with timeout (120s standard) |
| **Session handling** | Consistent session creation and validation |
| **Token management** | OAuth token persistence, refresh token handling |
| **User create/update** | Update existing users, not just create new |
| **Error handling** | Consistent error types, messages, and audit logging |
| **Audit logging** | Log all auth events (success and failure) |
| **Device registration** | Register device on login |
| **Event tracking** | Track login events in Supabase |
| **Bidirectional sync** | Terms/privacy acceptance synced both ways |
| **Sync handler init** | Call `setSyncUserId()` after successful login |
| **Mailbox flows** | Connection, cancellation, and error handling |

## Solution

### Phase 1: Comprehensive Audit (Document)

Create a parity matrix documenting which features exist in which handlers:

| Feature | Google Login | Google Complete | Google Mailbox | Google Mailbox Pending | MS Login | MS Mailbox | MS Mailbox Pending |
|---------|--------------|-----------------|----------------|------------------------|----------|------------|-------------------|
| DB init check | ? | ? | ? | ? | ? | ? | ? |
| Rate limiting | ? | ? | ? | ? | ? | ? | ? |
| Timeout | ? | ? | ? | ? | ? | ? | ? |
| ... | | | | | | | |

### Phase 2: Extract Shared Utilities

Create shared utilities to reduce duplication and enforce consistency:

```typescript
// electron/handlers/auth-utils.ts

export function withTimeout<T>(promise: Promise<T>, ms: number = 120000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Authentication timed out")), ms)
    ),
  ]);
}

export async function checkDatabaseReady(
  mainWindow: BrowserWindow | null,
  eventName: string,
  pendingData: object
): boolean {
  if (!databaseService.isInitialized()) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(eventName, {
        success: true,
        pendingLogin: true,
        ...pendingData,
      });
    }
    return false;
  }
  return true;
}

export async function handleLoginSuccess(
  localUser: User,
  cloudUser: CloudUser,
  provider: "google" | "microsoft",
  sessionToken: string
): Promise<void> {
  // Rate limit recording
  await rateLimitService.recordAttempt(localUser.email, true);

  // Device registration
  const deviceInfo = { ... };
  await supabaseService.registerDevice(cloudUser.id, deviceInfo);

  // Event tracking
  await supabaseService.trackEvent(cloudUser.id, "user_login", { provider }, ...);

  // Audit logging
  await auditService.log({
    userId: localUser.id,
    sessionId: sessionToken,
    action: "LOGIN",
    resourceType: "SESSION",
    resourceId: sessionToken,
    metadata: { provider },
    success: true,
  });

  // Sync handler init
  setSyncUserId(localUser.id);
}
```

### Phase 3: Refactor Handlers to Use Shared Utilities

Refactor both Google and Microsoft handlers to use the shared utilities, ensuring consistency.

### Phase 4: Add Tests for Parity

Create tests that verify both providers implement the same safety checks:

```typescript
describe("OAuth Handler Parity", () => {
  it("both providers check database initialization", async () => { ... });
  it("both providers implement timeout protection", async () => { ... });
  it("both providers record rate limit attempts", async () => { ... });
  // etc.
});
```

## Implementation Steps

1. Create parity audit matrix (document current state)
2. Identify gaps in each handler (comparing to the "complete" set)
3. Design shared utility interfaces
4. Extract common patterns to `auth-utils.ts`
5. Refactor Google handlers to use shared utilities
6. Refactor Microsoft handlers to use shared utilities
7. Add parity tests
8. Update documentation

## Acceptance Criteria

- [ ] Parity audit matrix created and committed
- [ ] All gaps identified and documented
- [ ] Shared utility module created (`electron/handlers/auth-utils.ts`)
- [ ] Google handlers refactored to use shared utilities
- [ ] Microsoft handlers refactored to use shared utilities
- [ ] All handlers pass same safety checks (DB init, rate limit, timeout, etc.)
- [ ] Parity tests added and passing
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Manual testing of both login flows (Google and Microsoft)
- [ ] Manual testing of both mailbox connection flows

## Estimated Effort

| Metric | Raw Estimate | Adjusted (refactor x0.5) | Notes |
|--------|--------------|--------------------------|-------|
| Turns | 25-35 | 13-18 | Primarily refactoring existing patterns |
| Tokens | ~100K | ~50K | |
| Time | 4-6 hours | 2-3 hours | |

## Dependencies

- BACKLOG-116 (Google Login Parity) - Should be completed first or merged with this work
  - **Recommendation:** Complete BACKLOG-116 first, then this item builds on that work

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking auth flows | Extensive manual testing of all flows |
| OAuth provider differences | Document legitimate differences (not bugs) |
| Refactoring complexity | Incremental changes, one handler at a time |
| Missing edge cases | Review existing bug reports for auth-related issues |

## Relationship to Other Backlog Items

| Item | Relationship |
|------|--------------|
| BACKLOG-116 | Prerequisite - addresses immediate parity gaps in `handleGoogleLogin` |
| BACKLOG-100 | Related - Create auth/ Module (potential location for shared utilities) |

## Notes

**Technical Debt Classification:** This is proactive technical debt prevention. While the immediate bug was fixed, the underlying pattern problem remains: two independent implementations that can drift apart.

**Why Low Priority:** The immediate bug is fixed, and BACKLOG-116 addresses the most critical gaps. This item is about establishing patterns to prevent future issues, which is valuable but not urgent.

**Consider combining with BACKLOG-100** (Create auth/ Module) if that work is scheduled, as both involve restructuring auth-related code.

**Related files:**
- `electron/handlers/googleAuthHandlers.ts`
- `electron/handlers/microsoftAuthHandlers.ts`
- `electron/handlers/auth-utils.ts` (to be created)
- `electron/services/rateLimitService.ts`
- `electron/services/auditService.ts`
- `electron/services/databaseService.ts`
- `electron/sync-handlers.ts`

**Incident that prompted this item:**
- Issue: "Database is not initialized" error on macOS during Google login
- Root cause: Missing `databaseService.isInitialized()` check in `handleGoogleLogin`
- Fix: Added check to send `google:login-pending` event when DB not ready
