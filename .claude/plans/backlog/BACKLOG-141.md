# BACKLOG-141: Fix Onboarding Flicker for Returning Users (Quick Fix)

**Priority:** Medium
**Category:** fix
**Status:** Pending
**Created:** 2026-01-03
**Sprint:** Unassigned
**Related:** BACKLOG-142 (State Coordination Overhaul - comprehensive fix)

---

## Problem

When a returning user logs in, they briefly see the onboarding screens flicker for ~1 second before seeing the main dashboard.

## Root Cause

In `usePhoneTypeApi.ts`, `hasSelectedPhoneType` defaults to `false`. When user authenticates:
1. `isAuthenticated` becomes `true`
2. `hasSelectedPhoneType` is still `false` (default, before DB loads)
3. Navigation sends user to `"phone-type-selection"`
4. DB query completes, `hasSelectedPhoneType` becomes `true`
5. Navigation redirects to dashboard
6. Result: ~1 second flicker

Note: `useEmailOnboardingApi.ts` already has this fix:
```typescript
const [hasCompletedEmailOnboarding, setHasCompletedEmailOnboarding] =
  useState<boolean>(true); // Default true to avoid flicker
```

## Quick Fix

Apply the same pattern to `usePhoneTypeApi.ts`:

```typescript
// Before:
const [hasSelectedPhoneType, setHasSelectedPhoneType] = useState<boolean>(false);

// After:
const [hasSelectedPhoneType, setHasSelectedPhoneType] = useState<boolean>(true); // Default true to avoid flicker
```

## Files to Modify

| File | Change |
|------|--------|
| `src/appCore/state/flows/usePhoneTypeApi.ts` | Change default from `false` to `true` |

## Acceptance Criteria

- [ ] Returning users see no onboarding flicker
- [ ] New users still see onboarding correctly
- [ ] Works on macOS and Windows

## Risk

**Low-Medium:** If data fails to load for a new user, they might skip onboarding. However:
- Same pattern already used for email onboarding
- Loading errors are rare and would surface other issues anyway

## Notes

This is a quick fix. The comprehensive solution (BACKLOG-142) will implement a proper state machine that eliminates this class of bugs entirely.

---

## Investigation Summary

SR Engineer investigation found:
- Race condition between auth completion and user data loading
- `isStillLoading` guard in `useNavigationFlow.ts` is checked too late
- Default values are inconsistent across hooks
- Pattern already applied to email onboarding but not phone type
