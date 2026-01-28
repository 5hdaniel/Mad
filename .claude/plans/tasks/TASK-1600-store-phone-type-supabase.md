# Task TASK-1600: Store Phone Type in Supabase

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

Store phone type selection in Supabase `user_preferences` instead of local SQLite database, eliminating the dependency on DB initialization during the phone-type onboarding step.

## Non-Goals

- Do NOT change the UI design of the phone type selection step
- Do NOT modify the flow step order (that's TASK-1601/1602)
- Do NOT remove local DB storage yet (keep as fallback for offline)
- Do NOT change the state machine structure

## Deliverables

1. Update: `src/appCore/state/flows/usePhoneTypeApi.ts` - Use Supabase for phone type storage
2. Update: `electron/services/authService.ts` - Add Supabase phone type API methods (if needed)
3. Update: `electron/preload/index.ts` - Expose new IPC handlers (if needed)
4. New test: `src/appCore/state/flows/__tests__/usePhoneTypeApi.test.ts` - Test Supabase integration

## Acceptance Criteria

- [ ] Phone type can be saved to Supabase `user_preferences.preferences.phone_type` when DB is not initialized
- [ ] Phone type is read from Supabase on app start (before local DB)
- [ ] Local DB storage continues to work as fallback for offline mode
- [ ] Existing state machine integration is preserved (dispatch ONBOARDING_STEP_COMPLETE)
- [ ] No console errors when saving phone type before DB init
- [ ] All CI checks pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current Architecture

The `usePhoneTypeApi` hook currently:
1. Checks `selectIsDatabaseInitialized(state)` to determine if DB is ready
2. If DB not ready, queues phone type in state and skips DB save
3. If DB ready, calls `window.api.user.setPhoneType(userId, phoneType)`

### New Architecture

Add Supabase as primary storage (available before DB init):

```typescript
// In usePhoneTypeApi.ts - savePhoneType function
const savePhoneType = useCallback(
  async (phoneType: "iphone" | "android"): Promise<boolean> => {
    const currentUserId = state.user?.id;
    if (!currentUserId) return false;

    try {
      // 1. Save to Supabase first (always available after auth)
      const supabaseResult = await window.api.user.setPhoneTypeCloud(
        currentUserId,
        phoneType
      );

      if (!supabaseResult.success) {
        console.error("[usePhoneTypeApi] Failed to save to Supabase:", supabaseResult.error);
        // Continue anyway - will sync later
      }

      // 2. Try local DB if initialized (for offline support)
      const isDbReady = selectIsDatabaseInitialized(state);
      if (isDbReady) {
        await window.api.user.setPhoneType(currentUserId, phoneType);
      }

      // 3. Dispatch step completion
      dispatch({
        type: "ONBOARDING_STEP_COMPLETE",
        step: "phone-type",
        phoneType,
      });

      return true;
    } catch (error) {
      console.error("[usePhoneTypeApi] Error saving phone type:", error);
      return false;
    }
  },
  [state, dispatch]
);
```

### Supabase API Implementation

Add new IPC handler in authService.ts:

```typescript
// In electron/services/authService.ts
export async function setPhoneTypeCloud(
  userId: string,
  phoneType: "iphone" | "android"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          preferences: { phone_type: phoneType },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getPhoneTypeCloud(
  userId: string
): Promise<{ success: boolean; phoneType?: "iphone" | "android"; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    const phoneType = data?.preferences?.phone_type;
    return { success: true, phoneType };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### Key Patterns

1. **Supabase First**: Save to cloud immediately after auth
2. **Local Fallback**: Continue saving to local DB when available
3. **State Machine Source of Truth**: Still dispatch to state machine for UI updates

## Integration Notes

- Imports from: `src/appCore/state/machine/` (selectors), `window.api`
- Exports to: Used by `PhoneTypeStep` component
- Used by: TASK-1601 (macOS flow), TASK-1602 (Windows flow)
- Depends on: None (first task in Phase 1)

## Do / Don't

### Do:
- Use upsert to handle both new and existing user_preferences rows
- Log clear messages for debugging phone type storage
- Preserve existing local DB flow for offline support
- Use TypeScript strict types for phone type values

### Don't:
- Remove local DB storage entirely (needed for offline)
- Change the UI or flow order (separate tasks)
- Add new columns to Supabase (use existing preferences jsonb)
- Block onboarding if Supabase save fails (graceful degradation)

## When to Stop and Ask

- If `user_preferences` table doesn't exist or has different structure than expected
- If Supabase RLS policies prevent upsert
- If the existing `setPhoneType` IPC handler has complex logic that needs coordination
- If you discover phone type is used in unexpected places

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `savePhoneType` calls Supabase API
  - Test `savePhoneType` still works when DB not initialized
  - Test phone type is read from Supabase on load
- Existing tests to update:
  - Any tests mocking `window.api.user.setPhoneType`

### Coverage

- Coverage impact: Should not decrease, adding new test file

### Integration / Feature Tests

- Required scenarios:
  - New user selects iPhone, phone type saved to Supabase
  - New user selects Android, phone type saved to Supabase
  - Returning user's phone type loaded from Supabase

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(onboarding): store phone type in Supabase`
- **Labels**: `onboarding`, `supabase`, `sprint-063`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 test file | +5K |
| Files to modify | 3 files (usePhoneTypeApi, authService, preload) | +10K |
| Code volume | ~100 lines | +5K |
| Test complexity | Medium (mocking Supabase) | +5K |

**Confidence:** Medium

**Risk factors:**
- Supabase RLS policies may need adjustment
- Existing IPC handler structure may vary

**Similar past tasks:** TASK-1161 (license schema) actual ~15K

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
- [ ] src/appCore/state/flows/__tests__/usePhoneTypeApi.test.ts

Files modified:
- [ ] src/appCore/state/flows/usePhoneTypeApi.ts
- [ ] electron/services/authService.ts (if needed)
- [ ] electron/preload/index.ts (if needed)

Features implemented:
- [ ] Supabase phone type storage
- [ ] Supabase phone type retrieval
- [ ] Graceful fallback to local DB

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

**Variance:** PM Est ~17.5K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~17.5K | ~XK | +/-X% |
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

### Pre-Implementation Technical Review

**Review Date:** 2026-01-28
**Reviewer:** SR Engineer

#### Branch Information
- **Branch From:** develop (after SPRINT-062 merges)
- **Branch Into:** develop
- **Suggested Branch Name:** feature/task-1600-phone-type-supabase

#### Execution Classification
- **Parallel Safe:** Yes (no shared files with 1601/1602/1603)
- **Depends On:** None
- **Blocks:** TASK-1601, TASK-1602 (recommended to complete first)

#### Architecture Validation

**APPROVED** - This change aligns with clean architecture goals:
1. Moves cloud-first storage to appropriate layer (Supabase)
2. Keeps local DB as fallback for offline mode (proper separation of concerns)
3. Maintains state machine as source of truth for UI state

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `user_preferences` table structure mismatch | Medium | **VERIFIED**: Table exists with `preferences JSONB` column per `supabase_schema.sql` line 110-114 |
| RLS policy blocks writes | Low | **VERIFIED**: Service role policy allows all operations (line 184-185) |
| Network failure during save | Low | Task correctly specifies graceful degradation - continue if Supabase fails |
| Offline users cannot save | Low | Local DB fallback preserved per spec |

#### Shared File Analysis
- `usePhoneTypeApi.ts` - **Only modified by this task in Phase 1**
- `electron/services/authService.ts` - Adding isolated functions (no conflict risk)
- `electron/preload/index.ts` - Adding new IPC handlers (no conflict risk)
- **No merge conflict risk with other Phase 1 tasks**

#### Technical Considerations

1. **Supabase Table Structure (VERIFIED)**:
   ```sql
   CREATE TABLE IF NOT EXISTS user_preferences (
     user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
   - Use `upsert` with `onConflict: "user_id"` as specified in task

2. **Current usePhoneTypeApi.ts Pattern**:
   - Already handles deferred DB init case (lines 115-128)
   - Already queues phone type in state when DB not ready
   - New code should add Supabase save BEFORE the existing logic

3. **IPC Handler Location**:
   - Pending APIs are in `electron/preload/authBridge.ts`
   - User APIs typically go through userBridge or authBridge
   - Recommend adding `setPhoneTypeCloud` and `getPhoneTypeCloud` to `authBridge.ts`

4. **Existing Phone Type Sync Pattern**:
   - `useSecureStorage.ts` already syncs queued phone type to DB after init (lines 134-150)
   - New Supabase flow should complement, not replace this

#### Do NOT Do (Gotchas)

1. **Do NOT use separate insert/update** - Use `upsert` only
2. **Do NOT change state machine dispatch** - Keep existing `ONBOARDING_STEP_COMPLETE` dispatch
3. **Do NOT require Supabase success to continue** - Graceful degradation is key
4. **Do NOT remove useSecureStorage sync logic** - It syncs to local DB after init

#### Patterns to Follow

```typescript
// Correct: Try Supabase first, then local DB if available
const savePhoneType = async (phoneType) => {
  // 1. Try Supabase (always available after auth)
  const cloudResult = await window.api.auth.setPhoneTypeCloud(userId, phoneType);
  if (!cloudResult.success) {
    console.warn("[usePhoneTypeApi] Supabase save failed, continuing...");
  }

  // 2. Try local DB if initialized
  if (selectIsDatabaseInitialized(state)) {
    await window.api.user.setPhoneType(userId, phoneType);
  }

  // 3. Dispatch state update (always)
  dispatch({ type: "ONBOARDING_STEP_COMPLETE", step: "phone-type", phoneType });
};
```

#### Test Expectations

- Mock `window.api.auth.setPhoneTypeCloud` in tests
- Test success path: Supabase succeeds
- Test graceful degradation: Supabase fails, flow continues
- Test local DB sync when initialized

#### Status: APPROVED FOR IMPLEMENTATION

---

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
