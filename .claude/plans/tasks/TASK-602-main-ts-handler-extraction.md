# TASK-602: main.ts Handler Extraction

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 2 - Main/Preload Extraction
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-600, TASK-601

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

Extract IPC handlers from `electron/main.ts` (1,655 lines) into domain-specific handler files, reducing main.ts to < 500 lines.

---

## Current State

`electron/main.ts` contains:
- Window creation and lifecycle (~100 lines)
- CSP configuration (~50 lines)
- Auto-updater logic (~100 lines)
- 20+ inline IPC handlers (~1,200 lines)
  - Conversation/message export (lines 462-1064)
  - Outlook integration (lines 1083-1655)
  - System info handlers
  - Permission handlers
  - Debug handlers

---

## Requirements

### Must Do
1. Extract handlers into `electron/handlers/` directory
2. Follow existing pattern from `electron/auth-handlers.ts`, `electron/transaction-handlers.ts`
3. Keep main.ts focused on:
   - App initialization
   - Window creation
   - Handler registration (imports + calls)
   - Auto-updater
4. Reduce main.ts to < 500 lines

### Must NOT Do
- Change any handler logic
- Modify IPC channel names
- Break existing functionality
- Create circular dependencies

---

## Proposed File Structure

```
electron/
  main.ts                      (< 500 lines - initialization only)
  handlers/
    index.ts                   (barrel export)
    conversationHandlers.ts    (export logic)
    outlookHandlers.ts         (Outlook integration)
    systemHandlers.ts          (system info, paths)
    permissionHandlers.ts      (Full Disk Access, etc.)
    debugHandlers.ts           (debug/dev tools)
```

---

## Handler Extraction Map

| Handler Group | Lines (approx) | Target File |
|---------------|----------------|-------------|
| Conversation export | 462-1064 | `conversationHandlers.ts` |
| Outlook handlers | 1083-1655 | `outlookHandlers.ts` |
| System settings | 400-460 | `systemHandlers.ts` |
| Permission requests | 449-500 | `permissionHandlers.ts` |
| Debug handlers | scattered | `debugHandlers.ts` |

---

## Implementation Pattern

Follow existing pattern from `auth-handlers.ts`:

```typescript
// electron/handlers/conversationHandlers.ts
import { ipcMain, BrowserWindow } from "electron";
import { logService } from "../services/logService";

export function registerConversationHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle("conversation:export", async (event, conversationId, options) => {
    // ... existing logic
  });

  ipcMain.handle("conversation:exportAll", async (event, options) => {
    // ... existing logic
  });
}
```

```typescript
// electron/main.ts (after extraction)
import { registerConversationHandlers } from "./handlers/conversationHandlers";
import { registerOutlookHandlers } from "./handlers/outlookHandlers";
// ...

function createWindow() {
  // ... window creation

  // Register handlers
  registerConversationHandlers(mainWindow);
  registerOutlookHandlers(mainWindow);
  // ...
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/handlers/index.ts` | Barrel export |
| `electron/handlers/conversationHandlers.ts` | Conversation/message export |
| `electron/handlers/outlookHandlers.ts` | Outlook integration |
| `electron/handlers/systemHandlers.ts` | System info, paths, settings |
| `electron/handlers/permissionHandlers.ts` | Permission requests |
| `electron/handlers/debugHandlers.ts` | Debug/dev utilities |

## Files to Modify

| File | Change |
|------|--------|
| `electron/main.ts` | Extract handlers, add imports, reduce to < 500 lines |

---

## Testing Requirements

1. **Smoke Test**
   - App starts without errors
   - All IPC handlers respond correctly

2. **Existing Tests**
   - All electron tests must pass
   - No handler behavior changes

3. **Manual Verification**
   - Export conversations works
   - Outlook integration works
   - System settings open correctly
   - Permissions flow works

---

## Acceptance Criteria

- [ ] `electron/main.ts` < 500 lines
- [ ] All handlers extracted to `electron/handlers/`
- [ ] No functionality changes
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] App starts and functions correctly
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-602-main-ts-extraction
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
