# BACKLOG-107: Split useAppStateMachine.ts into Flow Hooks

## Priority: Critical

## Category: refactor

## Summary

Split the monolithic `useAppStateMachine.ts` (1,117 lines, 3.7x over target of 300) into dedicated flow-specific hooks following the existing TODO plan in the file.

## Problem

`useAppStateMachine.ts` at 1,117 lines is 3.7x over the 300-line target and violates the architecture guardrails in `.claude/docs/shared/architecture-guardrails.md`. The file contains multiple distinct state flows that should be separated:

- Authentication flow
- Secure storage flow
- Phone onboarding flow
- Email onboarding flow
- Permissions flow

## Solution

Extract each flow into its own dedicated hook as outlined in the existing TODO comments within the file:

### Target Structure

```
src/hooks/
+-- useAppStateMachine.ts      # Main orchestrator (target: <300 lines)
+-- flows/
    +-- index.ts               # Barrel export
    +-- useAuthFlow.ts         # Authentication state
    +-- useSecureStorageFlow.ts # Secure storage state
    +-- usePhoneOnboardingFlow.ts # Phone onboarding state
    +-- useEmailOnboardingFlow.ts # Email onboarding state
    +-- usePermissionsFlow.ts  # Permissions state
    +-- types.ts               # Shared flow types
```

## Implementation Phases

### Phase 1: Analysis (~1 hour)
1. Read the existing TODO plan in the file
2. Map out state transitions for each flow
3. Identify shared state/context dependencies
4. Document extraction plan

### Phase 2: Extract useAuthFlow (~2 hours)
1. Extract authentication-related state and transitions
2. Create proper TypeScript interfaces
3. Update main hook to use extracted flow
4. Add tests

### Phase 3: Extract useSecureStorageFlow (~1.5 hours)
1. Extract secure storage state and transitions
2. Update main hook to use extracted flow
3. Add tests

### Phase 4: Extract usePhoneOnboardingFlow (~2 hours)
1. Extract phone onboarding state and transitions
2. Handle complex device detection logic
3. Update main hook to use extracted flow
4. Add tests

### Phase 5: Extract useEmailOnboardingFlow (~2 hours)
1. Extract email onboarding state and transitions
2. Handle OAuth flow integration
3. Update main hook to use extracted flow
4. Add tests

### Phase 6: Extract usePermissionsFlow (~1.5 hours)
1. Extract permissions state and transitions
2. Update main hook to use extracted flow
3. Add tests

### Phase 7: Final Cleanup (~1 hour)
1. Create barrel exports
2. Update all imports
3. Verify all tests pass
4. Document the new structure

## Acceptance Criteria

- [ ] `useAppStateMachine.ts` reduced to <300 lines
- [ ] At least 5 flow hooks extracted
- [ ] All state transitions preserved (no behavior changes)
- [ ] Test coverage maintained or improved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in onboarding or auth flows

## Estimated Effort

| Metric | Raw Estimate | Notes |
|--------|--------------|-------|
| Turns | 60-80 | Large refactor, many files |
| Tokens | ~200K | |
| Time | 2-3 days | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 30-40 |
| Tokens | ~100K |
| Time | 1-1.5 days |

## Dependencies

- TASK-614 (useAppStateMachine tests) should be completed first
- No blocking dependencies on other BACKLOG items

## Risks

| Risk | Mitigation |
|------|------------|
| Complex state interdependencies | Careful analysis of existing TODO plan |
| Breaking onboarding flow | Extensive testing at each phase |
| Hidden side effects | Integration tests for full flows |

## Notes

**This item is SR Engineer sourced from architecture review.**

The file already contains a TODO plan for this extraction. The TODO comments should be followed as the primary guide, with adjustments as needed during implementation.

This is a multi-day effort that should be broken into multiple TASKs during sprint planning:
- TASK-A: Analysis + useAuthFlow extraction
- TASK-B: useSecureStorageFlow + usePhoneOnboardingFlow extraction
- TASK-C: useEmailOnboardingFlow + usePermissionsFlow extraction
- TASK-D: Final cleanup and testing
