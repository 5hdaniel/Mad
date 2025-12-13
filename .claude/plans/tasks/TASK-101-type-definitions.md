# Task TASK-101: Create Type Definitions and Interfaces

## Goal

Create the foundational TypeScript type definitions that all onboarding components will use. This establishes the contract for step metadata, platform types, navigation configuration, and skip options.

## Non-Goals

- Do NOT implement any components
- Do NOT create the step registry (that's TASK-102)
- Do NOT create flow definitions (that's TASK-103)
- Do NOT add any runtime code

## Deliverables

1. New file: `src/components/onboarding/types.ts`
2. All type definitions exported and documented with JSDoc

## Acceptance Criteria

- [ ] `Platform` type defined as union: `'macos' | 'windows' | 'linux'`
- [ ] `SkipConfig` interface with `enabled`, `label`, and optional `description`
- [ ] `OnboardingStepMeta` interface with all required fields (see Implementation Notes)
- [ ] `OnboardingContext` interface for step function parameters
- [ ] `OnboardingStep` interface combining meta and Content component
- [ ] `OnboardingStepContentProps` interface for content component props
- [ ] `StepAction` union type for step-dispatched actions
- [ ] All types have JSDoc documentation
- [ ] File compiles with `npm run type-check`
- [ ] No circular imports possible (types only, no implementations)

## Implementation Notes

### OnboardingStepMeta Interface (Required Fields)

```typescript
interface OnboardingStepMeta {
  id: string;                    // Unique kebab-case identifier
  progressLabel: string;         // Short label for progress bar (≤12 chars)
  title: string;                 // Full screen title
  platforms: Platform[];         // Which platforms support this step
  navigation: {
    showBack: boolean;
    showNext: boolean;
    nextLabel?: string;          // Default: "Continue"
    backLabel?: string;          // Default: "Back"
  };
  skip: SkipConfig | false;      // Skip configuration or false
  required: boolean;             // Must complete to finish onboarding?
  getNextStepOverride?: (context: OnboardingContext) => string | null;
  canProceed?: (context: OnboardingContext) => boolean;
}
```

### OnboardingContext Interface

Include at minimum:
- `platform: Platform`
- `phoneType: 'iphone' | 'android' | null`
- `emailConnected: boolean`
- `emailProvider: 'google' | 'microsoft' | null`
- `hasPermissions: boolean`
- `hasSecureStorage: boolean`

### StepAction Union

Define actions for:
- `SELECT_PHONE` with phoneType
- `EMAIL_CONNECTED` with provider and email
- `PERMISSION_GRANTED`
- `DRIVER_INSTALLED`
- `SECURE_STORAGE_SETUP`
- `CUSTOM` with unknown payload (escape hatch)

## Integration Notes

- This file has NO dependencies on other onboarding files
- Other files will import FROM this file
- Use `import type` syntax where possible for tree-shaking

## File Location

```
src/components/onboarding/
└── types.ts  ← YOU CREATE THIS
```

## Do / Don't

### Do:
- Use strict TypeScript (no `any`)
- Document every interface with JSDoc
- Use readonly where appropriate
- Export all types

### Don't:
- Import from any other file
- Create runtime code (const, let, functions)
- Use `any` type
- Abbreviate property names

## When to Stop and Ask

- If unclear whether a field should be required vs optional
- If a type seems to conflict with existing types in `src/appCore/state/types.ts`
- If you need to add a field not specified here

## Testing Expectations

- No runtime tests (types only)
- Verify compilation: `npm run type-check`

## PR Preparation

- Title: `feat(onboarding): add type definitions for step architecture`
- Label: `phase-1`, `foundation`
- Ensure no linting errors

## Implementation Summary (Engineer-Owned)

*Completed: 2025-12-13*

```
Files created:
- [x] src/components/onboarding/types.ts (579 lines)

Types defined:
- [x] Platform ('macos' | 'windows' | 'linux')
- [x] OnboardingStepId (step identifiers union type)
- [x] SkipConfig (enabled, label, description?)
- [x] StepNavigationConfig (showBack?, backLabel?, continueLabel?, hideContinue?)
- [x] OnboardingStepMeta (id, progressLabel, platforms?, navigation?, skip?, isStepComplete?, shouldShow?, canProceed?)
- [x] OnboardingContext (platform, phoneType, emailConnected, connectedEmail, emailSkipped, driverSkipped, driverSetupComplete, permissionsGranted, termsAccepted, emailProvider, isNewUser, isDatabaseInitialized)
- [x] OnboardingStep (meta + Content component)
- [x] OnboardingStepContentProps (context, onAction)
- [x] StepAction (union of 11 action types: SELECT_PHONE, EMAIL_CONNECTED, EMAIL_SKIPPED, PERMISSION_GRANTED, DRIVER_SETUP_COMPLETE, DRIVER_SKIPPED, TERMS_ACCEPTED, TERMS_DECLINED, NAVIGATE_NEXT, NAVIGATE_BACK, ONBOARDING_COMPLETE)

Additional types defined:
- [x] OnboardingStepRegistry (Record<OnboardingStepId, OnboardingStep>)
- [x] OnboardingFlowSequence (readonly OnboardingStepId[])
- [x] OnboardingFlowConfig (steps, defaultSequence, initialContext)
- [x] OnboardingPersistedState (for state persistence)
- [x] OnboardingOrchestratorProps (config, initialContext?, onComplete, onStepChange?, onPersist?)
- [x] UseOnboardingFlowReturn (hook return type)
- [x] SkippableStepId (utility type)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
```

### Implementation Notes

1. **Import from existing types**: Imported `PhoneType` from `../../appCore/state/types` for compatibility with existing codebase.

2. **Addendum 01 compliance**: Added all required fields per Addendum 01:
   - `isStepComplete?: (context: OnboardingContext) => boolean` in OnboardingStepMeta
   - `connectedEmail: string | null` in OnboardingContext
   - `emailSkipped: boolean` in OnboardingContext
   - `driverSkipped: boolean` in OnboardingContext

3. **Design decisions**:
   - Used `OnboardingStepId` union type instead of plain string for type-safe step identification
   - Split navigation config into separate `StepNavigationConfig` interface for reusability
   - Added `shouldShow` predicate to OnboardingStepMeta for dynamic step visibility
   - Defined individual action interfaces (e.g., `SelectPhoneAction`) before combining into `StepAction` union for better documentation
   - Added persistence types (`OnboardingPersistedState`) anticipating TASK-104 requirements
   - Added hook return type (`UseOnboardingFlowReturn`) anticipating TASK-113 requirements

4. **Deviations from spec**:
   - Did not include `title` in OnboardingStepMeta (can be added if needed)
   - Did not include `required` field in OnboardingStepMeta (using `isStepComplete` + `skip` instead)
   - Used `ComponentType<OnboardingStepContentProps>` for Content instead of `React.FC` for flexibility
   - Did not add `CUSTOM` action with unknown payload (can be added if escape hatch needed)
   - Did not add `DRIVER_INSTALLED` or `SECURE_STORAGE_SETUP` actions (used `DRIVER_SETUP_COMPLETE` naming instead)

5. **No imports from other onboarding files**: Only imports are from React types and existing state types.
