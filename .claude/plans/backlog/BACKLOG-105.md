# BACKLOG-105: Monitor and Refactor AppRouter.tsx

## Priority: Low

## Category: refactor

## Summary

AppRouter.tsx is currently at 359 lines, exceeding the 300-line target (though below the 400-line trigger). Monitor and plan extraction when appropriate.

## Origin

SPRINT-009 Retrospective - Architecture monitoring identified during lessons learned.

## Current State

Per `.claude/docs/shared/architecture-guardrails.md`:

| File | Current | Target | Trigger |
|------|---------|--------|---------|
| `AppRouter.tsx` | 359 | 250 | >300 |

The file has exceeded the target (250) and the trigger (300) but is still below the upper bounds where extraction becomes urgent.

## Problem

AppRouter.tsx has grown to include:
- Route definitions
- Route guards and authentication logic
- Lazy loading configuration
- Error boundaries for routes

This should be split into focused modules.

## Proposed Extraction

### Option A: Route Groups
```
src/routes/
  index.ts (re-exports)
  AuthenticatedRoutes.tsx
  PublicRoutes.tsx
  AdminRoutes.tsx
```

### Option B: Feature-Based
```
src/features/
  auth/routes.tsx
  transactions/routes.tsx
  contacts/routes.tsx
  settings/routes.tsx
```

## Acceptance Criteria

- [ ] AppRouter.tsx reduced to <250 lines
- [ ] Route definitions moved to feature/domain modules
- [ ] Route guards extracted to separate utilities
- [ ] Lazy loading preserved
- [ ] No functionality changes
- [ ] All existing routes work correctly

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 5-7 | Apply 0.5x refactor multiplier (base: 10-14) |
| Tokens | ~25K | |
| Time | ~45-60 min | |

## Dependencies

None

## Trigger Conditions

Consider prioritizing this work when:
- AppRouter.tsx exceeds 400 lines (urgent trigger)
- New route groups are being added
- Router-related bugs are difficult to debug

## Monitoring

Add to periodic codebase health checks:
```bash
wc -l src/AppRouter.tsx
# Should be < 300 (target), definitely < 400 (trigger)
```

## Notes

This is preventive maintenance. Not urgent but should be addressed before the file becomes unmanageable. Current state is acceptable but trending toward technical debt.
