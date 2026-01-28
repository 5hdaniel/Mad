# BACKLOG-344: Add Audit Package as Default Export Format Option

**Created**: 2026-01-20
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

The default export format dropdown in settings/preferences is missing "Audit Package" (folder export) as an option. Users should be able to select audit package as their preferred default export format.

## Current Behavior

- Default export format options likely only include PDF and possibly other formats
- Audit Package (folder with organized PDFs + attachments) is not available as a default choice

## Expected Behavior

- "Audit Package" should appear in the default export format dropdown
- When selected, clicking export on a transaction should default to folder export

## Acceptance Criteria

- [ ] Audit Package appears in default format dropdown
- [ ] Selecting it sets folder export as the default
- [ ] Setting persists across app restarts

## Related

- Folder export feature (already implemented)
- Export modal component
