# BACKLOG-095: Create email/ Module for Email Export Components

## Priority: Medium

## Category: refactor

## Summary

Create a dedicated `email/` module for email export and processing UI components. This consolidates email-specific functionality in one location.

## Problem

Email export components are scattered at the root of `src/components/`:

| File | Lines | Current Location | Description |
|------|-------|------------------|-------------|
| `OutlookExport.tsx` | 675 | Root | Main Outlook export functionality |
| `ExportModal.tsx` | 427 | Root | Export dialog/modal |
| `ExportComplete.tsx` | 164 | Root | Export completion screen |

These components form a cohesive email export feature and should be grouped together.

## Solution

Create a dedicated `email/` module:

```
src/components/
+-- email/
    +-- index.ts                 # Barrel export
    +-- OutlookExport.tsx        # Moved from root (675 lines)
    +-- ExportModal.tsx          # Moved from root (427 lines)
    +-- ExportComplete.tsx       # Moved from root (164 lines)
    +-- __tests__/
        +-- OutlookExport.test.tsx
        +-- ExportModal.test.tsx
        +-- ExportComplete.test.tsx
```

## Implementation

1. Create `src/components/email/` directory
2. Move `OutlookExport.tsx` to `email/`
3. Move `ExportModal.tsx` to `email/`
4. Move `ExportComplete.tsx` to `email/`
5. Move associated test files to `email/__tests__/`
6. Create barrel export (`index.ts`)
7. Update all imports across the codebase

## Files to Move

### Components
- `src/components/OutlookExport.tsx` -> `src/components/email/OutlookExport.tsx`
- `src/components/ExportModal.tsx` -> `src/components/email/ExportModal.tsx`
- `src/components/ExportComplete.tsx` -> `src/components/email/ExportComplete.tsx`

### Tests (if exist)
- Move any associated test files to `email/__tests__/`

## Barrel Export

```typescript
// src/components/email/index.ts
export { OutlookExport } from './OutlookExport';
export { ExportModal } from './ExportModal';
export { ExportComplete } from './ExportComplete';
```

## Acceptance Criteria

- [ ] `email/` directory created
- [ ] All 3 components moved
- [ ] Test files relocated (if exist)
- [ ] Barrel export created
- [ ] All imports updated
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 4-5 | More files to move, more imports |
| Tokens | ~20K | |
| Time | 30-40 min | |

## Dependencies

- None (can be executed independently)

## Future Considerations

- `OutlookExport.tsx` at 675 lines may benefit from splitting in a future sprint
- Gmail export components (if added) would also go here
