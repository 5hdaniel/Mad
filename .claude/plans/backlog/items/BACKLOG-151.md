# BACKLOG-151: Reduce AppModals.tsx Below 150-Line Trigger

## Priority: Low

## Category: refactor

## Summary

Reduce `AppModals.tsx` (169 lines, 19 over 150-line trigger) by extracting the iPhone Sync modal wrapper to a dedicated component.

## Problem

`src/appCore/AppModals.tsx` at 169 lines is slightly over the 150-line trigger threshold for entry files as defined in `.claude/docs/shared/architecture-guardrails.md`:

| File | Target | Trigger |
|------|--------|---------|
| `AppModals.tsx` | 150 | >150 |

The file handles multiple modal wrappers and could benefit from extracting the larger modal sections.

## Solution

Extract the iPhone Sync modal wrapper to its own component:

### Target Structure

```
src/appCore/
+-- AppModals.tsx           # Main modal orchestrator (target: <150 lines)
+-- modals/
    +-- index.ts            # Barrel export
    +-- IPhoneSyncModal.tsx # iPhone sync modal wrapper
    +-- (future extractions as needed)
```

## Implementation Steps

### Step 1: Identify Extraction Target (~15 min)
1. Review `AppModals.tsx` for largest sections
2. iPhone Sync modal is likely the largest candidate
3. Identify props and dependencies

### Step 2: Extract Component (~30 min)
1. Create `modals/IPhoneSyncModal.tsx`
2. Move modal logic and JSX
3. Create proper TypeScript interface
4. Add barrel export

### Step 3: Update AppModals (~10 min)
1. Import extracted component
2. Replace inline modal with component usage
3. Pass required props

### Step 4: Verification (~15 min)
1. `npm run type-check` passes
2. `npm run lint` passes
3. `npm test` passes
4. Manual test of iPhone sync modal

## Acceptance Criteria

- [ ] `AppModals.tsx` reduced to <150 lines
- [ ] iPhone Sync modal extracted to dedicated component
- [ ] All functionality preserved (no behavior changes)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Tokens | ~10K | Simple extraction |
| Duration | ~1 hour | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Tokens | ~5K |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking modal state | Keep state management in AppModals |
| Props drilling | Pass minimal required props |

## Notes

**This item is SR Engineer sourced from architecture review (2026-01-04).**

This is a LOW priority maintenance task. The file is only 19 lines over the trigger. Priority should be given to HIGH/CRITICAL items before addressing this.

Consider batching with other small refactoring tasks in a "cleanup sprint."
