# TASK-2312: Support Widget Visible on All Screens

**Backlog ID:** BACKLOG-1341
**Sprint:** SPRINT-O
**Branch:** `fix/task-2312-support-widget-all-screens`
**Branch From:** `int/identity-provisioning`
**Branch Into:** `int/identity-provisioning`
**Estimated Tokens:** ~15K

---

## Objective

Move the SupportWidget component from individual page components to the AppShell or a layout wrapper so the (?) help/support icon renders on every screen, not just Dashboard and Log.

---

## Context

- The (?) support widget currently only appears on Dashboard and Log screens
- It is missing from Transactions, Transaction Details, Settings, and other screens
- This suggests the widget is rendered inside specific page components instead of at the app shell level
- The widget should be globally available on all authenticated screens

**Related:** BACKLOG-1306 (similar item, may be a duplicate) -- TASK-2282 exists for that item. This task (BACKLOG-1341) is the one assigned to this sprint.

---

## Requirements

### Must Do:
1. Find where `SupportWidget` is currently rendered (likely inside Dashboard and Log page components)
2. Remove those per-page renderings
3. Add `SupportWidget` to `AppShell.tsx` or equivalent layout wrapper so it renders on ALL authenticated screens
4. Ensure the widget does not appear on unauthenticated screens (login, error, onboarding) unless already intended
5. Check AppShell line budget (target: 150, trigger: >200 lines)

### Must NOT Do:
- Do not change the widget's appearance or behavior -- only its rendering location
- Do not add the widget to unauthenticated/error screens unless explicitly requested
- Do not exceed the AppShell.tsx line budget trigger (>200 lines) -- extract if needed

---

## Acceptance Criteria

- [ ] SupportWidget (?) icon visible on Dashboard
- [ ] SupportWidget (?) icon visible on Log screen
- [ ] SupportWidget (?) icon visible on Transactions list
- [ ] SupportWidget (?) icon visible on Transaction Detail
- [ ] SupportWidget (?) icon visible on Settings
- [ ] SupportWidget NOT rendered on login/onboarding screens (unless already was)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] AppShell.tsx stays within line budget (target 150, trigger >200)

---

## Files to Modify

- `src/components/AppShell.tsx` -- Add SupportWidget rendering here
- `src/pages/Dashboard.tsx` (or equivalent) -- Remove SupportWidget from here
- `src/pages/Log.tsx` (or equivalent) -- Remove SupportWidget from here
- Other pages that may have it -- Remove duplicates

## Files to Read (for context)

- `src/components/SupportWidget.tsx` (or similar) -- Understand the component's props and behavior
- `src/components/AppShell.tsx` -- Current layout structure
- `src/components/AppRouter.tsx` -- Routing structure to understand which screens are authenticated

---

## Testing Expectations

### Unit Tests
- **Required:** No new unit tests needed (UI placement change)
- **Existing tests to update:** Update any tests that assert SupportWidget presence in specific pages

### Manual Testing
- Navigate to every screen in the app and verify the (?) icon is present
- Verify clicking the widget still works (opens support dialog/link)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## PR Preparation

- **Title:** `fix: render support widget on all authenticated screens (BACKLOG-1341)`
- **Branch:** `fix/task-2312-support-widget-all-screens`
- **Target:** `int/identity-provisioning`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/identity-provisioning
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

- **Before**: SupportWidget only on Dashboard and Log
- **After**: SupportWidget on all authenticated screens
- **Actual Tokens**: ~XK (Est: 15K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- SupportWidget has complex props that differ per page (not a simple move)
- AppShell.tsx would exceed 200 lines after the change
- The widget is conditionally rendered based on user state that varies by page
- You encounter blockers not covered in the task file
