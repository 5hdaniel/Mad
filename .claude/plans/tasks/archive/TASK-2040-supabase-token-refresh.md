# Task TASK-2040: Supabase Token Auto-Refresh

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

## Goal

Enable proactive Supabase access token refresh so that long-running desktop sessions (1+ hours) do not silently lose cloud connectivity when the 1-hour JWT expires.

## Non-Goals

- Do NOT rewrite the entire auth flow or session management.
- Do NOT change the OAuth login flow (Google/Microsoft).
- Do NOT modify `persistSession` -- it should remain `false` (we manage session persistence ourselves via sessionService).
- Do NOT add token encryption (already handled by SPRINT-088, BACKLOG-722).

## Deliverables

1. Update: `electron/services/supabaseService.ts` -- enable `autoRefreshToken: true` or implement manual refresh logic
2. Possibly new: `electron/services/tokenRefreshService.ts` (if manual refresh approach is chosen)
3. Update: existing tests in `electron/services/__tests__/supabaseService.test.ts`

## Acceptance Criteria

- [ ] `autoRefreshToken` is either set to `true` or a manual refresh mechanism is implemented
- [ ] Token refresh happens before the 1-hour JWT expiry (proactive, not reactive)
- [ ] If refresh fails, the error is logged and the user is notified (not silently dropped)
- [ ] Existing auth flows (login, logout, session validation) are not broken
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Current State

`electron/services/supabaseService.ts:127-132`:
```typescript
this.client = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

The `autoRefreshToken: false` setting means the Supabase JS client does NOT proactively refresh the access token. After ~1 hour, the JWT expires and all Supabase queries start failing with 401 errors.

### Approach Options

**Option A (Preferred): Enable Supabase built-in auto-refresh**
```typescript
this.client = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
  },
});
```
The Supabase JS SDK will automatically refresh the token when it nears expiry (typically at the 50% mark of the JWT lifetime). Since we have `persistSession: false`, the refreshed tokens will be in-memory only -- which is fine because we manage persistence ourselves via `sessionService`.

**However**, verify this works correctly with `persistSession: false`. The SDK may need an active session to auto-refresh. If the SDK refresh fails silently because there is no persisted session, fall back to Option B.

**Option B: Manual refresh timer**
```typescript
// In supabaseService, after setting session:
private startRefreshTimer(expiresIn: number): void {
  // Refresh at 80% of token lifetime
  const refreshAt = expiresIn * 0.8 * 1000; // Convert to ms
  this.refreshTimer = setTimeout(async () => {
    try {
      const { data, error } = await this.client.auth.refreshSession();
      if (error) throw error;
      // Update stored session
      logService.info('[Supabase] Token refreshed successfully', 'SupabaseService');
      // Schedule next refresh
      if (data.session?.expires_in) {
        this.startRefreshTimer(data.session.expires_in);
      }
    } catch (error) {
      logService.error('[Supabase] Token refresh failed', 'SupabaseService', { error });
      // Emit event so UI can notify user
    }
  }, refreshAt);
}
```

### Key Considerations

- The `refresh_token` must be available to the Supabase client. Check how `setSession()` is called -- it needs both `access_token` and `refresh_token`.
- Look at how `sessionService` stores tokens -- ensure the `refresh_token` is being stored and passed to the Supabase client.
- If the app goes to sleep and wakes up past expiry, the refresh should still work (the refresh_token has a much longer lifetime than the access_token).

## Integration Notes

- Imports from: `@supabase/supabase-js`
- Exports to: Used by all services that call Supabase (syncOrchestrator, submissionSyncService, etc.)
- Used by: TASK-2044 (login retry) builds on the auth error handling patterns established here
- Depends on: None (Batch 1, parallel)

## Do / Don't

### Do:
- Test with a real Supabase session that is near expiry
- Log refresh events at info level for debugging
- Handle the case where refresh fails gracefully (log error, notify UI)
- Clean up any refresh timers on logout/app quit

### Don't:
- Change `persistSession` to `true` (we manage persistence via sessionService)
- Add retry logic for refresh failures (that is TASK-2044's scope)
- Modify the login flow
- Ignore the case where the app wakes from sleep past token expiry

## When to Stop and Ask

- If `autoRefreshToken: true` does not work with `persistSession: false`
- If the `refresh_token` is not being stored/passed to the Supabase client
- If changing the auth config causes existing tests to fail in unexpected ways
- If there are multiple places where `setSession()` is called and they are inconsistent

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that token refresh is triggered before expiry (mock timers)
  - Test that refresh failure is logged and does not crash the app
  - Test that refresh timer is cleaned up on logout
- Existing tests to update:
  - `electron/services/__tests__/supabaseService.test.ts` -- update to account for new auth config

### Coverage

- Coverage impact: Must not decrease; new refresh logic should be covered

### Integration / Feature Tests

- Required scenarios:
  - Session remains active after >1 hour of use (manual test)
  - App wake from sleep re-establishes session (manual test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(auth): enable Supabase token auto-refresh to prevent session expiry`
- **Labels**: `auth`, `security`, `rollout-readiness`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0-1 new files | +5K |
| Files to modify | 1-2 files (supabaseService.ts + tests) | +10K |
| Code volume | ~30-50 lines | +5K |
| Test complexity | Medium (mock Supabase auth, timers) | +5K |

**Confidence:** High

**Risk factors:**
- Unclear if `autoRefreshToken: true` works with `persistSession: false`
- May need to trace how refresh_token is stored and passed

**Similar past tasks:** Service-category tasks typically run at x0.5 multiplier.

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
- [ ] <file 1>

Files modified:
- [ ] electron/services/supabaseService.ts
- [ ] electron/services/__tests__/supabaseService.test.ts

Features implemented:
- [ ] Token auto-refresh enabled/implemented
- [ ] Refresh failure handling
- [ ] Timer cleanup on logout

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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~25K | ~XK | +/-X% |
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
