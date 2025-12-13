# Task TASK-108: Extract SecureStorageStep (macOS Only)

## Goal

Extract the keychain/secure storage explanation screen into the new step architecture. This step is **macOS only** and tests the platform gating functionality.

## Non-Goals

- Do NOT delete KeychainExplanation.tsx (deprecation is TASK-115)
- Do NOT modify AppRouter routing yet (TASK-114)
- Do NOT change any visual behavior

## Deliverables

1. New file: `src/components/onboarding/steps/SecureStorageStep.tsx`
2. Update: `src/components/onboarding/steps/index.ts` (register step)

## Acceptance Criteria

- [ ] `meta.id` is `'secure-storage'`
- [ ] `meta.progressLabel` is `'Secure Storage'`
- [ ] `meta.platforms` is `['macos']` **ONLY** (not Windows)
- [ ] `meta.navigation.showBack` is `true`
- [ ] `meta.navigation.showNext` is `true`
- [ ] `meta.skip` is `false` (required for macOS)
- [ ] Content includes "Don't show again" checkbox
- [ ] Content handles loading state for keychain prompt
- [ ] Step registered in STEP_REGISTRY
- [ ] Platform validation throws if step added to Windows flow

## Implementation Notes

### Platform Restriction

This step demonstrates platform-specific steps. It should **only** appear in the macOS flow.

```typescript
export const meta: OnboardingStepMeta = {
  id: 'secure-storage',
  progressLabel: 'Secure Storage',
  title: 'Secure Storage Setup',
  platforms: ['macos'],  // NOT Windows!
  // ...
};
```

If someone accidentally adds `'secure-storage'` to the Windows flow, the platform validation (TASK-103) should throw:

```
Error: [Onboarding] Step "secure-storage" does not support platform "windows".
Supported platforms: [macos].
```

### Content Features

From KeychainExplanation.tsx:
- Lock icon with gradient background
- Explanation text about keychain access
- "Don't show again" checkbox
- Loading spinner state when waiting for system dialog
- Info box about clicking "Always Allow"

### Action Types

This step needs a new action type:

```typescript
{ type: 'SECURE_STORAGE_SETUP', dontShowAgain: boolean }
```

## Integration Notes

- Content component may need local state for checkbox
- Loading state triggered by parent when keychain prompt active
- `onAction` fires when user clicks Continue

### Props from Context

The step may need to check:
- `context.hasSecureStorage` - whether already set up
- Loading state passed separately (consider adding to ContentProps)

## Do / Don't

### Do:
- Restrict to macOS only via `platforms` array
- Handle "Don't show again" checkbox state
- Include loading/waiting state rendering

### Don't:
- Add Windows to platforms array
- Skip checkbox functionality
- Implement actual keychain logic (handled by state machine)

## When to Stop and Ask

- If unclear how loading state should be passed
- If checkbox state management seems complex
- If KeychainExplanation has modes not covered

## Testing Expectations

- Unit test: Platform validation throws for Windows
- Unit test: Checkbox state changes
- Unit test: Continue fires action with checkbox value
- Unit test: Loading state renders spinner

## PR Preparation

- Title: `feat(onboarding): extract SecureStorageStep (macOS only)`
- Label: `phase-3`, `step-extraction`, `macos`
- Depends on: Phase 2 complete

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/steps/SecureStorageStep.tsx

Platform restriction verified:
- [ ] platforms: ['macos'] only
- [ ] Validation throws if added to Windows flow

Features implemented:
- [ ] Lock icon header
- [ ] Explanation text
- [ ] "Don't show again" checkbox
- [ ] Loading/waiting state
- [ ] Info box

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```
