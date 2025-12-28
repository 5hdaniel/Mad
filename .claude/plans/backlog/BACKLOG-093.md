# BACKLOG-093: Create common/ Module for Shared Utility Components

## Priority: Medium

## Category: refactor

## Summary

Create a `common/` module to house shared utility components that are used across multiple features. This includes error boundaries, toast notifications, and other cross-cutting UI components.

## Problem

Several utility components currently sit at the root of `src/components/` without a clear organizational home:

| File | Lines | Current Location | Description |
|------|-------|------------------|-------------|
| `ErrorBoundary.tsx` | 447 | Root | Global error handling component |
| `Toast.tsx` | 117 | Root | Notification toast component |

These components are used across multiple features and don't belong to any specific feature module.

## Solution

Create a dedicated `common/` module:

```
src/components/
+-- common/
    +-- index.ts                 # Barrel export
    +-- ErrorBoundary.tsx        # Moved from root
    +-- Toast.tsx                # Moved from root
    +-- __tests__/
        +-- ErrorBoundary.test.tsx
        +-- Toast.test.tsx
```

## Implementation

1. Create `src/components/common/` directory
2. Move `ErrorBoundary.tsx` to `common/`
3. Move `Toast.tsx` to `common/`
4. Move associated test files to `common/__tests__/`
5. Create barrel export (`index.ts`)
6. Update all imports across the codebase

## Files to Move

### Components
- `src/components/ErrorBoundary.tsx` -> `src/components/common/ErrorBoundary.tsx`
- `src/components/Toast.tsx` -> `src/components/common/Toast.tsx`

### Tests (if exist)
- `src/components/__tests__/ErrorBoundary.test.tsx` -> `src/components/common/__tests__/ErrorBoundary.test.tsx`
- `src/components/__tests__/Toast.test.tsx` -> `src/components/common/__tests__/Toast.test.tsx`

## Barrel Export

```typescript
// src/components/common/index.ts
export { ErrorBoundary } from './ErrorBoundary';
export { Toast } from './Toast';
```

## Acceptance Criteria

- [ ] `common/` directory created
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
| Turns | 3-4 | Move files + update imports |
| Tokens | ~15K | |
| Time | 20-30 min | |

## Dependencies

- None (can be executed independently)

## Future Additions

Other candidates for `common/` module:
- Loading spinners
- Modal base components
- Form field wrappers
- Confirmation dialogs
