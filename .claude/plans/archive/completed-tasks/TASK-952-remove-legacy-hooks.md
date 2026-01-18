# Task TASK-952: Remove Legacy Hook Code Paths

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

**PREREQUISITE:** TASK-951 validation must pass with GO decision.

---

## Goal

Remove the legacy code paths from migrated hooks now that the state machine is the default and has been validated on both platforms.

## Non-Goals

- Do NOT remove feature flag infrastructure (keep for emergency rollback)
- Do NOT remove `useOptionalMachineState` hook
- Do NOT modify state machine core files
- Do NOT proceed if TASK-951 has NO-GO decision

## Deliverables

1. Remove legacy else branches from 4 migrated hooks
2. Update related tests
3. Verify all existing tests pass

## Files to Modify

### useSecureStorage.ts (~150 lines to remove)

**Current structure:**
```typescript
export function useSecureStorage(options) {
  const machineState = useOptionalMachineState();

  if (machineState) {
    // State machine path (KEEP)
    return { ... };
  }

  // Legacy path (REMOVE)
  const [isDatabaseInitialized, setIsDatabaseInitialized] = useState(false);
  // ... ~150 lines of legacy code
}
```

**Target structure:**
```typescript
export function useSecureStorage(options) {
  const machineState = useOptionalMachineState();

  if (!machineState) {
    throw new Error('useSecureStorage requires state machine to be enabled');
  }

  // State machine path only
  return { ... };
}
```

### usePhoneTypeApi.ts (~100 lines to remove)

Same pattern as useSecureStorage.

### useEmailOnboardingApi.ts (~80 lines to remove)

Same pattern as useSecureStorage.

### useNavigationFlow.ts (~120 lines to remove)

Same pattern as useSecureStorage.

## Test Updates

- Update hook tests that explicitly test legacy path
- Remove tests that are only relevant to legacy path
- Verify state machine path tests still pass

## Acceptance Criteria

- [ ] TASK-951 validation passed with GO decision
- [ ] Legacy code removed from all 4 hooks
- [ ] All existing tests pass (or updated appropriately)
- [ ] No increase in bundle size (should decrease)
- [ ] Feature flag disable causes clear error (not silent failure)

## PR Preparation

- **Title**: `refactor(hooks): remove legacy code paths`
- **Branch From**: `develop`
- **Branch Into**: `develop`
- **Branch Name**: `feature/TASK-952-remove-legacy-hooks`

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~50K × 0.5 (refactor adjustment) = ~25K actual

**Token Cap:** 200K (budget for thorough testing)

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED (conditional on TASK-951 GO decision)
**Review Date:** 2026-01-04

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `feature/TASK-952-remove-legacy-hooks`

### Technical Considerations

- Keep `useOptionalMachineState` - it's still useful for conditional checks
- Keep feature flag - emergency rollback capability is worth the code overhead
- Throwing error when machine is disabled is preferred over silent failure
- Consider adding migration guide comment for anyone who disables flag

### Scope Correction (SPRINT-022 Review)

**Actual legacy code sizes (larger than original estimates):**

| Hook | Estimated | Actual | Notes |
|------|-----------|--------|-------|
| `useSecureStorage.ts` | ~150 lines | ~395 lines | Lines 141-536 |
| `usePhoneTypeApi.ts` | ~100 lines | ~118 lines | Lines 147-265 |
| `useEmailOnboardingApi.ts` | ~80 lines | ~84 lines | Lines 118-202 |
| `useNavigationFlow.ts` | ~120 lines | ~273 lines | Lines 171-444 |
| **Total** | **~450 lines** | **~870 lines** | Nearly 2x estimate |

The 200K token cap should still accommodate this, but engineer should be aware of the larger scope. Consider tackling hooks in order of size (smallest first) to build momentum.

---

## Implementation Summary (Engineer-Owned)

*To be filled by engineer agent*
