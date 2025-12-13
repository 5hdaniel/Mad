# Task TASK-113: Create useOnboardingFlow Hook

## Goal

Create the orchestration hook that manages onboarding flow state, step navigation, and action handling. This hook connects the step registry, flow definitions, and shell components.

## Non-Goals

- Do NOT modify AppRouter yet (TASK-114)
- Do NOT delete old components (TASK-115)
- Do NOT break existing functionality

## Deliverables

1. New file: `src/components/onboarding/hooks/useOnboardingFlow.ts`
2. New file: `src/components/onboarding/hooks/index.ts` (exports)

## Acceptance Criteria

- [ ] Hook returns current step, steps array, and navigation functions
- [ ] `goToNext()` advances to next step (or override)
- [ ] `goToPrevious()` goes to previous step
- [ ] `goToStep(id)` navigates to specific step
- [ ] `handleAction(action)` processes step actions
- [ ] Context is built from app state
- [ ] Platform-specific flow is loaded correctly
- [ ] Step overrides (branching) work
- [ ] Skip functionality works
- [ ] Returns everything OnboardingShell needs

## Implementation Notes

### Hook Interface

```typescript
// src/components/onboarding/hooks/useOnboardingFlow.ts

import { useState, useCallback, useMemo } from 'react';
import { usePlatform } from '../../../contexts/PlatformContext';
import { getFlowSteps } from '../flows';
import type {
  OnboardingStep,
  OnboardingContext,
  StepAction,
  Platform,
} from '../types';

interface UseOnboardingFlowOptions {
  /** Initial step index (default: 0) */
  initialStepIndex?: number;
  /** Callback when flow completes */
  onComplete?: () => void;
  /** Callback when user skips */
  onSkip?: () => void;
  /** External state for context building */
  appState: {
    phoneType: 'iphone' | 'android' | null;
    emailConnected: boolean;
    emailProvider: 'google' | 'microsoft' | null;
    hasPermissions: boolean;
    hasSecureStorage: boolean;
  };
}

interface UseOnboardingFlowReturn {
  /** All steps in the flow */
  steps: OnboardingStep[];
  /** Current step index */
  currentIndex: number;
  /** Current step */
  currentStep: OnboardingStep;
  /** Onboarding context */
  context: OnboardingContext;
  /** Navigation functions */
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (stepId: string) => void;
  /** Action handler for step Content */
  handleAction: (action: StepAction) => void;
  /** Skip current step */
  handleSkip: () => void;
  /** Whether flow is complete */
  isComplete: boolean;
  /** Whether on first step */
  isFirstStep: boolean;
  /** Whether on last step */
  isLastStep: boolean;
}

export function useOnboardingFlow(
  options: UseOnboardingFlowOptions
): UseOnboardingFlowReturn {
  const { isMacOS, isWindows } = usePlatform();

  // Determine platform
  const platform: Platform = isMacOS ? 'macos' : 'windows';

  // Get steps for this platform
  const steps = useMemo(() => getFlowSteps(platform), [platform]);

  // Current step state
  const [currentIndex, setCurrentIndex] = useState(
    options.initialStepIndex ?? 0
  );

  // Build context from app state
  const context: OnboardingContext = useMemo(() => ({
    platform,
    phoneType: options.appState.phoneType,
    emailConnected: options.appState.emailConnected,
    emailProvider: options.appState.emailProvider,
    hasPermissions: options.appState.hasPermissions,
    hasSecureStorage: options.appState.hasSecureStorage,
  }), [platform, options.appState]);

  // Current step
  const currentStep = steps[currentIndex];

  // Navigation
  const goToNext = useCallback(() => {
    // Check for override
    const override = currentStep.meta.getNextStepOverride?.(context);
    if (override) {
      const overrideIndex = steps.findIndex(s => s.meta.id === override);
      if (overrideIndex >= 0) {
        setCurrentIndex(overrideIndex);
        return;
      }
    }

    // Normal next
    if (currentIndex < steps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      options.onComplete?.();
    }
  }, [currentStep, currentIndex, steps, context, options.onComplete]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToStep = useCallback((stepId: string) => {
    const index = steps.findIndex(s => s.meta.id === stepId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
  }, [steps]);

  // Action handling
  const handleAction = useCallback((action: StepAction) => {
    // Process action and potentially advance
    switch (action.type) {
      case 'SELECT_PHONE':
        // Update phone type in parent state
        // Then advance
        goToNext();
        break;
      case 'EMAIL_CONNECTED':
        // Update email state in parent
        goToNext();
        break;
      // ... handle other actions
    }
  }, [goToNext]);

  const handleSkip = useCallback(() => {
    options.onSkip?.();
    goToNext();
  }, [options.onSkip, goToNext]);

  return {
    steps,
    currentIndex,
    currentStep,
    context,
    goToNext,
    goToPrevious,
    goToStep,
    handleAction,
    handleSkip,
    isComplete: currentIndex >= steps.length,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === steps.length - 1,
  };
}
```

### Integration with App State

The hook receives app state but doesn't modify it directly. Actions are passed up to parent components that update `useAppStateMachine`.

### Action → State Updates

Actions fire in the step's Content component. The hook's `handleAction` processes them and may:
1. Update local navigation state
2. Call parent callbacks to update app state
3. Advance to next step

## Do / Don't

### Do:
- Use useMemo for expensive computations
- Use useCallback for stable function references
- Handle all action types
- Support step overrides/branching

### Don't:
- Modify app state directly (use callbacks)
- Break if steps array is empty
- Ignore platform context
- Make navigation non-deterministic

## When to Stop and Ask

- If action → state update pattern is unclear
- If integration with existing state machine is complex
- If step override logic has edge cases

## Testing Expectations

- Unit test: Returns correct steps for macOS
- Unit test: Returns correct steps for Windows
- Unit test: goToNext advances index
- Unit test: goToPrevious decrements index
- Unit test: Step override redirects correctly
- Unit test: handleAction processes SELECT_PHONE

## PR Preparation

- Title: `feat(onboarding): add useOnboardingFlow hook`
- Label: `phase-4`, `integration`
- Depends on: Phase 3 complete

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/hooks/useOnboardingFlow.ts
- [ ] src/components/onboarding/hooks/index.ts

Features implemented:
- [ ] Platform-specific step loading
- [ ] Navigation (next/previous/goTo)
- [ ] Action handling
- [ ] Context building
- [ ] Step override support
- [ ] Skip handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```
