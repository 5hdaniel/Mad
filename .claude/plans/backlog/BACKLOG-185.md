# BACKLOG-185: Import Stuck at 100% on Progress Bar

## Status: Completed (SPRINT-027)

## Summary

After both messages and contacts finished importing, the progress bar would stay stuck at 100% indefinitely, preventing users from continuing to the next step.

## Root Cause

The code was using `Promise.all` to wait for both messages AND contacts to complete before proceeding to the next step. Since contact import can take significantly longer (especially with 5000+ contacts), users were stuck waiting even after messages were done.

## Solution

Changed the import logic to only wait for messages import to complete before allowing the user to proceed. Contacts continue importing in the background. The UI shows separate progress for each import type, and users can continue once messages are done.

## Files Changed

- `src/components/onboarding/steps/PermissionsStep.tsx` - Changed `Promise.all` to only wait for messages import

## Impact

- **Severity**: Medium - UX issue causing user confusion
- **User Impact**: Users thought the app was frozen
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

~3K

## Related Items

- Part of permissions step improvements in SPRINT-027
- Related to BACKLOG-183 (mixed UI during import)
- Related to dual progress bars improvement (unplanned work in sprint)
