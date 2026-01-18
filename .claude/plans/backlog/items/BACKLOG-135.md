# BACKLOG-135: Fix window.d.ts Type Definitions for Sync API

**Priority:** MEDIUM
**Category:** tech-debt
**Status:** Open
**Created:** 2026-01-02
**Source:** SPRINT-014 - TASK-910 debugging consumed ~6M tokens due to type mismatches

---

## Problem Statement

The `window.d.ts` type definitions are out of sync with the actual preload bridge exports. Specifically:

1. `getUnifiedStatus()` is exposed via `electron/preload/deviceBridge.ts` but not properly typed in `window.d.ts`
2. Engineers must use runtime type assertions to access these APIs
3. TypeScript doesn't catch missing/incorrect API usage at compile time

### Impact

- TASK-910 spent ~50 edit retries debugging type issues
- Engineers waste time on type workarounds instead of features
- Runtime errors possible if API changes without type updates

## Solution

1. Audit `electron/preload/deviceBridge.ts` exports
2. Update `src/window.d.ts` to match actual exports
3. Add CI check to verify types match exports (optional)

## Files to Modify

| File | Change |
|------|--------|
| `src/window.d.ts` | Add missing type definitions |
| `electron/preload/deviceBridge.ts` | Verify exports match types |

## Acceptance Criteria

- [ ] `getUnifiedStatus()` properly typed in `window.d.ts`
- [ ] All sync API methods have matching type definitions
- [ ] No type assertions needed to use sync APIs
- [ ] `npm run type-check` passes

## Estimated Effort

2-3 turns, ~10K tokens, 15-20 min

---

## Related

- **TASK-910**: Consumed ~6M tokens partly due to this issue
- **BACKLOG-130**: Similar permission/type infrastructure issue
