# SPRINT-092: Auth Hardening + Observability

**Created:** 2026-02-21
**Status:** Completed
**Base:** `develop` (with SPRINT-091 merged)

---

## Sprint Goal

Harden authentication flows and improve production observability -- proactive token refresh to prevent session drops, Sentry coverage in catch blocks, rate limiting on Edge Functions, audit log completeness, login retry UX, and global sign-out capability.

## Sprint Narrative

With SPRINT-090 completing code deduplication and SPRINT-091 addressing quick-win rollout readiness items, the codebase is in good shape for deeper auth and observability work. This sprint addresses six rollout readiness items spanning two themes:

1. **Auth Hardening** (P1): The Supabase client has `autoRefreshToken: false`, meaning sessions silently expire after 1 hour. Login failures have no retry mechanism. Users cannot sign out of all devices. These gaps create poor UX and security concerns for production users.

2. **Observability** (P2): Caught exceptions are silently swallowed in many service files -- adding Sentry.captureException() ensures error visibility. Edge Functions lack rate limiting. Audit logs have gaps in user action coverage.

The sprint is organized in two batches: Batch 1 (4 parallel tasks with no shared files) and Batch 2 (2 sequential tasks that depend on the auth patterns established by the token auto-refresh task).

---

## In-Scope

| ID | Title | Task | Batch | Est Tokens | Actual Tokens | PR | Merged | Status |
|----|-------|------|-------|-----------|---------------|-----|--------|--------|
| BACKLOG-774 | Supabase token auto-refresh | TASK-2040 | 1 | ~25K | - | #925 | Yes | Completed |
| BACKLOG-775 | Add Sentry.captureException() to catch blocks | TASK-2041 | 1 | ~40K | - | #927 | Yes | Completed |
| BACKLOG-776 | Rate limiting on Supabase Edge Functions | TASK-2042 | 1 | ~25K | - | #924 | Yes | Completed |
| BACKLOG-777 | Audit log completeness -- missing user actions | TASK-2043 | 1 | ~40K | - | #926 | Yes | Completed |
| BACKLOG-057 | Login auth timeout -- add retry on failure | TASK-2044 | 2 | ~30K | - | #928 | Yes | Completed |
| BACKLOG-778 | Sign out of all devices / session invalidation | TASK-2045 | 2 | ~30K | - | - | - | Moved to SPRINT-093 |

**Total Estimated Tokens:** ~190K (engineering) + ~60K (SR review, ~10K per task) = ~250K

---

## Out of Scope

- **Full auth system rewrite** -- We are adding auto-refresh and retry, not rebuilding the auth layer.
- **Token encryption at rest** -- Already addressed in SPRINT-088 (BACKLOG-722, session.json encryption with safeStorage).
- **Sentry performance monitoring / tracing** -- Only error capture in catch blocks, not distributed tracing.
- **New Edge Functions** -- Only adding rate limiting to existing functions (scim, validate-address).
- **Audit log UI / reporting** -- Only backend audit log event coverage, not a viewer.
- **Multi-factor authentication** -- Not in scope for this sprint.

---

## Phase Plan

### Batch 1: Parallel Tasks (4 tasks, no shared files)

```
Batch 1: Auth Hardening + Observability (All Parallel)
+-- TASK-2040: Supabase token auto-refresh             [~0.5-1 day]
+-- TASK-2041: Sentry.captureException() in catch blocks [~1 day]
+-- TASK-2042: Rate limiting on Edge Functions           [~0.5-1 day]
+-- TASK-2043: Audit log completeness                    [~1-2 days]
|
+-- CI gate: type-check, lint, test pass (per task)
+-- SR review + merge (per task, independent)
```

**Why all four are safe in parallel:**
- TASK-2040: Modifies `electron/services/supabaseService.ts` (auth config section, line ~129) and possibly a new token refresh helper.
- TASK-2041: Adds `Sentry.captureException()` calls inside existing catch blocks across ~20-30 service files. Touches many files but only adds one line per catch block -- no structural changes.
- TASK-2042: Modifies `supabase/functions/scim/index.ts` and `supabase/functions/validate-address/index.ts` only (Deno runtime, completely isolated from Electron code).
- TASK-2043: Modifies `electron/services/auditService.ts` (new AuditAction types) and adds `auditService.log()` calls in handler files. The audit calls are additions, not modifications to existing logic.

**Potential overlap note:** TASK-2041 and TASK-2043 both add lines to service/handler files. However, TASK-2041 adds `Sentry.captureException()` inside `catch` blocks, while TASK-2043 adds `auditService.log()` at business logic points (exports, settings changes, etc.). Different insertion points, no conflict risk. SR Engineer should confirm during technical review.

### Batch 2: Sequential Tasks (after Batch 1)

```
Batch 2: Auth UX (Sequential, after TASK-2040)
+-- TASK-2044: Login auth timeout retry                  [~1 day]
|   Depends on: TASK-2040 (token auto-refresh patterns)
|   Shares: sessionHandlers.ts, authBridge.ts, supabaseService.ts
|
+-- TASK-2045: Sign out all devices / session invalidation [~1 day]
    Depends on: TASK-2044 (auth error handling patterns)
    Shares: sessionHandlers.ts, supabaseService.ts
|
+-- CI gate: type-check, lint, test pass (per task)
+-- SR review + merge (per task, sequential)
```

**Why sequential:**
- TASK-2044 and TASK-2045 both modify `sessionHandlers.ts` and `supabaseService.ts`.
- TASK-2040 establishes token refresh patterns that TASK-2044 builds on (retry + refresh on auth failure).
- TASK-2044 establishes auth error handling patterns that TASK-2045 uses (global sign-out needs error handling).

---

## Dependency Graph

```
TASK-2040 (token auto-refresh) ──┐
TASK-2041 (Sentry catch blocks) ──┼──> All merge independently to develop
TASK-2042 (rate limiting)  ───────┤
TASK-2043 (audit log completeness)┘
                                  |
                     After TASK-2040 merged:
                                  |
                          TASK-2044 (login retry)
                                  |
                     After TASK-2044 merged:
                                  |
                          TASK-2045 (sign out all devices)
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1 | TASK-2040 (token auto-refresh) | None | Yes (Batch 1) |
| 1 | TASK-2041 (Sentry catch blocks) | None | Yes (Batch 1) |
| 1 | TASK-2042 (rate limiting) | None | Yes (Batch 1) |
| 1 | TASK-2043 (audit log completeness) | None | Yes (Batch 1) |
| 2 | TASK-2044 (login retry) | TASK-2040 | No (Sequential) |
| 3 | TASK-2045 (sign out all devices) | TASK-2044 | No (Sequential) |

---

## Merge Plan

| Task | Branch Name | Base | Target | PR | Status |
|------|-------------|------|--------|-----|--------|
| TASK-2040 | `fix/task-2040-supabase-token-refresh` | develop | develop | #925 | Merged |
| TASK-2041 | `fix/task-2041-sentry-capture-exceptions` | develop | develop | #927 | Merged |
| TASK-2042 | `fix/task-2042-edge-function-rate-limiting` | develop | develop | #924 | Merged |
| TASK-2043 | `fix/task-2043-audit-log-completeness` | develop | develop | #926 | Merged |
| TASK-2044 | `fix/task-2044-login-auth-retry` | develop | develop | #928 | Merged |
| TASK-2045 | `feature/task-2045-sign-out-all-devices` | develop | develop | - | Moved to SPRINT-093 |

**Merge order:** Batch 1 tasks can merge in any order. TASK-2044 must wait for TASK-2040 to merge. TASK-2045 must wait for TASK-2044 to merge.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Auto-refresh token causes unexpected re-auth during active sessions | High | Low | Test with token TTL near expiry; verify refresh happens transparently |
| Sentry calls in hot paths impact performance | Low | Low | captureException is async/non-blocking; no impact on critical path |
| Rate limiting too aggressive blocks legitimate use | Medium | Medium | Start with generous limits (100 req/min); monitor before tightening |
| Audit log additions break existing handler logic | Medium | Low | Audit calls are additive only; wrap in try-catch so failures don't break main flow |
| Login retry creates duplicate auth sessions | Medium | Low | Ensure retry cancels previous attempt before starting new one |
| Global sign-out breaks active sessions on other devices | Low | Low | Expected behavior; confirm Supabase `signOut({ scope: 'global' })` works as documented |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2040 | Test refresh logic with mocked Supabase client | N/A | Run app, wait >1hr, verify session stays active |
| TASK-2041 | Verify Sentry.captureException called in catch blocks (mock Sentry) | N/A | Trigger errors, check Sentry dashboard for events |
| TASK-2042 | Test rate limit middleware returns 429 at threshold | N/A | curl Edge Functions rapidly, verify 429 response |
| TASK-2043 | Test new audit entries created for each action type | N/A | Perform each action, verify audit_log entries |
| TASK-2044 | Test retry logic (mock auth failures, verify retry count) | N/A | Kill network during login, verify retry UI appears |
| TASK-2045 | Test global signOut call and local session cleanup | N/A | Sign out all devices in Settings, verify other sessions invalidated |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead | Confidence |
|------|----------|----------|------------|-----------|-------------|------------|
| TASK-2040 | service | ~50K | x0.5 | ~25K | ~10K | High |
| TASK-2041 | cleanup | ~80K | x0.5 | ~40K | ~10K | Medium |
| TASK-2042 | service | ~50K | x0.5 | ~25K | ~10K | Medium |
| TASK-2043 | service | ~80K | x0.5 | ~40K | ~10K | Medium |
| TASK-2044 | service | ~60K | x0.5 | ~30K | ~10K | Medium |
| TASK-2045 | service | ~60K | x0.5 | ~30K | ~10K | Medium |
| **Totals** | | | | **~190K** | **~60K** | |

**Grand total: ~250K estimated billable tokens.**

Note: TASK-2041 estimate depends on how many catch blocks are deemed "critical" -- a scope scan should narrow this. TASK-2043 depends on how many actions are currently unlogged -- the audit type enum already covers LOGIN, LOGOUT, DATA_EXPORT, etc. so some may already be wired.

---

## PM Status Update Checkpoints

PM updates status at each transition across ALL three locations:

1. `.claude/plans/backlog/data/backlog.csv` -- status column (source of truth)
2. `.claude/plans/backlog/items/BACKLOG-XXX.md` -- if detail file exists, update status there too
3. This sprint file -- In-Scope table Status column

| When | Status | Trigger |
|------|--------|---------|
| Engineer agent assigned | In Progress | PM kicks off engineer |
| PR created + CI passes | Testing | SR notifies PM |
| PR merged | Completed | SR confirms merge |

**Valid CSV statuses:** `Pending`, `In Progress`, `Testing`, `Completed`, `Deferred`

---

## End-of-Sprint Validation Notes

**Sprint Closed:** 2026-02-22
**Closed By:** PM

### Completion Summary

| Metric | Value |
|--------|-------|
| Tasks Planned | 6 |
| Tasks Completed | 5 |
| Tasks Moved | 1 (TASK-2045 to SPRINT-093) |
| PRs Merged | 5 (#922, #924, #925, #926, #927, #928) |
| Completion Rate | 83% (5/6) |

### PR Merge Verification

| Task | PR | Merged | Verified |
|------|-----|--------|----------|
| TASK-2040 (Supabase token auto-refresh) | #925 | Yes | Yes |
| TASK-2041 (Sentry captureException) | #927 | Yes | Yes |
| TASK-2042 (Edge function rate limiting) | #924 | Yes | Yes |
| TASK-2043 (Audit log completeness) | #926 | Yes | Yes |
| TASK-2044 (Login retry) | #928 | Yes | Yes |
| TASK-2045 (Sign out all devices) | - | - | Moved to SPRINT-093 |

### Backlog Status Updates

| Backlog ID | Status | Sprint |
|------------|--------|--------|
| BACKLOG-774 | Completed | SPRINT-092 |
| BACKLOG-775 | Completed | SPRINT-092 |
| BACKLOG-776 | Completed | SPRINT-092 |
| BACKLOG-777 | Completed | SPRINT-092 |
| BACKLOG-057 | Completed | SPRINT-092 |
| BACKLOG-778 | In Progress | SPRINT-093 (carried over) |

### Carryover Notes

- **TASK-2045 / BACKLOG-778 (Sign out all devices):** Moved to SPRINT-093 (Sync Resilience + Data Integrity). Task depends on auth error handling patterns from TASK-2044 which is now merged, so it is unblocked for SPRINT-093.

### Observations

- Batch 1 (4 parallel tasks) executed successfully with no merge conflicts, validating the shared-file analysis.
- Batch 2 was partially completed: TASK-2044 merged, TASK-2045 deferred to next sprint.
- All 5 merged PRs passed CI gates (type-check, lint, test).
- Sprint delivered on both themes: auth hardening (token refresh, login retry) and observability (Sentry coverage, rate limiting, audit logs).
