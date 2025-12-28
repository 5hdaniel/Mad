# BACKLOG-100: Create auth/ Module for Authentication Components

## Priority: Medium

## Category: refactor

## Summary

Create a dedicated `auth/` module for authentication-related UI components. This consolidates login flows for Microsoft and general authentication in one location.

## Problem

Authentication components are scattered at the root of `src/components/`:

| File | Lines | Current Location | Description |
|------|-------|------------------|-------------|
| `Login.tsx` | 563 | Root | Main login component |
| `MicrosoftLogin.tsx` | 347 | Root | Microsoft-specific login flow |

These components are closely related and should be grouped together.

## Solution

Create a dedicated `auth/` module:

```
src/components/
+-- auth/
    +-- index.ts                 # Barrel export
    +-- Login.tsx                # Moved from root (563 lines)
    +-- MicrosoftLogin.tsx       # Moved from root (347 lines)
    +-- __tests__/
        +-- Login.test.tsx
        +-- MicrosoftLogin.test.tsx
```

## Implementation

1. Create `src/components/auth/` directory
2. Move `Login.tsx` to `auth/`
3. Move `MicrosoftLogin.tsx` to `auth/`
4. Move associated test files to `auth/__tests__/`
5. Create barrel export (`index.ts`)
6. Update all imports across the codebase

## Files to Move

### Components
- `src/components/Login.tsx` -> `src/components/auth/Login.tsx`
- `src/components/MicrosoftLogin.tsx` -> `src/components/auth/MicrosoftLogin.tsx`

### Tests (if exist)
- Move any associated test files to `auth/__tests__/`

## Barrel Export

```typescript
// src/components/auth/index.ts
export { Login } from './Login';
export { MicrosoftLogin } from './MicrosoftLogin';
```

## Acceptance Criteria

- [ ] `auth/` directory created
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
| Turns | 3-4 | Two files to move |
| Tokens | ~15K | |
| Time | 20-30 min | |

## Dependencies

- None (can be executed independently)

## Future Considerations

- `Login.tsx` at 563 lines may benefit from splitting in a future sprint
- Additional auth providers (Gmail OAuth) may be added later
- Password reset, logout components could also live here
