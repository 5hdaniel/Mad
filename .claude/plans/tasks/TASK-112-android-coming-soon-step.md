# Task TASK-112: Extract AndroidComingSoonStep

## Goal

Extract the Android "Coming Soon" screen into the new step architecture. This is an edge case step shown when users select Android.

## Non-Goals

- Do NOT delete AndroidComingSoon.tsx (deprecation is TASK-115)
- Do NOT modify AppRouter routing yet (TASK-114)
- Do NOT implement actual Android support

## Deliverables

1. New file: `src/components/onboarding/steps/AndroidComingSoonStep.tsx`
2. Update: `src/components/onboarding/steps/index.ts` (register step)

## Acceptance Criteria

- [ ] `meta.id` is `'android-coming-soon'`
- [ ] `meta.progressLabel` is `'Android'` (or omit from progress)
- [ ] `meta.platforms` is `['macos', 'windows']`
- [ ] `meta.navigation.showBack` is `false` (custom back button)
- [ ] `meta.navigation.showNext` is `false` (custom continue button)
- [ ] Content shows "Coming Soon" message
- [ ] Content provides "Go Back" to reselect phone
- [ ] Content provides "Continue with Email Only"
- [ ] Step registered in STEP_REGISTRY

## Implementation Notes

### Special Flow Behavior

This step is reached via `getNextStepOverride` from phone-type step when Android is selected. It's not part of the normal linear flow.

```typescript
// In PhoneTypeStep meta
getNextStepOverride: (context) => {
  if (context.phoneType === 'android') {
    return 'android-coming-soon';
  }
  return null;
}
```

### Meta Configuration

```typescript
export const meta: OnboardingStepMeta = {
  id: 'android-coming-soon',
  progressLabel: 'Android',
  title: 'Android Support Coming Soon',
  platforms: ['macos', 'windows'],
  navigation: {
    showBack: false,  // Custom "Go Back & Select iPhone" button
    showNext: false,  // Custom "Continue with Email Only" button
  },
  skip: false,
  required: false,  // Can exit via either button
};
```

### Custom Actions

This step has custom navigation that doesn't fit the standard Back/Next pattern:

```typescript
| { type: 'GO_BACK_SELECT_IPHONE' }  // Returns to phone selection
| { type: 'CONTINUE_EMAIL_ONLY' }    // Proceeds without phone sync
```

The Content component renders its own buttons that fire these actions.

### Content from AndroidComingSoon.tsx (199 lines)

Key elements:
- Android icon with "Coming Soon" badge
- Feature preview (what's coming)
- Notification sign-up mention
- "Continue with Email Only" button
- "Go Back & Select iPhone" button

## Integration Notes

- Custom buttons inside Content (not using NavigationButtons)
- Actions need special handling in hook to redirect flow
- Progress indicator may need to handle this edge case

## Do / Don't

### Do:
- Keep both custom action buttons
- Match existing visual design
- Fire appropriate actions
- Show encouraging message

### Don't:
- Use standard navigation buttons
- Implement actual Android features
- Remove either navigation option
- Make it blocking (both exits work)

## When to Stop and Ask

- If custom actions don't fit the pattern
- If progress bar handling is unclear
- If flow redirection is complex

## Testing Expectations

- Unit test: Renders coming soon message
- Unit test: Go Back action fires
- Unit test: Continue Email Only action fires
- Unit test: Both buttons render

## PR Preparation

- Title: `feat(onboarding): extract AndroidComingSoonStep`
- Label: `phase-3`, `step-extraction`
- Depends on: Phase 2 complete

## Implementation Summary (Engineer-Owned)

*To be completed by implementing engineer after task completion.*

```
Files created:
- [ ] src/components/onboarding/steps/AndroidComingSoonStep.tsx

Features implemented:
- [ ] Coming soon message with Android icon
- [ ] Feature preview list
- [ ] "Go Back & Select iPhone" button
- [ ] "Continue with Email Only" button
- [ ] Custom action firing

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```
