# BACKLOG-540: Settings modal needs Save button when changes made

**Type:** Enhancement
**Priority:** P3 (UX improvement)
**Status:** Pending
**Sprint:** SPRINT-062 (deferred)
**Created:** 2026-01-27
**Related:** BACKLOG-539, BACKLOG-541 (Settings bundle)

---

## Problem Statement

The Settings modal currently shows only a "Done" button to close the modal. When a user makes changes to settings, there is no visual indication that:
1. Changes have been made
2. Changes will be saved when clicking Done

This is a UX anti-pattern that can cause confusion about whether changes are saved or lost.

## Proposed Solution

**Option A (Recommended): Dynamic button text**
- Show "Done" when no changes have been made
- Show "Save" (or "Save & Close") when settings have been modified
- Optionally add a visual indicator (e.g., asterisk, dot) when unsaved changes exist

**Option B: Explicit Save + Cancel**
- Replace single "Done" button with "Save" and "Cancel" buttons
- Save applies changes, Cancel discards changes
- More explicit but adds an extra click for users who just want to close

**Option C: Auto-save with confirmation**
- Auto-save settings on change
- Show brief toast/notification confirming save
- "Done" simply closes the modal

## Acceptance Criteria

- [ ] User can clearly tell when they have unsaved changes
- [ ] User understands their changes will be saved before closing
- [ ] Consistent with app's existing UX patterns for modals

## Technical Notes

This enhancement is part of a Settings bundle:
- BACKLOG-539: Lookback Period not persistent
- BACKLOG-540: Add Save button to Settings modal (this)
- BACKLOG-541: Default lookback period should be 3 months

**Recommendation:** Implement alongside BACKLOG-539 fix since both involve Settings modal save behavior.

## Effort Estimate

~10K tokens (UI change + state tracking for dirty form)

---

## Discovery Context

Found during SPRINT-062 testing. This is a UX enhancement that improves clarity but is not blocking functionality. Deferred as P3.
