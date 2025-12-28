# BACKLOG-094: Create llm/ Module for LLM/AI Components

## Priority: Medium

## Category: refactor

## Summary

Create a dedicated `llm/` module for LLM/AI-related UI components. This consolidates AI-specific error handling and display components in one location.

## Problem

LLM-related components are scattered at the root of `src/components/`:

| File | Lines | Current Location | Description |
|------|-------|------------------|-------------|
| `LLMErrorBoundary.tsx` | 125 | Root | Error boundary specific to LLM operations |
| `LLMErrorDisplay.tsx` | 134 | Root | Error display component for LLM failures |

These components are closely related and should be grouped together.

## Solution

Create a dedicated `llm/` module:

```
src/components/
+-- llm/
    +-- index.ts                 # Barrel export
    +-- LLMErrorBoundary.tsx     # Moved from root
    +-- LLMErrorDisplay.tsx      # Moved from root
    +-- __tests__/
        +-- LLMErrorBoundary.test.tsx
        +-- LLMErrorDisplay.test.tsx
```

## Implementation

1. Create `src/components/llm/` directory
2. Move `LLMErrorBoundary.tsx` to `llm/`
3. Move `LLMErrorDisplay.tsx` to `llm/`
4. Move associated test files to `llm/__tests__/`
5. Create barrel export (`index.ts`)
6. Update all imports across the codebase

## Files to Move

### Components
- `src/components/LLMErrorBoundary.tsx` -> `src/components/llm/LLMErrorBoundary.tsx`
- `src/components/LLMErrorDisplay.tsx` -> `src/components/llm/LLMErrorDisplay.tsx`

### Tests (if exist)
- `src/components/__tests__/LLMErrorBoundary.test.tsx` -> `src/components/llm/__tests__/LLMErrorBoundary.test.tsx`
- `src/components/__tests__/LLMErrorDisplay.test.tsx` -> `src/components/llm/__tests__/LLMErrorDisplay.test.tsx`

## Barrel Export

```typescript
// src/components/llm/index.ts
export { LLMErrorBoundary } from './LLMErrorBoundary';
export { LLMErrorDisplay } from './LLMErrorDisplay';
```

## Acceptance Criteria

- [ ] `llm/` directory created
- [ ] Both components moved
- [ ] Test files relocated (if exist)
- [ ] Barrel export created
- [ ] All imports updated
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 2-3 | Small module, few imports |
| Tokens | ~10K | |
| Time | 15-20 min | |

## Dependencies

- None (can be executed independently)

## Notes

- TASK-618 identifies `LLMLoadingStates.tsx` as orphaned - this should be deleted, not moved
- The `llm/` module is for active, used components only
