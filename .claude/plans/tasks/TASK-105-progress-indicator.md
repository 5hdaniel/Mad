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

- [ ] Accepts array of steps (from registry) and current index
- [ ] Renders circular step indicators matching existing design
- [ ] Completed steps show green checkmark
- [ ] Current step shows blue with ring highlight
- [ ] Pending steps show gray
- [ ] Connecting lines between circles
- [ ] Labels display `progressLabel` from step meta
- [ ] Labels truncate gracefully if too long
- [ ] Component is responsive
- [ ] Matches visual style of existing SetupProgressIndicator.tsx

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

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/shell/ProgressIndicator.tsx

Sub-components:
- [ ] StepCircle
- [ ] ConnectingLine
- [ ] StepLabel
- [ ] LabelSpacer

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Visual matches existing SetupProgressIndicator
```
