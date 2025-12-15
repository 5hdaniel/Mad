# Task TASK-105: Create Unified ProgressIndicator Component

## Goal

Create a single, authoritative progress indicator component that reads step information from the registry. This replaces the duplicate implementations currently scattered across components.

## Non-Goals

- Do NOT modify existing SetupProgressIndicator.tsx yet
- Do NOT modify EmailOnboardingScreen's embedded progress indicator yet
- Do NOT integrate with the router (that's TASK-114)

## Deliverables

1. New file: `src/components/onboarding/shell/ProgressIndicator.tsx`
2. Update: `src/components/onboarding/shell/index.ts` (add export)

## Acceptance Criteria

- [x] Accepts array of steps (from registry) and current index
- [x] Renders circular step indicators matching existing design
- [x] Completed steps show green checkmark
- [x] Current step shows blue with ring highlight
- [x] Pending steps show gray
- [x] Connecting lines between circles
- [x] Labels display `progressLabel` from step meta
- [x] Labels truncate gracefully if too long
- [x] Component is responsive
- [x] Matches visual style of existing SetupProgressIndicator.tsx

## Implementation Notes

### Component Interface

```typescript
// src/components/onboarding/shell/ProgressIndicator.tsx

import React from 'react';
import type { OnboardingStep } from '../types';

interface ProgressIndicatorProps {
  /** Ordered list of steps from the flow */
  steps: OnboardingStep[];
  /** Current step index (0-based) */
  currentIndex: number;
  /** Optional: which step user is viewing (for back navigation) */
  viewingIndex?: number;
}

/**
 * Progress indicator showing onboarding step progression.
 * Reads labels from step metadata - single source of truth.
 */
export function ProgressIndicator({
  steps,
  currentIndex,
  viewingIndex,
}: ProgressIndicatorProps) {
  const activeIndex = viewingIndex ?? currentIndex;

  return (
    <div className="mb-8">
      {/* Circles row */}
      <div className="flex items-center justify-center px-2 mb-3">
        {steps.map((step, index) => (
          <React.Fragment key={step.meta.id}>
            {/* Step circle */}
            <StepCircle
              stepNumber={index + 1}
              status={getStepStatus(index, currentIndex, activeIndex)}
            />
            {/* Connecting line (except after last) */}
            {index < steps.length - 1 && (
              <ConnectingLine completed={index < currentIndex} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Labels row */}
      <div className="flex items-start justify-center px-2">
        {steps.map((step, index) => (
          <React.Fragment key={`label-${step.meta.id}`}>
            <StepLabel
              label={step.meta.progressLabel}
              isActive={index === activeIndex}
            />
            {index < steps.length - 1 && <LabelSpacer />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

type StepStatus = 'completed' | 'current' | 'pending';

function getStepStatus(
  index: number,
  currentIndex: number,
  activeIndex: number
): StepStatus {
  if (index < currentIndex) return 'completed';
  if (index === activeIndex) return 'current';
  return 'pending';
}
```

### Visual Specifications (Match Existing)

**Step Circle:**
- Size: `w-8 h-8`
- Completed: `bg-green-500 text-white` with checkmark SVG
- Current: `bg-blue-500 text-white` with number, `ring-2 ring-offset-2 ring-blue-500`
- Pending: `bg-gray-200 text-gray-500` with number

**Connecting Line:**
- Size: `h-0.5 mx-1 max-w-[48px] flex-1`
- Completed: `bg-green-500`
- Pending: `bg-gray-200`

**Label:**
- Active: `text-blue-600 font-medium`
- Inactive: `text-gray-500`
- Size: `text-xs text-center max-w-[56px]`

## Integration Notes

- Imports from `../types.ts` (TASK-101)
- Does NOT import from step registry (receives steps as prop)
- Will be used by OnboardingShell (passed to progressSlot)

## Do / Don't

### Do:
- Match existing visual design pixel-perfect
- Use transition classes for smooth state changes
- Handle edge cases (0 steps, 1 step)
- Extract sub-components (StepCircle, ConnectingLine, StepLabel)

### Don't:
- Access step registry directly
- Add navigation functionality (that's elsewhere)
- Modify existing progress indicators
- Use hard-coded step counts

## When to Stop and Ask

- If existing progress indicators have inconsistent styling
- If unclear about ring highlight behavior
- If step array could be empty (edge case handling)

## Testing Expectations

- Snapshot test: Renders correctly with 4 steps
- Unit test: Step 0 shows as current when currentIndex=0
- Unit test: Step 0 shows completed when currentIndex=1
- Unit test: Handles viewingIndex for back navigation

## PR Preparation

- Title: `feat(onboarding): add unified ProgressIndicator component`
- Label: `phase-2`, `shell`
- Depends on: TASK-101

## Implementation Summary (Engineer-Owned)

**Completed: 2025-12-14**

```
Files created:
- [x] src/components/onboarding/shell/ProgressIndicator.tsx
- [x] src/components/onboarding/shell/index.ts

Sub-components:
- [x] StepCircle - renders circle with status styling (completed/current/pending)
- [x] ConnectingLine - renders line between circles with correct colors
- [x] StepLabel - renders label below circle with active/inactive styling
- [x] LabelSpacer - maintains alignment between labels
- [x] EdgeSpacer - invisible spacers at edges (matching original design)
- [x] CheckmarkIcon - SVG checkmark for completed steps

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] Visual matches existing SetupProgressIndicator
```

### Notes

**Design Decisions:**
- Added `EdgeSpacer` and `LabelEdgeSpacer` helper components to match the original invisible spacers in SetupProgressIndicator.tsx (lines 37, 79, 85, 107)
- Extracted `CheckmarkIcon` as a separate component for cleaner code
- Added `transition-all` classes to StepCircle and ConnectingLine for smooth state changes
- Added early return for empty steps array as edge case handling

**Visual Matching:**
- All Tailwind classes directly copied from SetupProgressIndicator.tsx:
  - Circle: `w-8 h-8 rounded-full`
  - Completed: `bg-green-500 text-white`
  - Current: `bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500`
  - Pending: `bg-gray-200 text-gray-500`
  - Line: `flex-1 h-0.5 mx-1 max-w-[48px]`
  - Labels: `text-xs text-center max-w-[56px]`

**No Deviations from spec.** All acceptance criteria met.
