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

## Quick Start

**Read this section first to understand the data flow.**

### Current Flow

```
User changes setting in UI
         |
         v
Settings.tsx: handleScanLookbackChange(months)
         |
         v
window.api.preferences.update(userId, { scan: { lookbackMonths: months } })
         |
         v
preference-handlers.ts: ipcMain.handle("preferences:update", ...)
         |
         v
supabaseService.getPreferences(userId)  <- Gets existing
         |
         v
deepMerge(existing, new)  <- Merges nested objects
         |
         v
supabaseService.syncPreferences(userId, merged)  <- Saves to Supabase
```

### Key Files

| File | Role | Key Function |
|------|------|--------------|
| `src/components/Settings.tsx` | UI | `handleScanLookbackChange` (line 133) |
| `electron/preference-handlers.ts` | IPC handler | `preferences:update` (line 117-174) |
| `electron/services/supabaseService.ts` | Storage | `syncPreferences`, `getPreferences` |

### What to Look For

1. **Silent errors** - Errors caught but only logged, not surfaced
2. **Deep merge bug** - `scan.lookbackMonths` may not merge correctly
3. **Load timing** - Value may be overwritten after initial load

---

## Goal

Fix the bug where the "Scan Lookback Period" setting in Settings doesn't persist when changed. The value resets to the default (9 months) instead of saving the user's selection.

## Non-Goals

- Do NOT add new settings or UI elements
- Do NOT refactor the entire settings/preferences system
- Do NOT modify other settings besides lookback period
- Do NOT change the UI design of the settings page

---

## Step-by-Step Debugging Guide

### Step 1: Add Diagnostic Logging (5 min)

Add temporary logging to trace the issue. Look for where the value is lost.

**File 1: `src/components/Settings.tsx`**

```typescript
// Line ~133 - handleScanLookbackChange
const handleScanLookbackChange = async (months: number): Promise<void> => {
  console.log('[Settings] 1. UI changing lookback to:', months);
  setScanLookbackMonths(months);
  try {
    console.log('[Settings] 2. Calling preferences.update with:', { scan: { lookbackMonths: months } });
    const result = await window.api.preferences.update(userId, {
      scan: {
        lookbackMonths: months,
      },
    });
    console.log('[Settings] 3. Update result:', result);
    if (!result.success) {
      console.error("[Settings] 4. FAILED - Update returned error:", result.error);
    } else {
      console.log("[Settings] 4. SUCCESS - Saved lookback:", months);
    }
  } catch (error) {
    console.error("[Settings] 4. EXCEPTION:", error);
  }
};
```

**File 2: `electron/preference-handlers.ts`**

```typescript
// Line ~117 - preferences:update handler
ipcMain.handle(
  "preferences:update",
  async (event, userId, partialPreferences) => {
    try {
      console.log('[Prefs] 1. Received update request:', JSON.stringify(partialPreferences));

      // ... validation code ...

      const existingPreferences = await supabaseService.getPreferences(validatedUserId);
      console.log('[Prefs] 2. Existing preferences:', JSON.stringify(existingPreferences));

      const updatedPreferences = deepMerge(existingPreferences ?? {}, sanitizedPartialPreferences);
      console.log('[Prefs] 3. After merge:', JSON.stringify(updatedPreferences));

      await supabaseService.syncPreferences(validatedUserId, updatedPreferences);
      console.log('[Prefs] 4. Synced to Supabase');

      return { success: true, preferences: updatedPreferences };
    } catch (error) {
      console.error('[Prefs] ERROR:', error);
      // ...
    }
  }
);
```

### Step 2: Test and Observe (5 min)

1. Open app, go to Settings
2. Open DevTools (View > Toggle Developer Tools)
3. Change lookback from 9 to 3 months
4. Look at Console output:
   - Do you see all 4 log messages?
   - Does message 3 show `{ scan: { lookbackMonths: 3 } }`?
   - Does message 4 say SUCCESS?

### Step 3: Identify Root Cause

**Possible Issues:**

**Issue A: Deep merge not working**
If existing preferences is `{ export: { format: 'pdf' } }` and you merge `{ scan: { lookbackMonths: 3 } }`, the result should be:
```json
{ "export": { "format": "pdf" }, "scan": { "lookbackMonths": 3 } }
```

Check the `deepMerge` function (line 185-206 in preference-handlers.ts).

**Issue B: Supabase sync fails silently**
Check if `syncPreferences` throws but error isn't surfaced.

**Issue C: Load overwrites save**
After saving, the `useEffect` that loads preferences on mount might overwrite with stale data.

Check `Settings.tsx` line ~75-100 for the load logic.

**Issue D: userId is stale/wrong**
If `userId` is undefined or wrong, the preference won't be saved to the right user.

### Step 4: Apply Fix

Based on what you find, apply the appropriate fix:

**Fix for Issue A (Deep Merge):**
```typescript
// Ensure nested object merges correctly
function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (isObject(source[key]) && isObject(target[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
```

**Fix for Issue B (Silent Failure):**
```typescript
// Surface errors instead of swallowing
try {
  await supabaseService.syncPreferences(userId, merged);
} catch (error) {
  logService.error('[Prefs] Sync failed:', error);
  return { success: false, error: error.message };
}
```

**Fix for Issue C (Load Timing):**
```typescript
// Add flag to prevent load from overwriting recent save
const [isLoading, setIsLoading] = useState(true);
const [lastSaveTime, setLastSaveTime] = useState(0);

// In useEffect load
if (Date.now() - lastSaveTime < 5000) {
  // Skip load if we just saved (within 5 seconds)
  return;
}

// In handleScanLookbackChange
setLastSaveTime(Date.now());
```

### Step 5: Verify the Fix

1. Change lookback from 9 to 3 months
2. Navigate to Dashboard and back to Settings - should still be 3
3. Restart the app - should still be 3
4. Check Supabase directly:
   ```sql
   SELECT preferences FROM user_preferences WHERE user_id = 'YOUR_USER_ID';
   ```
   Should show: `{ "scan": { "lookbackMonths": 3 } }`

### Step 6: Remove Debug Logging

After fix is verified, remove the temporary `console.log` statements (or keep only the error ones).

---

## Deliverables

1. Debug and fix: `src/components/Settings.tsx` - If issue is in UI layer
2. Possibly fix: `electron/preference-handlers.ts` - If issue is in deep merge
3. Possibly fix: `electron/services/supabaseService.ts` - If issue is in sync

## Acceptance Criteria

- [ ] Lookback period setting persists after changing
- [ ] Value survives page navigation
- [ ] Value survives app restart
- [ ] Value can be verified in Supabase user_preferences
- [ ] No regressions in other settings
- [ ] All CI checks pass

---

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

---

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Preference update for `scan.lookbackMonths`
  - Deep merge handles nested objects correctly
- Existing tests to update:
  - Any preference-related tests if they exist

**Test file:** `electron/__tests__/preference-handlers.test.ts`

```typescript
describe('preferences:update deep merge', () => {
  it('should merge scan.lookbackMonths into existing preferences', async () => {
    // Mock existing preferences
    const existing = { export: { format: 'pdf' } };
    mockSupabaseService.getPreferences.mockResolvedValue(existing);

    // Call update
    const result = await handlePreferencesUpdate('user-123', {
      scan: { lookbackMonths: 3 }
    });

    // Verify merge result
    expect(mockSupabaseService.syncPreferences).toHaveBeenCalledWith('user-123', {
      export: { format: 'pdf' },
      scan: { lookbackMonths: 3 }
    });
    expect(result.success).toBe(true);
  });
});
```

### Coverage

- Coverage impact: Must not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
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
