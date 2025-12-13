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

- [ ] `MACOS_FLOW` defines step order: `['phone-type', 'secure-storage', 'email-connect', 'permissions']`
- [ ] `WINDOWS_FLOW` defines step order: `['phone-type', 'email-connect', 'apple-driver']`
- [ ] `getFlowSteps(platform)` returns ordered `OnboardingStep[]`
- [ ] Platform validation throws if step doesn't support platform
- [ ] `validateAllFlows()` validates all flows at startup (dev only)
- [ ] Error messages are descriptive and actionable
- [ ] File compiles with `npm run type-check`

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

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/flows/index.ts
- [ ] src/components/onboarding/flows/macosFlow.ts
- [ ] src/components/onboarding/flows/windowsFlow.ts

Functions implemented:
- [ ] getFlowSteps(platform)
- [ ] validateAllFlows()
- [ ] FLOWS registry

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Platform validation throws correct errors
```
