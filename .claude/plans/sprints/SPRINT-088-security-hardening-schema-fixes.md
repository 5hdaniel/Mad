# SPRINT-088: Security Hardening & Schema Fixes

**Created:** 2026-02-19
**Status:** Active
**Branch:** `sprint/088-security-hardening-schema-fixes`
**Base:** `develop`

---

## Sprint Goal

Harden security posture and fix data integrity issues: remove a privilege escalation fallback, encrypt session tokens at rest, fix two incorrect table references (view and service), and guard a startup race condition.

## Sprint Narrative

The SPRINT-087 due diligence audit identified several security and schema issues that were deferred due to their risk profile requiring isolated testing. This sprint addresses 5 of those items: one critical security fix (service_role key removal), one medium-risk security feature (session token encryption), two schema/service table reference bugs, and one startup race condition.

The sprint is designed as an overnight run. Phase 1 contains 4 low-risk, isolated fixes that can run in parallel. Phase 2 contains the higher-risk session encryption task that should run sequentially after Phase 1 is merged, since it needs a stable baseline to test against.

---

## In-Scope

| ID | Title | Task | Phase | Est Tokens | Status |
|----|-------|------|-------|-----------|--------|
| BACKLOG-739 | Remove service_role key fallback | TASK-2013 | 1 | ~5K | Pending |
| BACKLOG-364 | Fix transaction_summary view table ref | TASK-2014 | 1 | ~8K | Pending |
| BACKLOG-365 | Fix feedbackService table reference | TASK-2015 | 1 | ~8K | Pending |
| BACKLOG-599 | Guard sync race condition at startup | TASK-2016 | 1 | ~8K | Pending |
| BACKLOG-722 | Encrypt session tokens with safeStorage | TASK-2017 | 2 | ~15K | Pending |

**Total Estimated Tokens:** ~44K (engineering) + ~15K (SR review) = ~59K

---

## Phase Plan

### Phase 1: Low-Risk Fixes (Parallel)

```
Phase 1: Security & Schema Fixes
+-- TASK-2013: Remove service_role key fallback (BACKLOG-739)      [PARALLEL]
|   1. Remove || process.env.SUPABASE_SERVICE_KEY on line 110
|   2. Add guard: throw if SUPABASE_ANON_KEY missing
|   3. Update file header comment
|   4. Update test mocks
|
+-- TASK-2014: Fix transaction_summary view (BACKLOG-364)          [PARALLEL]
|   1. Create migration: DROP/CREATE VIEW with transaction_contacts
|   2. Update schema.sql to match
|   3. Verify consumers of participant_count column
|
+-- TASK-2015: Fix feedbackService table reference (BACKLOG-365)   [PARALLEL]
|   1. Replace all user_feedback refs with classification_feedback
|   2. Verify column name alignment with schema
|   3. Update comments in feedbackService.ts
|
+-- TASK-2016: Guard sync race condition (BACKLOG-599)             [PARALLEL]
|   1. Add databaseService readiness check in startPeriodicSync()
|   2. Skip sync gracefully if DB not ready (log + retry next tick)
|   3. Verify call site ordering
|
+-- CI gate: type-check, lint, test all pass
```

**Parallelism justification:**
- TASK-2013 touches: `supabaseService.ts` + its tests -- no overlap
- TASK-2014 touches: `schema.sql` + new migration file -- no overlap
- TASK-2015 touches: `feedbackDbService.ts` + `feedbackService.ts` -- no overlap
- TASK-2016 touches: `submissionSyncService.ts` -- no overlap

### Phase 2: Session Encryption (Sequential)

```
Phase 2: Session Token Encryption (depends on Phase 1 merged)
+-- TASK-2017: Encrypt session.json with safeStorage (BACKLOG-722)  [SEQUENTIAL]
|   1. Add safeStorage encrypt/decrypt around session.json read/write
|   2. Handle plaintext -> encrypted migration
|   3. Graceful fallback: decrypt fail -> delete session, force re-login
|   4. Handle safeStorage unavailable -> plaintext with warning
|   5. Update tests
|
+-- CI gate: type-check, lint, test pass
+-- Manual test: login persistence, session.json is encrypted
```

**Why sequential:** This is the highest-risk task. It modifies auth persistence, has keychain conflict implications (see MEMORY.md), and needs manual testing. Running it on a stable Phase 1 baseline reduces variables.

---

## Dependency Graph

```
Phase 1 (Parallel):
TASK-2013 (service_role) ------+
TASK-2014 (view fix)    ------+---> All merged to develop
TASK-2015 (feedback ref) ------+
TASK-2016 (sync guard)  ------+
                               |
                               v
Phase Gate: Regression Check (PM)
  type-check -> lint -> test -> dev spot-check
                               |
                               v
Phase 2 (Sequential):
TASK-2017 (session encryption)
                               |
                               v
Sprint Complete
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1a | TASK-2013 (service_role) | None | Yes - with 2014, 2015, 2016 |
| 1b | TASK-2014 (view fix) | None | Yes - with 2013, 2015, 2016 |
| 1c | TASK-2015 (feedback ref) | None | Yes - with 2013, 2014, 2016 |
| 1d | TASK-2016 (sync guard) | None | Yes - with 2013, 2014, 2015 |
| 2 | TASK-2017 (session encrypt) | Phase 1 merged + Phase Gate | No |

---

## Merge Plan

| Task | Branch Name | Base | Target | Status |
|------|-------------|------|--------|--------|
| TASK-2013 | `fix/task-2013-remove-service-role-fallback` | develop | develop | Pending |
| TASK-2014 | `fix/task-2014-fix-transaction-summary-view` | develop | develop | Pending |
| TASK-2015 | `fix/task-2015-fix-feedback-table-reference` | develop | develop | Pending |
| TASK-2016 | `fix/task-2016-guard-sync-race-condition` | develop | develop | Pending |
| TASK-2017 | `feature/task-2017-encrypt-session-tokens` | develop | develop | Pending |

**Phase 1 merge order:** Any order (no dependencies between them).
**Phase 2 merge order:** TASK-2017 after all Phase 1 PRs merged and Phase Gate passed.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Removing service_role fallback breaks dev environment setup | Low | Low | App should always use anon key; clear error message if missing |
| transaction_summary view change breaks queries using participant_count | Medium | Low | Check all consumers of the view before changing |
| feedbackDbService column names don't match classification_feedback | Medium | Medium | Engineer must diff column names against schema before changing |
| Sync guard masks a real initialization ordering bug | Low | Low | Log when sync is skipped so it is diagnosable |
| safeStorage encrypt breaks on DMG/dev switch | High | Medium | Graceful fallback: decrypt fail -> delete session, force re-login |
| Existing plaintext sessions fail after encryption change | Medium | High | Auto-migration: detect plaintext, re-encrypt on first read |

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
| Phase gate passed | Update sprint narrative | PM runs regression check |

**Valid CSV statuses:** `Pending`, `In Progress`, `Testing`, `Completed`, `Deferred`

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2013 | Update supabaseService tests (remove SERVICE_KEY) | N/A | Verify app connects to Supabase |
| TASK-2014 | N/A (SQL view) | N/A | Query transaction_summary, verify counts |
| TASK-2015 | N/A (table name swap) | N/A | Verify feedback insert/query works |
| TASK-2016 | Mock databaseService.isInitialized() | N/A | Cold start app, verify no sync crash |
| TASK-2017 | Encrypt/decrypt round-trip, migration, failure fallback | N/A | Login, quit, relaunch (session persists); delete session.json (re-login) |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead |
|------|----------|----------|------------|-----------|-------------|
| TASK-2013 | security fix | ~5K | x1.0 | ~5K | ~2K |
| TASK-2014 | schema fix | ~8K | x1.0 | ~8K | ~3K |
| TASK-2015 | bug fix | ~8K | x1.0 | ~8K | ~3K |
| TASK-2016 | bug fix | ~8K | x1.0 | ~8K | ~3K |
| TASK-2017 | security feature | ~15K | x1.0 | ~15K | ~4K |
| **Totals** | | | | **~44K** | **~15K** |

**Grand total: ~59K estimated billable tokens.**

---

## Notes

### Overnight Execution Plan

This sprint is designed for overnight execution:
1. Launch 4 parallel engineer agents for Phase 1 tasks (separate Claude Web sessions or worktrees)
2. After all 4 PRs pass CI, SR Engineer batch-reviews and merges
3. PM runs Phase Gate regression check
4. Launch 1 engineer agent for Phase 2 (TASK-2017)
5. SR Engineer reviews and merges Phase 2

### Connection to SPRINT-087

SPRINT-087 (Repo Polish for Due Diligence) deferred these items. Specifically:
- BACKLOG-722 (session encryption) was explicitly noted as needing isolated testing
- BACKLOG-739 (service_role key) was deferred due to needing env verification
- BACKLOG-364, 365 were pre-existing schema issues identified during the audit
- BACKLOG-599 was a known race condition from earlier investigation
