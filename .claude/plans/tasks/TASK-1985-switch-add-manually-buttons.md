# TASK-1985: Switch positions of Add Manually and View Active Transactions buttons

**Backlog ID:** BACKLOG-693
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1985-swap-buttons`
**Estimated Tokens:** ~5K (ui x 1.0)

---

## Objective

On the "Start New Audit" modal, swap the positions of the "Add Manually" button and "View Active Transactions" button. Currently "View Active Transactions" is on the left and "Add Manually" is on the right. They should be switched so "Add Manually" is on the left and "View Active Transactions" is on the right.

---

## Context

`src/components/StartNewAuditModal.tsx` lines 302-370 render a 2-column grid with:
- Left column (first): "View Active Transactions" button
- Right column (second): "Add Manually" button

The user wants these swapped so "Add Manually" appears first (left) and "View Active Transactions" appears second (right).

---

## Requirements

### Must Do:
1. In `StartNewAuditModal.tsx`, swap the order of the two button blocks within the `grid grid-cols-2 gap-4` container
2. Move the "Add Manually" button block before the "View Active Transactions" button block

### Must NOT Do:
- Change button styles, colors, icons, or text
- Modify button functionality
- Change the grid layout (still 2 columns)
- Alter the AI-detected transactions section above
- Change the LicenseGate wrapping or disabled states

---

## Acceptance Criteria

- [ ] "Add Manually" button appears on the left side of the 2-column grid
- [ ] "View Active Transactions" button appears on the right side
- [ ] Both buttons retain their original styling, icons, and click behavior
- [ ] Transaction limit disabled state still works on "Add Manually"
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/StartNewAuditModal.tsx` - Swap the two `<button>` blocks within the grid (lines ~303-370)

## Files to Read (for context)

- `src/components/StartNewAuditModal.tsx` - Full component

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests
- **Existing tests to update:** `src/components/__tests__/StartNewAuditModal.test.tsx` if it asserts on button order

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(ui): swap Add Manually and View Active Transactions button positions`
- **Branch:** `fix/task-1985-swap-buttons`
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
- **Actual Tokens**: ~XK (Est: 5K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- There are more than 2 buttons in the grid (scope has changed)
- You encounter blockers not covered in the task file
