# TASK-2095: Remove Accessibility Permission, Redesign Onboarding Permissions Screen

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

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

**Backlog ID:** BACKLOG-821
**Sprint:** SPRINT-106
**Branch:** `fix/task-2095-remove-accessibility-permission`
**Estimated Tokens:** ~40K

---

## Objective

Remove the Accessibility permission requirement from onboarding and replace the multi-step permissions wizard with a single-screen layout. The app currently uses AppleScript to navigate System Settings (requiring Accessibility permission), but this is unnecessary -- the app can open System Settings directly via URL scheme. Also, redesign the permissions onboarding step to show all required permissions on one screen so users can go back and forth between System Settings and the app.

---

## Context

During onboarding, the app:
1. Requests Accessibility permission to run AppleScript that clicks through System Settings menus
2. Uses this to navigate to Privacy & Security > Full Disk Access
3. Falls back to URL scheme if Accessibility is denied

The Accessibility permission is confusing because:
- It does not actually help grant Full Disk Access
- Users see an unexpected permission prompt
- The fallback (URL scheme) works just as well

The permissions step should be redesigned as a single screen showing:
- What permissions are needed (Full Disk Access is the only required one)
- A "Open System Settings" button
- A checklist of steps with auto-detection updating as permissions are granted
- Users keep the app side-by-side with Settings and see progress update live

---

## Requirements

### Must Do:
1. Remove AppleScript UI automation from `electron/handlers/permissionHandlers.ts` (lines ~208-244)
2. Remove `runAppleScript()` from `electron/services/macOSPermissionHelper.ts` if no longer used elsewhere
3. Replace the current wizard-style permissions step with a single-screen layout in `src/components/onboarding/steps/PermissionsStep.tsx`
4. Use `shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")` as the primary (only) method to open System Settings
5. Show all permission steps on one screen with a checklist
6. Auto-detect permission grants and update the checklist in real-time
7. Remove Accessibility references from `src/components/onboarding/flows/macosFlow.ts` if it is a separate step

### Must NOT Do:
- Do NOT remove the Full Disk Access permission check -- that is still required
- Do NOT change the Windows onboarding flow
- Do NOT change how FDA status is detected (the existing detection logic stays)
- Do NOT remove the permission checking IPC handlers -- only the AppleScript automation

---

## Acceptance Criteria

- [ ] Accessibility permission is no longer requested during onboarding
- [ ] AppleScript UI automation code is removed from permissionHandlers.ts
- [ ] Permissions step is a single screen (not a multi-step wizard with Next button)
- [ ] "Open System Settings" button opens the FDA panel directly via URL scheme
- [ ] Checklist shows permission status with auto-detection
- [ ] Full Disk Access detection still works correctly
- [ ] No regression on macOS onboarding flow
- [ ] Windows onboarding flow is unaffected
- [ ] All existing tests pass
- [ ] All CI checks pass

---

## Files to Modify

- `electron/handlers/permissionHandlers.ts` -- Remove AppleScript automation (~lines 208-244)
- `electron/services/macOSPermissionHelper.ts` -- Remove `runAppleScript()` if unused elsewhere
- `src/components/onboarding/steps/PermissionsStep.tsx` -- Redesign to single-screen layout with checklist
- `src/components/onboarding/flows/macosFlow.ts` -- Remove Accessibility as a separate step if applicable

## Files to Read (for context)

- `electron/handlers/permissionHandlers.ts` -- Current AppleScript logic
- `electron/services/macOSPermissionHelper.ts` -- Current helper
- `src/components/onboarding/steps/PermissionsStep.tsx` -- Current UI
- `src/components/onboarding/flows/macosFlow.ts` -- Current flow definition

---

## Testing Expectations

### Unit Tests
- **Required:** Update existing permission handler tests to remove AppleScript assertions
- **New tests to write:** Test that the new permissions screen renders correctly with various permission states (granted, not granted)
- **Existing tests to update:** Any tests referencing Accessibility permission or AppleScript

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(onboarding): remove Accessibility permission, redesign permissions to single screen`
- **Branch:** `fix/task-2095-remove-accessibility-permission`
- **Target:** `develop`

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
Files modified:
- [ ] electron/handlers/permissionHandlers.ts
- [ ] electron/services/macOSPermissionHelper.ts
- [ ] src/components/onboarding/steps/PermissionsStep.tsx
- [ ] src/components/onboarding/flows/macosFlow.ts

Features implemented:
- [ ] Removed AppleScript UI automation
- [ ] Removed Accessibility permission requirement
- [ ] Single-screen permissions layout with checklist
- [ ] Auto-detection of permission grants
- [ ] Direct URL scheme for opening System Settings

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~40K vs Actual ~XK

### Notes

**Deviations from plan:**
<If you deviated, explain what and why>

**Issues encountered:**
<Document any challenges>

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
**Merge Commit:** <hash>
**Merged To:** develop

---

## Guardrails

**STOP and ask PM if:**
- `runAppleScript()` is used by other handlers besides the Accessibility automation
- The permissions step has shared state with other onboarding steps that would break
- The URL scheme `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles` does not work on the target macOS versions
- The auto-detection polling pattern significantly increases CPU usage
- You encounter blockers not covered in the task file
