# SPRINT-080C: Before 100 Users (Monitoring & Resilience)

**Status:** Pending
**Created:** 2026-02-11
**Branch From:** develop
**Target:** develop

---

## Sprint Goal

Add production monitoring (Sentry), crash recovery, database backup safety, periodic update checks, and Supabase health monitoring to support scaling to 100 users.

## Scope

### In Scope

| Task | Title | Priority | Est. Tokens | Phase |
|------|-------|----------|-------------|-------|
| TASK-1967 | Sentry Integration | P1 | ~50K | 1 |
| TASK-1968 | Renderer Crash Recovery | P1 | ~15K | 2 (after 1967) |
| TASK-1969 | Pre-Migration Database Backup | P2 | ~15K | 1 |
| TASK-1970 | Periodic Update Checks | P2 | ~10K | 1 |
| TASK-1971 | Supabase Monitoring (Edge Function) | P2 | ~25K | 1 |

**Total estimated (engineering):** ~115K tokens
**SR Review overhead:** ~40K tokens
**Grand Total:** ~155K tokens

### Out of Scope / Deferred

- Custom Sentry dashboard / alerting rules
- Auto-restart on crash (manual reload via dialog is sufficient)
- Backup rotation / cleanup (single backup per migration is sufficient for now)
- Supabase alerting / PagerDuty integration
- Client-side performance monitoring (Sentry performance module)

---

## Phase Plan

### Execution: Mixed Sequential + Parallel

TASK-1967 and TASK-1968 are sequential (crash recovery depends on Sentry for capturing crash details). The remaining three tasks are independent and can run in parallel with each other (and with the 1967→1968 chain).

```
Sequential: TASK-1967 (Sentry) → TASK-1968 (Crash Recovery)
Parallel:   TASK-1969 (Migration Backup) | TASK-1970 (Periodic Updates) | TASK-1971 (Supabase Monitor)
```

**Parallel safety analysis:**

| Task Pair | Shared Files | Conflict Risk | Verdict |
|-----------|-------------|---------------|---------|
| 1967 vs 1969 | None | None | Safe parallel |
| 1967 vs 1970 | `electron/main.ts` | Low (different sections) | Sequential preferred |
| 1967 vs 1971 | None | None | Safe parallel |
| 1969 vs 1970 | None | None | Safe parallel |
| 1969 vs 1971 | None | None | Safe parallel |
| 1970 vs 1971 | None | None | Safe parallel |

**Note:** TASK-1967 and TASK-1970 both touch `electron/main.ts`. Running 1970 after 1967+1968 completes avoids merge conflicts.

**Recommended execution order:**
```
Batch 1 (Parallel):
  ├── TASK-1967 (Sentry)           — electron/main.ts, vite.config.ts
  ├── TASK-1969 (Migration Backup) — electron/services/databaseService.ts
  └── TASK-1971 (Supabase Monitor) — Supabase Edge Function (no local files)

Batch 2 (Sequential after 1967):
  └── TASK-1968 (Crash Recovery)   — electron/main.ts

Batch 3 (After Batch 2):
  └── TASK-1970 (Periodic Updates) — electron/main.ts, electron/constants.ts
```

**File ownership per task:**

TASK-1967 touches:
- `electron/main.ts` (Sentry init)
- `vite.config.ts` (Sentry vite plugin)
- `.github/workflows/release.yml` (secrets)
- `.env.production` / `.env.development` (DSN)

TASK-1968 touches:
- `electron/main.ts` (crash handlers after createWindow)

TASK-1969 touches:
- `electron/services/databaseService.ts` (backup in runMigrations)

TASK-1970 touches:
- `electron/constants.ts` (new constant)
- `electron/main.ts` (setInterval for update checks)

TASK-1971 touches:
- Supabase Edge Function only (deployed via MCP)

---

## Dependency Graph

```
TASK-1967 (Sentry)
    │
    ▼
TASK-1968 (Crash Recovery) ── depends on Sentry for crash capture
    │
    ▼
TASK-1970 (Periodic Updates) ── sequential to avoid main.ts conflicts

TASK-1969 (Migration Backup) ── independent
TASK-1971 (Supabase Monitor) ── independent
```

---

## Merge Plan

All branches target `develop` via traditional merge (not squash).

| Task | Branch | Merge Order |
|------|--------|-------------|
| TASK-1967 | `feature/TASK-1967-sentry-integration` | 1st |
| TASK-1969 | `feature/TASK-1969-migration-backup` | Any (independent) |
| TASK-1971 | `feature/TASK-1971-supabase-monitoring` | Any (independent) |
| TASK-1968 | `feature/TASK-1968-renderer-crash-recovery` | After 1967 |
| TASK-1970 | `feature/TASK-1970-periodic-updates` | After 1968 |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sentry SDK increases bundle size significantly | Medium | Low | Tree-shake unused integrations; measure before/after |
| Sentry source maps leak source code | Low | Medium | Upload maps to Sentry only, don't ship with app |
| Crash recovery dialog re-crashes | Low | High | Use native dialog (Electron dialog module, not renderer) |
| Migration backup doubles DB file size on disk | Low | Low | Single backup, overwrite on next migration |
| Supabase Edge Function cold start latency | Low | Low | Health check is not user-facing, latency acceptable |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Verification |
|------|-------------|
| TASK-1967 | Trigger deliberate error, confirm in Sentry with readable stack trace |
| TASK-1968 | Force crash via DevTools `process.crash()`, confirm dialog + reload |
| TASK-1969 | Run migration, confirm backup file exists and is valid |
| TASK-1970 | Confirm interval set in production mode only |
| TASK-1971 | Deploy via Supabase MCP, test with curl |

### CI Requirements

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Progress Tracking

| Task | Status | Billable Tokens | Duration | PR |
|------|--------|----------------|----------|-----|
| TASK-1967 | Pending | - | - | - |
| TASK-1968 | Pending | - | - | - |
| TASK-1969 | Pending | - | - | - |
| TASK-1970 | Pending | - | - | - |
| TASK-1971 | Pending | - | - | - |
