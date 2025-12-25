# TASK-616: Console.log to logService

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start Time:** [timestamp]
**Task End Time:** [timestamp]

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |
```

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
