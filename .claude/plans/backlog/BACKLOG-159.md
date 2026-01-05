# BACKLOG-159: Delete Deprecated PermissionsScreen Component

## Summary

`PermissionsScreen.tsx` (873 lines) is marked as deprecated but still exists in the codebase. It should be deleted after verifying the replacement is complete.

## Problem

The file header says:
```typescript
/**
 * @deprecated Use `onboarding/steps/PermissionsStep.tsx` instead.
 * This file will be removed after migration is complete.
 */
```

However, the file was never deleted, adding 873 lines of dead/duplicate code.

## Verification Steps

1. Confirm `PermissionsStep.tsx` handles all use cases
2. Search for any remaining imports of `PermissionsScreen`
3. Check route definitions for references
4. Verify onboarding flow works without it

## Files

- `src/components/PermissionsScreen.tsx` - DELETE
- Any files importing it - UPDATE

## Acceptance Criteria

- [ ] PermissionsScreen.tsx deleted
- [ ] No broken imports
- [ ] Onboarding permissions flow still works
- [ ] No TypeScript errors

## Priority

**MEDIUM** - Dead code removal, quick win

## Estimate

~10K tokens

## Category

refactor/cleanup
