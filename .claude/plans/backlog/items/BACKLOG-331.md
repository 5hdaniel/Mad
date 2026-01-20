# BACKLOG-331: Transaction Details Modal Responsive Size

## Type
UI / UX Polish

## Priority
Low

## Status
In Progress

**Sprint:** SPRINT-046
**Task:** TASK-1140

## Summary

When switching between tabs on the Transaction Details modal, the popup size changes based on content within each tab. This causes jarring layout shifts.

## Current Behavior

1. User opens Transaction Details modal
2. User switches between tabs (Details, Contacts, Messages, Emails, etc.)
3. Modal height/width changes based on content in each tab
4. This causes jarring visual jump as modal resizes

## Expected Behavior

- Modal should have a fixed/responsive size based on viewport
- Content should scroll within the fixed container
- No size jumping when switching tabs
- Consistent modal dimensions regardless of tab content

## Similar Implementation

**BACKLOG-315 / TASK-1130** - Contact modal fixed size
- Same pattern: fixed outer container, scrollable inner content
- Can reference that implementation for consistency

## Affected Files

- `src/components/transactionDetailsModule/` - TransactionDetails modal/container
- Likely needs CSS changes to:
  - Set fixed/max modal dimensions
  - Make content area scrollable
  - Ensure consistent size across all tabs

## Acceptance Criteria

- [ ] Modal maintains consistent size when switching tabs
- [ ] Content scrolls within the fixed container
- [ ] No visible layout shift during tab changes
- [ ] Modal remains usable on various screen sizes (responsive)
- [ ] Scrollbars appear only when content exceeds container height

## Technical Notes

This is a CSS-focused fix similar to TASK-1130 for the Contact modal. The approach should be:
1. Set fixed dimensions (or max dimensions) on the modal container
2. Set the content area to overflow: auto
3. Ensure all tabs render within the same container constraints

## Estimated Effort

~5K tokens (CSS fix similar to TASK-1130)

## Discovered During

User testing - 2026-01-19
