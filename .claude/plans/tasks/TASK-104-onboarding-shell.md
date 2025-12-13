# Task TASK-104: Create OnboardingShell Layout Wrapper

## Goal

Create a unified layout wrapper component that provides consistent structure for all onboarding steps. This shell handles the outer layout (background, centering, card container) while delegating content and progress/navigation to child components.

## Non-Goals

- Do NOT implement ProgressIndicator (that's TASK-105)
- Do NOT implement NavigationButtons (that's TASK-106)
- Do NOT extract actual step content (Phase 3)
- Do NOT modify existing onboarding components

## Deliverables

1. New file: `src/components/onboarding/shell/OnboardingShell.tsx`
2. New file: `src/components/onboarding/shell/index.ts` (exports)

## Acceptance Criteria

- [ ] `OnboardingShell` component renders consistent layout structure
- [ ] Background gradient matches existing: `bg-gradient-to-br from-slate-50 to-blue-50`
- [ ] Card container matches existing: `bg-white rounded-2xl shadow-xl p-8`
- [ ] Centered layout with `max-w-xl w-full`
- [ ] Renders children (step content) in correct position
- [ ] Accepts slots for progress indicator and navigation buttons
- [ ] Props are fully typed
- [ ] Component is exported from shell/index.ts

## Implementation Notes

### Component Structure

```typescript
// src/components/onboarding/shell/OnboardingShell.tsx

import React from 'react';

interface OnboardingShellProps {
  /** Progress indicator component (rendered above card) */
  progressSlot?: React.ReactNode;
  /** Navigation buttons component (rendered below content) */
  navigationSlot?: React.ReactNode;
  /** Step content (rendered inside card) */
  children: React.ReactNode;
  /** Optional custom max-width class */
  maxWidth?: string;
}

/**
 * Unified layout wrapper for all onboarding steps.
 * Provides consistent background, centering, and card structure.
 */
export function OnboardingShell({
  progressSlot,
  navigationSlot,
  children,
  maxWidth = 'max-w-xl',
}: OnboardingShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className={`${maxWidth} w-full`}>
        {/* Progress indicator slot */}
        {progressSlot}

        {/* Main card container */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {children}
        </div>

        {/* Navigation buttons slot */}
        {navigationSlot}
      </div>
    </div>
  );
}
```

### Export File

```typescript
// src/components/onboarding/shell/index.ts
export { OnboardingShell } from './OnboardingShell';
```

### Directory Structure After This Task

```
src/components/onboarding/
├── types.ts                 ← TASK-101
├── steps/
│   └── index.ts             ← TASK-102
├── flows/
│   └── ...                  ← TASK-103
└── shell/
    ├── index.ts             ← YOU CREATE
    └── OnboardingShell.tsx  ← YOU CREATE
```

## Integration Notes

- NO imports from other onboarding files (self-contained)
- Will be used by useOnboardingFlow hook (TASK-113)
- Progress and navigation components plugged in via slots

## Do / Don't

### Do:
- Match existing visual styling exactly
- Use Tailwind classes consistent with codebase
- Keep component focused on layout only
- Document props with JSDoc

### Don't:
- Add business logic
- Import step types (not needed for shell)
- Hard-code progress or navigation components
- Change existing styling patterns

## When to Stop and Ask

- If existing onboarding screens use inconsistent styling
- If unclear about gradient or card styling
- If slot pattern seems incorrect for this use case

## Testing Expectations

- Snapshot test: Shell renders correctly
- Unit test: Children render in card
- Unit test: Progress slot renders above card
- Unit test: Navigation slot renders (position TBD)

## PR Preparation

- Title: `feat(onboarding): add OnboardingShell layout wrapper`
- Label: `phase-2`, `shell`
- Depends on: Phase 1 complete

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/shell/OnboardingShell.tsx
- [ ] src/components/onboarding/shell/index.ts

Props implemented:
- [ ] progressSlot
- [ ] navigationSlot
- [ ] children
- [ ] maxWidth

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Visual styling matches existing screens
```
