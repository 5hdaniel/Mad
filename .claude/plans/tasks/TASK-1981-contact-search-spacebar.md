# TASK-1981: Fix space bar in contact search input

**Backlog ID:** BACKLOG-689
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1981-contact-search-spacebar`
**Estimated Tokens:** ~5K (ui x 1.0)

---

## Objective

Fix the contact search input in the new transaction audit flow so that pressing the space bar types a space character instead of being intercepted by the keyboard navigation handler.

---

## Context

`src/components/shared/ContactSearchList.tsx` has a `handleKeyDown` function (line 387) that handles keyboard navigation. The switch statement (line 389) includes a case for `" "` (space) at line 400:

```typescript
case " ":
case "Enter":
  e.preventDefault();
  if (focusedIndex >= 0 && focusedIndex < combinedContacts.length) {
    handleRowSelect(combinedContacts[focusedIndex]);
  }
  break;
```

This `onKeyDown={handleKeyDown}` is attached to the search `<input>` element (line 438). When the user presses space in the search input, `e.preventDefault()` prevents the space character from being typed, making it impossible to search for contacts with spaces in their names (e.g., "John Smith").

The phone number resolution works (user confirmed the software resolves phone numbers to names in the text tab), so the underlying contact data is correct -- it is purely a UI input issue.

---

## Requirements

### Must Do:
1. In `ContactSearchList.tsx`, modify the `handleKeyDown` function so that the space key (`" "`) does NOT call `e.preventDefault()` when the search input is focused
2. The space key should still work for selecting contacts when navigating the list (i.e., when `focusedIndex >= 0` AND the search input is NOT the active element, or better: remove space from the handler entirely and let Enter handle selection)
3. Simplest fix: remove the `case " ":` line entirely from the switch statement. Users can still select contacts with Enter or by clicking.

### Must NOT Do:
- Change the search filtering logic (`matchesSearch` function)
- Modify the Enter key behavior (should still select focused contact)
- Change the ArrowUp/ArrowDown navigation
- Alter how contacts are displayed in the list

---

## Acceptance Criteria

- [ ] User can type spaces in the contact search input (e.g., "John Smith")
- [ ] Search correctly filters contacts by names containing spaces
- [ ] Enter key still selects the focused contact in the list
- [ ] Arrow keys still navigate the contact list
- [ ] Escape key still clears search and resets focus
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (including `ContactSearchList.test.tsx`)

---

## Files to Modify

- `src/components/shared/ContactSearchList.tsx` - Remove `case " ":` from the `handleKeyDown` switch statement (line 400)

## Files to Read (for context)

- `src/components/shared/ContactSearchList.tsx` - Full component, especially lines 386-416 (keyboard handler) and 433-443 (input element)
- `src/components/shared/ContactSearchList.test.tsx` - Existing tests

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests, but verify existing keyboard tests pass
- **Existing tests to update:** `src/components/shared/ContactSearchList.test.tsx` if any test relies on space key selecting a contact

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(contacts): allow space bar in contact search input`
- **Branch:** `fix/task-1981-contact-search-spacebar`
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
- Other components share the same keyboard handler pattern and may have the same bug
- Removing the space case breaks an accessibility requirement
- You encounter blockers not covered in the task file
