# SPRINT-080B: Before 50 Users (Scaling & UX)

**Status:** Pending
**Created:** 2026-02-11
**Branch From:** develop
**Target:** develop

---

## Sprint Goal

Prepare the application for 50-user scale by adding server-side pagination to the broker portal, enabling WAL mode for better SQLite concurrency, and adding user-facing email sync depth controls.

## Scope

### In Scope

| Task | Title | Priority | Est. Tokens | Phase |
|------|-------|----------|-------------|-------|
| TASK-1964 | Broker Portal Submission List Pagination | P1 | ~60K | 1 |
| TASK-1965 | Enable SQLite WAL Mode | P1 | ~15K | 1 |
| TASK-1966 | Email Sync Depth Filter UI | P2 | ~35K | 1 |

**Total estimated (engineering):** ~110K tokens
**SR Review overhead:** ~40K tokens
**Grand Total:** ~150K tokens

### Out of Scope / Deferred

- Client-side infinite scroll (using page-based pagination instead)
- Supabase connection pooling changes
- Email sync performance optimization (separate concern)
- Broker portal mobile responsiveness

---

## Phase Plan

### Phase 1: All Three Tasks (Parallel - Worktrees)

All three tasks touch completely different codebases/directories. Safe for parallel execution.

```
Phase 1 (Parallel):
  ├── TASK-1964 (Pagination)      — broker-portal/
  ├── TASK-1965 (WAL Mode)        — electron/services/db/
  └── TASK-1966 (Email Filter UI) — electron/ + src/
```

**Parallel safety analysis:**

| Task Pair | Shared Files | Conflict Risk | Verdict |
|-----------|-------------|---------------|---------|
| 1964 vs 1965 | None | None | Safe parallel |
| 1964 vs 1966 | None | None | Safe parallel |
| 1965 vs 1966 | None | None | Safe parallel |

**File ownership per task:**

TASK-1964 touches:
- `broker-portal/app/dashboard/submissions/page.tsx`
- `broker-portal/components/submission/SubmissionListClient.tsx`
- `broker-portal/hooks/useRealtimeSubmissions.ts`

TASK-1965 touches:
- `electron/services/db/core/dbConnection.ts`

TASK-1966 touches:
- `electron/services/transactionService.ts`
- `electron/constants.ts`
- `src/` (email connections settings component)
- `electron/services/__tests__/incrementalSync.integration.test.ts`

**No overlapping files between any tasks.**

---

## Dependency Graph

```
TASK-1964 (Pagination)  ──┐
TASK-1965 (WAL Mode)    ──┼── all independent, parallel execution
TASK-1966 (Email Filter) ─┘
```

---

## Merge Plan

All branches target `develop` via traditional merge (not squash). No ordering constraints.

| Task | Branch | Merge Order |
|------|--------|-------------|
| TASK-1964 | `feature/TASK-1964-submission-pagination` | Any |
| TASK-1965 | `feature/TASK-1965-wal-mode` | Any |
| TASK-1966 | `feature/TASK-1966-email-sync-depth-filter` | Any |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQLCipher doesn't support WAL | Low | Medium | Check return value of `pragma("journal_mode = WAL")`; fallback gracefully |
| WAL sidecar files missed in backup | Medium | High | Run `PRAGMA wal_checkpoint(TRUNCATE)` before any backup |
| Pagination breaks realtime updates | Low | Medium | Verify `router.refresh()` re-fetches current page |
| Email sync depth change confuses existing users | Low | Low | Default matches current behavior (3 months / ~90 days) |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Verification |
|------|-------------|
| TASK-1964 | Manual test with 50+ submissions, verify page nav, filter resets to page 1 |
| TASK-1965 | Query `PRAGMA journal_mode` after DB open, assert returns `wal`; run `npm test` |
| TASK-1966 | Change sync depth in settings, verify new sync respects the setting |

### CI Requirements

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Progress Tracking

| Task | Status | Billable Tokens | Duration | PR |
|------|--------|----------------|----------|-----|
| TASK-1964 | Pending | - | - | - |
| TASK-1965 | Pending | - | - | - |
| TASK-1966 | Pending | - | - | - |
