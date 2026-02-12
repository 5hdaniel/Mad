# SPRINT-080: Contact Query Worker Thread (Main Process Freeze Fix)

**Status:** Active
**Created:** 2026-02-11
**Branch From:** develop
**Target:** develop

---

## Sprint Goal

Fix the ~3.7s UI freeze when loading 1000+ external contacts by moving the `contacts:get-available` SQLite query to a Node.js worker thread. This is a targeted performance fix (subset of BACKLOG-497).

## Scope

### In Scope

| Task | Title | Priority | Est. Tokens | Phase |
|------|-------|----------|-------------|-------|
| TASK-1956 | Move external contacts query to worker thread | P1 | ~25K | 1 |

**Total estimated (engineering):** ~25K tokens
**SR Review overhead:** ~15K tokens
**Grand Total:** ~40K tokens

### Out of Scope / Deferred

- Moving other SQLite queries to worker threads (BACKLOG-497 broader scope)
- Persistent worker pool or worker manager
- Changes to the renderer or preload bridge
- Contact deduplication or sync improvements

---

## Phase Plan

### Phase 1: Worker Thread Implementation (Sequential - Single Task)

```
Phase 1 (Sequential):
  └── TASK-1956: Create worker, async wrapper, update handler, enable WAL
```

**File ownership:**

TASK-1956 touches:
- `electron/workers/contactQueryWorker.ts` (NEW)
- `electron/services/db/externalContactDbService.ts`
- `electron/contact-handlers.ts`
- `electron/services/db/core/dbConnection.ts`

---

## Dependency Graph

```
TASK-1956 (single task) ──> Merge to develop
```

No inter-task dependencies (single-task sprint).

---

## Merge Plan

Task branches from `develop` and merges back to `develop`.

**Branch naming:**
- `fix/TASK-1956-contact-query-worker-thread`

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Worker path resolution in packaged Electron | Medium | High | Check `__dirname` in both dev/prod; add `app.isPackaged` fallback |
| WAL mode side effects on existing code | Low | Medium | WAL is a well-tested SQLite feature; busy_timeout already set |
| Encryption key not working in worker | Low | High | Same-process `workerData` transfer; test explicitly |
| Worker spawning overhead per call | Low | Low | One-shot is simpler; optimize to pool later if needed |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Unit Tests | Integration Tests | Manual |
|------|-----------|-------------------|--------|
| TASK-1956 | Yes (async wrapper) | No | Window drag during contact load |

### CI Requirements

All PRs must pass:
- `npm run type-check`
- `npm run lint`
- `npm test`

### Manual Verification Checklist (Post-Sprint)

- [ ] Start app with 1000+ contacts. Window should remain draggable during contact load.
- [ ] Open ContactSelectModal -- contacts appear correctly (no missing data).
- [ ] App startup and shutdown work correctly (WAL mode does not cause issues).

---

## Progress Tracking

| Task | Status | Billable Tokens | Duration | PR |
|------|--------|----------------|----------|-----|
| TASK-1956 | In Progress | - | - | - |

---

## Unplanned Work Log

| Task | Source | Root Cause | Added Date | Impact |
|------|--------|------------|------------|--------|
| - | - | - | - | - |

---

## Validation Checklist (End of Sprint)

- [ ] External contacts load without freezing the main process
- [ ] WAL mode enabled in database initialization
- [ ] Worker thread spawns, queries, and terminates cleanly
- [ ] All CI checks pass on develop after merge
- [ ] No regressions in contact flows
