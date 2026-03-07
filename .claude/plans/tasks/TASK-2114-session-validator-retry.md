# TASK-2114: Session validator network change resilience

**Backlog:** BACKLOG-848
**Sprint:** SPRINT-114
**Status:** Completed
**Priority:** Medium
**Type:** fix

---

## Problem

When plugging in an iPhone for sync, Windows may auto-switch the network source to iPhone tethering. This IP change causes the session validator (`useSessionValidator.ts`) to detect an invalid session and trigger logout — even though the session is actually valid.

The user sees: "Your session was ended from another device. Please sign in again."

## Root Cause

`validateRemoteSession()` makes a Supabase API call. When the network source changes mid-request, the call may fail or return an unexpected result. The current code treats ANY non-valid result as session invalidated, with no retry logic.

## Solution

Add retry with delay (2-3 retries over ~10 seconds) before treating a session as invalid. Only retry on network-related failures, not on explicit invalidation responses.

## Files to Modify

- `src/hooks/useSessionValidator.ts` — add retry logic to `checkSession()`

## Implementation Notes

- Add a retry loop (e.g., 3 attempts with 3-second delay between each)
- Only retry when the validation call fails or returns ambiguous results
- If the server explicitly says "session revoked", do NOT retry — respect that immediately
- Log each retry attempt for debugging
- Keep the existing deferred-logout-during-sync logic (TASK-2109) unchanged

## Acceptance Criteria

- [ ] Session validator retries up to 3 times with delay before triggering logout
- [ ] Explicit session revocation (server says invalid) still triggers immediate logout
- [ ] Network errors during validation are retried, not treated as invalidation
- [ ] Existing sync-awareness (TASK-2109) is not affected
- [ ] Unit tests cover retry scenarios
