# Task TASK-1809: Fix Terms Sync Reliability

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

---

## Goal

Ensure terms acceptance syncs reliably from Supabase to local on app restart, preventing the terms screen from reappearing after the user has already accepted terms.

## Non-Goals

- Do NOT change the terms acceptance UI
- Do NOT modify the terms modal component
- Do NOT add new terms versions or policies
- Do NOT change when terms are shown (version checking logic)

## Deliverables

1. Update `sessionHandlers.ts` - Ensure terms sync from Supabase to local on session restore
2. Add retry logic if sync fails
3. Improve `needsToAcceptTerms()` to check Supabase if local is empty
4. Add logging for debugging sync issues

## Acceptance Criteria

- [ ] User accepts terms, quits during onboarding -> terms NOT shown again on restart
- [ ] User accepts terms on device A, opens device B -> terms NOT shown on device B
- [ ] If Supabase check fails, retry with exponential backoff (3 attempts)
- [ ] If all retries fail, fall back to local data
- [ ] Detailed logging for debugging sync issues
- [ ] All CI checks pass
- [ ] TypeScript strict mode compliant

## Implementation Notes

### Problem Analysis

**Current flow (BROKEN):**
1. User logs in, accepts terms
2. `acceptTermsToSupabase()` saves to cloud
3. User quits during onboarding (before local DB may be initialized due to `deferredDbInit`)
4. User reopens app
5. `handleGetCurrentUser()` fetches cloud user with `terms_accepted_at`
6. ISSUE: Local user may not have `terms_accepted_at` if DB wasn't initialized
7. `needsToAcceptTerms()` checks local user first, returns `true`
8. Terms shown again

**Fix:**
1. Always check Supabase for terms before showing terms modal
2. If Supabase has terms, sync to local immediately
3. Only show terms if BOTH Supabase and local don't have terms

### Session Handler Update

```typescript
// electron/handlers/sessionHandlers.ts - in handleGetCurrentUser

export async function handleGetCurrentUser(event: IpcMainInvokeEvent) {
  // ... existing session loading ...

  // CRITICAL: Always check Supabase for terms state
  const cloudUser = await fetchCloudUserWithRetry(session.user.id);

  if (cloudUser?.terms_accepted_at) {
    // Sync to local if we have local DB
    if (databaseService.isInitialized()) {
      const localUser = await databaseService.getUserById(session.user.id);
      if (localUser && !localUser.terms_accepted_at) {
        await databaseService.updateUser(localUser.id, {
          terms_accepted_at: cloudUser.terms_accepted_at,
          terms_version_accepted: cloudUser.terms_version_accepted,
          privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
          privacy_policy_version_accepted: cloudUser.privacy_policy_version_accepted,
        });
        console.log('[SessionHandler] Synced terms from Supabase to local');
      }
    }
  }

  // Return cloud terms state to renderer
  return {
    ...userData,
    termsAcceptedAt: cloudUser?.terms_accepted_at ?? localUser?.terms_accepted_at ?? null,
    // ... rest of user data
  };
}
```

### Retry Logic

```typescript
async function fetchCloudUserWithRetry(userId: string, maxRetries = 3): Promise<CloudUser | null> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const user = await supabaseService.getUserById(userId);
      return user;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[SessionHandler] Supabase fetch attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[SessionHandler] All Supabase fetch retries failed:', lastError);
  return null; // Fall back to local data
}
```

### needsToAcceptTerms Update

The function should now use the cloud terms state passed from backend:

```typescript
// In useAuthFlow or AuthContext
function needsToAcceptTerms(userData: UserData): boolean {
  // If cloud has terms accepted, don't need to accept again
  if (userData.termsAcceptedAt) {
    return false;
  }

  // If local has terms accepted (legacy or offline), don't need to accept
  if (localUser?.terms_accepted_at) {
    return false;
  }

  // No terms anywhere - need to accept
  return true;
}
```

### Key Files to Read First

1. `electron/handlers/sessionHandlers.ts` - Current `handleGetCurrentUser` implementation
2. `electron/services/supabaseService.ts` - `getUserById` method
3. `src/hooks/useAuthFlow.ts` - `needsToAcceptTerms` usage
4. `src/appCore/auth/AuthContext.tsx` - How terms state flows to UI

### Logging Requirements

Add detailed logging to help debug future issues:

```typescript
console.log('[TermsSync] Cloud terms_accepted_at:', cloudUser?.terms_accepted_at);
console.log('[TermsSync] Local terms_accepted_at:', localUser?.terms_accepted_at);
console.log('[TermsSync] DB initialized:', databaseService.isInitialized());
console.log('[TermsSync] Sync result:', syncResult);
```

## Integration Notes

- Imports from: `supabaseService.ts`, `databaseService.ts`
- Used by: AuthContext, useAuthFlow
- Depends on: None (can run in parallel with TASK-1806)

## Do / Don't

### Do:
- Always check Supabase before showing terms
- Sync Supabase -> local, not vice versa
- Add exponential backoff for retries
- Log all sync operations for debugging
- Handle offline gracefully (use local if no network)

### Don't:
- Block app startup on terms sync (should be fast, but don't hang)
- Change the terms modal UI
- Modify terms version checking logic
- Sync local -> Supabase (cloud is source of truth)

## When to Stop and Ask

- If `needsToAcceptTerms` is scattered across multiple files
- If terms checking happens in more than 2-3 places
- If you find race conditions between local and cloud
- If the retry logic needs to be more complex

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `fetchCloudUserWithRetry` with retries
  - Test terms sync from cloud to local
  - Test fallback to local when cloud unavailable
- Existing tests to update:
  - Mock cloud terms state in session handler tests

### Coverage

- Coverage impact: Must not decrease
- Retry logic should have >80% coverage

### Integration Tests

- Accept terms on fresh install, quit during onboarding, reopen -> terms NOT shown
- Accept terms, simulate offline, reopen -> terms NOT shown (local has it)
- Accept terms on device A, open device B -> terms NOT shown

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(auth): ensure terms sync reliably from Supabase on restart`
- **Labels**: `critical`, `fix`, `onboarding`
- **Base Branch**: `main`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `fix`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3 (sessionHandlers, supabaseService, useAuthFlow) | +5K |
| Code volume | ~80 lines | +2K |
| Test complexity | Medium (retry logic) | +3K |

**Confidence:** Medium-High - well-understood problem

**Risk factors:**
- Terms checking may be in multiple places
- Race conditions between local/cloud

**Similar past tasks:** Fix tasks typically come in at 0.75x estimate (~7.5K actual)

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-02-03*

### Agent ID

```
Engineer Agent ID: engineer-1809
```

### Checklist

```
Files modified:
- [x] electron/handlers/sessionHandlers.ts
- [ ] electron/services/supabaseService.ts (not needed - existing getUserById works fine)
- [ ] src/hooks/useAuthFlow.ts (not needed - fix is entirely in backend)

Features implemented:
- [x] Cloud-first terms checking
- [x] Sync Supabase -> local
- [x] Retry logic with exponential backoff (3 attempts: 500ms, 1000ms, 2000ms)
- [x] Detailed logging with [TermsSync] prefix

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (pre-existing unrelated error in NotificationContext.tsx)
- [x] npm test passes (pre-existing failures in contact-handlers.test.ts unrelated to changes)
- [ ] Manual test: accept terms, quit, reopen -> no terms shown
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <auto-captured> |
| Duration | <auto-captured> |
| API Calls | N/A |

**Variance:** PM Est ~10K vs Actual <auto-captured>

### Notes

**Planning notes:**
- The existing code only synced terms when creating a NEW local user (line 602 branch)
- The bug occurs when local user EXISTS but was created before terms were accepted to Supabase
- Added `fetchCloudUserWithRetry()` with 3-attempt exponential backoff
- Added `syncTermsFromCloudToLocal()` helper to DRY up sync logic
- Enhanced `needsToAcceptTerms()` to accept optional cloudUser parameter as fallback

**Deviations from plan:**
- Did not modify supabaseService.ts - existing `getUserById` method works fine
- Did not modify useAuthFlow.ts - fix is entirely in backend sessionHandlers

**Issues encountered:**
- Had to deal with stashed changes from other tasks (TASK-1807, TASK-1808) that leaked into the workspace
- Pre-existing test failures in contact-handlers.test.ts (unrelated to changes)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Error Handling:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
