# BACKLOG-183: Mixed UI During Import - Instructions Showing With Progress

## Status: Completed (SPRINT-027)

## Summary

During message/contact import, the PermissionsStep was showing both the permission instructions AND the import progress bars simultaneously, creating a confusing mixed UI state.

## Root Cause

The PermissionsStep component was rendering both views at the same time because there was no early return when the import view should be shown. The import progress section was being rendered alongside the instruction steps instead of replacing them.

## Solution

Created a dedicated import view that shows ONLY when importing or when import has results. Added an early return pattern so that when the import state is active, the component immediately returns the import-only view without rendering any of the instruction steps.

## Files Changed

- `src/components/onboarding/steps/PermissionsStep.tsx` - Added early return for dedicated import view

## Impact

- **Severity**: Medium - Confusing UX but not blocking
- **User Impact**: Users saw overlapping instructions while import was running
- **Discovery**: User testing during SPRINT-027

## Category

`fix`

## Priority

Medium

## Sprint

SPRINT-027 (Messages & Contacts Polish)

## PR/Commit

Direct commit to `fix/messages-display-issues` branch

## Estimated Tokens

~5K

## Related Items

- Part of permissions step improvements in SPRINT-027
- Related to BACKLOG-184 (import stuck at 100%)
