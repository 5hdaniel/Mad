# Task TASK-114: Integrate with AppRouter

## Goal

Wire the new onboarding system into the existing AppRouter, making it the active onboarding implementation while keeping old components available for fallback.

## Non-Goals

- Do NOT delete old components yet (TASK-115)
- Do NOT modify AppStateMachine significantly
- Do NOT change app step types

## Deliverables

1. New file: `src/components/onboarding/OnboardingFlow.tsx` (main orchestrator)
2. Update: `src/appCore/AppRouter.tsx` (use new system)
3. Update: `src/components/onboarding/index.ts` (public exports)

## Acceptance Criteria

- [ ] New `OnboardingFlow` component orchestrates the flow
- [ ] AppRouter renders `OnboardingFlow` for onboarding steps
- [ ] OnboardingFlow uses `useOnboardingFlow` hook
- [ ] OnboardingFlow renders `OnboardingShell` with correct slots
- [ ] All existing handlers still work (handleSelectIPhone, etc.)
- [ ] Navigation through all steps works on macOS
- [ ] Navigation through all steps works on Windows
- [ ] Feature flag or condition allows fallback to old components

## Implementation Notes

### OnboardingFlow Component

```typescript
// src/components/onboarding/OnboardingFlow.tsx

import React from 'react';
import { useOnboardingFlow } from './hooks';
import { OnboardingShell } from './shell/OnboardingShell';
import { ProgressIndicator } from './shell/ProgressIndicator';
import { NavigationButtons } from './shell/NavigationButtons';
import type { AppStateMachine } from '../../appCore/state/types';

interface OnboardingFlowProps {
  app: AppStateMachine;
}

/**
 * Main onboarding orchestrator component.
 * Uses new step architecture while integrating with existing app state.
 */
export function OnboardingFlow({ app }: OnboardingFlowProps) {
  const flow = useOnboardingFlow({
    appState: {
      phoneType: app.selectedPhoneType,
      emailConnected: app.hasEmailConnected,
      emailProvider: app.pendingOnboardingData.emailProvider,
      hasPermissions: app.hasPermissions,
      hasSecureStorage: app.hasSecureStorageSetup,
    },
    onComplete: () => {
      // Transition to dashboard
      app.goToStep('dashboard');
    },
    onSkip: () => {
      // Handle skip (may vary by step)
    },
  });

  const { currentStep, steps, currentIndex, context } = flow;

  // Map actions to existing app handlers
  const handleAction = (action: StepAction) => {
    switch (action.type) {
      case 'SELECT_PHONE':
        if (action.phoneType === 'iphone') {
          app.handleSelectIPhone();
        } else {
          app.handleSelectAndroid();
        }
        break;
      case 'EMAIL_CONNECTED':
        app.handleEmailOnboardingComplete();
        break;
      case 'PERMISSION_GRANTED':
        app.handlePermissionsGranted();
        break;
      // ... map other actions
    }
    flow.handleAction(action);
  };

  return (
    <OnboardingShell
      progressSlot={
        <ProgressIndicator
          steps={steps}
          currentIndex={currentIndex}
        />
      }
      navigationSlot={
        <NavigationButtons
          showBack={currentStep.meta.navigation.showBack && !flow.isFirstStep}
          showNext={currentStep.meta.navigation.showNext}
          skipConfig={currentStep.meta.skip}
          nextLabel={currentStep.meta.navigation.nextLabel}
          backLabel={currentStep.meta.navigation.backLabel}
          onBack={flow.goToPrevious}
          onNext={flow.goToNext}
          onSkip={flow.handleSkip}
        />
      }
    >
      <currentStep.Content
        context={context}
        onAction={handleAction}
      />
    </OnboardingShell>
  );
}
```

### AppRouter Integration

```typescript
// src/appCore/AppRouter.tsx

// Add import
import { OnboardingFlow } from '../components/onboarding';

// In render logic, for onboarding steps:
case 'phone-type-selection':
case 'email-onboarding':
case 'keychain-explanation':
case 'permissions':
case 'apple-driver-setup':
  // Use new onboarding system
  return <OnboardingFlow app={app} />;
```

### Feature Flag (Optional)

For safer rollout:

```typescript
const USE_NEW_ONBOARDING = true; // or env var

// In AppRouter
if (USE_NEW_ONBOARDING && isOnboardingStep(currentStep)) {
  return <OnboardingFlow app={app} />;
}
// Fall back to old components
```

### Action → Handler Mapping

| StepAction | App Handler |
|------------|-------------|
| `SELECT_PHONE (iphone)` | `handleSelectIPhone()` |
| `SELECT_PHONE (android)` | `handleSelectAndroid()` |
| `EMAIL_CONNECTED` | `handleEmailOnboardingComplete()` |
| `PERMISSION_GRANTED` | `handlePermissionsGranted()` |
| `SECURE_STORAGE_SETUP` | `handleKeychainExplanationContinue()` |
| `DRIVER_INSTALLED` | `handleAppleDriverSetupComplete()` |
| `GO_BACK_SELECT_IPHONE` | `handleAndroidGoBack()` |
| `CONTINUE_EMAIL_ONLY` | `handleAndroidContinueWithEmail()` |

## Integration Notes

- OnboardingFlow owns step navigation
- Existing handlers update app state
- Some handlers may advance AppStep (keep for now)
- Goal: OnboardingFlow drives UI, handlers drive state

## Do / Don't

### Do:
- Map all actions to existing handlers
- Keep existing handlers functional
- Support gradual migration
- Test both flows work

### Don't:
- Delete existing router logic yet
- Modify handler implementations
- Break existing tests
- Remove fallback capability

## When to Stop and Ask

- If handler mapping is unclear
- If state updates cause double-navigation
- If edge cases break (Android flow, skip, etc.)

## Testing Expectations

- Integration test: Full macOS flow completes
- Integration test: Full Windows flow completes
- Integration test: Android redirects correctly
- Integration test: Skip works on email step
- Integration test: Back navigation works

## PR Preparation

- Title: `feat(onboarding): integrate new architecture with AppRouter`
- Label: `phase-4`, `integration`, `high-risk`
- Depends on: TASK-113

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/OnboardingFlow.tsx
- [ ] src/components/onboarding/index.ts (updated)

Files modified:
- [ ] src/appCore/AppRouter.tsx

Action mappings verified:
- [ ] SELECT_PHONE → handleSelectIPhone/Android
- [ ] EMAIL_CONNECTED → handleEmailOnboardingComplete
- [ ] PERMISSION_GRANTED → handlePermissionsGranted
- [ ] SECURE_STORAGE_SETUP → handleKeychainExplanationContinue
- [ ] DRIVER_INSTALLED → handleAppleDriverSetupComplete

Flow tests:
- [ ] macOS new user flow works
- [ ] Windows new user flow works
- [ ] Android redirect works
- [ ] Skip email works
- [ ] Back navigation works

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```
