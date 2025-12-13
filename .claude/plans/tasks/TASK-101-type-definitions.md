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

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/types.ts

Types defined:
- [ ] Platform
- [ ] SkipConfig
- [ ] OnboardingStepMeta
- [ ] OnboardingContext
- [ ] OnboardingStep
- [ ] OnboardingStepContentProps
- [ ] StepAction

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```
