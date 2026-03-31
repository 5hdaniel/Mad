# TASK-2323: Fix Account Verification Race Condition

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Prerequisites

**Depends on:** TASK-2317 (investigation)
**Conditional:** This task may be SKIPPED if investigation finds:
- No actual race condition exists (error is caused by something else)
- The issue is already fixed in a recent PR
- A different root cause requiring a different fix approach

**PM will update this task file with specific fix instructions after TASK-2317 investigation completes.**

---

## Goal

Fix the "Setup failed" error during account verification by addressing the race condition with DB initialization and improving Sentry logging for better future debugging. Multiple services may access the database before initialization completes.

**NOTE:** This goal will be refined based on TASK-2317 investigation findings.

## Non-Goals

- Do NOT restructure the entire app startup sequence
- Do NOT change the onboarding step order
- Do NOT modify the state machine transitions (unless investigation proves it is the root cause)
- Do NOT change the retry logic in AccountVerificationStep (3 retries is fine)

## Deliverables

**TO BE DETERMINED** based on TASK-2317 investigation. Likely candidates:
1. Better Sentry breadcrumbs/context in the verification handler
2. DB initialization ordering fix (ensure all migrations run before flag is set)
3. Guard in verifyUserInLocalDb handler to check DB readiness
4. More descriptive error messages for specific failure modes

## File Boundaries

**TO BE DETERMINED** after TASK-2317 investigation.

Likely files:
- `electron/handlers/userSettingsHandlers.ts` -- verifyUserInLocalDb handler
- `electron/services/databaseService.ts` -- DB initialization sequence
- `src/components/onboarding/steps/AccountVerificationStep.tsx` -- Error message improvements

## Acceptance Criteria

- [ ] Account verification succeeds reliably during SSO onboarding
- [ ] Sentry captures specific error details when verification fails
- [ ] DB initialization completes fully before verification can access it
- [ ] Error messages are descriptive (not just "Setup failed")
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

**PLACEHOLDER:** PM will add specific implementation guidance after reviewing TASK-2317 findings.

### Likely Sentry Improvements

At minimum, the fix should add:
- Breadcrumbs in the verifyUserInLocalDb handler showing which DB operation failed
- Context tags: `db_initialized`, `migration_version`, `tables_exist`
- Error classification: distinguish schema errors, constraint errors, and connection errors

## Testing Expectations

### Unit Tests
- TBD based on investigation findings

### Manual Testing
1. Full SSO onboarding flow (create new account via Azure AD)
2. Verify account verification step succeeds without "Setup failed"
3. If testing race condition: rapid restart during onboarding
4. Check Sentry for improved error context

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## PR Preparation

- **Title:** `fix: resolve account verification race condition with DB initialization (BACKLOG-1347)`
- **Branch:** `fix/task-2323-verification-race-condition`
- **Target:** `int/identity-provisioning`
- **Depends on:** TASK-2317 investigation findings

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K (service x 0.5 = ~20K from base ~40K)

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Confidence:** Low (depends on investigation findings)

**Risk factors:**
- Race condition fixes can be tricky and may require careful sequencing
- DB initialization is core infrastructure -- changes have wide impact
- May need to add guards to multiple services

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Notes

**Investigation reference:** TASK-2317 findings
**Root cause:** [from investigation]
**Fix applied:** [description]

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merged To:** int/identity-provisioning
