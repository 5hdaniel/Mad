# BACKLOG-556: DMG/Packaged App - Deferred DB Init Never Triggers During Onboarding

**Created**: 2026-01-27
**Priority**: P0 (Critical - Blocks fresh user onboarding)
**Type**: Bug
**Sprint Origin**: SPRINT-062 (discovered during TASK-1508 user testing)

---

## Problem Statement

First-time macOS users on the packaged app (DMG) cannot complete onboarding. After successful browser-based OAuth login:

1. User reaches "Connect Your Email" step
2. Clicking Google/Microsoft fails with: "No user found in database. Please log in first."
3. Screen jumps back to Email Connect when leaving/returning to app
4. Full Disk Access flow also broken due to state instability

## Root Cause Analysis

**The deferred DB initialization is never triggered during onboarding.**

### Flow Breakdown

1. **STORAGE_CHECKED** with `hasKeyStore=false` (first-time macOS) sets:
   - `phase: "loading-auth"` (skips `initializing-db`)
   - `deferredDbInit: true`

2. **Auth succeeds** → Pending user stored:
   ```
   [DeepLink] Database not initialized, storing pending user
   [DeepLink] Stored pending user for later creation: 67614fc0-...
   ```

3. **Onboarding starts** → `secure-storage` step shows

4. **SECURE_STORAGE_SETUP action** → Just calls `goToNext()` without:
   - Triggering `initializeSecureStorage()`
   - Creating the pending user in local DB

5. **email-connect step** → Fails because:
   - DB was never initialized
   - Pending user was never synced to local DB
   - `useEmailHandlers` can't find user in database

## Error Messages

From renderer console:
```
[useEmailHandlers] Failed to start Microsoft OAuth: No user found in database. Please log in first.
[useEmailHandlers] Failed to start Google OAuth: No user found in database. Please log in first.
```

From main process logs:
```
[DeepLink] Database not initialized, storing pending user
[DeepLink] Stored pending user for later creation: 67614fc0-1be2-474d-8c99-58305472736a
```

## Expected Behavior

1. First-time macOS user logs in via browser OAuth
2. Pending user stored (correct)
3. During `secure-storage` step, clicking Continue:
   - Triggers `window.api.system.initializeSecureStorage()`
   - Keychain prompt appears
   - On success, syncs pending user to local SQLite DB
4. `email-connect` step works because user exists in DB

## Files Involved

| File | Issue |
|------|-------|
| `src/components/onboarding/hooks/useOnboardingFlow.ts:277-279` | `SECURE_STORAGE_SETUP` just calls `goToNext()` without DB init |
| `src/appCore/state/machine/reducer.ts:177-186` | Sets `deferredDbInit: true` but nothing acts on it |
| `electron/main.ts:400-406` | Stores pending user, but pending user never gets created |

## Acceptance Criteria

- [ ] `secure-storage` step triggers DB initialization when `deferredDbInit=true`
- [ ] Keychain prompt appears during secure-storage step (not on app launch)
- [ ] Pending user is synced to local DB after successful DB init
- [ ] Email connect step works for first-time macOS users
- [ ] Onboarding state is stable (no jumping back to email step)
- [ ] Full Disk Access flow works after email connect

## Technical Approach

1. **Option A: Handle in useOnboardingFlow**
   - When `SECURE_STORAGE_SETUP` action received and `deferredDbInit=true`
   - Call `window.api.system.initializeSecureStorage()`
   - On success, sync pending user, then `goToNext()`

2. **Option B: Handle via LoadingOrchestrator**
   - Add effect that watches for onboarding secure-storage step
   - Auto-trigger DB init when that step is active
   - Use existing pending user sync logic

3. **Option C: Dispatch TRIGGER_DB_INIT action** (from TASK-1506B plan)
   - Add new action type to state machine
   - SecureStorageStep dispatches it instead of SECURE_STORAGE_SETUP
   - Reducer/orchestrator handles the init

## Related

- **TASK-1506B**: Original plan to fix keychain timing (partially implemented)
- **BACKLOG-554**: Device registration testing
- **BACKLOG-555**: Offline grace period testing

## Reproducibility

100% reproducible on packaged DMG:

1. Delete `~/Library/Application Support/magic-audit`
2. Delete "magic-audit Safe Storage" from Keychain Access
3. Open `dist/MagicAudit-2.0.0-arm64.dmg`
4. Login via browser OAuth (succeeds)
5. Click "Connect with Google" on email step → Error

## Notes

This is the second env-related issue found during DMG testing:
1. ~~`.env.production` path wrong (FIXED)~~
2. Deferred DB init never triggers (THIS ISSUE)
