# TASK-2096: Add Notification Permission Step to Joyride Tour

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

**Backlog ID:** BACKLOG-822
**Sprint:** SPRINT-106
**Branch:** `feature/task-2096-notification-joyride-step`
**Estimated Tokens:** ~30K

---

## Objective

Add a step to the dashboard joyride tour that triggers a test notification (causing macOS to show the notification permission prompt) and guides the user through enabling notifications via the 4-step hover > Options > Allow flow.

---

## Context

When Keepr first launches, macOS shows a notification permission prompt that users often dismiss. Without notifications enabled, users miss important alerts like sync completion. The joyride tour already mentions notifications in the sync-status step ("Enable notifications in Settings to be alerted when syncing finishes") -- this new step follows that by actually triggering the permission prompt and guiding the user through enabling it.

Reference screenshots are in `docs/` folder:
- `1.Notifications.png` -- Initial notification banner
- `2.onHover.png` -- Hover reveals "Options" button
- `3.dropDownOpen.png` -- Dropdown open with Allow/Don't Allow
- `4.Allow selected .png` -- "Allow" highlighted

---

## Requirements

### Must Do:
1. Add a new joyride step in `src/config/tourSteps.ts` after the sync-status step
2. When this step activates, trigger a test notification via IPC to Electron's `Notification` API
3. The tour tooltip should explain the 4-step process: notice banner > hover to reveal Options > click Options > select Allow
4. If notifications are already enabled, skip this step entirely (check via Electron's `systemPreferences` or `Notification.permission`)
5. Add an IPC handler to trigger the test notification if one does not already exist
6. Consider adding a "Send Test Notification" button in the tooltip as fallback

### Must NOT Do:
- Do NOT modify the existing joyride tour steps (only add a new one)
- Do NOT change the Electron notification system or preferences storage
- Do NOT add this step on Windows (Windows handles notification permissions differently)

---

## Acceptance Criteria

- [ ] New joyride step appears after the sync-status step on macOS
- [ ] A test notification is triggered when the step activates
- [ ] The tooltip clearly explains the 4-step allow process
- [ ] If notifications are already enabled, the step is skipped
- [ ] The step works correctly on macOS
- [ ] Windows tour is unaffected (step not shown)
- [ ] All existing tests pass
- [ ] All CI checks pass

---

## Files to Modify

- `src/config/tourSteps.ts` -- Add notification permission step to `getDashboardTourSteps()`
- `electron/handlers/` -- Add IPC handler to trigger a test notification (if not already present)
- `src/window.d.ts` -- Add type for the new IPC channel (if needed)
- `electron/preload/` -- Expose new IPC channel (if needed)

## Files to Read (for context)

- `src/config/tourSteps.ts` -- Existing tour steps structure
- `docs/1.Notifications.png` through `docs/4.Allow selected .png` -- Reference screenshots
- Electron notification API docs

---

## Testing Expectations

### Unit Tests
- **Required:** Yes, for the new tour step logic (skip when already enabled)
- **New tests to write:** Test that the notification step is included/excluded based on permission status
- **Existing tests to update:** Any test that asserts on the exact number or order of tour steps

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(ui): add notification permission step to joyride tour`
- **Branch:** `feature/task-2096-notification-joyride-step`
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
- [ ] src/config/tourSteps.ts
- [ ] electron/handlers/ (notification trigger)
- [ ] src/window.d.ts (if needed)
- [ ] electron/preload/ (if needed)

Features implemented:
- [ ] New joyride tour step for notification permission
- [ ] Test notification trigger via IPC
- [ ] Skip logic when notifications already enabled
- [ ] macOS-only (not shown on Windows)

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

**Variance:** PM Est ~30K vs Actual ~XK

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
- The joyride library (react-joyride) does not support conditional step skipping at runtime
- Triggering a notification from the renderer process requires a new IPC pattern not currently used
- The test notification causes the macOS permission prompt to appear at the wrong time (before the tooltip is shown)
- You encounter blockers not covered in the task file
