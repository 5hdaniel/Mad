# TASK-616: Console.log to logService

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 1-2 → Actual: _ (variance: _%)
- Est Wall-Clock: 5-10 min → Actual: _ min (variance: _%)
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

- [ ] No console.* in production code
- [ ] logService used consistently
- [ ] All existing tests pass
- [ ] `npm run lint` passes

---

## Branch

```
feature/TASK-616-logservice
```
