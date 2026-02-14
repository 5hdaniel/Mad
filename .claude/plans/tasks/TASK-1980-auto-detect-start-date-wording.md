# TASK-1980: Auto-detection start date wording, default, and settings toggle

**Backlog ID:** BACKLOG-688
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1980-start-date-wording`
**Estimated Tokens:** ~15K (ui x 1.0)

---

## Objective

Three changes to the start date auto-detection feature on the new audit address step:
1. Improve the wording to clearly explain it auto-detects the **start representation date**
2. Change the default mode from auto to **manual entry**
3. Add a setting in Settings that lets the user change the default mode

---

## Context

- `src/components/audit/AddressVerificationStep.tsx` has the Auto/Manual toggle (added in TASK-1974)
- Default is currently `startDateMode = "manual"` in the component props, but the parent `useAuditTransaction` hook may set it to `"auto"`
- Auto mode shows: "Detecting from communications..." then "Based on earliest client communication"
- The auto-detection finds the earliest communication date with assigned contacts

Current wording issues:
- "Detecting from communications..." does not explain what is being detected
- "Based on earliest client communication" does not mention "start representation date"
- The "Auto" / "Manual" button labels do not explain what they do
- There is no way to set a default preference in Settings

---

## Requirements

### Must Do:
1. **Wording changes in `AddressVerificationStep.tsx`:**
   - Change "Detecting from communications..." to "Detecting start representation date..."
   - Change "Based on earliest client communication" to "Start representation date based on earliest client communication"
   - Change "Start date will be set after selecting contacts in Step 2" to "Representation start date will be set after selecting contacts in Step 2"
   - Change "No communications found -- using default (60 days ago)" to "No communications found for representation start date -- using default (60 days ago)"
   - Add tooltip or helper text to the Auto/Manual toggle: "Auto: detect from earliest communication. Manual: enter date yourself"

2. **Default to manual mode:**
   - In `useAuditTransaction` hook (or wherever `startDateMode` is initialized), default to `"manual"` instead of `"auto"`
   - If a user preference exists (see #3), use that instead

3. **Settings toggle for default mode:**
   - Add a new preference `audit.startDateDefault` with values `"auto"` | `"manual"`
   - Add a small toggle in Settings (near the existing audit-related settings) that lets user choose default
   - Label: "Start Date Mode" with description "Choose the default mode for representation start date when creating new audits"
   - Read this preference when initializing a new audit to set the default mode

### Must NOT Do:
- Change the actual auto-detection logic (it works correctly)
- Modify how the date is calculated or stored
- Change the Auto/Manual toggle button styling (just wording improvements)
- Remove the ability to switch between auto and manual during audit creation

---

## Acceptance Criteria

- [ ] All auto-detection text references "start representation date" or "representation start date"
- [ ] Default mode when creating a new audit is "manual" (unless overridden by settings)
- [ ] Settings has a toggle for "Start Date Mode" with Auto/Manual options
- [ ] Changing the Settings toggle persists and affects the next new audit
- [ ] Auto mode still works correctly when selected manually during audit creation
- [ ] Manual mode shows date input as before
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/audit/AddressVerificationStep.tsx` - Update wording strings
- `src/hooks/useAuditTransaction.ts` - Read preference for default mode, default to "manual"
- `src/components/Settings.tsx` - Add start date default mode toggle
- `src/services/settingsService.ts` - Add `audit.startDateDefault` to `UserPreferences` type

## Files to Read (for context)

- `src/components/audit/AddressVerificationStep.tsx` - Full component with current wording
- `src/hooks/useAuditTransaction.ts` - Where startDateMode is initialized
- `src/components/Settings.tsx` - Current settings layout
- `src/services/settingsService.ts` - Preferences types

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests required, but update existing tests if they assert on the old wording strings
- **Existing tests to update:** `src/components/audit/__tests__/AddressVerificationStep.test.tsx` if it checks text content

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(audit): improve auto-detect start date wording and add settings default`
- **Branch:** `fix/task-1980-start-date-wording`
- **Branch From:** `sprint/082-ui-stabilization`
- **Target:** `sprint/082-ui-stabilization`

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

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
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

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-02-13 | **Status:** APPROVED

### Branch Information (PM Updated for Sprint Branch)
- **Branch From:** `sprint/082-ui-stabilization`
- **Branch Into:** `sprint/082-ui-stabilization`
- **Branch Name:** `fix/task-1980-start-date-wording`

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `AddressVerificationStep.tsx`, `useAuditTransaction.ts`, `Settings.tsx`, `settingsService.ts`
- Conflicts with: None -- all 4 files are exclusive to this task

### Technical Considerations
- Verify `UserPreferences` is a JSON blob (not a DB column) before adding `audit.startDateDefault`
- If `Settings.tsx` is already large, the new toggle should be minimal (2-3 lines in the existing settings layout, not a new section)
- The `useAuditTransaction.ts` change to read preference should use the existing preference-reading pattern already in the hook

---

## Guardrails

**STOP and ask PM if:**
- The `UserPreferences` type requires schema migration to add new fields
- The Settings component is too large and needs extraction before adding more toggles
- Existing tests heavily depend on the old wording strings
- You encounter blockers not covered in the task file
