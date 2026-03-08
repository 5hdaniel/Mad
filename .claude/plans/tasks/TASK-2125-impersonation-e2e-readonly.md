# TASK-2125: Impersonation End-to-End Validation & Read-Only Enforcement

**Backlog ID:** BACKLOG-866
**Sprint:** SPRINT-116
**Phase:** Phase 3 - Integration & Hardening (Sequential)
**Depends On:** TASK-2123 (admin portal), TASK-2124 (broker portal) -- both must be merged
**Branch:** `feature/task-2125-impersonation-e2e`
**Branch From:** `int/sprint-116-impersonation`
**Branch Into:** `int/sprint-116-impersonation`
**Estimated Tokens:** ~15K (service category x 0.5 = ~8K adjusted)

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Verify the full impersonation flow works end-to-end (admin portal -> broker portal), harden read-only enforcement during impersonation sessions, and fix any integration gaps found during testing.

## Non-Goals

- Do NOT add new features beyond what was spec'd in TASK-2122/2123/2124
- Do NOT implement Electron app impersonation
- Do NOT add an impersonation management page (active sessions list)
- Do NOT modify the database schema unless fixing a bug from TASK-2122

## Deliverables

1. Update (if needed): `broker-portal/app/dashboard/submissions/*/page.tsx` -- Disable write actions during impersonation
2. Update (if needed): `broker-portal/components/submission/*` -- Hide submit/approve buttons during impersonation
3. Update (if needed): Any broker portal page that has write operations -- add impersonation guards
4. New file (if needed): `broker-portal/lib/impersonation-guards.ts` -- Helper to check impersonation state in server components
5. Fixes: Any integration bugs found during end-to-end testing

## File Boundaries

### Files to modify (owned by this task):

- Any `broker-portal/` file that has write operations needing impersonation guards
- Any integration fix files identified during testing

### Files this task must NOT modify:

- `supabase/migrations/*` (unless fixing a critical bug from TASK-2122)
- `admin-portal/*` (unless fixing a critical bug from TASK-2123)

## Acceptance Criteria

- [ ] Full flow works: admin clicks "View as User" -> broker portal opens with target user data
- [ ] Purple banner visible on all dashboard pages during impersonation
- [ ] Countdown timer accurate and updates every second
- [ ] "End Session" clears impersonation and redirects to admin portal
- [ ] Expired session is handled gracefully (banner shows expired, redirect offered)
- [ ] Submission forms are disabled/hidden during impersonation
- [ ] Approve/reject buttons are hidden during impersonation
- [ ] Settings page is inaccessible during impersonation
- [ ] User invite functionality is disabled during impersonation
- [ ] All write-capable API calls from the broker portal reject requests during impersonation
- [ ] Audit log shows impersonation start and end events
- [ ] Invalid tokens show appropriate error message
- [ ] All CI checks pass

## Implementation Notes

### Read-Only Enforcement Strategy

There are three layers of read-only enforcement:

**Layer 1: UI Hiding (already partially in TASK-2124)**
- Hide buttons/forms during impersonation
- Use `useImpersonation().isImpersonating` to conditionally render

**Layer 2: Server Component Guards**
In server components that handle actions:
```typescript
import { getImpersonationSession } from '@/lib/impersonation';

// In server actions / API routes:
const impersonation = await getImpersonationSession();
if (impersonation) {
  return { error: 'Write operations are not allowed during impersonation sessions' };
}
```

**Layer 3: API Route Guards**
For any API routes that accept POST/PUT/DELETE:
```typescript
// In broker-portal/app/api/*/route.ts:
import { getImpersonationSession } from '@/lib/impersonation';

export async function POST(request: Request) {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return NextResponse.json(
      { error: 'Write operations disabled during impersonation' },
      { status: 403 }
    );
  }
  // ... normal handler
}
```

### Pages/Components to Audit for Write Operations

Check these locations for write operations that need impersonation guards:

1. **Submissions** -- `broker-portal/app/dashboard/submissions/`
   - Any "approve", "reject", "request changes" buttons
   - Any submission forms
   - Any file upload components

2. **Users** -- `broker-portal/app/dashboard/users/`
   - Invite user button
   - Edit user role
   - Remove user

3. **Settings** -- `broker-portal/app/dashboard/settings/`
   - Organization settings
   - SSO configuration
   - Any write operations

4. **API Routes** -- `broker-portal/app/api/`
   - Check all POST/PUT/DELETE handlers

### Testing Checklist

Run through this checklist manually:

1. **Token Generation:**
   - [ ] Admin with `users.impersonate` permission can generate token
   - [ ] Admin without permission sees no button
   - [ ] Self-impersonation is blocked

2. **Token Validation:**
   - [ ] Valid token redirects to dashboard with banner
   - [ ] Expired token shows error
   - [ ] Invalid UUID token shows error
   - [ ] Reusing a token after session ends shows error

3. **Data Display:**
   - [ ] Dashboard shows target user's submissions, not admin's
   - [ ] Submissions list is correct for target user
   - [ ] User info in nav shows target user (or is hidden)

4. **Read-Only:**
   - [ ] Cannot submit new transactions
   - [ ] Cannot approve/reject submissions
   - [ ] Cannot invite users
   - [ ] Cannot modify settings
   - [ ] API calls return 403

5. **Session Lifecycle:**
   - [ ] Banner shows correct countdown
   - [ ] "End Session" works
   - [ ] Expired session is handled
   - [ ] Audit log entries exist

### Fixing Integration Issues

If testing reveals integration issues between TASK-2123 and TASK-2124:
- Document the issue in the Implementation Summary
- Fix it in this task's branch
- Note which original task the fix relates to

## Integration Notes

- **Depends on:** TASK-2123 (admin portal) and TASK-2124 (broker portal) -- both merged
- **Final task:** This is the last task in Sprint 116
- After this task merges, the integration branch `int/sprint-116-impersonation` is ready for develop merge

## Do / Don't

### Do:
- Audit ALL write operations in the broker portal
- Add both UI and server-side guards (defense in depth)
- Document any bugs found and fixed
- Test with both valid and invalid/expired tokens

### Don't:
- Do NOT add new features
- Do NOT change the impersonation flow architecture
- Do NOT skip server-side guards (UI-only hiding is insufficient)
- Do NOT modify the schema unless absolutely necessary for a bug fix

## When to Stop and Ask

- If the end-to-end flow has a fundamental architecture issue (e.g., RLS prevents all data access)
- If there are more than 10 files needing write operation guards (may need scope revision)
- If you need to modify the database schema to fix a bug
- If the admin portal button doesn't generate a valid token

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this is primarily an integration/validation task)

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Use the manual testing checklist above
- Document results in Implementation Summary

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking in both admin-portal/ and broker-portal/
- [ ] Lint checks
- [ ] Build succeeds in both portals
- [ ] All existing CI checks pass

## PR Preparation

- **Title**: `feat(broker): harden impersonation read-only enforcement`
- **Labels**: `broker-portal`, `sprint-116`, `security`
- **Depends on**: TASK-2123 and TASK-2124

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~8K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3-5 files (adding guards) | +8K |
| Bug fixes | 1-2 integration fixes | +5K |
| Testing | Manual verification | +2K |
| Service multiplier | x 0.5 | Applied |

**Confidence:** Medium

**Risk factors:**
- Number of write operations to guard is uncertain
- Integration bugs from Phase 2 could add scope
- RLS data access issues might surface

**Similar past tasks:** Various polish/hardening tasks in past sprints

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] <list when known>

Files modified:
- [ ] <list when known>

Features implemented:
- [ ] Read-only enforcement on submissions
- [ ] Read-only enforcement on user management
- [ ] Read-only enforcement on settings
- [ ] API route guards
- [ ] Integration bug fixes (if any)

Verification:
- [ ] End-to-end flow tested
- [ ] All write operations blocked during impersonation
- [ ] npm run type-check passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document bugs found during E2E testing>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |
| Duration | - | X sec | - |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

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
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-116-impersonation

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
