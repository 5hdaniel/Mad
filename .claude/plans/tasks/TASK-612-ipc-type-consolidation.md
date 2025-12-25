# TASK-612: IPC Type Consolidation

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 6 - Type Safety
**Priority:** MEDIUM
**Status:** Pending
**Depends On:** TASK-603

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
- Est Turns: 2-3 → Actual: _ (variance: _%)
- Est Wall-Clock: 10-15 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 8-10 | **2-3** | - |
| **Tokens** | ~40K | ~12K | - |
| **Time** | 1-1.5h | **10-15 min** | **10-15 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Consolidate and properly type IPC channel definitions to ensure type safety across main process and renderer.

---

## Current State

- `electron/types/ipc.ts` exists (1,274 lines) but may not be fully utilized
- Renderer components often use `any` for IPC results
- Some type duplication between main and renderer

---

## Requirements

### Must Do
1. Audit IPC type coverage
2. Ensure all channels have proper types
3. Share types between main and renderer
4. Add type guards for IPC responses

### Must NOT Do
- Change IPC channel names
- Modify message formats
- Break existing functionality

---

## Implementation

### Shared Types
```typescript
// shared/types/ipc.ts (or electron/types/ipc.ts)

export interface IpcResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface TransactionResult extends IpcResult<Transaction> {}
export interface TransactionsResult extends IpcResult<Transaction[]> {}

// Channel type mapping
export interface IpcChannels {
  "transactions:getAll": {
    params: [userId: string];
    result: TransactionsResult;
  };
  "transactions:update": {
    params: [transactionId: string, updates: TransactionUpdate];
    result: IpcResult;
  };
  // ... all channels
}
```

### Typed Invoke
```typescript
// Utility for typed IPC calls
export async function typedInvoke<K extends keyof IpcChannels>(
  channel: K,
  ...params: IpcChannels[K]["params"]
): Promise<IpcChannels[K]["result"]> {
  return await ipcRenderer.invoke(channel, ...params);
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/types/ipc.ts` | Complete channel type definitions |
| `electron/preload/*.ts` | Use typed invoke pattern |
| `src/types/` | Import shared IPC types |

---

## Testing Requirements

1. **Type Check**
   - All IPC calls properly typed
   - No `any` in IPC layer

2. **Runtime**
   - All existing tests pass
   - IPC calls work correctly

---

## Acceptance Criteria

- [ ] All IPC channels typed
- [ ] Types shared between main/renderer
- [ ] No `any` in IPC layer
- [ ] All existing tests pass
- [ ] `npm run type-check` passes

---

## Branch

```
feature/TASK-612-ipc-types
```
