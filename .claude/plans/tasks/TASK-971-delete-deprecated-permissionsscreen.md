# TASK-971: Remove Deprecated PermissionsScreen and Refactor Routing

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-159
**Status:** Ready
**Estimate:** ~25K tokens
**Token Cap:** 80K
**Depends On:** TASK-970

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

- [ ] AppRouter.tsx routing updated (PermissionsScreen replaced or route removed)
- [ ] PermissionsScreen.tsx deleted
- [ ] No TypeScript errors
- [ ] No broken imports
- [ ] Onboarding/permissions tests pass
- [ ] Permissions flow verified to work (manual or test coverage)

## Engineer Metrics

**Agent ID:** _[Record immediately when Task tool returns]_

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 25K) / 25K x 100]_%
