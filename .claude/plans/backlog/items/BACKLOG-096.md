# BACKLOG-096: Create system/ Module for Infrastructure Components

## Priority: Medium

## Category: refactor

## Summary

Create a dedicated `system/` module for system-level and infrastructure UI components. This includes health monitoring, offline handling, update notifications, and system settings.

## Problem

System/infrastructure components are scattered at the root of `src/components/`:

| File | Lines | Current Location | Description |
|------|-------|------------------|-------------|
| `SystemHealthMonitor.tsx` | 326 | Root | System health dashboard |
| `OfflineFallback.tsx` | 325 | Root | Offline state handling |
| `UpdateNotification.tsx` | 89 | Root | App update notifications |
| `SystemSettingsMockup.tsx` | 364 | Root | System settings UI |

These components are all related to system-level functionality and should be grouped together.

## Solution

Create a dedicated `system/` module:

```
src/components/
+-- system/
    +-- index.ts                    # Barrel export
    +-- SystemHealthMonitor.tsx     # Moved from root (326 lines)
    +-- OfflineFallback.tsx         # Moved from root (325 lines)
    +-- UpdateNotification.tsx      # Moved from root (89 lines)
    +-- SystemSettingsMockup.tsx    # Moved from root (364 lines)
    +-- __tests__/
        +-- SystemHealthMonitor.test.tsx
        +-- OfflineFallback.test.tsx
        +-- UpdateNotification.test.tsx
        +-- SystemSettingsMockup.test.tsx
```

## Implementation

1. Create `src/components/system/` directory
2. Move `SystemHealthMonitor.tsx` to `system/`
3. Move `OfflineFallback.tsx` to `system/`
4. Move `UpdateNotification.tsx` to `system/`
5. Move `SystemSettingsMockup.tsx` to `system/`
6. Move associated test files to `system/__tests__/`
7. Create barrel export (`index.ts`)
8. Update all imports across the codebase

## Files to Move

### Components
- `src/components/SystemHealthMonitor.tsx` -> `src/components/system/SystemHealthMonitor.tsx`
- `src/components/OfflineFallback.tsx` -> `src/components/system/OfflineFallback.tsx`
- `src/components/UpdateNotification.tsx` -> `src/components/system/UpdateNotification.tsx`
- `src/components/SystemSettingsMockup.tsx` -> `src/components/system/SystemSettingsMockup.tsx`

### Tests (if exist)
- Move any associated test files to `system/__tests__/`

## Barrel Export

```typescript
// src/components/system/index.ts
export { SystemHealthMonitor } from './SystemHealthMonitor';
export { OfflineFallback } from './OfflineFallback';
export { UpdateNotification } from './UpdateNotification';
export { SystemSettingsMockup } from './SystemSettingsMockup';
```

## Acceptance Criteria

- [ ] `system/` directory created
- [ ] All 4 components moved
- [ ] Test files relocated (if exist)
- [ ] Barrel export created
- [ ] All imports updated
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 4-5 | 4 files to move |
| Tokens | ~20K | |
| Time | 30-40 min | |

## Dependencies

- None (can be executed independently)

## Future Considerations

- `SystemSettingsMockup.tsx` suggests this is a placeholder - may be replaced with real settings
- May want to consider merging with or relating to `settings/` module
