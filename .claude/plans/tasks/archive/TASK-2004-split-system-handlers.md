# TASK-2004: Split system-handlers.ts into Domain Handler Files

**Backlog:** BACKLOG-720
**Sprint:** SPRINT-085
**Status:** Pending
**Priority:** High
**Category:** refactor
**Estimated Tokens:** ~30K (refactor x0.5 multiplier applied)
**Token Cap:** ~120K (4x)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Goal

Split the monolith `electron/system-handlers.ts` (2,019 lines, 39 IPC handlers) into 3 domain-specific handler files, convert all `require()` calls to ES module imports, and adopt the `wrapHandler()` utility from TASK-2002. Follow the same patterns established by TASK-1999 for transaction handler splitting.

## Non-Goals

- Do NOT change any handler behavior or IPC response shapes
- Do NOT add new IPC channels
- Do NOT refactor service code (only move handler code)
- Do NOT modify `transaction-handlers.ts` (already split by TASK-1999)
- Do NOT modify `contact-handlers.ts`

## Prerequisites

**Depends on:**
- TASK-2002 (wrapHandler HOF) must be merged first
- TASK-1999 (transaction handler split) should be merged first so this task can follow the established pattern

## Deliverables

### New Files to Create

| File | Handlers (IPC channels) |
|------|------------------------|
| `electron/handlers/diagnosticHandlers.ts` | All `system:diagnostic-*` and `system:get-*-info` handlers, health checks, debug/logging utilities |
| `electron/handlers/userSettingsHandlers.ts` | `system:get-preferences`, `system:set-preference`, user/account settings, theme, notification preferences |
| `electron/handlers/systemHandlers.ts` | Core system operations: `system:get-version`, `system:open-external`, `system:get-path`, `system:check-updates`, `system:contact-support`, platform utilities |

### Handler Distribution

Before implementation, the engineer must read through all 39 `ipcMain.handle()` calls in `system-handlers.ts` and categorize each one into the 3 target files. The distribution above is guidance -- the engineer should make the final grouping based on actual handler content. The principle is:

- **diagnosticHandlers**: Anything that inspects system state, runs checks, or produces debug output
- **userSettingsHandlers**: Anything that reads/writes user preferences or settings
- **systemHandlers**: Everything else (platform operations, external links, version info)

### Files to Modify

| File | Change |
|------|--------|
| `electron/system-handlers.ts` | Delete entirely (replaced by 3 new files) |
| `electron/main.ts` | Update imports to register new handler files |

## Implementation Notes

### Step 1: Follow TASK-1999 patterns

This task follows the same approach as TASK-1999. Reference the resulting handler files from that task for:
- Registration function naming convention
- Import structure
- `wrapHandler()` usage
- Export pattern

### Step 2: Convert require() to ES imports

The current `system-handlers.ts` has these `require()` calls:

**Top-level (lines 10-14):**
```typescript
// BEFORE
const permissionService = require("./services/permissionService").default;
const connectionStatusService = require("./services/connectionStatusService").default;
const macOSPermissionHelper = require("./services/macOSPermissionHelper").default;

// AFTER (in the appropriate new handler file)
import permissionService from "../services/permissionService";
import connectionStatusService from "../services/connectionStatusService";
import macOSPermissionHelper from "../services/macOSPermissionHelper";
```

**Inline require() calls (lines ~1663-1664):**
```typescript
// BEFORE
const { app } = require("electron");
const os = require("os");

// AFTER: top-level imports
import { app } from "electron";
import os from "os";
```

### Step 3: Adopt wrapHandler()

Same pattern as TASK-1999:

```typescript
import { wrapHandler } from "../utils/wrapHandler";

export function registerDiagnosticHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle("system:diagnostic-check",
    wrapHandler(async (event, userId) => {
      // ... existing logic
    }, { module: "Diagnostics" })
  );
}
```

### Step 4: Update main.ts registration

```typescript
// BEFORE
import { registerSystemHandlers } from "./system-handlers";
registerSystemHandlers(mainWindow);

// AFTER
import { registerDiagnosticHandlers } from "./handlers/diagnosticHandlers";
import { registerUserSettingsHandlers } from "./handlers/userSettingsHandlers";
import { registerSystemHandlers } from "./handlers/systemHandlers";

registerDiagnosticHandlers(mainWindow);
registerUserSettingsHandlers(mainWindow);
registerSystemHandlers(mainWindow);
```

### Step 5: Delete the monolith

After all handlers are moved and tests pass, delete `electron/system-handlers.ts`.

## Acceptance Criteria

- [ ] `electron/system-handlers.ts` is deleted
- [ ] 3 new handler files exist in `electron/handlers/` with all 39 handlers distributed
- [ ] All 39 IPC channel names are preserved exactly (no renames)
- [ ] All `require()` calls converted to ES `import` statements
- [ ] `wrapHandler()` adopted in all new handler files
- [ ] `electron/main.ts` updated to import and register all 3 new handler files
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes -- all existing tests pass WITHOUT modification
- [ ] No behavioral changes -- same inputs produce same outputs

## Do / Don't Guidelines

### DO:
- Preserve exact IPC channel names
- Preserve exact response shapes
- Follow the patterns established by TASK-1999
- Import only what each handler file needs
- Use `wrapHandler()` with appropriate `module` names

### DON'T:
- Rename any IPC channels
- Change any handler logic
- Add new handlers
- Modify test files
- Change shared types/interfaces

## Stop-and-Ask Triggers

- If any existing test fails after the split, STOP and investigate
- If `wrapHandler()` from TASK-2002 does not exist on the branch, STOP
- If the TASK-1999 split pattern is unclear or not yet merged, STOP
- If a handler uses platform-specific `require()` that can't be a top-level import, flag it

## Testing Expectations

- Zero new tests required
- All existing system handler tests must pass unchanged
- Run `npm run type-check && npm run lint && npm test` before creating PR

## PR Preparation

**Title:** `refactor: split system-handlers.ts into 3 domain handler files`
**Labels:** refactor, architecture
**Base:** develop

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | (auto-captured) |
| **Branch** | refactor/task-2004-split-system-handlers |
| **PR** | TBD |
| **Files Changed** | 5 (3 new handler files, 1 facade, 1 main.ts update) |
| **Tests Added** | 0 (existing 61 tests all pass unchanged) |
| **Issues/Blockers** | See below |

### Handler Distribution (39 total)

| File | Handlers | Count |
|------|----------|-------|
| `electron/handlers/diagnosticHandlers.ts` | health-check, get-diagnostics, 6x diagnostic:*, reindex-database, check-email-data | 10 |
| `electron/handlers/userSettingsHandlers.ts` | 3x user phone type (local+cloud+sync), notification:*, verify/check-user-in-local-db | 9 |
| `electron/handlers/systemHandlers.ts` | secure storage, DB init, permissions, connections, shell ops, contact-support | 20 |

### Deviations

1. **3 service `require()` calls retained** (permissionService, connectionStatusService, macOSPermissionHelper): The test mocks for these services don't set `__esModule: true`, making ES imports incompatible without modifying tests. Documented with comments in each handler file. The 2 inline `require()` calls (app, os from lines 1663-1664) were successfully converted.

2. **wrapHandler not adopted for 8 handlers**: Handlers that return structured error objects (e.g., `error: { type: "VALIDATION_ERROR", userMessage: "..." }`) or handler-specific fields in error responses (e.g., `phoneType: null`) cannot use wrapHandler because it returns flat error strings. These retain manual try/catch to preserve exact response shapes.

3. **Thin re-export facade retained**: `electron/system-handlers.ts` kept as a 19-line compatibility re-export (same pattern as TASK-1999's `transaction-handlers.ts`) so existing tests import path works unchanged.
