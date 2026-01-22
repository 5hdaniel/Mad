# BACKLOG-306: Hide Phone/Email in Contact Selection Modal

**Status:** Done
**Sprint:** SPRINT-045
**PR:** #472
**Completed:** 2026-01-19

## Summary

In the "Select Contact" / "Link chats to" modal, do not display phone numbers or email addresses for contacts. Only show the contact name.

## Current Behavior

The contact selection modal currently displays:
- Contact name
- Phone number (if available)
- Email address (if available)

## Desired Behavior

The contact selection modal should only display:
- Contact name

## Rationale

- Cleaner UI with less visual clutter
- Phone/email not needed for selection context
- Privacy consideration - less PII displayed

## Affected Components

- `ContactSelectModal.tsx` or similar contact picker component
- Contact list item rendering

## Acceptance Criteria

- [ ] Contact selection modal shows only contact names
- [ ] No phone numbers displayed in the list
- [ ] No email addresses displayed in the list
- [ ] Selection functionality unchanged

## Estimated Effort

~5K tokens (simple UI change)

## Priority

Low - UI polish item

## References

- User request: 2026-01-18
