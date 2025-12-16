# Task TASK-103: Create Flow Definitions (macOS/Windows)

## Goal

Create platform-specific flow definitions that specify the order of onboarding steps for each platform. Implement validation that throws developer errors when a step doesn't support the platform it's used on.

## Non-Goals

- Do NOT create step implementations (Phase 3)
- Do NOT create the OnboardingShell (Phase 2)
- Do NOT modify any existing components

## Deliverables

1. New file: `src/components/onboarding/flows/macosFlow.ts`
2. New file: `src/components/onboarding/flows/windowsFlow.ts`
3. New file: `src/components/onboarding/flows/index.ts` (utilities + validation)

## Acceptance Criteria

- [x] `MACOS_FLOW` defines step order: `['phone-type', 'secure-storage', 'email-connect', 'permissions']`
- [x] `WINDOWS_FLOW` defines step order: `['phone-type', 'email-connect', 'apple-driver']`
- [x] `getFlowSteps(platform)` returns ordered `OnboardingStep[]`
- [x] Platform validation throws if step doesn't support platform
- [x] `validateAllFlows()` validates all flows at startup (dev only)
- [x] Error messages are descriptive and actionable
- [x] File compiles with `npm run type-check`

## Implementation Notes

### Flow Definition Structure

```typescript
// src/components/onboarding/flows/macosFlow.ts
import type { Platform } from '../types';

export const MACOS_FLOW = {
  platform: 'macos' as Platform,
  steps: [
    'phone-type',
    'secure-storage',
    'email-connect',
    'permissions',
  ],
} as const;
```

### Platform Validation (Critical)

```typescript
// src/components/onboarding/flows/index.ts

export function getFlowSteps(platform: Platform): OnboardingStep[] {
  const flow = FLOWS[platform];

  if (!flow || flow.steps.length === 0) {
    throw new Error(
      `[Onboarding] No flow defined for platform: ${platform}`
    );
  }

  return flow.steps.map((stepId) => {
    const step = getStep(stepId);  // from ../steps

    // CRITICAL: Validate platform support
    if (!step.meta.platforms.includes(platform)) {
      throw new Error(
        `[Onboarding] Step "${stepId}" does not support platform "${platform}". ` +
        `Supported platforms: [${step.meta.platforms.join(', ')}]. ` +
        `Either remove this step from the ${platform} flow, or add "${platform}" ` +
        `to the step's platforms array.`
      );
    }

    return step;
  });
}
```

### Directory Structure After This Task

```
src/components/onboarding/
├── types.ts                 ← TASK-101
├── steps/
│   └── index.ts             ← TASK-102
└── flows/
    ├── index.ts             ← YOU CREATE
    ├── macosFlow.ts         ← YOU CREATE
    └── windowsFlow.ts       ← YOU CREATE
```

## Integration Notes

- Imports from `../types.ts` (TASK-101)
- Imports from `../steps` (TASK-102)
- Will be used by `useOnboardingFlow` hook (TASK-113)

## Do / Don't

### Do:
- Use `as const` for flow definitions (type safety)
- Provide actionable error messages
- Validate only in development
- Export platform flow objects

### Don't:
- Create step implementations
- Validate at runtime in production
- Use magic strings (reference step IDs consistently)
- Swallow validation errors

## When to Stop and Ask

- If unsure about step order for a platform
- If validation error messages seem unclear
- If types don't align with TASK-101/TASK-102

## Testing Expectations

- Unit test: `getFlowSteps('macos')` returns correct order
- Unit test: `getFlowSteps('windows')` returns correct order
- Unit test: Platform validation throws for incompatible step
- Unit test: `validateAllFlows()` catches misconfigurations

## PR Preparation

- Title: `feat(onboarding): add platform flow definitions with validation`
- Label: `phase-1`, `foundation`
- Depends on: TASK-101, TASK-102

## Implementation Summary (Engineer-Owned)

*Completed: 2025-12-14*

```
Files created:
- [x] src/components/onboarding/flows/index.ts
- [x] src/components/onboarding/flows/macosFlow.ts
- [x] src/components/onboarding/flows/windowsFlow.ts

Files modified:
- [x] src/components/onboarding/types.ts (added missing step IDs)

Functions implemented:
- [x] getFlowSteps(platform) - returns OnboardingStep[] with validation
- [x] getFlowForPlatform(platform) - returns step ID array
- [x] validateFlowSteps(stepIds, platform) - validates step platform support
- [x] validateAllFlows() - validates all flows at startup (dev only)
- [x] FLOWS registry - maps Platform to flow config

Exports:
- [x] MACOS_FLOW, MACOS_FLOW_STEPS, MACOS_PLATFORM
- [x] WINDOWS_FLOW, WINDOWS_FLOW_STEPS, WINDOWS_PLATFORM
- [x] FLOWS registry
- [x] getFlowForPlatform, getFlowSteps, validateFlowSteps, validateAllFlows

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] Platform validation throws correct errors
```

### Notes

**Deviations from plan:**
- **DEVIATION FROM PLAN:** Updated `OnboardingStepId` in `types.ts` to add missing step IDs (`secure-storage`, `apple-driver`) that were not included in TASK-101 but are required for the platform flows. This was pre-approved by the PM.

**Design decisions:**
- Added `getFlowForPlatform(platform)` function that returns just the step ID array (in addition to `getFlowSteps` which returns full step objects) for consumers who only need IDs
- Linux platform uses the same flow as macOS (documented in code comment)
- Validation gracefully skips unregistered steps to allow flows to be defined before step implementations exist (Phase 3)
- All validation only runs in development mode (`process.env.NODE_ENV === 'development'`)

**Issues encountered:**
- Initial type mismatch between task requirements (`secure-storage`, `apple-driver`) and TASK-101 types (`driver-setup`, no `secure-storage`). Resolved by updating types.ts with PM approval.
- npm install had network issues with electron binary download, but type-check/lint still ran successfully after partial install.

**Reviewer notes:**
- The types.ts modification adds `secure-storage` and `apple-driver` to `OnboardingStepId` union type
- Validation handles the case where `platforms` is undefined/empty (meaning "all platforms supported")
