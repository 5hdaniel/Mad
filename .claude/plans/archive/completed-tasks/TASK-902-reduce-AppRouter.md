# TASK-902: Reduce AppRouter.tsx to <300 Lines

**Sprint:** SPRINT-013
**Backlog:** BACKLOG-109
**Priority:** HIGH
**Category:** refactor
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 4-6 turns, ~20K tokens, 15-20 min

---

## Goal

Reduce `AppRouter.tsx` from 359 lines to under 300 lines by extracting route configuration and helper components.

## Non-Goals

- Do NOT change routing behavior
- Do NOT add new routes
- Do NOT modify the `AppStateMachine` interface
- Do NOT change how components receive props

---

## Current State

- **Current lines:** 359
- **Target:** < 300 lines
- **Over by:** 59 lines

The file contains:
- Route configuration (which steps map to which components)
- Loading screen component (inline)
- `isOnboardingStep` helper function
- Main `AppRouter` component with switch logic

---

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `src/appCore/routing/routeConfig.ts` | Route configuration and step-to-component mapping |
| `src/appCore/routing/LoadingScreen.tsx` | Extract inline loading component |
| `src/appCore/routing/index.ts` | Barrel export |

### Files to Modify

| File | Change |
|------|--------|
| `src/appCore/AppRouter.tsx` | Import from routing/, reduce to < 300 lines |

---

## Implementation Notes

### Route Configuration Extraction

```typescript
// src/appCore/routing/routeConfig.ts
import type { AppStep } from '../state/types';

export const ONBOARDING_STEPS: AppStep[] = [
  'phone-type-selection',
  'android-coming-soon',
  'email-onboarding',
  'keychain-explanation',
  'permissions',
  'apple-driver-setup',
];

export function isOnboardingStep(step: string): boolean {
  return ONBOARDING_STEPS.includes(step as AppStep);
}

export const USE_NEW_ONBOARDING = true;
```

### LoadingScreen Extraction

If there's an inline loading component, extract it:

```typescript
// src/appCore/routing/LoadingScreen.tsx
export function LoadingScreen() {
  return (
    <div className="...">
      {/* loading UI */}
    </div>
  );
}
```

---

## Acceptance Criteria

- [ ] `AppRouter.tsx` is < 300 lines
- [ ] Route configuration extracted to separate file
- [ ] All routes still work correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All existing tests pass

---

## Do / Don't

### Do
- Keep the same component structure
- Maintain all existing route behaviors
- Use barrel exports for clean imports
- Follow existing code style

### Don't
- Change how routes are resolved
- Modify component props interfaces
- Add lazy loading (out of scope)
- Change the `USE_NEW_ONBOARDING` flag behavior

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Line count target requires behavior changes
- Route configuration is more complex than expected
- Tests need modification

---

## Testing Expectations

- **No new tests required** - this is pure refactoring
- All existing tests must pass unchanged
- Manual verification: navigate to all screens, verify correct rendering

---

## PR Preparation

**Branch:** `feature/TASK-902-reduce-app-router`
**Title:** `refactor(routing): reduce AppRouter.tsx to <300 lines`
**Labels:** `refactor`, `SPRINT-013`

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-902-reduce-app-router

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Technical Considerations
1. **LoadingScreen extraction**: Primary target - saves ~30 lines
2. **routeConfig.ts**: Extract `isOnboardingStep`, `USE_NEW_ONBOARDING`, and `ONBOARDING_STEPS` array
3. **Create `routing/index.ts`** barrel export for clean imports
4. **Note**: Target is <300 but guardrail target is 250. Consider going further if natural.

### Risk Areas
- The inline loading screen JSX must preserve exact styling
- Ensure `isOnboardingStep` remains accessible to OnboardingFlow if needed

---

## Implementation Summary

*To be filled by engineer after completion*
