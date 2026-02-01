# SPRINT-062 Investigation: User ID & Session Architecture Analysis

**Date:** 2026-01-27
**Status:** Complete
**Investigator:** Senior Engineer (Claude Opus 4.5)

---

## Executive Summary

After comprehensive code analysis, the issues reported are **symptoms of one root architectural problem**: the app has **two separate session/auth systems** that are not properly synchronized:

1. **File-based SessionService** (`session.json`) - Persists user across app restarts
2. **Database SessionDbService** - Manages session tokens in SQLite `sessions` table

On app startup, `clearAllSessions()` deletes all SQLite sessions (line 234 of `system-handlers.ts`) but **does not clear the file-based session**. This creates a state where:
- File session says "user is logged in"
- Database session says "no valid session"
- `handleGetCurrentUser()` loads from file, validates against (cleared) database, fails

This architecture mismatch, combined with historical user ID inconsistencies, cascades into all the reported issues.

---

## Root Cause Analysis

### Issue 1: Returning User Sees Onboarding

**Root Cause:** `isNewUser` flag is conflated with `needsToAcceptTerms()`

**Evidence (sessionHandlers.ts:658):**
```typescript
isNewUser: needsToAcceptTerms(user),
```

This means ANY user who hasn't accepted the current terms version is marked as "new," even if they:
- Have completed phone type selection
- Have connected email
- Have existing transactions

**The State Machine Flow:**
1. `LoadingOrchestrator` calls `window.api.auth.getCurrentUser()`
2. `handleGetCurrentUser()` returns `isNewUser: needsToAcceptTerms(user)`
3. `LoadingOrchestrator` dispatches `AUTH_LOADED` with `isNewUser: true`
4. State machine goes to `onboarding` state instead of `ready`

**Key Finding:** `isNewUser` should ONLY be true for users who have NEVER completed onboarding (no `terms_accepted_at`, no `mobile_phone_type`, no `email_onboarding_completed_at`). Currently it's true for ANYONE who hasn't accepted the CURRENT terms version.

### Issue 2: User ID Mismatch

**Root Cause:** Historical local users were created with `crypto.randomUUID()` instead of Supabase `auth.uid()`

**Timeline:**
1. **Before TASK-1507G:** `createUser()` always generated a random UUID
2. **TASK-1507G Fix:** `createUser()` now accepts optional `id` parameter for Supabase UUID
3. **Problem:** Existing users in `users_local` still have mismatched IDs

**Current State:**
- Supabase `auth.uid()` = `67614fc0-1be2-474d-8c99-58305472736a` (canonical)
- Local SQLite `users_local.id` = `388d5ad0-f7eb-4d0f-8f8e-c4b5d20fcbfa` (legacy random)

**Migration Logic Exists But Has Gaps:**
- `sessionHandlers.ts:430-516` has `migrateUserToSupabaseId()`
- It runs during `handleGetCurrentUser()` when ID mismatch detected
- BUT: Migration only runs IF a session exists AND user can be loaded

### Issue 3: Session Not Persisting ("No existing session found")

**Root Cause:** Session lifecycle is broken by `clearAllSessions()`

**The Problem Flow:**
```
1. User logs in
   - microsoftAuthHandlers saves session to file (sessionService.saveSession)
   - microsoftAuthHandlers creates session in DB (databaseService.createSession)

2. User closes and reopens app
   - system-handlers.ts:234 calls databaseService.clearAllSessions() <-- DELETES DB SESSION
   - File session.json still exists with user data

3. handleGetCurrentUser() called
   - Loads session from file (success)
   - Validates session token against DB (FAILS - was cleared!)
   - Returns error "No active session"
```

**Code Evidence (system-handlers.ts:232-237):**
```typescript
// Session-only login: Clear login sessions but keep mailbox tokens
// Users must re-login each app launch (security), but mailbox access persists (UX)
await databaseService.clearAllSessions();
```

**The Comment vs Reality:**
- Comment says "Users must re-login each app launch"
- But file session is NOT cleared
- Creates inconsistent state where file says "logged in" but DB says "no session"

### Issue 4: Azure Provider Mapping

**Status:** FIXED in codebase

**Evidence (supabaseService.ts:145-148):**
```typescript
async signInWithIdToken(
  provider: "google" | "azure",  // Accepts 'azure' for Microsoft
  idToken: string
)
```

The `azure` -> `microsoft` mapping is handled correctly. The user.email issue was fixed by extracting from `user_metadata.email`.

### Issue 5: Contacts Import Validation Error

**Root Cause:** NOT FOUND in contact code

After reviewing `contactDbService.ts`, there is no ValidationError thrown for email fields. The contact creation:
- Does NOT validate email format
- Uses INSERT OR IGNORE for duplicates
- Normalizes email to lowercase

**Hypothesis:** The ValidationError is coming from a DIFFERENT layer:
- Could be from `validation.ts` utility
- Could be in a handler that validates before calling DB service
- Need user to provide exact error message/stack trace

### Issue 6: Outlook/Gmail Connection

**Status:** Should work IF user ID mismatch is resolved

**Evidence (sharedAuthHandlers.ts:271-277):**
```typescript
const validatedUserId = await getValidUserId(data.userId, "SharedAuth");
if (!validatedUserId) {
  return {
    success: false,
    error: "No user found in database. Please log in first.",
  };
}
```

The `getValidUserId()` helper falls back to finding ANY user in `users_local`, so this should work for single-user scenarios. The issue is that if there are TWO users (one with each ID), it may pick the wrong one.

### Issue 7: Messages Re-importing

**Root Cause:** Two users means messages split between them

If there are two `users_local` records:
- `67614fc0...` (Supabase ID)
- `388d5ad0...` (Legacy ID)

And messages are imported under one ID, the deduplication query:
```sql
WHERE user_id = ?
```
Will find no duplicates if checked with the OTHER user's ID.

---

## Architectural Diagrams

### Current (Broken) Session Flow

```
APP STARTUP
    |
    v
+-------------------------+
| system-handlers.ts      |
| clearAllSessions()      |  <-- Clears SQLite sessions table
+-------------------------+
    |
    v
+-------------------------+
| LoadingOrchestrator     |
| Phase 3: loading-auth   |
+-------------------------+
    |
    v
+-------------------------+
| handleGetCurrentUser()  |
| 1. Load file session    |  <-- session.json EXISTS
| 2. Validate DB session  |  <-- sessions table EMPTY (cleared!)
| 3. FAIL                 |
+-------------------------+
    |
    v
User sees: "No active session" error
State machine: Goes to unauthenticated
```

### Current (Broken) User ID Flow

```
FIRST LOGIN (Before TASK-1507G)
    |
    v
+-------------------------+
| microsoftAuthHandlers   |
| 1. Supabase Auth        |  --> auth.uid() = 67614fc0...
| 2. createUser()         |  --> users_local.id = 388d5ad0... (random!)
| 3. Save session         |  --> stores user with 388d5ad0...
+-------------------------+
    |
    v
SUBSEQUENT REQUESTS
    |
    v
+-------------------------+
| mailbox connection      |
| userId from Supabase    |  --> 67614fc0...
| Lookup in users_local   |  --> NOT FOUND (id=388d5ad0...)
| getValidUserId fallback |  --> Returns 388d5ad0...
+-------------------------+
    |
    v
Data saved with WRONG user ID or FK failure
```

---

## Unified Fix Strategy

### Fix Priority Order

| Priority | Issue | Fix | Impact |
|----------|-------|-----|--------|
| **P0** | Session Architecture | Align file + DB sessions | Blocks all others |
| **P1** | User ID Mismatch | Run migration on startup | Blocks mailbox/sync |
| **P2** | isNewUser Definition | Separate terms vs onboarding | UX for returning users |
| **P3** | ValidationError | Need more info from user | Unknown scope |

### Fix 1: Session Architecture Alignment (P0)

**Option A: Remove File Session (Recommended)**
- Delete `sessionService.ts`
- Store ALL session data in SQLite `sessions` table
- `clearAllSessions()` behavior becomes intentional

**Option B: Synchronize Sessions**
- When `clearAllSessions()` runs, also clear `session.json`
- OR: Don't clear SQLite sessions on startup (remove the call)

**Recommended:** Option B (minimal change)

**Implementation:**
```typescript
// system-handlers.ts line 234
await databaseService.clearAllSessions();
await sessionService.clearSession();  // <-- ADD THIS LINE
```

OR (better):
```typescript
// REMOVE the clearAllSessions() call entirely
// Let sessions persist across app restarts
// Session expiry (24hr) already handles security
```

### Fix 2: User ID Migration at Startup (P1)

**Problem:** Migration only runs during `handleGetCurrentUser()`, which fails if session is broken.

**Fix:** Add explicit migration check during DB initialization.

**Implementation Location:** `system-handlers.ts` after `initializeDatabase()`

```typescript
// After initializeDatabase() completes, check for ID mismatch
const supabaseSession = await supabaseService.getAuthSession();
if (supabaseSession?.userId) {
  // Find any user by email or oauth_id
  const localUser = await databaseService.getUserByEmail(...);
  if (localUser && localUser.id !== supabaseSession.userId) {
    await migrateUserToSupabaseId(localUser, supabaseSession.userId);
  }
}
```

### Fix 3: Separate isNewUser from needsTermsAcceptance (P2)

**Current:**
```typescript
isNewUser: needsToAcceptTerms(user)  // WRONG: Conflates two concepts
```

**Fix:**
```typescript
// A user is "new" only if they've never completed initial onboarding
const isNewUser = !user.terms_accepted_at && !user.mobile_phone_type;

// Terms update is a separate flag
const needsTermsUpdate = needsToAcceptTerms(user) && !isNewUser;
```

**Implementation Locations:**
- `sessionHandlers.ts:658`
- `microsoftAuthHandlers.ts:475`
- `googleAuthHandlers.ts:352, 588`

### Fix 4: State Machine Returning User Logic

**Current Issue:** State machine treats ALL users with `isNewUser: true` as needing full onboarding.

**Fix:** Add `needsTermsUpdate` flag to distinguish:
1. New user (never completed onboarding) -> Full onboarding flow
2. Returning user (completed onboarding, needs terms update) -> Terms modal only

**Implementation (reducer.ts):**
```typescript
case "AUTH_LOADED": {
  // ...existing code...

  if (action.isNewUser) {
    // TRULY new user - start full onboarding
    return { status: "onboarding", ... };
  }

  if (action.needsTermsUpdate) {
    // Returning user with outdated terms - go to ready but show terms modal
    return { status: "loading", phase: "loading-user-data" };
    // The terms modal is handled at the AppRouter level
  }

  // Normal returning user
  return { status: "loading", phase: "loading-user-data" };
}
```

---

## Implementation Plan

### Phase 1: Critical Path (Day 1)

**Task 1A: Fix Session Clearing**
- File: `electron/system-handlers.ts`
- Change: Add `await sessionService.clearSession();` after `clearAllSessions()` (line 234)
- OR: Remove `clearAllSessions()` call entirely

**Task 1B: Add User Migration to Startup**
- File: `electron/system-handlers.ts`
- Location: After `initializeDatabase()` (around line 296)
- Add migration check and execution

**Verification:**
1. Clear all app data
2. Login with Microsoft
3. Close and reopen app
4. User should be recognized as returning user
5. No ID mismatch warnings in logs

### Phase 2: UX Fixes (Day 2)

**Task 2A: Separate isNewUser Definition**
- Files: `sessionHandlers.ts`, `microsoftAuthHandlers.ts`, `googleAuthHandlers.ts`
- Change: `isNewUser` checks for NEVER completed onboarding, not just missing current terms

**Task 2B: Add needsTermsUpdate Flag**
- Files: Same as 2A
- Add separate `needsTermsUpdate` flag for returning users who need to accept new terms

**Task 2C: Update State Machine Types**
- File: `src/appCore/state/machine/types.ts`
- Add `needsTermsUpdate?: boolean` to `AuthLoadedAction`

**Task 2D: Update Reducer Logic**
- File: `src/appCore/state/machine/reducer.ts`
- Handle `needsTermsUpdate` separately from `isNewUser`

**Verification:**
1. Login as new user -> Full onboarding flow
2. Complete onboarding -> Dashboard
3. Bump terms version -> User sees terms modal, NOT full onboarding
4. Accept terms -> Dashboard (not phone type selection)

### Phase 3: Validation Error Investigation (Day 3)

**Requires User Input:**
- Exact error message
- Stack trace
- What action triggered it (import button? auto-import?)

**Potential Locations to Check:**
- `electron/contact-handlers.ts`
- `electron/utils/validation.ts`
- `src/services/contactService.ts`

---

## Verification Checklist

### After Phase 1:

- [ ] App remembers user across restarts
- [ ] No "No existing session found" in logs
- [ ] Only ONE user record in `users_local` table
- [ ] User ID matches Supabase `auth.uid()`
- [ ] Mailbox connection works with correct user ID

### After Phase 2:

- [ ] New user sees: Login -> Terms -> Phone Type -> Email -> Dashboard
- [ ] Returning user sees: Login -> Dashboard (or Terms modal if needed)
- [ ] Returning user does NOT see Phone Type selection again
- [ ] Terms modal shows for returning users when version bumped

### After Phase 3:

- [ ] Contact import completes without ValidationError
- [ ] All contacts associated with correct user ID

---

## Database State Verification Queries

Run these to diagnose current state:

```sql
-- Check for multiple users
SELECT id, email, created_at FROM users_local;

-- Check session state
SELECT * FROM sessions;

-- Check user onboarding state
SELECT
  id,
  email,
  terms_accepted_at,
  terms_version_accepted,
  mobile_phone_type,
  email_onboarding_completed_at
FROM users_local;

-- Check if messages are split between users
SELECT user_id, COUNT(*) as message_count
FROM messages
GROUP BY user_id;

-- Check if contacts are split between users
SELECT user_id, COUNT(*) as contact_count
FROM contacts
GROUP BY user_id;
```

---

## Files Modified Summary

| File | Change Type | Priority |
|------|-------------|----------|
| `electron/system-handlers.ts` | Add session clear / migration | P0 |
| `electron/handlers/sessionHandlers.ts` | Fix isNewUser definition | P2 |
| `electron/handlers/microsoftAuthHandlers.ts` | Fix isNewUser definition | P2 |
| `electron/handlers/googleAuthHandlers.ts` | Fix isNewUser definition | P2 |
| `src/appCore/state/machine/types.ts` | Add needsTermsUpdate | P2 |
| `src/appCore/state/machine/reducer.ts` | Handle terms update flow | P2 |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration deletes user data | Low | High | Transaction with rollback |
| Session clear breaks existing users | Medium | Medium | Test on backup first |
| State machine changes cause loops | Medium | High | Add integration tests |
| Terms modal shows incorrectly | Low | Low | Test version comparison |

---

## Appendix: Key Code Locations

### Session Management
- `electron/services/sessionService.ts` - File-based session (session.json)
- `electron/services/db/sessionDbService.ts` - SQLite sessions table
- `electron/system-handlers.ts:234` - clearAllSessions() call
- `electron/handlers/sessionHandlers.ts:521-669` - handleGetCurrentUser()

### User Creation/Migration
- `electron/services/db/userDbService.ts:21-55` - createUser()
- `electron/handlers/sessionHandlers.ts:430-516` - migrateUserToSupabaseId()
- `electron/services/supabaseService.ts:459-537` - _migrateUserToAuthId()

### isNewUser Determination
- `electron/handlers/sessionHandlers.ts:53-77` - needsToAcceptTerms()
- `electron/handlers/sessionHandlers.ts:658` - isNewUser assignment
- `electron/handlers/microsoftAuthHandlers.ts:475` - isNewUser assignment
- `electron/handlers/googleAuthHandlers.ts:352,588` - isNewUser assignment

### State Machine
- `src/appCore/state/machine/types.ts` - State and action types
- `src/appCore/state/machine/reducer.ts` - State transitions
- `src/appCore/state/machine/LoadingOrchestrator.tsx` - Orchestration
