# TASK-2317: Investigate Account Verification Race Condition

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Investigate the "Setup failed" error during account verification that appears to be a race condition with DB initialization and schema validation errors. Multiple services may access the database before initialization completes. Document the root cause and recommend a fix.

## Non-Goals

- Do NOT fix any code in this task (read-only investigation)
- Do NOT modify any files
- Do NOT create a PR
- Do NOT investigate unrelated onboarding issues

## Investigation Scope

The account verification step (`AccountVerificationStep.tsx`) calls `window.api.system.verifyUserInLocalDb()` which triggers a handler in the main process. The error "Setup failed" appears after 3 retries (MAX_RETRIES = 3). Suspected issues:

1. **Race condition:** Multiple services access DB before init completes
2. **Schema validation errors:** DB schema may not be fully applied when verification runs
3. **Initialization ordering:** The `isDatabaseInitialized` flag may be set before all tables exist

### Key Questions to Answer

1. **What does `verifyUserInLocalDb` do in the main process?** Trace the full handler chain.
2. **What specific error is thrown?** Is it a schema error (table not found), a constraint error, or a connection error?
3. **What is the DB initialization sequence?** Document the order: DB open -> migrations -> schema validation -> flag set.
4. **Are there other services that access DB during init?** Check for race conditions in the startup flow.
5. **Is the `isDatabaseInitialized` state machine flag set prematurely?** Does it wait for all migrations + schema validation?
6. **What does Sentry show?** Check if `reportOnboardingFailure` captures useful data. Are there existing Sentry events for this?

### Files to Investigate

Start with these and follow the trail:
- `src/components/onboarding/steps/AccountVerificationStep.tsx` -- Frontend step (already reviewed, see line 177-255)
- `electron/handlers/userSettingsHandlers.ts` -- The `verifyUserInLocalDb` handler
- `electron/services/databaseService.ts` -- DB initialization, migration, schema validation
- `electron/preload/systemBridge.ts` -- Bridge for `system.verifyUserInLocalDb`
- `src/appCore/state/machine/` -- State machine `isDatabaseInitialized` transition
- `electron/main.ts` -- App startup sequence, handler registration order
- `src/components/onboarding/sentryOnboarding.ts` -- Sentry reporting for this step

### Investigation Output Format

Document findings in the Implementation Summary section below:

```markdown
### Findings

**verifyUserInLocalDb handler location:** [file:line]
**Error type observed:** [schema/constraint/connection/other]
**DB initialization sequence:**
1. [step 1]
2. [step 2]
...

**Race condition confirmed:** Yes / No / Unclear
**Root cause hypothesis:** [description]
**Confidence:** High / Medium / Low

**Recommended fix approach:**
- Sentry logging improvements: [what to add]
- Initialization ordering fix: [if applicable]
- Other: [if applicable]

**Estimated fix complexity:** Simple / Medium / Complex
**Files that would need modification:** [list]
```

## Acceptance Criteria

- [ ] Investigation summary completed with all 6 questions answered
- [ ] DB initialization sequence fully documented
- [ ] Race condition confirmed or ruled out
- [ ] Root cause hypothesis documented with confidence level
- [ ] Recommended fix approach documented (including Sentry improvements)
- [ ] No files modified (read-only investigation)

## File Boundaries

N/A -- this is a read-only investigation task. No files should be modified.

## Testing Expectations

### Unit Tests
- Required: No (investigation only)

### CI Requirements
- N/A (no code changes)

## PR Preparation

No PR for this task. Findings are documented in the Implementation Summary section below.

---

## PM Estimate (PM-Owned)

**Category:** `investigation`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Confidence:** Medium

**Risk factors:**
- Race condition may be intermittent and hard to reproduce
- Multiple services may be involved, requiring broad code tracing
- Sentry may not have captured useful error details

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Findings

**verifyUserInLocalDb handler location:** [file:line]
**Error type observed:** [schema/constraint/connection/other]

**DB initialization sequence:**
1. [step]
2. [step]
...

**Race condition confirmed:** Yes / No / Unclear

**Root cause hypothesis:**
[description]

**Confidence:** High / Medium / Low

**Recommended fix approach:**
- Sentry logging improvements: [what to add]
- Initialization ordering fix: [if applicable]

**Estimated fix complexity:** Simple / Medium / Complex

**Files that would need modification:**
- [file1]
- [file2]

### Questions Answered

1. **What does verifyUserInLocalDb do?**
   [answer]

2. **What specific error is thrown?**
   [answer]

3. **What is the DB initialization sequence?**
   [answer]

4. **Are there other services that access DB during init?**
   [answer]

5. **Is isDatabaseInitialized set prematurely?**
   [answer]

6. **What does Sentry show?**
   [answer]

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

---

## SR Engineer Review (SR-Owned)

N/A -- investigation task, no PR.
