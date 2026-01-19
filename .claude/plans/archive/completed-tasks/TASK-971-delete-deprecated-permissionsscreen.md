# TASK-971: Remove Deprecated PermissionsScreen and Refactor Routing

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-159
**Status:** Complete
**Estimate:** ~25K tokens
**Token Cap:** 80K
**Depends On:** TASK-970
**PR:** #322 (merged 2026-01-05)

---

## Context

`PermissionsScreen.tsx` (873 lines) is marked `@deprecated` but still exists. The replacement `PermissionsStep.tsx` is already in use.

**CRITICAL:** This is NOT a simple file deletion. PermissionsScreen is actively imported and used in:
- `src/appCore/AppRouter.tsx:11` - import statement
- `src/appCore/AppRouter.tsx:142` - rendered when `currentStep === "permissions" && isMacOS`

The routing logic must be updated to use the new component before deletion.

## Current Routing (AppRouter.tsx lines 139-147)

```typescript
// Permissions (macOS only)
if (currentStep === "permissions" && isMacOS) {
  return (
    <PermissionsScreen
      onPermissionsGranted={handlePermissionsGranted}
      onCheckAgain={checkPermissions}
    />
  );
}
```

## Deliverables

1. **Analyze PermissionsStep.tsx** - Understand its API and ensure it can handle the same callbacks
2. **Check USE_NEW_ONBOARDING flag** - Determine if this flag already controls routing
3. **Update AppRouter.tsx routing** - Replace PermissionsScreen with PermissionsStep (or remove the route if USE_NEW_ONBOARDING handles it)
4. **Remove import** - Delete the import statement from AppRouter.tsx
5. **Delete file** - Remove `src/components/PermissionsScreen.tsx`
6. **Type check** - Ensure no TypeScript errors
7. **Test** - Verify permissions flow works on macOS

## Files

- `src/appCore/AppRouter.tsx` - MODIFY (remove import, update/remove routing logic)
- `src/components/PermissionsScreen.tsx` - DELETE (873 lines)

## Branch

```bash
git checkout -b fix/TASK-971-delete-permissionsscreen develop
```

## Verification Commands

```bash
# Find all references (should be only AppRouter before changes)
grep -r "PermissionsScreen" src/

# Check the new onboarding flag usage
grep -r "USE_NEW_ONBOARDING" src/

# Understand PermissionsStep API
grep -A5 "interface.*Props" src/components/onboarding/steps/PermissionsStep.tsx

# Type check after changes
npm run type-check

# Test onboarding and permissions
npm test -- --testPathPattern="onboarding|permission"
```

## Acceptance Criteria

- [x] AppRouter.tsx routing updated (PermissionsScreen replaced or route removed)
- [x] PermissionsScreen.tsx deleted
- [x] No TypeScript errors
- [x] No broken imports
- [x] Onboarding/permissions tests pass
- [x] Permissions flow verified to work (manual or test coverage)

## Engineer Metrics

**Agent ID:** aef568e

| Metric | Value |
|--------|-------|
| Total Tokens | ~25K |
| Duration | ~120 seconds |
| API Calls | ~15 |

**Variance:** 0% (on target)

---

## Implementation Summary

### Analysis Performed
- Verified `USE_NEW_ONBOARDING = true` in `routeConfig.ts`
- Confirmed `"permissions"` is included in `ONBOARDING_STEPS` array
- Identified that early return in AppRouter.tsx (line 54-57) handles all onboarding steps via `OnboardingFlow`
- Concluded the old routing block (lines 139-147) was dead code

### Changes Made
1. Removed `PermissionsScreen` import from `AppRouter.tsx`
2. Removed dead routing block (permissions step is already handled by OnboardingFlow)
3. Deleted `src/components/PermissionsScreen.tsx` (873 lines)

### Verification
- 124 onboarding/permission tests pass
- Type-check passes
- Lint passes
- No remaining references to PermissionsScreen in source code

---

## SR Engineer Review

**Review Date:** 2026-01-05
**SR Engineer Agent ID:** 011CUStmvmVNXPNe4oF321jJ
**Status:** APPROVED

### Checklist

**BLOCKING - Verify before reviewing code:**
- [x] Engineer Agent ID is present (aef568e)
- [x] Metrics table has actual values
- [x] Variance is calculated (0%)
- [x] Implementation Summary complete

**Code Review:**
- [x] CI passes (all checks successful)
- [x] Code quality acceptable
- [x] Architecture compliance verified
- [x] No security concerns

**File Lifecycle Check (Refactor PR):**
- [x] Orphan Check: PermissionsScreen.tsx properly deleted
- [x] Import Check: Import removed from AppRouter.tsx
- [x] Test Check: No orphaned tests
- [x] Export Check: No dangling barrel exports

### Review Notes

The engineer correctly identified that the routing block was dead code because:
1. `USE_NEW_ONBOARDING = true` (verified in `routeConfig.ts:15`)
2. `"permissions"` is in `ONBOARDING_STEPS` (verified in `routeConfig.ts:20-27`)
3. The early return at line 54-56 in AppRouter.tsx catches all onboarding steps including "permissions"

The replacement `PermissionsStep.tsx` exists at `src/components/onboarding/steps/PermissionsStep.tsx` and is used by `OnboardingFlow`.

Clean refactoring with proper dead code removal. No architectural concerns.
