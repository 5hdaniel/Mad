# Engineer Assignment Prompts

## Overview

These are the exact prompts to be given to engineers for each task in the onboarding refactor sprint. Each prompt is self-contained and provides everything needed to execute the task.

---

## Phase 1: Foundation

### TASK-101: Type Definitions

```
You are assigned Task TASK-101 – "Create Type Definitions and Interfaces".

Task file: .claude/plans/tasks/TASK-101-type-definitions.md

Instructions:
- Branch: feat/101-onboarding-types
- Create: src/components/onboarding/types.ts
- Define all type interfaces for the onboarding step architecture
- Reference existing types in src/appCore/state/types.ts for compatibility
- Do NOT create any runtime code (types only)
- All types must have JSDoc documentation

Key types to define:
- Platform ('macos' | 'windows' | 'linux')
- SkipConfig (label, description)
- OnboardingStepMeta (id, progressLabel, platforms, navigation, skip, etc.)
- OnboardingContext (platform, phoneType, emailConnected, etc.)
- OnboardingStep (meta + Content component)
- StepAction union type

Verification before PR:
- npm run type-check passes
- npm run lint passes
- No runtime code (const, let, functions)

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-102: Step Registry

```
You are assigned Task TASK-102 – "Create Step Registry Infrastructure".

Task file: .claude/plans/tasks/TASK-102-step-registry.md

Instructions:
- Branch: feat/102-step-registry
- Depends on: TASK-101 must be merged first
- Create: src/components/onboarding/steps/index.ts
- Implement STEP_REGISTRY object and utility functions
- Add development-only validation for registry consistency

Functions to implement:
- registerStep(key, step) - validates key matches meta.id
- getStep(id) - retrieves step, throws if not found
- getAllSteps() - returns all registered steps

Validation rules (dev only):
- Registry key must equal step.meta.id
- Duplicate registrations throw error
- getStep throws for unknown steps

Verification before PR:
- npm run type-check passes
- npm run lint passes
- Add basic unit tests

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-103: Flow Definitions

```
You are assigned Task TASK-103 – "Create Flow Definitions".

Task file: .claude/plans/tasks/TASK-103-flow-definitions.md

Instructions:
- Branch: feat/103-flow-definitions
- Depends on: TASK-102 must be merged first
- Create: src/components/onboarding/flows/macosFlow.ts
- Create: src/components/onboarding/flows/windowsFlow.ts
- Create: src/components/onboarding/flows/index.ts
- Implement platform validation that throws if step doesn't support platform

macOS flow order: ['phone-type', 'secure-storage', 'email-connect', 'permissions']
Windows flow order: ['phone-type', 'email-connect', 'apple-driver']

CRITICAL: getFlowSteps must validate each step supports the platform:
- If step.meta.platforms doesn't include platform, throw descriptive error
- Error must tell developer exactly how to fix it

Verification before PR:
- npm run type-check passes
- npm run lint passes
- Test that validation throws correct errors

Complete the Implementation Summary in the task file before opening your PR.
```

---

## Phase 2: Shell Components

### TASK-104: OnboardingShell

```
You are assigned Task TASK-104 – "Create OnboardingShell Layout Wrapper".

Task file: .claude/plans/tasks/TASK-104-onboarding-shell.md

Instructions:
- Branch: feat/104-onboarding-shell
- Depends on: Phase 1 complete
- Create: src/components/onboarding/shell/OnboardingShell.tsx
- Create: src/components/onboarding/shell/index.ts
- This is a layout component - no business logic

Match existing styling exactly:
- Background: bg-gradient-to-br from-slate-50 to-blue-50
- Card: bg-white rounded-2xl shadow-xl p-8
- Centered: flex items-center justify-center
- Max width: max-w-xl w-full

Props:
- progressSlot?: React.ReactNode (rendered above card)
- navigationSlot?: React.ReactNode (rendered below content)
- children: React.ReactNode (rendered inside card)

Do NOT include:
- Progress indicator implementation
- Navigation buttons implementation
- Any business logic

Verification before PR:
- npm run type-check passes
- npm run lint passes
- Visual matches existing onboarding screens

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-105: ProgressIndicator

```
You are assigned Task TASK-105 – "Create Unified ProgressIndicator".

Task file: .claude/plans/tasks/TASK-105-progress-indicator.md

Instructions:
- Branch: feat/105-progress-indicator
- Depends on: Phase 1 complete (can parallel with TASK-104)
- Create: src/components/onboarding/shell/ProgressIndicator.tsx
- Update: src/components/onboarding/shell/index.ts
- This replaces duplicate progress indicators across codebase

Visual requirements (match existing SetupProgressIndicator.tsx):
- Circles: w-8 h-8 rounded-full
- Completed: bg-green-500 with checkmark
- Current: bg-blue-500 with ring highlight
- Pending: bg-gray-200
- Connecting lines: h-0.5 max-w-[48px]
- Labels: text-xs below circles

Props:
- steps: OnboardingStep[] (from flow)
- currentIndex: number
- viewingIndex?: number (for back navigation highlighting)

Key difference from old implementation:
- Reads progressLabel from step.meta (single source of truth)
- No hardcoded step arrays

Verification before PR:
- npm run type-check passes
- npm run lint passes
- Visual matches existing progress indicators

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-106: NavigationButtons

```
You are assigned Task TASK-106 – "Create NavigationButtons Component".

Task file: .claude/plans/tasks/TASK-106-navigation-buttons.md

Instructions:
- Branch: feat/106-navigation-buttons
- Depends on: Phase 1 complete (can parallel with TASK-104, TASK-105)
- Create: src/components/onboarding/shell/NavigationButtons.tsx
- Update: src/components/onboarding/shell/index.ts

Button styling (match existing):
- Back: bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200
- Next: bg-blue-500 text-white rounded-lg hover:bg-blue-600
- Skip: text-sm text-gray-500 underline (above main buttons)
- All: flex-1 px-4 py-3

Props:
- showBack, showNext: boolean
- skipConfig?: SkipConfig | false
- backLabel?, nextLabel?: string (defaults: "Back", "Continue")
- nextDisabled?: boolean
- onBack, onNext, onSkip?: () => void

Handle these combinations:
- Back + Next
- Next only
- Skip + Back + Next
- Skip + Next

Verification before PR:
- npm run type-check passes
- npm run lint passes
- All button combinations render correctly

Complete the Implementation Summary in the task file before opening your PR.
```

---

## Phase 3: Step Extraction

### TASK-107: PhoneTypeStep

```
You are assigned Task TASK-107 – "Extract PhoneTypeStep".

Task file: .claude/plans/tasks/TASK-107-phone-type-step.md

Instructions:
- Branch: feat/107-phone-type-step
- Depends on: Phase 2 complete
- Create: src/components/onboarding/steps/PhoneTypeStep.tsx
- Register in: src/components/onboarding/steps/index.ts
- Reference: src/components/PhoneTypeSelection.tsx (DO NOT modify)

Meta configuration:
- id: 'phone-type'
- progressLabel: 'Phone Type'
- platforms: ['macos', 'windows']
- navigation: { showBack: false, showNext: false }
- skip: false
- required: true
- getNextStepOverride: return 'android-coming-soon' if phoneType === 'android'

Content:
- Extract phone card UI from PhoneTypeSelection.tsx
- Use onAction({ type: 'SELECT_PHONE', phoneType: 'iphone' | 'android' })
- Do NOT include progress indicator or navigation buttons

This is the first step extraction - establish the pattern for others.

Verification before PR:
- npm run type-check passes
- npm run lint passes
- Step registered in STEP_REGISTRY

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-108: SecureStorageStep

```
You are assigned Task TASK-108 – "Extract SecureStorageStep (macOS Only)".

Task file: .claude/plans/tasks/TASK-108-secure-storage-step.md

Instructions:
- Branch: feat/108-secure-storage-step
- Depends on: Phase 2 complete (can parallel with other Phase 3)
- Create: src/components/onboarding/steps/SecureStorageStep.tsx
- Register in: src/components/onboarding/steps/index.ts
- Reference: src/components/KeychainExplanation.tsx (DO NOT modify)

CRITICAL - Platform restriction:
- platforms: ['macos'] - NOT Windows!
- If added to Windows flow, validation should throw

Meta configuration:
- id: 'secure-storage'
- progressLabel: 'Secure Storage'
- platforms: ['macos']
- navigation: { showBack: true, showNext: true }
- skip: false
- required: true

Content features:
- Lock icon header
- Keychain explanation text
- "Don't show again" checkbox
- Loading state for system dialog

Action: { type: 'SECURE_STORAGE_SETUP', dontShowAgain: boolean }

Verification before PR:
- npm run type-check passes
- Platform validation throws if added to Windows flow

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-109: EmailConnectStep (Highest Risk)

```
You are assigned Task TASK-109 – "Extract EmailConnectStep".

Task file: .claude/plans/tasks/TASK-109-email-connect-step.md

⚠️ HIGH RISK - This is the largest extraction (from 1,019 line file)

Instructions:
- Branch: feat/109-email-connect-step
- Depends on: Phase 2 complete (can parallel with other Phase 3)
- Create: src/components/onboarding/steps/EmailConnectStep.tsx
- Register in: src/components/onboarding/steps/index.ts
- Reference: src/components/EmailOnboardingScreen.tsx (DO NOT modify)

Meta configuration:
- id: 'email-connect'
- progressLabel: 'Email' (keep short!)
- platforms: ['macos', 'windows']
- navigation: { showBack: true, showNext: true }
- skip: { enabled: true, label: 'Skip for now', description: 'Connect later in Settings' }
- required: false
- canProceed: (context) => context.emailConnected

Focus on extracting:
- Provider card UI (Gmail/Outlook)
- Primary/secondary provider display
- Connection status indicator
- Connect button actions

Do NOT extract:
- Internal step navigation (old pattern, not needed)
- Phone type change within screen (separate concern)

This may need follow-up work for full feature parity.

Verification before PR:
- npm run type-check passes
- Skip configuration works
- Provider cards render correctly

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-110: PermissionsStep

```
You are assigned Task TASK-110 – "Extract PermissionsStep (macOS Only)".

Task file: .claude/plans/tasks/TASK-110-permissions-step.md

Instructions:
- Branch: feat/110-permissions-step
- Depends on: Phase 2 complete (can parallel with other Phase 3)
- Create: src/components/onboarding/steps/PermissionsStep.tsx
- Register in: src/components/onboarding/steps/index.ts
- Reference: src/components/PermissionsScreen.tsx (DO NOT modify)

CRITICAL - Platform restriction:
- platforms: ['macos'] - NOT Windows!

Meta configuration:
- id: 'permissions'
- progressLabel: 'Permissions'
- platforms: ['macos']
- navigation: { showBack: true, showNext: true }
- skip: false
- required: true
- canProceed: (context) => context.hasPermissions

Content features:
- Full Disk Access explanation
- System Settings guide/mockup
- "Open System Settings" button
- Permission status indicator

Action: { type: 'PERMISSION_GRANTED' }

Verification before PR:
- npm run type-check passes
- Platform validation throws if added to Windows flow

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-111: AppleDriverStep

```
You are assigned Task TASK-111 – "Extract AppleDriverStep (Windows Only)".

Task file: .claude/plans/tasks/TASK-111-apple-driver-step.md

Instructions:
- Branch: feat/111-apple-driver-step
- Depends on: Phase 2 complete (can parallel with other Phase 3)
- Create: src/components/onboarding/steps/AppleDriverStep.tsx
- Register in: src/components/onboarding/steps/index.ts
- Reference: src/components/AppleDriverSetup.tsx (DO NOT modify)

CRITICAL - Platform restriction:
- platforms: ['windows'] - NOT macOS!

Meta configuration:
- id: 'apple-driver'
- progressLabel: 'Install Tools'
- platforms: ['windows']
- navigation: { showBack: true, showNext: true }
- skip: { enabled: true, label: 'Skip for now', description: 'Install iTunes later' }
- required: false

Content features:
- iTunes/Apple driver explanation
- Download links (Apple site, Microsoft Store)
- Installation guidance

Action: { type: 'DRIVER_INSTALLED' }

Note: This step only shows for iPhone users on Windows.
Flow logic handles when to show it.

Verification before PR:
- npm run type-check passes
- Platform validation throws if added to macOS flow

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-112: AndroidComingSoonStep

```
You are assigned Task TASK-112 – "Extract AndroidComingSoonStep".

Task file: .claude/plans/tasks/TASK-112-android-coming-soon-step.md

Instructions:
- Branch: feat/112-android-coming-soon-step
- Depends on: Phase 2 complete (can parallel with other Phase 3)
- Create: src/components/onboarding/steps/AndroidComingSoonStep.tsx
- Register in: src/components/onboarding/steps/index.ts
- Reference: src/components/AndroidComingSoon.tsx (DO NOT modify)

Meta configuration:
- id: 'android-coming-soon'
- progressLabel: 'Android'
- platforms: ['macos', 'windows']
- navigation: { showBack: false, showNext: false } (custom buttons)
- skip: false
- required: false

SPECIAL: This step has custom navigation buttons in Content:
- "Go Back & Select iPhone" button
- "Continue with Email Only" button

Actions:
- { type: 'GO_BACK_SELECT_IPHONE' }
- { type: 'CONTINUE_EMAIL_ONLY' }

This step is reached via getNextStepOverride from phone-type when Android selected.

Verification before PR:
- npm run type-check passes
- Both custom buttons render and fire actions

Complete the Implementation Summary in the task file before opening your PR.
```

---

## Phase 4: Integration

### TASK-113: useOnboardingFlow Hook

```
You are assigned Task TASK-113 – "Create useOnboardingFlow Hook".

Task file: .claude/plans/tasks/TASK-113-use-onboarding-flow-hook.md

Instructions:
- Branch: feat/113-onboarding-flow-hook
- Depends on: Phase 3 complete
- Create: src/components/onboarding/hooks/useOnboardingFlow.ts
- Create: src/components/onboarding/hooks/index.ts

This hook orchestrates the entire flow:
- Loads platform-specific steps
- Manages current step index
- Handles navigation (next, previous, goTo)
- Processes step actions
- Builds context from app state

Return interface:
- steps: OnboardingStep[]
- currentIndex: number
- currentStep: OnboardingStep
- context: OnboardingContext
- goToNext, goToPrevious, goToStep
- handleAction, handleSkip
- isComplete, isFirstStep, isLastStep

Key behavior:
- goToNext checks getNextStepOverride before advancing
- handleAction processes step-specific actions
- Context is built from appState prop

Verification before PR:
- npm run type-check passes
- Navigation works correctly
- Step override (branching) works

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-114: Router Integration

```
You are assigned Task TASK-114 – "Integrate with AppRouter".

Task file: .claude/plans/tasks/TASK-114-router-integration.md

⚠️ HIGH RISK - This wires everything together

Instructions:
- Branch: feat/114-router-integration
- Depends on: TASK-113
- Create: src/components/onboarding/OnboardingFlow.tsx
- Update: src/appCore/AppRouter.tsx
- Update: src/components/onboarding/index.ts

OnboardingFlow component:
- Uses useOnboardingFlow hook
- Renders OnboardingShell with slots
- Maps StepActions to existing app handlers
- Renders current step's Content

Action → Handler mapping:
- SELECT_PHONE(iphone) → app.handleSelectIPhone()
- SELECT_PHONE(android) → app.handleSelectAndroid()
- EMAIL_CONNECTED → app.handleEmailOnboardingComplete()
- PERMISSION_GRANTED → app.handlePermissionsGranted()
- SECURE_STORAGE_SETUP → app.handleKeychainExplanationContinue()
- DRIVER_INSTALLED → app.handleAppleDriverSetupComplete()
- GO_BACK_SELECT_IPHONE → app.handleAndroidGoBack()
- CONTINUE_EMAIL_ONLY → app.handleAndroidContinueWithEmail()

AppRouter change:
- For onboarding steps, render <OnboardingFlow app={app} />
- Keep old components available for fallback

MUST TEST:
- Full macOS new user flow
- Full Windows new user flow
- Android redirect flow
- Skip email flow
- Back navigation

Verification before PR:
- npm run type-check passes
- npm test passes
- All flows work manually

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-115: Deprecate Old Components

```
You are assigned Task TASK-115 – "Deprecate Old Components".

Task file: .claude/plans/tasks/TASK-115-deprecate-old-components.md

Instructions:
- Branch: feat/115-deprecate-components
- Depends on: TASK-114
- Do NOT delete any files
- Add @deprecated JSDoc to old components

Files to deprecate:
- src/components/PhoneTypeSelection.tsx
- src/components/EmailOnboardingScreen.tsx
- src/components/KeychainExplanation.tsx
- src/components/PermissionsScreen.tsx
- src/components/AppleDriverSetup.tsx
- src/components/AndroidComingSoon.tsx
- src/components/SetupProgressIndicator.tsx

Add this pattern to each:
/**
 * @deprecated Use the new onboarding architecture instead:
 * - Step: src/components/onboarding/steps/[StepName].tsx
 * - Shell: src/components/onboarding/shell/OnboardingShell.tsx
 * - Hook: src/components/onboarding/hooks/useOnboardingFlow.ts
 *
 * Scheduled for removal in next major version.
 */

Do NOT:
- Delete any code
- Change any behavior
- Remove any exports
- Modify tests

Verification before PR:
- npm run type-check passes
- npm test passes (no changes to tests)
- IDE shows deprecation warnings

Complete the Implementation Summary in the task file before opening your PR.
```

---

### TASK-116: Update Tests

```
You are assigned Task TASK-116 – "Update Tests".

Task file: .claude/plans/tasks/TASK-116-update-tests.md

Instructions:
- Branch: feat/116-update-tests
- Depends on: TASK-115
- Ensure all existing tests pass
- Add baseline tests for new components

Existing tests (must still pass):
- EmailOnboardingScreen.test.tsx
- PhoneTypeSelection.test.tsx
- AppleDriverSetup.test.tsx
- KeychainExplanation.test.tsx

New tests to create:
- src/components/onboarding/__tests__/registry.test.ts
- src/components/onboarding/__tests__/flows.test.ts
- src/components/onboarding/__tests__/shell.test.tsx
- src/components/onboarding/__tests__/steps.test.tsx

Test focus:
- Registry validation (throws on mismatch, duplicates)
- Flow validation (platform errors, correct order)
- Shell renders children and slots
- At least one step (PhoneTypeStep) has component tests

Do NOT:
- Delete existing tests
- Aim for 100% coverage
- Add flaky tests

Verification before PR:
- npm test passes with 0 failures
- Coverage doesn't decrease

Complete the Implementation Summary in the task file before opening your PR.
```

---

## Sprint Completion Checklist

When all tasks are complete:

1. [ ] All task branches merged to integration branch
2. [ ] Integration branch CI is green
3. [ ] Manual testing of full flows complete
4. [ ] Old components marked deprecated
5. [ ] All tests passing
6. [ ] Integration branch merged to main
