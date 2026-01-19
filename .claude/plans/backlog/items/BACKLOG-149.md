# BACKLOG-149: Delete Deprecated EmailOnboardingScreen.tsx

## Priority: Medium

## Category: refactor

## Summary

Delete the deprecated `EmailOnboardingScreen.tsx` (1,203 lines) after verifying migration to `onboarding/steps/EmailConnectStep.tsx` is complete.

## Problem

The file `src/components/EmailOnboardingScreen.tsx` is marked as DEPRECATED in its header:

```typescript
/**
 * @deprecated Use `onboarding/steps/EmailConnectStep.tsx` instead.
 *
 * Migration guide:
 * 1. New step file has `meta` object with configuration
 * 2. Content component receives `onAction` callback
 * 3. Layout/navigation handled by OnboardingShell
 *
 * This file will be removed after migration is complete.
 */
```

The file at 1,203 lines is still in the codebase despite being deprecated. Dead code:
- Increases bundle size
- Causes confusion for developers
- May have stale dependencies
- Adds maintenance burden

## Solution

1. Verify migration is complete by checking all usages
2. Confirm `EmailConnectStep.tsx` has full feature parity
3. Delete the deprecated file
4. Remove any orphaned imports/references

## Implementation Steps

### Step 1: Verify Migration (~30 min)
1. Search for imports of `EmailOnboardingScreen`
2. Check routing configuration
3. Compare functionality with `EmailConnectStep.tsx`
4. Document any missing features

### Step 2: Clean Deletion (~15 min)
1. Delete `src/components/EmailOnboardingScreen.tsx`
2. Remove from any barrel exports
3. Update any stale imports (should fail to compile if missed)

### Step 3: Verification (~15 min)
1. `npm run type-check` passes
2. `npm run lint` passes
3. `npm test` passes
4. Manual test of email onboarding flow

## Acceptance Criteria

- [ ] All usages of `EmailOnboardingScreen` identified and migrated
- [ ] `EmailOnboardingScreen.tsx` deleted
- [ ] No orphaned imports remain
- [ ] Email onboarding flow works correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Bundle size reduced

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Tokens | ~15K | Mostly verification, simple deletion |
| Duration | ~1 hour | |

## Dependencies

- Migration to `EmailConnectStep.tsx` must be complete
- If migration is NOT complete, this becomes a larger task to complete migration first

## Risks

| Risk | Mitigation |
|------|------------|
| Migration incomplete | Thorough usage search before deletion |
| Missing features in new component | Feature parity checklist |
| Breaking onboarding for users | Manual testing of full flow |

## Notes

**This item is SR Engineer sourced from architecture review (2026-01-04).**

If the migration is found to be incomplete, this task should be:
1. Re-scoped to include completing the migration, OR
2. Deferred until migration is complete, OR
3. Split: TASK-A (complete migration) + TASK-B (delete old file)

The 1,203 lines in the deprecated file represent significant dead code. Deletion will improve codebase clarity and reduce bundle size.
