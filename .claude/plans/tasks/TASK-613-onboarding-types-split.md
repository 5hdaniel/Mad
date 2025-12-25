# TASK-613: Onboarding Types Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety
**Priority:** MEDIUM
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start Time:** [timestamp]
**Task End Time:** [timestamp]

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |
```

---

## Objective

Split `src/components/onboarding/types.ts` (629 lines) into domain-specific type files.

---

## Current State

Single types file contains:
- Step type definitions
- Flow type definitions
- State machine types
- Context types
- Action types
- Guard types

---

## Requirements

### Must Do
1. Split into focused type files
2. Maintain all existing exports
3. Update imports across onboarding components
4. Keep barrel export for backwards compatibility

### Must NOT Do
- Change type definitions
- Break existing components
- Remove any types

---

## Proposed Structure

```
src/components/onboarding/types/
  index.ts          (barrel export - maintains backwards compatibility)
  steps.ts          (step definitions)
  flows.ts          (flow types)
  state.ts          (state machine types)
  context.ts        (context types)
  actions.ts        (action types)
  guards.ts         (guard types)
```

---

## Files to Create

| File | Content |
|------|---------|
| `types/index.ts` | Barrel export |
| `types/steps.ts` | Step definitions |
| `types/flows.ts` | Flow types |
| `types/state.ts` | State machine types |
| `types/context.ts` | Context types |
| `types/actions.ts` | Action types |
| `types/guards.ts` | Guard types |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/onboarding/types.ts` | Replace with re-export from types/ |

---

## Testing Requirements

1. **Type Check**
   - All imports resolve
   - No type errors

2. **Existing Tests**
   - All onboarding tests pass

---

## Acceptance Criteria

- [ ] Types split into focused files
- [ ] Barrel export maintains backwards compatibility
- [ ] All existing tests pass
- [ ] `npm run type-check` passes

---

## Branch

```
feature/TASK-613-onboarding-types
```
