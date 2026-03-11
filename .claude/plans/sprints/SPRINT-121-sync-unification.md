# SPRINT-121: Sync Orchestrator Unification + AbortController

**Created:** 2026-03-10
**Status:** Completed
**Goal:** Route all bypass operations through SyncOrchestrator with unified progress, then add AbortController propagation for cancellable operations
**Integration Branch:** `int/sprint-121-sync-unification` (from `develop`)

---

## Sprint Narrative

Multiple sync and import operations bypass the SyncOrchestrator and use direct IPC calls with their own local progress state. This creates an inconsistent UX: the dashboard sync indicator only shows for some operations, Settings has duplicate progress logic, and there is no unified cancel capability.

This sprint is structured as two sequential phases:
- **Phase A** routes bypass operations through the orchestrator and extends SyncType to cover maintenance operations, delivering unified progress tracking across the app.
- **Phase B** builds on Phase A by replacing the boolean `isCancelled` flag in DeviceSyncOrchestrator with proper AbortController/signal propagation, and ensuring cancel signals flow from the renderer orchestrator down through individual operation handlers.

Both phases are sequential because Phase B directly modifies files touched by Phase A.

---

## In-Scope

### Phase A: Orchestrator Unification (BACKLOG-801)

| Backlog | Task | Title | Est. Tokens | Status | Execution |
|---------|------|-------|-------------|--------|-----------|
| BACKLOG-801 | TASK-2150 | Route bypass operations through SyncOrchestrator | ~40K | Completed (PR #1116 merged) | Sequential (sole Phase A task) |

**What changes:**
1. Extend `SyncType` to include new operation types: `'reindex' | 'backup' | 'restore' | 'ccpa-export'`
2. Route Settings messages import through orchestrator instead of direct `window.api.messages.importMacOSMessages()`
3. Route force re-import contacts through orchestrator instead of direct `window.api.contacts.forceReimport()`
4. Register reindex, backup, restore, and CCPA export as orchestrator operations
5. Unified progress tracking -- all operations visible in dashboard sync indicator

**Scope reduction from BACKLOG-801 description:**
- Transaction submission sync (`useSubmissionSync`) and transaction scan (`useTransactionScan`) are NOT in scope. These are fire-and-forget per-transaction operations that don't fit the orchestrator's sequential queue model. They remain direct IPC calls.
- Key contacts sync composition (orchestrator composing email+message syncs for contacts) is deferred to a future sprint.

### Phase B: AbortController Propagation (BACKLOG-242)

| Backlog | Task | Title | Est. Tokens | Status | Execution |
|---------|------|-------|-------------|--------|-----------|
| BACKLOG-242 | TASK-2151 | Add AbortController support for long operations | ~30K | Completed (PR #1117 merged) | Sequential (depends on TASK-2150) |

**What changes:**
1. Replace `isCancelled` boolean flag in `DeviceSyncOrchestrator` with `AbortController`
2. Pass `AbortSignal` to individual operations from the renderer's `SyncOrchestratorService.cancel()`
3. Propagate cancel signal through IPC to electron handlers for long operations (reindex, backup, restore, CCPA export)
4. Ensure the existing `macOSMessagesImportService` hybrid pattern (flag + AbortController) is aligned with the new approach

## Out of Scope / Deferred

- Transaction submission sync routing through orchestrator (different pattern -- per-transaction, not global)
- Transaction scan from transaction view (same as above)
- Key contacts sync composition (future architectural design needed)
- Offline gating of operations (BACKLOG-799 handles this separately)
- UI for cancel buttons on individual operations (just wiring the signal; cancel UI already exists for messages)

---

## Dependency Graph

```
Phase A:
  TASK-2150 (Orchestrator Unification)
      |
      | (must merge before Phase B starts)
      v
Phase B:
  TASK-2151 (AbortController Propagation)
```

Both tasks are strictly sequential. TASK-2151 modifies `SyncOrchestratorService.ts`, `deviceSyncOrchestrator.ts`, and handler files that TASK-2150 also modifies.

---

## Dependencies

- SPRINT-117 (SOC 2 compliance) -- should be merged to develop before starting
- No dependency on SPRINT-118/119/120 -- this sprint is independent

---

## Merge Plan

- **Integration branch:** `int/sprint-121-sync-unification` (from `develop`)
- TASK-2150 branches from `int/sprint-121-sync-unification`, merges back to `int/sprint-121-sync-unification`
- TASK-2151 branches from `int/sprint-121-sync-unification` (after TASK-2150 merges), merges back to `int/sprint-121-sync-unification`
- When both tasks complete, `int/sprint-121-sync-unification` merges to `develop`

### Branch names:

| Task | Branch |
|------|--------|
| TASK-2150 | `feature/task-2150-sync-orchestrator-unification` |
| TASK-2151 | `feature/task-2151-abort-controller-support` |

---

## Task Files

| Task | File |
|------|------|
| TASK-2150 | `.claude/plans/tasks/TASK-2150-sync-orchestrator-unification.md` |
| TASK-2151 | `.claude/plans/tasks/TASK-2151-abort-controller-support.md` |

---

## Token Budget

| Task | Category | Est. Tokens | Token Cap |
|------|----------|-------------|-----------|
| TASK-2150 | service (x0.5) | ~40K | 160K |
| TASK-2151 | service (x0.5) | ~30K | 120K |
| **Total** | | **~70K** | |

**Estimation notes:**
- BACKLOG-801 estimated at ~80K but the orchestrator already exists with `registerSyncFunction()`, `requestSync()`, `forceSync()`, external sync tracking, and observer pattern. The work is wiring new operations through it, not building the orchestrator from scratch. Applying service multiplier (x0.5) to raw estimate of ~80K yields ~40K.
- BACKLOG-242 estimated at ~50K but `SyncOrchestratorService` already uses AbortController internally. The work is propagating the signal down to individual operations and refactoring DeviceSyncOrchestrator. Applying service multiplier yields ~30K.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backup/restore operations use Electron dialog (main process) -- unclear how to report progress through renderer orchestrator | Medium | Use `external` sync pattern (like iPhone): register operation, update progress from renderer callback, mark complete. Dialog interaction stays in main process. |
| CCPA export reports progress via `event.sender.send()` -- needs IPC bridge to orchestrator | Medium | Add an IPC listener in renderer that forwards to orchestrator's `updateExternalSync()` |
| Extending SyncType union may cause type errors in switch exhaustiveness checks | Low | Add cases for new types in any exhaustive switch statements |
| DeviceSyncOrchestrator `isCancelled` replacement could break iPhone sync flow | Medium | Keep backward-compatible: AbortSignal checked at same points as boolean. Test iPhone sync cancel after change. |
| Settings components currently own their own import state (isImporting, progress) -- routing through orchestrator may break local state | Medium | Components subscribe to orchestrator state instead of maintaining local state; keep local state as fallback during transition |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Test Type | What to Verify |
|------|-----------|---------------|
| TASK-2150 | Manual | Trigger each operation from Settings, verify dashboard sync indicator shows progress |
| TASK-2150 | Manual | Verify existing dashboard sync (contacts, emails, messages) still works |
| TASK-2150 | Unit | Existing `SyncOrchestratorService` tests still pass with extended SyncType |
| TASK-2151 | Manual | Start a long operation (messages import), cancel it, verify it stops |
| TASK-2151 | Manual | Start iPhone sync, cancel it, verify it stops cleanly |
| TASK-2151 | Unit | DeviceSyncOrchestrator tests pass with AbortController instead of boolean |

### Integration Verification (After Each Phase Merge)

**After TASK-2150 merge:**
- [ ] Dashboard sync indicator shows for all operations (messages import from Settings, reindex, backup, CCPA export)
- [ ] Settings messages import still works with progress
- [ ] Settings force re-import contacts still works
- [ ] Normal sync flow (contacts, emails, messages) unaffected
- [ ] `npm run type-check` passes

**After TASK-2151 merge:**
- [ ] Cancel from dashboard stops in-progress operations
- [ ] iPhone sync cancel works correctly
- [ ] Messages import cancel works correctly
- [ ] No orphaned processes after cancel
- [ ] `npm run type-check` passes

### CI Gates

All tasks must pass:
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] Build succeeds
