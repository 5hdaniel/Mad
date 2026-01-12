# TASK-1022: Remove Console Statements (High-Priority Files)

**Backlog ID:** BACKLOG-192
**Sprint:** SPRINT-031
**Phase:** 2 (Parallel)
**Branch:** `refactor/task-1022-console-cleanup`
**Estimated Tokens:** ~15K

---

## Objective

Remove or replace console statements in the three files with the most console pollution: `PermissionsStep.tsx` (21), `useAutoRefresh.ts` (13), and `Settings.tsx` (12).

---

## Context

The codebase has 186 console statements total. This task focuses on the worst offenders:
- `src/components/onboarding/steps/PermissionsStep.tsx` - 21 statements
- `src/components/Settings.tsx` - 15 statements (corrected from 12)
- `src/hooks/useAutoRefresh.ts` - 13 statements

Total: 49 statements (~26% of all console statements).

---

## Requirements

### Must Do:
1. Audit each console statement in target files
2. Remove debug/development console.log statements
3. Keep intentional error logging (console.error for actual errors)
4. Ensure no functionality is broken by removals
5. Document any console statements intentionally kept

### Must NOT Do:
- Remove console.error for actual error handling
- Remove statements without understanding their purpose
- Introduce logging library (out of scope)
- Modify business logic

---

## Acceptance Criteria

- [ ] Console statements in target files reduced to <5 total
- [ ] Remaining statements are intentional error logging
- [ ] All existing tests pass
- [ ] App functionality unchanged
- [ ] No new console statements added elsewhere
- [ ] `useAutoRefresh.test.ts` updated if console.error assertions removed

---

## Files to Modify

- `src/components/onboarding/steps/PermissionsStep.tsx` - 21 console statements
- `src/components/Settings.tsx` - 15 console statements
- `src/hooks/useAutoRefresh.ts` - 13 console statements

## Files to Read (for context)

- Each target file - understand what the console statements are logging

---

## Implementation Guide

### Step 1: Audit Each File

For each file, categorize every console statement:

| Category | Action | Example |
|----------|--------|---------|
| Debug output | REMOVE | `console.log('data:', data)` |
| TODO marker | REMOVE or address | `console.log('TODO: implement')` |
| Error logging | KEEP | `console.error('Failed to load:', err)` |
| Development aid | REMOVE | `console.log('entering function')` |
| User info | REVIEW | `console.log('Sync complete')` |

### Step 2: Create Audit Table

Before removing, document in PR description:

```markdown
## Console Statement Audit

### PermissionsStep.tsx
| Line | Statement | Category | Action |
|------|-----------|----------|--------|
| 42 | console.log('permissions:', perms) | Debug | Remove |
| 67 | console.error('Permission denied:', err) | Error | Keep |
...
```

### Step 3: Safe Removal Pattern

```typescript
// BEFORE
async function checkPermissions() {
  console.log('Checking permissions...'); // Debug - REMOVE
  try {
    const result = await api.checkPermissions();
    console.log('Result:', result); // Debug - REMOVE
    return result;
  } catch (err) {
    console.error('Permission check failed:', err); // Error - KEEP
    throw err;
  }
}

// AFTER
async function checkPermissions() {
  try {
    const result = await api.checkPermissions();
    return result;
  } catch (err) {
    console.error('Permission check failed:', err);
    throw err;
  }
}
```

### Step 4: Verification

After removal, verify:
1. `npm test` passes
2. App runs without errors
3. Functionality works as expected (manual test)

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests
- **Existing tests to update:** None expected

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] App builds successfully

### Manual Testing
- [ ] PermissionsStep.tsx - Onboarding permissions flow works
- [ ] useAutoRefresh.ts - Auto-refresh functionality works
- [ ] Settings.tsx - Settings page works

---

## PR Preparation

- **Title:** `refactor: remove debug console statements from high-traffic files`
- **Branch:** `refactor/task-1022-console-cleanup`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] Counted initial console statements

Implementation:
- [ ] Audit table created
- [ ] Removals complete
- [ ] Tests pass locally (npm test)
- [ ] Manual verification complete
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: 46 console statements in target files
- **After**: X statements (Y removed, Z kept)
- **Kept statements rationale**: [document why each was kept]
- **Actual Tokens**: ~XK (Est: 15K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-01-10 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** refactor/task-1022-console-cleanup

### Execution Classification
- **Parallel Safe:** Yes - Phase 2, different files from TASK-1020/1021
- **Depends On:** TASK-1019 (Phase 1 complete)
- **Blocks:** None

### Shared File Analysis
- Files modified: `src/components/onboarding/steps/PermissionsStep.tsx`, `src/components/Settings.tsx`, `src/hooks/useAutoRefresh.ts`
- Conflicts with: None (different files from other Phase 2 tasks)

### Technical Considerations

**IMPORTANT - useAutoRefresh.ts has existing tests:**
File `src/hooks/__tests__/useAutoRefresh.test.ts` exists with 757 lines.
The tests mock console.log and console.error:
```typescript
consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
```

**Test Impact:**
- Tests verify console.error is called on error conditions
- If you remove console.error calls, update tests to NOT expect them
- Example test assertion to update (line 347-350):
```typescript
expect(consoleErrorSpy).toHaveBeenCalledWith(
  "[useAutoRefresh] Email sync error:",
  expect.any(Error)
);
```

**Categorization Guidance:**

| File | Keep | Remove |
|------|------|--------|
| PermissionsStep.tsx | `console.error` for actual errors | Debug logs, flow tracking |
| Settings.tsx | `console.error` for error handlers | State debug, click tracking |
| useAutoRefresh.ts | None (tests mock all) or tagged errors only | All debug logging |

**Recommendation for useAutoRefresh.ts:**
Either:
1. Keep labeled console.error (e.g., `[useAutoRefresh] Error:`) and update tests
2. Remove ALL console statements and update tests to not expect them

Option 2 is cleaner but requires test updates.

---

## Guardrails

**STOP and ask PM if:**
- A console statement seems important but unclear why
- Removing a statement breaks functionality
- Files have significantly more/fewer statements than expected
- You find console statements that log sensitive data
- You encounter blockers not covered in the task file
