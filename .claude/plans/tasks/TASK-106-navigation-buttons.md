# Task TASK-106: Create NavigationButtons Component

## Goal

Create a configurable navigation buttons component that renders Back, Next, and Skip buttons based on step configuration. This replaces the scattered, inconsistent button implementations across onboarding screens.

## Non-Goals

- Do NOT implement navigation logic (that's the hook's job)
- Do NOT modify existing components
- Do NOT add step-specific behavior

## Deliverables

1. New file: `src/components/onboarding/shell/NavigationButtons.tsx`
2. Update: `src/components/onboarding/shell/index.ts` (add export)

## Acceptance Criteria

- [ ] Renders Back button when `showBack` is true
- [ ] Renders Next/Continue button when `showNext` is true
- [ ] Renders Skip button when skip config is provided
- [ ] Skip button shows label from config
- [ ] Skip button shows description if provided
- [ ] Next button can be disabled via prop
- [ ] Custom labels supported for Back and Next
- [ ] Matches existing button styling
- [ ] Buttons fire provided callbacks

## Implementation Notes

### Component Interface

```typescript
// src/components/onboarding/shell/NavigationButtons.tsx

import React from 'react';
import type { SkipConfig } from '../types';

interface NavigationButtonsProps {
  /** Show back button */
  showBack: boolean;
  /** Show next/continue button */
  showNext: boolean;
  /** Skip configuration (false = no skip button) */
  skipConfig?: SkipConfig | false;
  /** Custom label for back button */
  backLabel?: string;
  /** Custom label for next button */
  nextLabel?: string;
  /** Disable next button */
  nextDisabled?: boolean;
  /** Callbacks */
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
}

/**
 * Navigation buttons for onboarding steps.
 * Renders Back, Next, and Skip based on configuration.
 */
export function NavigationButtons({
  showBack,
  showNext,
  skipConfig,
  backLabel = 'Back',
  nextLabel = 'Continue',
  nextDisabled = false,
  onBack,
  onNext,
  onSkip,
}: NavigationButtonsProps) {
  const showSkip = skipConfig && skipConfig !== false;

  return (
    <div className="mt-6">
      {/* Skip section (above main buttons) */}
      {showSkip && (
        <div className="text-center mb-4">
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {skipConfig.label}
          </button>
          {skipConfig.description && (
            <p className="text-xs text-gray-400 mt-1">
              {skipConfig.description}
            </p>
          )}
        </div>
      )}

      {/* Main navigation buttons */}
      <div className="flex gap-3">
        {showBack && (
          <button
            onClick={onBack}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            {backLabel}
          </button>
        )}
        {showNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

### Button Styling (Match Existing)

**Back Button:**
- `bg-gray-100 text-gray-700 rounded-lg font-medium`
- `hover:bg-gray-200 transition-colors`
- `flex-1 px-4 py-3`

**Next/Continue Button:**
- `bg-blue-500 text-white rounded-lg font-semibold`
- `hover:bg-blue-600 transition-colors`
- `disabled:opacity-50 disabled:cursor-not-allowed`
- `flex-1 px-4 py-3`

**Skip Button:**
- `text-sm text-gray-500 hover:text-gray-700 underline`
- Above main buttons, centered
- Description below in `text-xs text-gray-400`

### Layout Patterns

**Back + Next:**
```
[  Back  ] [  Continue  ]
```

**Next only:**
```
[       Continue       ]
```

**Skip + Next:**
```
        Skip for now
  You can do this later
[       Continue       ]
```

## Integration Notes

- Imports only from `../types.ts` (SkipConfig type)
- Will be used by OnboardingShell (passed to navigationSlot)
- Callbacks provided by parent component/hook

## Do / Don't

### Do:
- Match existing button styles exactly
- Handle all combinations of buttons
- Support disabled state for next
- Keep component pure (no internal state)

### Don't:
- Implement navigation logic
- Call router or state machine
- Add loading states (handled by parent)
- Use hard-coded text (props only)

## When to Stop and Ask

- If existing buttons have inconsistent styling across screens
- If unclear about skip button positioning
- If button combinations seem unusual

## Testing Expectations

- Unit test: Back renders when showBack=true
- Unit test: Back hidden when showBack=false
- Unit test: Next renders with custom label
- Unit test: Next disabled state works
- Unit test: Skip renders with description
- Snapshot tests for each combination

## PR Preparation

- Title: `feat(onboarding): add NavigationButtons component`
- Label: `phase-2`, `shell`
- Depends on: TASK-101 (types)

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/shell/NavigationButtons.tsx

Button configurations tested:
- [ ] Back + Next
- [ ] Next only
- [ ] Back only
- [ ] Skip + Next
- [ ] All three
- [ ] None (edge case)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] Visual matches existing buttons
```
