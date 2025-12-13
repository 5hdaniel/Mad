# Task TASK-115: Deprecate Old Components

## Goal

Mark the old onboarding components as deprecated with clear documentation. Do NOT delete them yet - they serve as fallback and reference.

## Non-Goals

- Do NOT delete any files
- Do NOT remove any functionality
- Do NOT modify component behavior

## Deliverables

1. Add `@deprecated` JSDoc to old components
2. Add deprecation comments explaining migration
3. Update any import statements to prefer new system

## Acceptance Criteria

- [ ] `PhoneTypeSelection.tsx` marked deprecated
- [ ] `EmailOnboardingScreen.tsx` marked deprecated
- [ ] `KeychainExplanation.tsx` marked deprecated
- [ ] `PermissionsScreen.tsx` marked deprecated
- [ ] `AppleDriverSetup.tsx` marked deprecated
- [ ] `AndroidComingSoon.tsx` marked deprecated
- [ ] `SetupProgressIndicator.tsx` marked deprecated
- [ ] Each file has comment pointing to new location
- [ ] No functionality changes
- [ ] All existing tests still pass

## Implementation Notes

### Deprecation Pattern

Add to the top of each file:

```typescript
/**
 * @deprecated This component is deprecated.
 * Use the new onboarding architecture instead:
 * - Step: src/components/onboarding/steps/PhoneTypeStep.tsx
 * - Shell: src/components/onboarding/shell/OnboardingShell.tsx
 * - Hook: src/components/onboarding/hooks/useOnboardingFlow.ts
 *
 * This file is kept for reference and fallback.
 * Scheduled for removal in next major version.
 */
```

### Files to Deprecate

| File | New Location |
|------|--------------|
| `PhoneTypeSelection.tsx` | `onboarding/steps/PhoneTypeStep.tsx` |
| `EmailOnboardingScreen.tsx` | `onboarding/steps/EmailConnectStep.tsx` |
| `KeychainExplanation.tsx` | `onboarding/steps/SecureStorageStep.tsx` |
| `PermissionsScreen.tsx` | `onboarding/steps/PermissionsStep.tsx` |
| `AppleDriverSetup.tsx` | `onboarding/steps/AppleDriverStep.tsx` |
| `AndroidComingSoon.tsx` | `onboarding/steps/AndroidComingSoonStep.tsx` |
| `SetupProgressIndicator.tsx` | `onboarding/shell/ProgressIndicator.tsx` |

### Example Deprecation

```typescript
// src/components/PhoneTypeSelection.tsx

/**
 * @deprecated Use `onboarding/steps/PhoneTypeStep.tsx` instead.
 *
 * Migration guide:
 * 1. New step file has `meta` object with configuration
 * 2. Content component receives `onAction` callback
 * 3. Layout/navigation handled by OnboardingShell
 *
 * This file will be removed after migration is complete.
 */

// ... rest of file unchanged
```

### Do NOT Change

- Component implementations
- Prop interfaces
- Export patterns
- Test files

## Integration Notes

- Old components may still be imported by AppRouter fallback
- Tests import old components directly
- Keep exports functional

## Do / Don't

### Do:
- Add clear deprecation notices
- Point to new locations
- Keep all code functional
- Update JSDoc only

### Don't:
- Delete any code
- Change behavior
- Remove exports
- Break tests

## When to Stop and Ask

- If unclear which new file corresponds to old
- If deprecation affects imports elsewhere
- If linting warns on deprecated usage

## Testing Expectations

- All existing tests pass unchanged
- No runtime behavior changes
- IDE shows deprecation warnings on old imports

## PR Preparation

- Title: `chore(onboarding): deprecate old components`
- Label: `phase-4`, `deprecation`
- Depends on: TASK-114

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files deprecated:
- [ ] src/components/PhoneTypeSelection.tsx
- [ ] src/components/EmailOnboardingScreen.tsx
- [ ] src/components/KeychainExplanation.tsx
- [ ] src/components/PermissionsScreen.tsx
- [ ] src/components/AppleDriverSetup.tsx
- [ ] src/components/AndroidComingSoon.tsx
- [ ] src/components/SetupProgressIndicator.tsx

Each file has:
- [ ] @deprecated JSDoc tag
- [ ] Migration guide comment
- [ ] New file location reference

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (no changes to tests)
```
