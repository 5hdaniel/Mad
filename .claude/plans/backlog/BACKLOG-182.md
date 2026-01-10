# BACKLOG-182: getCurrentUser() Returns False After Login

## Status: Completed (SPRINT-027)

## Summary

After user logs in via OAuth, `getCurrentUser()` returns `false` instead of the authenticated user, causing the permissions step to fail when trying to import messages/contacts.

## Root Cause

Session-only OAuth design stores sessions in the database only, but `getCurrentUser()` looks for file-based session tokens. Since sessions are now database-only (for security), the file-based lookup always returns false.

## Solution

Pass `userId` through the onboarding context from `app.currentUser.id` instead of calling `getCurrentUser()` at the component level. This ensures the user ID is available when needed for imports.

## Files Changed

- `src/components/onboarding/types/context.ts` - Added `userId` to `OnboardingContextValue`
- `src/components/onboarding/hooks/useOnboardingFlow.ts` - Pass `userId` from `app.currentUser.id`
- `src/components/onboarding/OnboardingFlow.tsx` - Include `userId` in context provider
- `src/components/onboarding/steps/PermissionsStep.tsx` - Use `userId` from context instead of `getCurrentUser()`

## Impact

- **Severity**: High - Blocked all imports during onboarding
- **User Impact**: Users could not import messages or contacts after login
- **Discovery**: User testing during SPRINT-027

## Category

`fix`

## Priority

High

## Sprint

SPRINT-027 (Messages & Contacts Polish)

## PR/Commit

Direct commit to `fix/messages-display-issues` branch

## Estimated Tokens

~8K

## Related Items

- Part of permissions step improvements in SPRINT-027
