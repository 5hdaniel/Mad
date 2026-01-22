# BACKLOG-111: Migrate Components to Service Abstractions

## Priority: High

## Category: refactor

## Summary

Migrate 423 direct `window.api` calls across 43 component files to use the service layer abstractions in `src/services/`.

## Problem

Components are directly calling `window.api` and `window.electron` instead of using the service abstractions created in TASK-604. This violates the architecture principle of having clear service boundaries and makes the codebase harder to test and maintain.

**Scope:**
- 423 direct `window.api` calls
- 43 component files affected
- Key offenders:
  - `Login.tsx`: 17 calls
  - `EmailOnboardingScreen.tsx`: 15 calls
  - `Settings.tsx`: 10 calls

## Solution

Migrate components to use `src/services/` abstractions instead of direct IPC calls.

### Before (Direct Call)

```typescript
// In component
const handleLogin = async () => {
  const result = await window.api.auth.login(credentials);
  if (result.success) {
    // handle success
  }
};
```

### After (Service Abstraction)

```typescript
// In component
import { authService } from '@/services/authService';

const handleLogin = async () => {
  const result = await authService.login(credentials);
  if (result.success) {
    // handle success
  }
};
```

### Migration Strategy

1. **Phase 1: High-Priority Files** (Login, EmailOnboarding, Settings)
   - These have the most calls and highest impact

2. **Phase 2: Medium-Priority Files**
   - Files with 5-10 direct calls

3. **Phase 3: Low-Priority Files**
   - Files with <5 direct calls

### Service Layer Verification

Before migration, verify that `src/services/` has abstractions for all needed operations. If not, create them following the patterns established in TASK-604.

## Implementation Phases

### Phase 1: Audit & Planning (~2 hours)
1. Run grep to catalog all `window.api` and `window.electron` calls
2. Map each call to existing service abstraction
3. Identify missing service methods
4. Create migration plan by file

### Phase 2: Service Layer Completion (~4 hours)
1. Add any missing service methods
2. Ensure consistent error handling
3. Add TypeScript types

### Phase 3: High-Priority Migration (~6 hours)
1. Migrate `Login.tsx` (17 calls)
2. Migrate `EmailOnboardingScreen.tsx` (15 calls)
3. Migrate `Settings.tsx` (10 calls)
4. Update tests

### Phase 4: Medium-Priority Migration (~6 hours)
1. Migrate files with 5-10 calls
2. Update tests

### Phase 5: Low-Priority Migration (~4 hours)
1. Migrate remaining files
2. Update tests
3. Add ESLint rule to prevent new direct calls

## Acceptance Criteria

- [ ] All `window.api` calls migrated to service abstractions
- [ ] All `window.electron` calls migrated to service abstractions
- [ ] No direct IPC calls in components
- [ ] ESLint rule added to prevent regression
- [ ] All functionality preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Raw Estimate | Notes |
|--------|--------------|-------|
| Turns | 80-100 | Large migration, many files |
| Tokens | ~300K | |
| Time | 2-3 days | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 40-50 |
| Tokens | ~150K |
| Time | 1-1.5 days |

## Dependencies

- TASK-604 (Service layer creation) - Already complete
- Should be done after BACKLOG-107 (useAppStateMachine split) to avoid conflicts

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Test each migrated component |
| Missing service abstractions | Complete service layer first |
| Merge conflicts with parallel work | Schedule as dedicated sprint |

## Notes

**This item is SR Engineer sourced from architecture review.**

This is a significant undertaking that will substantially improve code quality and testability. Consider breaking into multiple TASKs by component group:

- TASK-A: Service layer completion + ESLint rule
- TASK-B: Login.tsx migration
- TASK-C: EmailOnboardingScreen.tsx migration
- TASK-D: Settings.tsx migration
- TASK-E: Remaining files migration

**Files to modify:**
- 43 component files with direct IPC calls
- `src/services/*.ts` - Potential additions
- `.eslintrc.js` - New rule for `window.api` prevention
