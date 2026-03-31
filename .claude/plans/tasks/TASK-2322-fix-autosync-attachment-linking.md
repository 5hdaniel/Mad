# TASK-2322: Fix Auto-Sync Email Attachment Linking

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Prerequisites

**Depends on:** TASK-2316 (investigation)
**Conditional:** This task may be SKIPPED if investigation finds:
- Auto-sync attachment linking is not actually broken (user error)
- The feature was intentionally disabled
- A different root cause requiring a different fix approach

**PM will update this task file with specific fix instructions after TASK-2316 investigation completes.**

---

## Goal

Fix auto-sync email attachment linking so that email attachments are automatically linked to transactions during email sync, matching the behavior of manual search-and-attach.

**NOTE:** This goal will be refined based on TASK-2316 investigation findings. The specific files, approach, and acceptance criteria below are placeholders that will be updated by PM.

## Non-Goals

- Do NOT change the manual attachment flow (it works correctly)
- Do NOT add new attachment types or formats
- Do NOT modify the UI for attachment display

## Deliverables

**TO BE DETERMINED** based on TASK-2316 investigation. Likely candidates:
1. Fix in email sync service (auto-link logic)
2. Fix in attachment matching algorithm
3. Fix in sync timing/ordering

## File Boundaries

**TO BE DETERMINED** after TASK-2316 investigation.

## Acceptance Criteria

- [ ] Email attachments are automatically linked to transactions during sync
- [ ] Manual attachment flow continues to work unchanged
- [ ] No regression in email sync performance
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

**PLACEHOLDER:** PM will add specific implementation guidance after reviewing TASK-2316 findings.

## Testing Expectations

### Unit Tests
- TBD based on investigation findings

### Manual Testing
1. Connect email account
2. Trigger email sync
3. Verify attachments are automatically linked to the correct transactions
4. Verify manual search-and-attach still works

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## PR Preparation

- **Title:** `fix: restore auto-sync email attachment linking (BACKLOG-1340)`
- **Branch:** `fix/task-2322-autosync-attachment-fix`
- **Target:** `int/identity-provisioning`
- **Depends on:** TASK-2316 investigation findings

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K (service x 0.5 = ~25K from base ~50K)

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Confidence:** Low (depends on investigation findings)

**Risk factors:**
- Scope unknown until TASK-2316 completes
- May require deep email sync service changes
- Could be a simple configuration fix or a complex logic bug

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

**Investigation reference:** TASK-2316 findings
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
