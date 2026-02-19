# SPRINT-087: Repo Polish for Due Diligence

**Created:** 2026-02-19
**Status:** Planning
**Branch:** `develop` (task branches off develop)
**Base:** `develop`

---

## Sprint Goal

Make the codebase presentable for external due diligence review. Remove dead code, enforce CI quality gates, expand test coverage visibility, and eliminate hygiene issues that signal neglect to a technical acquirer.

## Sprint Narrative

A software due diligence assessment identified 12 issues (BACKLOG-721 through BACKLOG-732) spanning dead code, non-blocking CI steps, low coverage thresholds, and minor hygiene gaps. This sprint addresses the 9 items that have the highest signal-to-effort ratio -- the things a technical reviewer would flag within the first hour of examining the repo.

The Electron v35-to-v40 upgrade (BACKLOG-721), session.json encryption (BACKLOG-722), and the imessage-parser vulnerability chain (BACKLOG-723) are deferred to dedicated sprints due to their size, risk profile, or requiring focused testing.

---

## In-Scope

| ID | Title | Task | Phase | Status |
|----|-------|------|-------|--------|
| BACKLOG-724 | Delete empty electron/schema.sql artifact | TASK-2006 | 1 | Pending |
| BACKLOG-727 | Fix backlog CSV status casing | TASK-2006 | 1 | Pending |
| BACKLOG-731 | Gitignore mad.db and backlog-dashboard.html | TASK-2006 | 1 | Pending |
| BACKLOG-732 | Consolidate duplicate backlog items | TASK-2006 | 1 | Pending |
| BACKLOG-725 | Remove deprecated components from AppRouter | TASK-2007 | 1 | Pending |
| BACKLOG-726 | Replace console.log with logService | TASK-2008 | 1 | Pending |
| BACKLOG-728 | Make lint and npm audit blocking in CI | TASK-2009 | 2 | Pending |
| BACKLOG-729 | Add Electron backend tests to CI pipeline | TASK-2010 | 2 | Pending |
| BACKLOG-730 | Raise CI test coverage threshold to 40% | TASK-2011 | 2 | Pending |

**Total Estimated Tokens:** ~55K (engineering ~35K + SR review ~20K)

## Out-of-Scope / Deferred

| ID | Title | Reason | Recommended Sprint |
|----|-------|--------|-------------------|
| BACKLOG-721 | Upgrade Electron v35 to v40 | ~80K tokens, high risk (Node.js 22->24, native module rebuild, macOS 12 minimum), needs dedicated sprint with manual testing | SPRINT-088 (standalone) |
| BACKLOG-722 | Encrypt session.json with safeStorage | Security change with safeStorage/keychain implications, needs isolated testing | SPRINT-088 or SPRINT-089 |
| BACKLOG-723 | Replace or patch imessage-parser vulnerability chain | Dependency chain surgery, may break iPhone sync, needs dedicated investigation | SPRINT-089 |

---

## Phase Plan

### Phase 1: Code Cleanup (Parallel)

```
Phase 1: Code Cleanup
+-- TASK-2006: Repo hygiene quick wins (BACKLOG-724, 727, 731, 732)  [PARALLEL]
|   1. Delete empty electron/schema.sql
|   2. Fix backlog CSV casing (7 pending, 4 completed, 1 testing, 1 deferred, 1 Blocked)
|   3. Add mad.db and backlog-dashboard.html to .gitignore
|   4. Consolidate ~20 duplicate backlog items
|
+-- TASK-2007: Remove deprecated components (BACKLOG-725)             [PARALLEL]
|   1. Remove 6 deprecated component imports from AppRouter.tsx
|   2. Remove WelcomeTerms import from AppModals.tsx
|   3. Delete 6 deprecated component files
|   4. Delete associated test files
|   5. Verify no other imports remain
|
+-- TASK-2008: Replace console.log with logService (BACKLOG-726)      [PARALLEL]
|   1. Replace 77 console.log calls in 17 src/ files
|   2. Replace 6 console.log calls in 5 electron/ production files
|   3. Skip test files (console.log in tests is acceptable)
|
+-- CI gate: type-check, lint, test all pass
```

**Parallelism justification:**
- TASK-2006 touches: backlog CSV, .gitignore, electron/schema.sql -- no overlap with 2007/2008
- TASK-2007 touches: AppRouter.tsx, AppModals.tsx, 6 component files -- no overlap with 2008
- TASK-2008 touches: 22 production files (hooks, services, state) -- no overlap with AppRouter/AppModals since those have no console.log calls

### Phase 2: CI Hardening (Sequential)

```
Phase 2: CI Hardening (depends on Phase 1 merged)
+-- TASK-2009: Make lint and npm audit blocking (BACKLOG-728)         [FIRST]
|   1. Remove continue-on-error from lint step
|   2. Remove continue-on-error from npm audit step
|   3. Remove continue-on-error from npm outdated step (or remove step)
|   4. Fix any lint errors that would now block CI
|
+-- TASK-2010: Add electron tests to CI (BACKLOG-729)                 [AFTER 2009]
|   1. Update jest.config.js testMatch for CI to include electron/**
|   2. Fix any electron tests that fail in CI environment
|   3. Verify CI passes with expanded test suite
|
+-- TASK-2011: Raise coverage threshold to 40% (BACKLOG-730)          [AFTER 2010]
|   1. Run coverage with electron tests included
|   2. Adjust global thresholds from 24% toward 40%
|   3. Set realistic thresholds based on measured coverage
|   4. Add per-path thresholds for src/hooks/ and src/utils/
|
+-- CI gate: ALL tests pass with new blocking rules
```

**Sequential justification:**
- TASK-2009 changes CI behavior -- lint must pass before we add more tests
- TASK-2010 adds electron tests to CI -- must be stable before raising thresholds
- TASK-2011 raises thresholds -- depends on knowing actual coverage with electron tests included

---

## Dependency Graph

```
Phase 1 (Parallel):
TASK-2006 (repo hygiene) ----+
TASK-2007 (deprecated comps) +---> All merged to develop
TASK-2008 (console.log)  ----+
                              |
                              v
Phase 2 (Sequential):
TASK-2009 (lint/audit blocking)
    |
    v
TASK-2010 (electron tests in CI)
    |
    v
TASK-2011 (coverage threshold 40%)
    |
    v
Sprint Complete
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1a | TASK-2006 (repo hygiene) | None | Yes - with 2007, 2008 |
| 1b | TASK-2007 (deprecated components) | None | Yes - with 2006, 2008 |
| 1c | TASK-2008 (console.log cleanup) | None | Yes - with 2006, 2007 |
| 2 | TASK-2009 (lint/audit blocking) | Phase 1 merged | No |
| 3 | TASK-2010 (electron tests in CI) | TASK-2009 | No |
| 4 | TASK-2011 (coverage threshold) | TASK-2010 | No |

---

## Merge Plan

| Task | Branch Name | Base | Target |
|------|-------------|------|--------|
| TASK-2006 | `chore/task-2006-repo-hygiene` | develop | develop |
| TASK-2007 | `chore/task-2007-remove-deprecated-components` | develop | develop |
| TASK-2008 | `chore/task-2008-replace-console-log` | develop | develop |
| TASK-2009 | `ci/task-2009-lint-audit-blocking` | develop | develop |
| TASK-2010 | `ci/task-2010-electron-tests-in-ci` | develop | develop |
| TASK-2011 | `ci/task-2011-coverage-threshold-40` | develop | develop |

**Phase 1 merge order:** Any order (no dependencies between them).
**Phase 2 merge order:** TASK-2009 -> TASK-2010 -> TASK-2011 (strict sequence).

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Removing deprecated components breaks a route that still uses them | High | Low | Grep for all imports before deleting; check AppRouter route map against onboarding steps |
| Making lint blocking reveals many existing lint errors | Medium | Medium | Fix lint errors in TASK-2009; if too many, scope to only blocking errors (not warnings) |
| Electron tests fail in CI due to missing native modules | Medium | High | CI may need electron test setup; if too many failures, add electron tests behind a separate job |
| Coverage cannot reach 40% even with electron tests | Low | Medium | Set threshold to actual measured coverage minus 2% margin; document path to 40% |
| console.log removal breaks debug-only code paths | Low | Low | Only replace in production files; logService has debug level for dev-only output |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2006 | N/A (data/config only) | N/A | Verify .gitignore works, CSV validates |
| TASK-2007 | Delete deprecated test files | Run existing test suite | Verify onboarding flow still works |
| TASK-2008 | N/A (logging only) | N/A | Spot-check log output in dev mode |
| TASK-2009 | N/A (CI config) | N/A | Verify CI blocks on lint failure |
| TASK-2010 | Run electron tests in CI | N/A | Verify CI runs electron tests |
| TASK-2011 | N/A (threshold config) | N/A | Verify CI reports coverage correctly |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (enforced after TASK-2009)
- [ ] `npm test` passes (with electron tests after TASK-2010)
- [ ] Coverage meets threshold (40% after TASK-2011)
- [ ] No regressions in existing tests

---

## Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead |
|------|----------|----------|------------|-----------|-------------|
| TASK-2006 | cleanup | ~4K | x0.5 | ~2K | ~3K |
| TASK-2007 | cleanup | ~10K | x0.5 | ~5K | ~3K |
| TASK-2008 | cleanup | ~15K | x0.5 | ~8K | ~4K |
| TASK-2009 | config | ~5K | x0.5 | ~3K | ~3K |
| TASK-2010 | config | ~15K | x0.5 | ~8K | ~4K |
| TASK-2011 | config | ~10K | x0.5 | ~5K | ~3K |
| **Totals** | | | | **~31K** | **~20K** |

**Grand total: ~51K estimated billable tokens.**

Sprint is well under the 100-120K budget, leaving room for Phase 2 tasks encountering more lint/test fixes than expected.

---

## Notes

### Priority Justification

This sprint targets the issues with the highest "first impression" impact for a technical acquirer:
1. **CI quality gates** (TASK-2009) -- A reviewer checking CI config will immediately see non-blocking lint/audit
2. **Test coverage** (TASK-2010, 2011) -- 24% threshold with missing electron tests is a red flag
3. **Dead code** (TASK-2007) -- Deprecated but imported components signal sloppy maintenance
4. **Console.log pollution** (TASK-2008) -- 83+ console.log calls look unprofessional
5. **Repo hygiene** (TASK-2006) -- Small items that each individually signal carelessness

### Deferred Item Notes

**BACKLOG-721 (Electron v35 -> v40):** This is the most impactful single item but carries significant risk. Node.js 22->24 requires native module rebuild (better-sqlite3-multiple-ciphers). macOS 12 minimum drops Big Sur. Clipboard API changes. Recommend a dedicated SPRINT-088 with manual testing checkpoint.

**BACKLOG-722 (session.json encryption):** Currently Supabase tokens are in plaintext in the user data directory. Important for security posture but requires careful safeStorage integration and has the keychain conflict issue documented in MEMORY.md.

**BACKLOG-723 (imessage-parser vuln):** The vulnerability chain is through sqlite3 transitive deps. May require replacing imessage-parser entirely. Needs investigation first.
