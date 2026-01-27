# Task TASK-1507C: Fix Deep Link Auth Not Setting currentUser

**Sprint**: SPRINT-062
**Backlog Item**: N/A (bug fix discovered during email onboarding testing)
**Status**: Pending
**Execution**: Sequential (Phase 3, after TASK-1507B)
**Priority**: P0 (blocks email onboarding after deep link auth)

---

## Problem Statement

After successful deep link authentication (browser OAuth via Supabase), the Google email OAuth fails with "undefined" error. The user successfully authenticates via browser, app transitions to onboarding, but when clicking "Connect Google" for email, the connection fails.

**Error Behavior:** User completes browser OAuth, sees onboarding, clicks "Connect Google", gets error: "Failed to start Google OAuth: undefined"

**Root Cause:** `handleDeepLinkAuthSuccess` in `useAuthFlow.ts` dispatches `LOGIN_SUCCESS` to the state machine but does NOT call the `login()` function from AuthContext. This means `currentUser` is never set in AuthContext, causing downstream failures.

---

## Root Cause Analysis

### The Flow That Breaks

1. User clicks "Sign In with Browser" -> Browser opens for Supabase OAuth
2. User authenticates in browser -> Browser redirects to `magicaudit://callback`
3. Deep link handler receives tokens -> Sends `auth:deep-link-callback` event
4. `handleDeepLinkAuthSuccess` in `useAuthFlow.ts` is called
5. **BUG:** Handler dispatches `LOGIN_SUCCESS` to state machine but does NOT call `login()`
6. App transitions to onboarding (phone-type-selection)
7. User selects phone type, proceeds to email connection step
8. User clicks "Connect Google"
9. **FAILURE:** `useEmailHandlers.ts` checks `currentUserId` (from AuthContext) - it's undefined
10. Neither `usePendingApi` nor `currentUserId` branches execute
11. `result` stays undefined -> "Failed to start Google OAuth: undefined"

### Code Comparison

**`handleLoginSuccess` (works correctly):**
```typescript
// Line 108-151 in useAuthFlow.ts
const handleLoginSuccess = useCallback((user, token, provider, subscriptionData, isNewUser) => {
  setIsNewUserFlow(isNewUser);
  setPendingOAuthData(null);
  login(user, token, provider, subscriptionData, isNewUser);  // <-- CALLS login()

  if (stateMachineDispatch && platform) {
    stateMachineDispatch({ type: "LOGIN_SUCCESS", ... });
  }
}, [login, stateMachineDispatch, platform]);
```

**`handleDeepLinkAuthSuccess` (MISSING login() call):**
```typescript
// Line 165-209 in useAuthFlow.ts
const handleDeepLinkAuthSuccess = useCallback((data: DeepLinkAuthData) => {
  setPendingOAuthData(null);
  const isNewUser = !data.licenseStatus || data.licenseStatus.transactionCount === 0;
  setIsNewUserFlow(isNewUser);

  // Dispatches to state machine - good
  if (stateMachineDispatch && platform && data.user) {
    stateMachineDispatch({ type: "LOGIN_SUCCESS", ... });
  }

  // MISSING: No call to login() - currentUser never set in AuthContext!

  if (isNewUser) {
    onSetCurrentStep("phone-type-selection");
  } else {
    onSetCurrentStep("dashboard");
  }
}, [stateMachineDispatch, platform, onSetCurrentStep]);
```

### Why `useEmailHandlers` Fails

**File:** `src/appCore/state/flows/useEmailHandlers.ts` (lines 175-196)

```typescript
const handleStartGoogleEmailConnect = useCallback(async () => {
  const usePendingApi = pendingOAuthData && !isAuthenticated;  // false (no pending data)

  let result;
  if (usePendingApi) {
    result = await window.api.auth.googleConnectMailboxPending(emailHint);
  } else if (currentUserId) {  // <-- currentUserId is undefined!
    result = await window.api.auth.googleConnectMailbox(currentUserId);
  }
  // result is never assigned -> undefined error
}, [...]);
```

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1507B merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `fix/task-1507c-deeplink-currentuser`

---

## Estimated Tokens

**Est. Tokens**: ~15K (targeted fix)
**Token Cap**: ~60K (4x estimate)

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/appCore/state/flows/useAuthFlow.ts` | Modify | Add `login()` call in `handleDeepLinkAuthSuccess` |

---

## Implementation Steps

### Step 1: Add login() Call to handleDeepLinkAuthSuccess

**File:** `src/appCore/state/flows/useAuthFlow.ts`

Modify the `handleDeepLinkAuthSuccess` function to call `login()` before dispatching to state machine. The `login()` function:
- Sets `currentUser` in AuthContext
- Sets `sessionToken` in AuthContext
- Sets `authProvider` in AuthContext
- Sets `isAuthenticated` to true
- Sets `subscription` in AuthContext

**Current code (lines 165-209):**
```typescript
const handleDeepLinkAuthSuccess = useCallback(
  (data: DeepLinkAuthData): void => {
    console.log("[useAuthFlow] Deep link auth success", { userId: data.userId || data.user?.id });

    // Clear any pending OAuth data
    setPendingOAuthData(null);

    // Determine if this is a new user based on license status
    const isNewUser = !data.licenseStatus || data.licenseStatus.transactionCount === 0;
    setIsNewUserFlow(isNewUser);

    // Dispatch LOGIN_SUCCESS to state machine if dispatch is available
    if (stateMachineDispatch && platform && data.user) {
      // ... state machine dispatch
    }

    // Navigate to the appropriate step
    if (isNewUser) {
      onSetCurrentStep("phone-type-selection");
    } else {
      onSetCurrentStep("dashboard");
    }
  },
  [stateMachineDispatch, platform, onSetCurrentStep],
);
```

**Required change:**

Add `login()` call BEFORE the state machine dispatch:
```typescript
const handleDeepLinkAuthSuccess = useCallback(
  (data: DeepLinkAuthData): void => {
    console.log("[useAuthFlow] Deep link auth success", { userId: data.userId || data.user?.id });

    // Clear any pending OAuth data
    setPendingOAuthData(null);

    // Determine if this is a new user based on license status
    const isNewUser = !data.licenseStatus || data.licenseStatus.transactionCount === 0;
    setIsNewUserFlow(isNewUser);

    // TASK-1507C: Call login() to set currentUser in AuthContext
    // This is required for downstream handlers (email connection) to work
    if (data.user) {
      const user = {
        id: data.user.id,
        email: data.user.email || "",
        display_name: data.user.name,
      };
      // sessionToken comes from the deep link data (access_token)
      // provider is determined from the auth source (default to "google" for Supabase OAuth)
      login(
        user,
        data.accessToken || "",
        data.provider || "google",
        data.subscription,
        isNewUser
      );
    }

    // Dispatch LOGIN_SUCCESS to state machine if dispatch is available
    if (stateMachineDispatch && platform && data.user) {
      // ... existing state machine dispatch code
    }

    // Navigate to the appropriate step
    if (isNewUser) {
      onSetCurrentStep("phone-type-selection");
    } else {
      onSetCurrentStep("dashboard");
    }
  },
  [login, stateMachineDispatch, platform, onSetCurrentStep],  // Add login to deps
);
```

### Step 2: Verify DeepLinkAuthData Has Required Fields

Check that `DeepLinkAuthData` interface includes the fields we need:
- `accessToken` - for sessionToken
- `provider` - auth provider (google/microsoft)
- `subscription` - subscription data (may be undefined)

**File to check:** `src/components/Login.tsx` (where `DeepLinkAuthData` is defined)

If any fields are missing, they may need to be added or we use sensible defaults:
- `accessToken`: Deep link callback should include this (from Supabase OAuth)
- `provider`: Can default to "google" if not present
- `subscription`: Can be undefined (will be fetched later)

### Step 3: Update Dependency Array

Ensure `login` is included in the `useCallback` dependency array for `handleDeepLinkAuthSuccess`.

---

## Acceptance Criteria

- [ ] `handleDeepLinkAuthSuccess` calls `login()` to set currentUser in AuthContext
- [ ] After deep link auth, `currentUser` is available in AuthContext
- [ ] Email connection (Google/Microsoft) works after deep link authentication
- [ ] Both new user and returning user flows work correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Testing Requirements

### Manual Testing

1. **Deep Link Auth -> Email Connection Flow:**
   - Sign out (if signed in)
   - Click "Sign In with Browser"
   - Complete Google OAuth in browser
   - App transitions to onboarding
   - Select phone type
   - Click "Connect Google" for email
   - **Expected:** OAuth window opens (not "undefined" error)
   - Complete Google email OAuth
   - **Expected:** Email connected successfully

2. **Verify currentUser is Set:**
   - After deep link auth completes
   - Open DevTools console
   - Check that user data is logged/available
   - Proceed through onboarding

3. **Returning User Flow:**
   - Ensure existing users still transition to dashboard correctly
   - Email handlers should still work for returning users

### Unit Tests

- Existing tests should continue to pass
- No new unit tests required (integration testing covers this)

---

## Dependencies

- **Depends on**: TASK-1507B (wire deep link auth handler) - must be merged
- **Blocks**: TASK-1508 (manual test of full flow)

---

## Integration Notes

- **Uses:** `login()` function from `UseAuthFlowOptions` (passed in from AuthContext)
- **Sets:** `currentUser`, `sessionToken`, `authProvider` in AuthContext
- **Enables:** `useEmailHandlers` to function correctly with `currentUserId`

---

## Do / Don't

### Do:
- Call `login()` BEFORE dispatching to state machine (order matters)
- Use existing `login()` function signature
- Handle case where `data.user` might be undefined (guard check)
- Add `login` to dependency array

### Don't:
- Don't modify `Login.tsx` - it already passes the data correctly
- Don't change the state machine dispatch logic
- Don't modify `useEmailHandlers.ts` - the fix is in the caller
- Don't add new state - use existing AuthContext state

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- `DeepLinkAuthData` interface is missing `accessToken` or other required fields
- The `login()` function signature has changed from what's expected
- Unable to determine the correct `provider` value for deep link auth
- Unclear about the order of operations (login vs state machine dispatch)

---

## PR Preparation

**Title**: `fix: call login() in deep link auth to set currentUser`

**Labels**: `sprint-062`, `bug`, `auth`, `P0`

**PR Body Template**:
```markdown
## Summary
- Fix currentUser not being set after deep link authentication
- Add login() call in handleDeepLinkAuthSuccess
- Enables email connection to work after browser OAuth

## Root Cause
`handleDeepLinkAuthSuccess` dispatched LOGIN_SUCCESS to state machine but did not call
`login()` from AuthContext. This left `currentUser` undefined, causing downstream
handlers (email connection) to fail with "undefined" error.

## Test Plan
- [ ] Deep link auth -> email connection works (no undefined error)
- [ ] New user flow: browser auth -> onboarding -> email connect works
- [ ] Returning user flow: browser auth -> dashboard works
- [ ] TypeScript/lint/tests pass
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | PM Agent | N/A | ~3K | Complete |
| 2. Implement | Engineer Agent | ___________ | ___K | Pending |
| 3. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 4. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

*Completed by Engineer Agent*

### Files Changed
- [x] `src/appCore/state/flows/useAuthFlow.ts`

### Approach Taken

Implemented the fix exactly per SR Engineer's corrected implementation:

1. Added `login()` call BEFORE `stateMachineDispatch` in `handleDeepLinkAuthSuccess`
2. Verified `DeepLinkAuthData` interface - confirmed no `provider` or `subscription` fields
3. Used hardcoded `"google"` for provider (Supabase browser auth is Google-based)
4. Passed `undefined` for subscription (will be fetched separately)
5. Used `data.accessToken` directly (not with empty string fallback)
6. Added `login` to the useCallback dependency array

### Testing Done
- [x] TypeScript type-check passes
- [x] ESLint passes (pre-existing NotificationContext error unrelated)
- [x] Unit tests - databaseService.test.ts failures are pre-existing (unrelated)
- [ ] Manual test: deep link auth -> email connection (requires app build)
- [ ] Manual test: new user onboarding flow (requires app build)
- [ ] Manual test: returning user dashboard flow (requires app build)

### Notes for SR Review

1. **All SR Engineer corrections applied exactly as specified**
2. **Pre-existing issues (not introduced by this fix):**
   - ESLint error in NotificationContext.tsx (rule definition missing)
   - Test failures in databaseService.test.ts (mock setup issue)
3. **PR**: https://github.com/5hdaniel/Mad/pull/638
