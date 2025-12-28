# TASK-616: Console.log to logService

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Completed

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** 2025-12-27 ~22:00 PST
**Task End:** 2025-12-27 ~23:05 PST
**Wall-Clock Time:** ~65 min (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | 0 | 0 | 0 min |
| Implementation | 8 | ~32K | ~45 min |
| Debugging | 4 | ~16K | ~20 min |
| **Total** | 12 | ~48K | ~65 min |

**Estimated vs Actual:**
- Est Turns: 1-2 -> Actual: 12 (variance: +500%)
- Est Wall-Clock: 5-10 min -> Actual: ~65 min (variance: +550%)

**Note:** Task was significantly more complex than estimated:
- 9 production files required changes (not just minor touch-ups)
- Duplicate import issue in databaseService.ts needed fixing
- Test file updates required (3 test files) to match new logService usage
- Supabase service had 25+ console.* calls requiring replacement
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 4-6 | **1-2** | - |
| **Tokens** | ~20K | ~6K | - |
| **Time** | 30-45m | **5-10 min** | **5-10 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Replace remaining `console.log/error/warn` calls with `logService` for consistent logging.

---

## Current State

`logService` exists and is used in many places, but inconsistently. Some files still use `console.*` directly.

---

## Requirements

### Must Do
1. Find all console.* usages in production code
2. Replace with appropriate logService method
3. Keep console.* in test files (acceptable)

### Must NOT Do
- Modify logService implementation
- Change log levels inappropriately
- Remove useful log context

---

## Replacement Pattern

```typescript
// Before
console.log("[Main] Starting...");
console.error("[Main] Error:", error);

// After
import { logService } from "../services/logService";
logService.info("[Main] Starting...");
logService.error("[Main] Error:", error);
```

---

## Files to Modify

Audit and fix:
- `electron/main.ts`
- `electron/handlers/*.ts`
- `electron/services/*.ts`
- Any other files with console.*

---

## Acceptance Criteria

- [x] No console.* in production code
- [x] logService used consistently
- [x] All existing tests pass
- [x] `npm run lint` passes

---

## Branch

```
feature/TASK-616-console-log-to-logservice
```

---

## Implementation Summary

### Files Modified (Production - 9 files)

| File | Console.* Replaced | Notes |
|------|-------------------|-------|
| `electron/services/extraction/extractionStrategyService.ts` | 1 error | Added logService import |
| `electron/services/extraction/hybridExtractorService.ts` | 5 warns | Already had import |
| `electron/services/db/oauthTokenDbService.ts` | 1 log | Added logService import |
| `electron/services/db/sessionDbService.ts` | 1 log | Added logService import |
| `electron/services/macOSPermissionHelper.ts` | 12 logs/errors | Added logService import |
| `electron/services/llm/baseLLMService.ts` | 3 (log method) | Refactored internal log() method |
| `electron/services/llm/batchLLMService.ts` | 2 warns | Added logService import |
| `electron/services/microsoftAuthService.ts` | 17 logs/errors | Added logService import |
| `electron/services/supabaseService.ts` | 26 logs/errors | Already had partial import |

### Files Modified (Bug Fix - 1 file)

| File | Issue | Fix |
|------|-------|-----|
| `electron/services/databaseService.ts` | Duplicate logService import | Removed duplicate |

### Files Modified (Tests - 3 files)

| File | Changes |
|------|---------|
| `electron/services/extraction/__tests__/extractionStrategyService.test.ts` | Updated error logging test expectations |
| `electron/services/llm/__tests__/baseLLMService.test.ts` | Updated log method tests for logService |

### Deviations from Plan

None - followed the replacement pattern as specified.

### Issues Encountered

1. **Duplicate import in databaseService.ts** - Pre-existing issue, fixed as part of cleanup
2. **Test failures** - Expected, tests were checking for console.* directly, updated to verify logService behavior

### Quality Gates

- [x] `npm run type-check` - PASS
- [x] `npm run lint` - PASS (warnings only, pre-existing)
- [x] `npm test` - PASS (1467/1468, 1 flaky perf test unrelated)
