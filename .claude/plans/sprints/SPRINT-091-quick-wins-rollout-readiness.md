# SPRINT-091: Quick Wins -- Rollout Readiness

**Created:** 2026-02-21
**Status:** Planning
**Base:** `develop`

---

## Sprint Goal

Knock out 7 low-effort rollout readiness items -- security hardening, bug fixes, and production hygiene -- before tackling larger features in subsequent sprints.

## Sprint Narrative

With SPRINT-090 wrapping up code deduplication and service consolidation, the codebase is cleaner and more maintainable. Before moving to larger feature work, this sprint addresses a batch of quick-win items identified during the rollout readiness audit. These range from P0 security fixes (RLS policies granting universal access) to minor bug fixes (thread sort order) and production hygiene (log scrubbing, CSP headers, dev-only code exposure).

All 7 tasks are independent with no shared file dependencies, making them safe for full parallel execution.

---

## In-Scope

| ID | Title | Task | Phase | Est Tokens | Actual Tokens | PR | Merged | Status |
|----|-------|------|-------|-----------|---------------|-----|--------|--------|
| BACKLOG-768 | Verify nodeIntegration/contextIsolation settings | TASK-2033 | 1 | ~10K | - | - | - | Pending |
| BACKLOG-769 | Fix window.__testCrash exposed in production | TASK-2034 | 1 | ~15K | - | - | - | Pending |
| BACKLOG-175 | Fix AttachMessagesModal thread sort order | TASK-2035 | 1 | ~15K | - | - | - | Pending |
| BACKLOG-770 | Remove Windows deep link cold-start 100ms delay | TASK-2036 | 1 | ~15K | - | - | - | Pending |
| BACKLOG-771 | Fix Supabase RLS policies on users/licenses/devices | TASK-2037 | 1 | ~40K | - | - | - | Pending |
| BACKLOG-772 | Scrub sensitive data from log statements | TASK-2038 | 1 | ~40K | - | - | - | Pending |
| BACKLOG-773 | Review and tighten CSP headers | TASK-2039 | 1 | ~40K | - | - | - | Pending |

**Total Estimated Tokens:** ~175K (engineering) + ~70K (SR review, ~10K per task) = ~245K

---

## Out of Scope

- **Full Electron security audit** -- This sprint covers specific items #7, #19, #20, #21 from the rollout readiness list, not a comprehensive audit.
- **New RLS policies for other Supabase tables** -- Only `users`, `licenses`, `devices` are addressed.
- **Rewriting the logging system** -- We scrub sensitive data from existing log calls, not refactoring the logging infrastructure.
- **Production CSP for broker portal (Next.js)** -- CSP work is scoped to the Electron app only.

---

## Phase Plan

### Phase 1: All Tasks (Parallel)

All 7 tasks are independent and can run in parallel. No shared files, no dependency chains.

```
Phase 1: Quick Wins (All Parallel)
+-- TASK-2033: Verify nodeIntegration/contextIsolation          [~15 min]
+-- TASK-2034: Fix window.__testCrash dev-only guard            [~30 min]
+-- TASK-2035: Fix AttachMessagesModal thread sort order         [~30 min]
+-- TASK-2036: Remove Windows deep link 100ms delay             [~30 min]
+-- TASK-2037: Fix Supabase RLS policies (users/licenses/dev)   [~0.5 day]
+-- TASK-2038: Scrub sensitive data from log statements         [~0.5-1 day]
+-- TASK-2039: Review and tighten CSP headers                   [~0.5-1 day]
|
+-- CI gate: type-check, lint, test pass (per task)
+-- SR review + merge (per task, independent)
```

**Why all parallel is safe:**
- TASK-2033: Read-only verification of `electron/main.ts` BrowserWindow config
- TASK-2034: Modifies `src/contexts/NetworkContext.tsx` only
- TASK-2035: Modifies `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` only
- TASK-2036: Modifies `electron/main.ts` (different section from TASK-2033 -- TASK-2033 is read-only)
- TASK-2037: Supabase SQL migration only (no TypeScript files)
- TASK-2038: Modifies log statements across many files (no overlap with above specific files)
- TASK-2039: Modifies CSP config in `electron/main.ts` (different section from TASK-2036)

**Note on TASK-2033/2036/2039 sharing `electron/main.ts`:** TASK-2033 is read-only verification (may result in no changes). TASK-2036 modifies the deep link handler section. TASK-2039 modifies CSP header configuration. These touch different, well-separated sections of the file. However, **SR Engineer should review for potential merge conflicts** during technical review and may recommend sequencing these three if the sections are closer than expected.

---

## Dependency Graph

```
No dependencies -- all tasks are independent.

TASK-2033 ──┐
TASK-2034 ──┤
TASK-2035 ──┤
TASK-2036 ──┼──> All merge independently to develop
TASK-2037 ──┤
TASK-2038 ──┤
TASK-2039 ──┘
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1 | TASK-2033 (nodeIntegration verify) | None | Yes (all) |
| 1 | TASK-2034 (testCrash fix) | None | Yes (all) |
| 1 | TASK-2035 (thread sort fix) | None | Yes (all) |
| 1 | TASK-2036 (deep link delay) | None | Yes (all) |
| 1 | TASK-2037 (RLS policies) | None | Yes (all) |
| 1 | TASK-2038 (log scrubbing) | None | Yes (all) |
| 1 | TASK-2039 (CSP headers) | None | Yes (all) |

---

## Merge Plan

| Task | Branch Name | Base | Target | PR | Status |
|------|-------------|------|--------|-----|--------|
| TASK-2033 | `fix/task-2033-verify-node-integration` | develop | develop | - | Pending |
| TASK-2034 | `fix/task-2034-testcrash-dev-guard` | develop | develop | - | Pending |
| TASK-2035 | `fix/task-2035-thread-sort-order` | develop | develop | - | Pending |
| TASK-2036 | `fix/task-2036-remove-deeplink-delay` | develop | develop | - | Pending |
| TASK-2037 | `fix/task-2037-rls-policies` | develop | develop | - | Pending |
| TASK-2038 | `chore/task-2038-scrub-log-sensitive-data` | develop | develop | - | Pending |
| TASK-2039 | `fix/task-2039-tighten-csp-headers` | develop | develop | - | Pending |

**Merge order:** Any order -- no dependencies. However, if TASK-2033/2036/2039 all modify `electron/main.ts`, merge one at a time and rebase the others.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| RLS policy changes break existing queries | High | Low | Test with Supabase dashboard; verify app still reads/writes own data |
| CSP too restrictive breaks app functionality | Medium | Medium | Test all app features after CSP changes; start with report-only mode |
| Log scrubbing removes useful debugging info | Low | Medium | Redact values but keep structure (e.g., "token=***" not remove line entirely) |
| Multiple tasks modifying electron/main.ts cause merge conflicts | Low | Medium | Tasks touch different sections; SR reviews for conflict risk |
| nodeIntegration verification reveals it's incorrectly set | Medium | Low | Fix is trivial -- single config line change |
| Thread sort fix has unintended side effects | Low | Low | 1-line change with clear logic; existing tests validate |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2033 | N/A (verification task) | N/A | Confirm BrowserWindow settings in dev tools |
| TASK-2034 | Verify `window.__testCrash` is undefined in prod build | N/A | Check `window.__testCrash` is not accessible |
| TASK-2035 | Update MessageThreadCard tests for sort order | N/A | Verify threads sort newest-first in AttachMessagesModal |
| TASK-2036 | N/A (removing delay, no new logic) | N/A | Test deep link callback on Windows cold start |
| TASK-2037 | N/A (SQL migration) | Test RLS with Supabase dashboard | Verify app can read/write own rows, not others |
| TASK-2038 | Spot-check redacted log output | N/A | Review log output for leaked sensitive data |
| TASK-2039 | N/A (config change) | N/A | Verify app loads correctly with tightened CSP |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead | Confidence |
|------|----------|----------|------------|-----------|-------------|------------|
| TASK-2033 | security | ~25K | x0.4 | ~10K | ~10K | High |
| TASK-2034 | security | ~35K | x0.4 | ~15K | ~10K | High |
| TASK-2035 | bug fix | ~15K | x1.0 | ~15K | ~10K | High |
| TASK-2036 | config | ~30K | x0.5 | ~15K | ~10K | High |
| TASK-2037 | schema | ~30K | x1.3 | ~40K | ~10K | Medium |
| TASK-2038 | cleanup | ~80K | x0.5 | ~40K | ~10K | Medium |
| TASK-2039 | security | ~100K | x0.4 | ~40K | ~10K | Medium |
| **Totals** | | | | **~175K** | **~70K** | |

**Grand total: ~245K estimated billable tokens.**

Note: TASK-2033 may complete with zero code changes (verification only). TASK-2038 estimate depends on how many log statements contain sensitive data -- a scope scan should be done before implementation. TASK-2037 and TASK-2039 have medium confidence due to the need to understand existing Supabase policies and CSP configuration.

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
