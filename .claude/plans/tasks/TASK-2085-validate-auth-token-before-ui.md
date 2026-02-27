# Task TASK-2085: Validate Auth Token Before Showing Authenticated UI

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

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Backlog Item

**BACKLOG-816:** Validate auth token before showing authenticated UI

## Goal

Add server-side token validation during the `loading-auth` phase of the state machine, BEFORE dispatching `AUTH_LOADED` with a user. Currently, `handleGetCurrentUser` in `sessionHandlers.ts` restores a cached Supabase session via `setSession()` but does NOT validate whether that session is still valid on the server (e.g., user deleted from Supabase, token revoked). The user briefly sees the Dashboard before being kicked out. The fix is to call `auth.getUser()` (server-validated) after `setSession()` succeeds, and only return `success: true` if the server confirms the user exists.

## Non-Goals

- Do NOT change the login flow (OAuth, deep link, `LOGIN_SUCCESS` dispatch). This task only modifies the **session restoration path** for returning users.
- Do NOT change the `useSessionValidator` polling hook (TASK-2062). That hook detects remote invalidation AFTER the app is running. This task prevents the initial flash of authenticated UI.
- Do NOT modify the LoadingOrchestrator phase sequence or add new loading phases. The existing `loading-auth` phase has enough time to perform this check.
- Do NOT change keychain/safeStorage access or the DB initialization flow. Token validation happens AFTER DB init and session load.
- Do NOT change the license check flow. LicenseContext runs after the state machine reaches `ready`.
- Do NOT add a new visual loading state/splash screen -- the existing `LoadingScreen` component for `loading-auth` phase already shows "Loading authentication..." which is appropriate.

## Deliverables

1. **Modify:** `electron/handlers/sessionHandlers.ts` -- `handleGetCurrentUser()` function
2. **Modify:** `electron/handlers/sessionHandlers.ts` -- `handleValidateRemoteSession()` (extract shared validation logic)
3. **Add tests:** `electron/__tests__/session-handlers-auth-validation.test.ts`

## Acceptance Criteria

- [ ] When a returning user opens the app with a valid cached session AND the Supabase server confirms the user exists, the app proceeds to Dashboard as before (no regression)
- [ ] When a returning user opens the app with a stale/revoked session, the app shows the Login screen directly -- never briefly showing Dashboard
- [ ] When the server validation call fails due to network error, the app proceeds optimistically (same as current behavior) -- we do NOT block offline users from using cached sessions
- [ ] The `loading-auth` phase message ("Loading authentication...") is visible during the server check (~500ms)
- [ ] The login flow (OAuth callback, `LOGIN_SUCCESS` action) is unaffected -- confirmed by existing auth handler tests passing
- [ ] Keychain/safeStorage access is unaffected -- the DB initialization phases (Phase 1 and Phase 2) run before auth check
- [ ] License checks are unaffected -- LicenseProvider only runs after state machine reaches `ready`
- [ ] All existing tests pass
- [ ] New tests cover: valid session, revoked session, network error, expired tokens
- [ ] All CI checks pass

## Implementation Notes

### Current Flow (Problem)

```
Phase 3: loading-auth
  -> LoadingOrchestrator calls window.api.auth.getCurrentUser()
  -> IPC handler: handleGetCurrentUser()
    1. databaseService.isInitialized() check
    2. sessionService.loadSession() -- reads encrypted session.json
    3. databaseService.validateSession() -- checks local SQLite
    4. sessionSecurityService.checkSessionValidity() -- checks expiry/inactivity
    5. supabaseService.getClient().auth.setSession() -- restores SDK session
       (only checks if tokens PARSE correctly, does NOT contact server)
    6. Returns { success: true, user, ... }
  -> LoadingOrchestrator dispatches AUTH_LOADED with user
  -> State machine -> loading-user-data -> ready -> Dashboard shown

  LATER (5 seconds): useSessionValidator polls validateRemoteSession
    -> If invalid, shows alert + logs out (user saw Dashboard briefly)
```

### Target Flow (Fix)

```
Phase 3: loading-auth
  -> LoadingOrchestrator calls window.api.auth.getCurrentUser()
  -> IPC handler: handleGetCurrentUser()
    1-5. (same as before)
    6. NEW: After setSession succeeds, call auth.getUser() to validate server-side
       a. If auth.getUser() returns user -> token is valid, proceed normally
       b. If auth.getUser() returns error (user deleted/revoked) -> clear session, return { success: false }
       c. If auth.getUser() throws network error -> proceed optimistically (offline tolerance)
    7. Returns { success: true/false } based on validation
  -> LoadingOrchestrator dispatches AUTH_LOADED with user (valid) or null (invalid)
  -> User goes to Dashboard (valid) or Login (invalid) -- no flash
```

### Key Implementation Details

#### 1. Where to add the validation (sessionHandlers.ts, handleGetCurrentUser)

After the existing `setSession()` block (around line 732-775), add server-side validation:

```typescript
// After successful setSession()...

// TASK-2085: Server-side token validation for returning users
// Prevents showing authenticated UI when session was revoked remotely
try {
  const { data: userData, error: getUserError } = await supabaseService
    .getClient()
    .auth.getUser();

  if (getUserError || !userData.user) {
    // Session is invalid on the server (user deleted, token revoked)
    await logService.info(
      "Supabase session invalid on server, forcing re-login",
      "SessionHandlers",
      { error: getUserError?.message }
    );

    // Clean up the invalid session
    await databaseService.deleteSession(session.sessionToken);
    await sessionService.clearSession();
    sessionSecurityService.cleanupSession(session.sessionToken);

    return { success: false, error: "Session no longer valid" };
  }

  await logService.info(
    "Supabase session validated server-side",
    "SessionHandlers"
  );
} catch (validationError) {
  // Network error during validation -- proceed optimistically
  // The user may be offline, and we don't want to block them
  await logService.warn(
    "Server-side session validation failed (network?), proceeding optimistically",
    "SessionHandlers",
    { error: validationError instanceof Error ? validationError.message : "Unknown" }
  );
}
```

#### 2. Why this does NOT interfere with login

The `handleGetCurrentUser` function is ONLY called during **app restart** (Phase 3 of LoadingOrchestrator). During a fresh login:
- OAuth completes in `sharedAuthHandlers.ts` (Google) or `microsoftAuthHandlers.ts` (Microsoft)
- Those handlers call `supabaseService.signInWithIdToken()` which creates a fresh server-validated session
- The state machine receives `LOGIN_SUCCESS` and goes to `loading-user-data`, skipping `handleGetCurrentUser` entirely

The call chain:
```
App restart: LoadingOrchestrator Phase 3 -> getCurrentUser IPC -> handleGetCurrentUser
Fresh login: OAuth callback -> completeLogin -> LOGIN_SUCCESS dispatch (bypasses getCurrentUser)
```

#### 3. Why this does NOT interfere with keychain/safeStorage

The loading phase sequence is:
```
Phase 1: checking-storage   -> reads db-key-store.json (no Supabase call)
Phase 2: initializing-db    -> initializes encrypted SQLite (uses safeStorage/Keychain)
Phase 3: loading-auth       -> THIS IS WHERE WE ADD THE CHECK
Phase 4: loading-user-data  -> reads user preferences from DB
```

Keychain access (safeStorage) happens in Phase 2. Our change is in Phase 3. The keychain is never touched during token validation. The `auth.getUser()` call is a pure HTTPS request to Supabase -- no local encryption/decryption involved.

#### 4. Why this does NOT interfere with license checks

The LicenseProvider in `LicenseContext.tsx`:
- Only validates when it receives a `userId` prop
- `userId` comes from `useAuth().currentUser?.id`
- `currentUser` is only set when state machine reaches `onboarding` or `ready`
- If token validation fails, state machine goes to `unauthenticated` -- `currentUser` is never set -- LicenseProvider never fires

#### 5. Handling the existing setSession failure path

Currently (lines 748-757), if `setSession()` fails with "expired"/"invalid"/"refresh" errors, the handler already clears the session and returns `{ success: false }`. The NEW server validation adds a second check: even if `setSession()` succeeds (tokens parse OK), the server may have revoked them. This is the gap being closed.

#### 6. Timeout consideration

The `auth.getUser()` call typically completes in ~200-500ms. For offline users, the catch block handles network errors. No explicit timeout is needed because:
- The Supabase JS SDK already has built-in HTTP timeouts
- The catch block ensures we never block forever
- Offline users get the optimistic path (proceed with cached session)

### Relationship to Existing Validators

| Validator | When | Purpose |
|-----------|------|---------|
| `handleGetCurrentUser` (this change) | App startup, Phase 3 | Prevent initial flash of authenticated UI |
| `useSessionValidator` (TASK-2062) | Every 60s while running | Detect mid-session remote invalidation |
| `setSession()` error handling | App startup, Phase 3 | Detect locally expired/corrupt tokens |

These are complementary, not overlapping. The startup validator prevents the initial flash; the polling validator catches subsequent invalidations.

## Integration Notes

- **Imports from:** `supabaseService` (already imported in sessionHandlers.ts)
- **No new IPC channels needed** -- modification is within existing `handleGetCurrentUser`
- **No renderer changes needed** -- the LoadingOrchestrator already handles `{ success: false }` from `getCurrentUser` by dispatching `AUTH_LOADED` with `user: null`, which transitions to `unauthenticated`
- **No state machine changes needed** -- the existing `AUTH_LOADED` action with `user: null` already handles the "no valid session" case correctly

## Do / Don't

### Do:
- Add the `auth.getUser()` call AFTER `setSession()` succeeds, not before
- Catch network errors separately and proceed optimistically (offline users must not be blocked)
- Log clearly at each decision point for debugging
- Reuse the existing session cleanup pattern already in `handleGetCurrentUser`
- Keep the existing `setSession()` error handling intact -- the new check is additive

### Don't:
- Do NOT add the validation to `handleValidateRemoteSession` -- that's the polling path, this is the startup path
- Do NOT add a new loading phase to the state machine -- `loading-auth` is sufficient
- Do NOT add explicit timeouts around `auth.getUser()` -- the Supabase SDK handles HTTP timeouts
- Do NOT modify the `LoadingScreen` component -- "Loading authentication..." is already the correct message
- Do NOT call `auth.getUser()` on the fresh login path -- fresh logins already have server-validated tokens
- Do NOT remove or modify the `useSessionValidator` hook -- both startup and polling validation serve different purposes

## When to Stop and Ask

- If `auth.getUser()` has unexpected behavior (e.g., it triggers token refresh instead of just validating)
- If the existing `setSession()` block has been significantly modified from what's documented here
- If you discover that `handleGetCurrentUser` is called during fresh login (not just app restart)
- If adding the check causes the `loading-auth` phase to exceed 3 seconds in testing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write in `electron/__tests__/session-handlers-auth-validation.test.ts`:
  - **Valid session:** `setSession` succeeds, `getUser` returns user -> returns `{ success: true, user }`
  - **Revoked session:** `setSession` succeeds, `getUser` returns error (AuthApiError) -> clears session, returns `{ success: false }`
  - **Deleted user:** `setSession` succeeds, `getUser` returns `{ user: null }` -> clears session, returns `{ success: false }`
  - **Network error:** `setSession` succeeds, `getUser` throws network error -> returns `{ success: true, user }` (optimistic)
  - **setSession failure (existing behavior preserved):** `setSession` returns expired error -> returns `{ success: false }` (no `getUser` call)
- Existing tests to verify still pass:
  - `electron/__tests__/auth-handlers.test.ts`
  - `electron/__tests__/auth-handlers.integration.test.ts`
  - `electron/__tests__/session-handlers-2062.test.ts`

### Coverage

- Coverage impact: Should increase (adding tests for previously untested path)

### Integration / Feature Tests

- Manual testing scenarios:
  1. Normal app restart with valid session -> Dashboard loads normally
  2. Delete user from Supabase Admin, restart app -> Login screen shown directly (no flash)
  3. Disconnect network, restart app -> Dashboard loads from cache (offline tolerance)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(auth): validate session token server-side before showing authenticated UI`
- **Labels**: `fix`, `auth`, `security`
- **Depends on**: None

---

## Risk Analysis

### Risk 1: Latency on app startup
- **Impact:** Loading screen visible for ~500ms longer on app restart
- **Mitigation:** This is acceptable UX -- users currently see the loading screen anyway. The "Loading authentication..." message gives proper context.
- **Fallback:** Network errors skip the check entirely, so offline users are not affected.

### Risk 2: False negatives from auth.getUser()
- **Concern:** Could `auth.getUser()` fail for non-revocation reasons (e.g., temporary Supabase outage)?
- **Mitigation:** Network errors are caught and treated as "valid" (optimistic). Only definitive auth errors (user not found, invalid token) trigger logout.

### Risk 3: Token refresh race condition
- **Concern:** `auth.getUser()` might trigger a token refresh that conflicts with the session we just set.
- **Analysis:** The Supabase SDK's `getUser()` method calls the `/auth/v1/user` endpoint with the current access token. If the token is expired, the SDK auto-refreshes it (since `autoRefreshToken: true`). This is actually beneficial -- it means the session is updated with fresh tokens. The `onAuthStateChange` listener (TASK-2040) in `supabaseService.ts` will update the cached `authSession` automatically.
- **Mitigation:** This is a non-issue; the existing auth state listener handles refresh events.

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new test file | +10K |
| Files to modify | 1 file (sessionHandlers.ts) | +10K |
| Code volume | ~30 lines production, ~100 lines test | +15K |
| Test complexity | Medium (mocking Supabase SDK) | +10K |

**Confidence:** High

**Risk factors:**
- Supabase SDK mocking complexity in tests could add tokens
- Existing test infrastructure should handle this well (TASK-2062 tests are a pattern)

**Similar past tasks:** TASK-2062 (session validation polling, similar scope)

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
Files created:
- [ ] electron/__tests__/session-handlers-auth-validation.test.ts

Files modified:
- [ ] electron/handlers/sessionHandlers.ts

Features implemented:
- [ ] Server-side token validation in handleGetCurrentUser
- [ ] Optimistic fallback on network errors
- [ ] Session cleanup on revoked tokens

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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
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
