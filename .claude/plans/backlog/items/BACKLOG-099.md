# BACKLOG-099: Split EmailOnboardingScreen.tsx

## Priority: High

## Category: refactor

## Summary

Split the large `EmailOnboardingScreen.tsx` (1,203 lines) into smaller, focused components and hooks. This is one of the largest files in the codebase.

## Problem

`EmailOnboardingScreen.tsx` at 1,203 lines is the largest component in the codebase. It likely contains:
- Multiple onboarding steps/screens
- Provider selection (Gmail/Outlook)
- Authentication flows
- Permission handling
- Progress tracking
- State management for the entire flow

This size makes the component:
- Difficult to understand and maintain
- Hard to test individual pieces
- Prone to merge conflicts
- Slow to navigate in IDE

## Solution

Analyze and extract logical pieces while keeping the component in the existing `onboarding/` module structure.

### Target Structure

```
src/components/
+-- onboarding/
    +-- index.ts                           # Barrel export
    +-- EmailOnboardingScreen.tsx          # Main orchestrator (target: <300 lines)
    +-- components/
    |   +-- ProviderSelection.tsx          # Gmail/Outlook selection
    |   +-- GmailAuthStep.tsx              # Gmail authentication
    |   +-- OutlookAuthStep.tsx            # Outlook authentication
    |   +-- PermissionsStep.tsx            # Permission requests
    |   +-- OnboardingProgress.tsx         # Progress indicator
    |   +-- OnboardingComplete.tsx         # Completion screen
    +-- hooks/
    |   +-- useOnboardingFlow.ts           # Flow state machine
    |   +-- useProviderAuth.ts             # Auth handling
    +-- __tests__/
        +-- EmailOnboardingScreen.test.tsx
        +-- ProviderSelection.test.tsx
        +-- useOnboardingFlow.test.ts
```

## Implementation Phases

### Phase 1: Analysis (~30 min)
1. Read and understand the current component structure
2. Identify the different "steps" in the onboarding flow
3. Map state and prop flows
4. Document extraction plan with specific line ranges

### Phase 2: Hook Extraction (~45 min)
1. Extract flow state management to `useOnboardingFlow.ts`
2. Extract auth logic to `useProviderAuth.ts`
3. Update main component to use hooks

### Phase 3: Step Extraction (~90 min)
1. Extract provider selection UI
2. Extract Gmail auth step
3. Extract Outlook auth step
4. Extract permissions step
5. Extract progress/completion UI

### Phase 4: Cleanup (~20 min)
1. Update barrel exports
2. Update all imports
3. Verify tests pass
4. Final review

## Acceptance Criteria

- [ ] `EmailOnboardingScreen.tsx` reduced to <300 lines
- [ ] At least 4 sub-components extracted
- [ ] At least 1 custom hook extracted
- [ ] All functionality preserved (no behavior changes)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Manual testing of onboarding flow passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 14-18 | Largest file in codebase |
| Tokens | ~70K | |
| Time | 2.5-3.5 hours | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 7-9 |
| Tokens | ~35K |
| Time | 1.5-2 hours |

## Dependencies

- None (onboarding/ module already exists)

## Risks

| Risk | Mitigation |
|------|------------|
| Complex flow state management | Careful hook extraction, keep state centralized |
| Auth provider integration points | Test each step independently |
| Breaking onboarding for new users | Manual testing required |

## Testing Considerations

The onboarding flow is critical for new users. Manual testing should include:
1. Fresh install experience
2. Gmail authentication flow
3. Outlook authentication flow
4. Permission granting
5. Flow completion

## Notes

This is a larger refactoring task that may benefit from being broken into multiple TASKs during sprint planning:
- TASK-A: Analysis and hook extraction
- TASK-B: Provider selection extraction
- TASK-C: Auth steps extraction
- TASK-D: Progress/completion extraction
