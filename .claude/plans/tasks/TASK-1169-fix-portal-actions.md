# Task TASK-1169: Fix Broker Portal Review Actions

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Fix the broker portal review actions (Approve, Reject, Request Changes) which are currently not working. This is a P0 Critical bug blocking the team workflow.

## Non-Goals

- Do NOT modify the desktop app (this is broker portal only)
- Do NOT change the submission data structure
- Do NOT create new RLS policies (that's TASK-1164)

## Problem Statement

### Symptoms

1. **Reject Submission**: Clicking "Yes" on the confirmation dialog does nothing
   - Dialog stays open, no status change

2. **Request Changes**: Shows error "Failed to submit review. Please try again."

### Likely Causes

- RLS policy blocking UPDATE for brokers
- Missing broker role in organization_members
- Column name mismatch between code and schema
- Supabase client not authenticated properly

## Deliverables

1. Diagnose root cause of review action failures
2. Fix Approve action
3. Fix Reject action
4. Fix Request Changes action
5. Verify all actions work correctly

## Acceptance Criteria

- [ ] Reject action updates submission status to 'rejected'
- [ ] Request Changes action updates status to 'needs_changes' with notes
- [ ] Approve action updates status to 'approved'
- [ ] Broker's notes are saved correctly
- [ ] Agent sees updated status on desktop app (verified via TASK-1166/1167)
- [ ] No console errors during review workflow
- [ ] `npm run type-check` passes (in broker-portal)
- [ ] All CI checks pass

## Investigation Steps

1. **Check browser console for errors** when clicking review buttons
2. **Check network tab** for failed API requests
3. **Verify Supabase RLS** allows broker to UPDATE submissions
4. **Check if required columns exist**: `reviewed_by`, `reviewed_at`, `review_notes`, `status`
5. **Verify the update query** in the portal code

## Files to Investigate/Modify

**Broker Portal (Next.js app):**
- `broker-portal/app/dashboard/submissions/[id]/page.tsx`
- `broker-portal/components/ReviewActions.tsx` (if exists)
- `broker-portal/lib/supabase.ts`

**Supabase:**
- `supabase/migrations/20260122_b2b_broker_portal.sql` (RLS policies reference)

## Implementation Notes

### Debugging RLS

If the issue is RLS-related:
1. Check Supabase Dashboard -> Authentication -> Policies
2. Verify `transaction_submissions` has UPDATE policy for brokers
3. The policy should check: user is authenticated AND is broker for the org

### Common Fixes

1. **If column mismatch**: Update code to use correct column names
2. **If RLS blocking**: Document issue for TASK-1164 (RLS Audit)
3. **If auth issue**: Check Supabase client session is valid

### Expected SQL for Review Actions

```sql
-- Approve
UPDATE transaction_submissions
SET status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = $submission_id;

-- Reject
UPDATE transaction_submissions
SET status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = $notes,
    updated_at = NOW()
WHERE id = $submission_id;

-- Request Changes
UPDATE transaction_submissions
SET status = 'needs_changes',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = $notes,
    updated_at = NOW()
WHERE id = $submission_id;
```

## Integration Notes

- Imports from: Supabase client
- Exports to: Broker portal UI
- Used by: Broker users reviewing submissions
- Depends on: TASK-1164 (RLS Audit) - soft dependency

**Note:** If the root cause is RLS policies, coordinate with TASK-1164. The RLS audit task should fix policy issues, and this task should fix code issues.

## Do / Don't

### Do:
- Add detailed console logging for debugging
- Test all three review actions
- Verify error messages are user-friendly
- Check both success and error paths

### Don't:
- Don't bypass RLS (fix policies properly via TASK-1164)
- Don't change the submission schema
- Don't modify desktop app code

## When to Stop and Ask

- If the issue is 100% RLS-related (coordinate with TASK-1164)
- If the schema is significantly different than expected
- If you need to modify core Supabase configuration
- If you discover the issue affects more than review actions

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (portal doesn't have unit tests set up)
- Manual testing required for all actions

### Coverage

- Coverage impact: N/A (broker portal)

### Manual Test Scenarios

1. **Approve Flow**:
   - Login as broker
   - View pending submission
   - Click Approve
   - Verify status changes to 'approved'

2. **Reject Flow**:
   - Login as broker
   - View pending submission
   - Click Reject
   - Enter rejection reason
   - Verify status changes to 'rejected'
   - Verify notes are saved

3. **Request Changes Flow**:
   - Login as broker
   - View pending submission
   - Click Request Changes
   - Enter feedback
   - Verify status changes to 'needs_changes'
   - Verify notes are saved

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (if portal has it)
- [ ] Lint / format checks
- [ ] Build step

**PRs without passing CI WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(portal): repair broker review actions for submissions`
- **Labels**: `bug`, `portal`, `sprint-051`, `p0-critical`
- **Depends on**: Soft dependency on TASK-1164 (RLS Audit)

---

## PM Estimate (PM-Owned)

**Category:** `bug-fix`

**Estimated Tokens:** ~15K-25K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Investigation needed | Medium | +8K |
| Files to modify | 2-3 portal files | +7K |
| Code volume | ~50-100 lines | +5K |
| Testing/verification | Manual testing | +5K |

**Confidence:** Medium

**Risk factors:**
- Root cause may be RLS (requires coordination)
- Issue may be deeper than expected
- Portal codebase unfamiliar territory

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
Investigation:
- [ ] Checked browser console errors
- [ ] Checked network requests
- [ ] Verified RLS policies
- [ ] Identified root cause

Files modified:
- [ ] [list files changed]

Actions fixed:
- [ ] Approve works
- [ ] Reject works
- [ ] Request Changes works

Verification:
- [ ] Manual testing complete
- [ ] Type check passes (if applicable)
- [ ] Build passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Root Cause Analysis

**Root Cause:** <describe what was actually wrong>

**Category:** RLS / Code Bug / Schema Mismatch / Auth Issue / Other

**Fix Applied:** <describe the fix>

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
| **Tokens** | ~20K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

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
