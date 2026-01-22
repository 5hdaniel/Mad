# BACKLOG-101: Split PermissionsScreen.tsx

## Priority: Medium

## Category: refactor

## Summary

Split the large `PermissionsScreen.tsx` (873 lines) into smaller, focused components. This is one of the larger files in the codebase.

## Problem

`PermissionsScreen.tsx` at 873 lines likely contains:
- Multiple permission types
- Platform-specific handling (Windows/macOS)
- Permission request flows
- Status display for each permission
- Complex conditional rendering

This size makes the component difficult to maintain and test.

## Solution

Analyze and extract logical pieces, keeping the component in an appropriate module.

### Target Structure

```
src/components/
+-- permissions/
    +-- index.ts                         # Barrel export
    +-- PermissionsScreen.tsx            # Main orchestrator (target: <300 lines)
    +-- components/
    |   +-- PermissionCard.tsx           # Individual permission display
    |   +-- PermissionStatus.tsx         # Status indicator
    |   +-- PermissionRequest.tsx        # Request flow
    |   +-- PlatformPermissions.tsx      # Platform-specific handling
    +-- hooks/
    |   +-- usePermissions.ts            # Permission state management
    +-- __tests__/
        +-- PermissionsScreen.test.tsx
        +-- PermissionCard.test.tsx
```

## Implementation Phases

### Phase 1: Analysis (~20 min)
1. Read and understand the current component structure
2. Identify logical boundaries for extraction
3. Map state and prop flows

### Phase 2: Hook Extraction (~30 min)
1. Extract permission state management to `usePermissions.ts`
2. Update main component to use hook

### Phase 3: Component Extraction (~60 min)
1. Extract permission card UI
2. Extract status indicators
3. Extract request flow components
4. Update main component to compose pieces

### Phase 4: Module Organization (~20 min)
1. Create `permissions/` directory structure
2. Move all files
3. Create barrel exports
4. Update imports

## Acceptance Criteria

- [ ] `PermissionsScreen.tsx` reduced to <300 lines
- [ ] At least 2 sub-components extracted
- [ ] Custom hook extracted for permission state
- [ ] `permissions/` module created
- [ ] All functionality preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 10-12 | Medium-large refactor |
| Tokens | ~45K | |
| Time | 1.5-2 hours | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 5-6 |
| Tokens | ~22K |
| Time | 45-60 min |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Platform-specific code complexity | Keep platform logic together |
| Permission API interactions | Test on both Windows and macOS |

## Notes

Permissions are critical for app functionality. Manual testing should include:
1. Fresh install permission requests
2. Permission re-granting after denial
3. Platform-specific behavior (Windows vs macOS)
