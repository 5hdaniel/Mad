# BACKLOG-098: Split AuditTransactionModal.tsx and Create audit/ Module

## Priority: High

## Category: refactor

## Summary

Split the large `AuditTransactionModal.tsx` (1,169 lines) into smaller, focused components and create a dedicated `audit/` module for audit-related functionality.

## Problem

`AuditTransactionModal.tsx` at 1,169 lines is one of the largest components in the codebase. It likely contains:
- Modal container logic
- Audit form handling
- Validation logic
- Multiple sub-sections
- State management

This violates the single responsibility principle and makes the component difficult to maintain, test, and reason about.

## Solution

1. Analyze the component structure
2. Extract logical sub-components
3. Extract custom hooks for state management
4. Create `audit/` module to house all extracted pieces

### Target Structure

```
src/components/
+-- audit/
    +-- index.ts                      # Barrel export
    +-- AuditTransactionModal.tsx     # Main modal (target: <300 lines)
    +-- components/
    |   +-- AuditForm.tsx             # Form component
    |   +-- AuditSummary.tsx          # Summary display
    |   +-- AuditActions.tsx          # Action buttons
    |   +-- AuditValidation.tsx       # Validation messages
    +-- hooks/
    |   +-- useAuditForm.ts           # Form state management
    |   +-- useAuditValidation.ts     # Validation logic
    +-- __tests__/
        +-- AuditTransactionModal.test.tsx
        +-- AuditForm.test.tsx
        +-- useAuditForm.test.ts
```

## Implementation Phases

### Phase 1: Analysis (~30 min)
1. Read and understand the current component structure
2. Identify logical boundaries for extraction
3. Map state and prop flows
4. Document extraction plan

### Phase 2: Hook Extraction (~45 min)
1. Extract form state to `useAuditForm.ts`
2. Extract validation logic to `useAuditValidation.ts`
3. Update main component to use hooks

### Phase 3: Component Extraction (~60 min)
1. Extract form section to `AuditForm.tsx`
2. Extract summary section to `AuditSummary.tsx`
3. Extract action buttons to `AuditActions.tsx`
4. Update main component to compose extracted pieces

### Phase 4: Module Organization (~20 min)
1. Create `audit/` directory structure
2. Move all files to new locations
3. Create barrel exports
4. Update all imports

## Acceptance Criteria

- [ ] `AuditTransactionModal.tsx` reduced to <300 lines
- [ ] At least 3 sub-components extracted
- [ ] At least 1 custom hook extracted
- [ ] `audit/` module created with proper structure
- [ ] All functionality preserved (no behavior changes)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Existing tests updated/pass

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 12-16 | Large refactor requiring careful analysis |
| Tokens | ~60K | |
| Time | 2-3 hours | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 6-8 |
| Tokens | ~30K |
| Time | 1-1.5 hours |

## Dependencies

- Should be executed after TASK-618 (orphaned files cleanup)
- No blocking dependencies on other BACKLOG items

## Risks

| Risk | Mitigation |
|------|------------|
| Tight coupling in original component | Careful analysis before extraction |
| Breaking existing functionality | Keep all tests passing throughout |
| Prop drilling after extraction | Use context or composition patterns if needed |

## Notes

This is a larger refactoring task that may benefit from being broken into multiple TASKs during sprint planning:
- TASK-A: Analysis and hook extraction
- TASK-B: Component extraction
- TASK-C: Module organization
