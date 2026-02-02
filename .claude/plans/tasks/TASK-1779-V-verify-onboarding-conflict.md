# Task TASK-1779-V: Verify Onboarding + Conflict Handling

---

## WORKFLOW REQUIREMENT

**This is a VERIFICATION task.**

Verification tasks validate that infrastructure changes meet the original acceptance criteria. They may produce minor fixes committed directly, but primarily document test results.

---

## Goal

Verify that onboarding flow works correctly with SyncOrchestrator AND that conflict handling (sync-in-progress scenarios) works as designed.

## Non-Goals

- Do NOT implement new features
- Do NOT refactor existing code (unless fixing a verification failure)
- Do NOT change the conflict dialog design

## Deliverables

1. Documented test results (in this file)
2. Any minor fixes discovered during verification (direct commit)

## Acceptance Criteria

### Onboarding Flow Verification

- [ ] Fresh onboarding: FDA permissions grant triggers sync correctly
- [ ] Sync types (contacts, messages) are queued via orchestrator
- [ ] Pills show correct states during onboarding sync
- [ ] Transition to dashboard happens after sync is triggered (not waiting for completion)
- [ ] Dashboard shows correct sync state when user arrives

### Conflict Handling Tests (SR Requirement)

**Test 1: Conflict dialog appears when triggering sync while one is running**
- [ ] Start a sync (e.g., from dashboard auto-refresh)
- [ ] While sync is running, trigger another sync (manual refresh)
- [ ] Verify conflict dialog appears with two options

**Test 2: "Abandon and restart" option works**
- [ ] When conflict dialog appears, click "Abandon and restart"
- [ ] Verify current sync is cancelled
- [ ] Verify new sync starts from the beginning
- [ ] Verify pills reset and show new sync progress

**Test 3: "Keep current" option works**
- [ ] When conflict dialog appears, click "Keep current"
- [ ] Verify current sync continues uninterrupted
- [ ] Verify no new sync is queued
- [ ] Verify dialog closes and pills continue showing current sync

---

## Test Scenarios

### Scenario A: Fresh Onboarding

1. Reset app state (delete database or use fresh user)
2. Go through onboarding steps
3. Grant FDA permissions
4. Verify sync is triggered via orchestrator
5. Verify transition to dashboard
6. Verify pills show correct state on dashboard

### Scenario B: Conflict - User Triggers During Auto-Refresh

1. Load dashboard (auto-refresh starts)
2. While syncing, click manual refresh button
3. Verify conflict dialog appears
4. Test both options (abandon/keep)

### Scenario C: Conflict - Multiple Rapid Triggers

1. Click refresh button
2. Immediately click refresh button again
3. Verify conflict handling (dialog or queue)

---

## Integration Notes

- Verifies: TASK-1784 (PermissionsStep migration)
- Verifies: TASK-1782 (SyncOrchestrator conflict handling)
- Depends on: Phase 1 complete (TASK-1786)

## Testing Expectations (MANDATORY)

### Manual Testing

This is a verification task - all testing is manual.

**Required scenarios:**
- Fresh onboarding flow (end-to-end)
- Conflict dialog appearance
- Abandon and restart behavior
- Keep current behavior

### CI Requirements

This task's PR MUST pass (if any fixes are made):
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `verification`

**Estimated Tokens:** ~3K

**Token Cap:** 12K (4x upper estimate)

**Confidence:** Medium

**Risk factors:**
- May discover issues requiring Phase 1 rework

---

## Verification Results (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Test Results

| Test | Result | Notes |
|------|--------|-------|
| Fresh onboarding flow | PASS / FAIL | |
| Conflict dialog appears | PASS / FAIL | |
| Abandon and restart | PASS / FAIL | |
| Keep current | PASS / FAIL | |

### Issues Found

**List any issues discovered during verification:**

1. Issue: <description>
   - Severity: Critical / Major / Minor
   - Fix: <commit hash or "deferred to TASK-XXX">

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Notes

**Observations:**
<Key findings from verification>

**Recommendations:**
<Any recommendations for future work>
