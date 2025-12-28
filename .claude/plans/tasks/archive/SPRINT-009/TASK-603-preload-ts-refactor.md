# TASK-603: preload.ts Refactor

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 2 - Main/Preload Extraction
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-602

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

Refactor `electron/preload.ts` (1,902 lines) by:
1. Extracting IPC bridge definitions into domain-specific files
2. Removing legacy `window.electron` namespace (after migration)
3. Reducing preload.ts to < 400 lines

---

## Current State

`electron/preload.ts` contains:
- `window.api` namespace definitions (~1,400 lines)
  - auth, transactions, contacts, communications
  - settings, llm, feedback, system
  - outlook, backup, export, sync
- Legacy `window.electron` namespace (~300 lines, duplicates window.api)
- Context bridge setup

---

## Requirements

### Must Do
1. Extract IPC bridges into `electron/preload/` directory
2. Keep core preload.ts focused on contextBridge.exposeInMainWorld
3. Remove `window.electron` namespace (13 files still use it - will be migrated in TASK-609)
4. Reduce preload.ts to < 400 lines

### Must NOT Do
- Change IPC channel names
- Break existing window.api contracts
- Remove window.electron until TASK-609 completes migration

---

## Proposed File Structure

```
electron/
  preload.ts                   (< 400 lines - bridge setup only)
  preload/
    index.ts                   (barrel export)
    authBridge.ts              (auth IPC definitions)
    transactionBridge.ts       (transaction IPC definitions)
    contactBridge.ts           (contact IPC definitions)
    communicationBridge.ts     (communication IPC definitions)
    settingsBridge.ts          (settings IPC definitions)
    llmBridge.ts               (LLM IPC definitions)
    systemBridge.ts            (system/debug IPC definitions)
    outlookBridge.ts           (Outlook IPC definitions)
    exportBridge.ts            (export IPC definitions)
```

---

## Implementation Pattern

```typescript
// electron/preload/authBridge.ts
import { ipcRenderer } from "electron";

export const authBridge = {
  login: (email: string, password: string) =>
    ipcRenderer.invoke("auth:login", email, password),

  logout: () =>
    ipcRenderer.invoke("auth:logout"),

  getSession: () =>
    ipcRenderer.invoke("auth:get-session"),

  // ... other auth methods
};
```

```typescript
// electron/preload.ts (after extraction)
import { contextBridge } from "electron";
import { authBridge } from "./preload/authBridge";
import { transactionBridge } from "./preload/transactionBridge";
// ...

contextBridge.exposeInMainWorld("api", {
  auth: authBridge,
  transactions: transactionBridge,
  contacts: contactBridge,
  // ... other bridges
});

// Legacy namespace (to be removed in TASK-609)
contextBridge.exposeInMainWorld("electron", {
  // ... legacy definitions
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/preload/index.ts` | Barrel export |
| `electron/preload/authBridge.ts` | Auth IPC |
| `electron/preload/transactionBridge.ts` | Transaction IPC |
| `electron/preload/contactBridge.ts` | Contact IPC |
| `electron/preload/communicationBridge.ts` | Communication IPC |
| `electron/preload/settingsBridge.ts` | Settings IPC |
| `electron/preload/llmBridge.ts` | LLM IPC |
| `electron/preload/systemBridge.ts` | System IPC |
| `electron/preload/outlookBridge.ts` | Outlook IPC |
| `electron/preload/exportBridge.ts` | Export IPC |

## Files to Modify

| File | Change |
|------|--------|
| `electron/preload.ts` | Extract bridges, reduce to < 400 lines |

---

## Testing Requirements

1. **Type Check**
   - All IPC bridges properly typed
   - window.api types match

2. **Smoke Test**
   - App starts without errors
   - All IPC calls work from renderer

3. **Existing Tests**
   - All tests pass
   - No behavior changes

---

## Acceptance Criteria

- [ ] `electron/preload.ts` < 400 lines
- [ ] All bridges extracted to `electron/preload/`
- [ ] `window.api` contract unchanged
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] App functions correctly
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-603-preload-extraction
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
