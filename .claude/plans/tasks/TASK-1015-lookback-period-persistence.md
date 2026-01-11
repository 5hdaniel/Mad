# Task TASK-1015: Fix Scan Lookback Period Setting Persistence

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

Fix the bug where the "Scan Lookback Period" setting in Settings doesn't persist when changed. The value resets to the default (9 months) instead of saving the user's selection.

## Non-Goals

- Do NOT add new settings or UI elements
- Do NOT refactor the entire settings/preferences system
- Do NOT modify other settings besides lookback period
- Do NOT change the UI design of the settings page

## Deliverables

1. Debug and fix: `src/components/Settings.tsx` - handleScanLookbackChange or related
2. Possibly fix: `electron/handlers/preference-handlers.ts` - deep merge logic
3. Possibly fix: `electron/services/supabaseService.ts` - syncPreferences

## Acceptance Criteria

- [ ] Lookback period setting persists after changing
- [ ] Value survives page navigation
- [ ] Value survives app restart
- [ ] Value can be verified in Supabase user_preferences
- [ ] No regressions in other settings
- [ ] All CI checks pass

## Implementation Notes

### Investigation Steps

The bug could be in any of these layers:

1. **UI Layer (Settings.tsx)**
   - Check if `handleScanLookbackChange` is calling the API correctly
   - Verify the value is being passed correctly

2. **IPC Handler (preference-handlers.ts)**
   - Check the deep merge logic for `scan.lookbackMonths`
   - Look for silent failures (errors caught but not surfaced)

3. **Supabase Sync (supabaseService.ts)**
   - Check if `syncPreferences` is being called
   - Verify data reaches Supabase

### Debug Approach

Add console.log at each layer to trace the flow:

```typescript
// Settings.tsx
const handleScanLookbackChange = async (months: number) => {
  console.log('[Settings] Changing lookback to:', months);
  const result = await window.api.preferences.update(userId, {
    scan: { lookbackMonths: months }
  });
  console.log('[Settings] Update result:', result);
};

// preference-handlers.ts
ipcMain.handle('preferences:update', async (event, userId, updates) => {
  console.log('[Prefs] Received update:', updates);
  // ... merge logic
  console.log('[Prefs] After merge:', merged);
  // ... sync
  console.log('[Prefs] Sync result:', syncResult);
});
```

### Possible Fixes

**If deep merge issue:**
```typescript
// Ensure nested object merges correctly
const merged = {
  ...existingPrefs,
  scan: {
    ...existingPrefs.scan,
    ...updates.scan
  }
};
```

**If silent failure:**
```typescript
// Surface errors instead of swallowing them
try {
  await supabaseService.syncPreferences(userId, merged);
} catch (error) {
  console.error('[Prefs] Sync failed:', error);
  throw error; // Re-throw to surface to caller
}
```

**If async timing issue:**
```typescript
// Ensure state updates after successful persistence
const result = await window.api.preferences.update(userId, updates);
if (result.success) {
  setLookbackMonths(months); // Only update UI if save succeeded
}
```

### Verification

After fix, verify:
1. Change setting from 9 to 3 months
2. Check DevTools Network tab for Supabase call
3. Navigate away and back - setting should persist
4. Close and reopen app - setting should persist
5. Check Supabase directly: `user_preferences.scan.lookbackMonths = 3`

## Integration Notes

- Imports from: Supabase client for persistence
- Exports to: Settings UI displays the value
- Used by: Sync service uses lookback for filtering
- Depends on: None (can run in parallel with other Phase 1 tasks)

## Do / Don't

### Do:
- Add logging to trace the issue
- Test the full flow: UI -> IPC -> Supabase -> reload
- Check for error handling that might swallow failures
- Verify other scan settings still work

### Don't:
- Refactor the entire preferences system
- Change how other settings work
- Add new settings or UI
- Make breaking changes to the preferences schema

## When to Stop and Ask

- If the preferences system uses a pattern you don't recognize
- If you find the bug is in Supabase or requires backend changes
- If fixing this would require significant refactoring
- If other settings have the same bug (might indicate systemic issue)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Preference update for scan.lookbackMonths
  - Deep merge handles nested objects correctly
- Existing tests to update:
  - Any preference-related tests if they exist

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Change lookback setting, verify persisted
  - App restart preserves setting

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(settings): persist scan lookback period setting correctly`
- **Labels**: `bug`, `settings`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service` (bug fix)

**Estimated Tokens:** ~10-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Investigation | Trace through 3 layers | +5K |
| Files to modify | 1-2 files | +3K |
| Fix complexity | Likely simple once found | +2K |
| Test updates | Small | +2K |

**Confidence:** Medium

**Risk factors:**
- Bug location unknown until investigation
- Could be multiple issues compounding

**Similar past tasks:** Bug fixes typically under 15K tokens

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
Files modified:
- [ ] Settings.tsx
- [ ] preference-handlers.ts
- [ ] supabaseService.ts (if needed)

Bug investigation:
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Verified in all layers

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Root cause:**
<What was the actual bug and where was it?>

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
| **Tokens** | ~15K | ~XK | +/-X% |
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
