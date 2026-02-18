# SPRINT-085: Handler Architecture Debt (SR Audit P1 Findings)

**Created:** 2026-02-16
**Status:** Completed
**Branch:** `develop` (individual task branches off develop)
**Base:** `develop`

---

## Sprint Goal

Reduce architectural debt in the Electron IPC handler layer by splitting monolith handler files, extracting raw SQL into services, fixing bridge type declarations, and eliminating repeated error-handling boilerplate. These are the 6 Priority 1 findings from the SR Engineer codebase audit.

## Sprint Narrative

The SR Engineer performed a full codebase audit and identified structural debt concentrated in the IPC handler layer:

1. **Handler monoliths** -- `transaction-handlers.ts` (3,754 lines, 43 handlers) and `system-handlers.ts` (2,019 lines, 39 handlers) have grown far beyond maintainable size. Each file mixes CRUD, export, sync, and attachment logic into a single namespace.

2. **Missing bridge types** -- 11+ methods on `window.api.transactions` and `window.api.contacts` lack type declarations, forcing 9+ production `as any` casts in component code. This undermines TypeScript's safety guarantees.

3. **Duplicated error handling** -- The pattern `error instanceof Error ? error.message : "Unknown error"` appears 179 times across handler files. `ValidationError` catch blocks are duplicated 30+ times. A `wrapHandler()` HOF would eliminate this boilerplate.

4. **Raw SQL in handlers** -- The `contacts:update` handler contains ~140 lines of raw SQL for email/phone sync. This violates the handler-as-thin-orchestrator principle.

5. **`require()` calls** -- 10+ `require()` calls in `transaction-handlers.ts` and 5 in `system-handlers.ts` should be ES module imports.

This sprint focuses purely on structural refactoring -- no feature changes, no behavioral changes. Every handler should produce identical IPC responses after refactoring.

---

## In-Scope

| ID | Title | Task | Status |
|----|-------|------|--------|
| BACKLOG-715 | Split transaction-handlers.ts into domain-specific handler files | TASK-1999 | Completed (PR #871) |
| BACKLOG-716 | Extract business logic from transaction handlers into services | TASK-2000 | Completed (PR #872) |
| BACKLOG-717 | Fix window.api bridge type declarations | TASK-2001 | Completed (PR #870) |
| BACKLOG-718 | Create wrapHandler() HOF for error handling boilerplate | TASK-2002 | Completed (PR #868) |
| BACKLOG-719 | Extract raw SQL from contact-handlers.ts into contactDbService | TASK-2003 | Completed (PR #869) |
| BACKLOG-720 | Split system-handlers.ts into domain-specific handler files | TASK-2004 | Completed (PR #873) |

**Total Estimated Tokens:** ~190K (engineering) + ~80K (SR review overhead) = ~270K

## Out-of-Scope / Deferred

- Converting `require()` in non-handler files (services, parsers) -- handler-only scope
- Refactoring the `electron/handlers/` subfolder files (googleAuthHandlers, sessionHandlers, etc.) -- different audit priority
- Adding new IPC handlers or features
- Changing handler behavior or response shapes (purely structural refactoring)
- Refactoring `contact-handlers.ts` beyond the SQL extraction -- its full split is a P2 item

---

## Phase Plan

### Phase 1: Foundation (Parallel -- no shared files)

These three tasks touch completely different files and can run in parallel.

```
Phase 1: Foundation
+-- TASK-2001: Fix bridge type declarations (transactionBridge.ts, contactBridge.ts, window.d.ts, component files)
+-- TASK-2002: Create wrapHandler() HOF (new file: electron/utils/wrapHandler.ts + tests)
+-- TASK-2003: Extract raw SQL from contact-handlers.ts into contactDbService
+-- CI gate: type-check, lint, test all pass
```

**TASK-2001** (BACKLOG-717): Fix bridge type declarations
- Touches: `electron/preload/transactionBridge.ts`, `electron/preload/contactBridge.ts`, `src/types/window.d.ts`, 6+ component files
- Removes 9+ `as any` casts from production code

**TASK-2002** (BACKLOG-718): Create wrapHandler() HOF
- Creates: `electron/utils/wrapHandler.ts`, `electron/utils/__tests__/wrapHandler.test.ts`
- Defines pattern but does NOT apply to all files yet (Phase 2 tasks will adopt it during their refactoring)

**TASK-2003** (BACKLOG-719): Extract raw SQL from contact-handlers.ts
- Touches: `electron/contact-handlers.ts`, `electron/services/db/contactDbService.ts`
- Extracts ~140 lines of email/phone sync SQL into service methods

### Phase 2: Handler Splits (Sequential -- shared handler registration)

These two tasks must be sequential because:
- Both modify `electron/main.ts` (handler registration imports)
- TASK-1999 is the largest task and should go first
- TASK-2004 can adopt patterns established by TASK-1999
- Both should adopt the `wrapHandler()` utility from TASK-2002

```
Phase 2: Handler Splits
+-- TASK-1999: Split transaction-handlers.ts (depends on TASK-2002 merge)
|   1. Split 43 handlers into 4 domain files
|   2. Convert require() to ES imports
|   3. Adopt wrapHandler() in new files
|   4. Fix getTransactionDetails return type
+-- CI gate: type-check, lint, test all pass
|
+-- TASK-2004: Split system-handlers.ts (depends on TASK-1999 merge + TASK-2002 merge)
|   1. Split 39 handlers into 3 domain files
|   2. Convert require() to ES imports
|   3. Adopt wrapHandler() in new files
+-- CI gate: type-check, lint, test all pass
```

**TASK-1999** (BACKLOG-715): Split transaction-handlers.ts
- Creates: `electron/handlers/transactionCrudHandlers.ts`, `electron/handlers/transactionExportHandlers.ts`, `electron/handlers/emailSyncHandlers.ts`, `electron/handlers/attachmentHandlers.ts`
- Deletes (eventually replaces): `electron/transaction-handlers.ts`
- Also converts 5 top-level + 5+ inline `require()` to ES imports
- Effort: L

**TASK-2004** (BACKLOG-720): Split system-handlers.ts
- Creates: `electron/handlers/diagnosticHandlers.ts`, `electron/handlers/userSettingsHandlers.ts`, core `electron/handlers/systemHandlers.ts`
- Deletes (eventually replaces): `electron/system-handlers.ts`
- Also converts 3 top-level + 2 inline `require()` to ES imports
- Effort: M

### Phase 3: Integration Verification (After all tasks merged)

```
Phase 3: Verification
+-- Manual smoke test: all IPC channels still work
+-- CI gate: full test suite, type-check, lint
```

---

## Task Decomposition Notes

### P1.1 Split into Two Tasks

The original P1.1 finding ("Split transaction-handlers.ts") was too large for a single task. It has been split into:
- **TASK-1999**: Handler file split + require() conversion + wrapHandler() adoption
- **TASK-2000**: Extract business logic (backfill, attachment counting, raw SQL) into service files

However, upon further analysis, TASK-2000 (business logic extraction) is better done as part of the handler split itself -- extracting a handler to a new file is the right time to also extract its inline logic into services. Therefore, TASK-1999 includes service extraction guidance in its implementation notes. TASK-2000 covers the specific `getTransactionDetails` return type fix and remaining business logic extractions that are self-contained.

### P1.6 Folded In

The `require()` to ES import conversion (P1.6) is folded into TASK-1999 (transaction handlers) and TASK-2004 (system handlers) since those files are being restructured anyway. The remaining handler files with `require()` (address-handlers.ts with 1, feedback-handlers.ts with 1) are small enough to address opportunistically or in a follow-up.

---

## Dependency Graph

```
Phase 1 (Parallel):
  TASK-2001 (bridge types)  ────────────────────────────┐
  TASK-2002 (wrapHandler HOF)  ─────┐                   │
  TASK-2003 (contact SQL extraction) │                   │
                                     │                   │
Phase 2 (Sequential):               ▼                   │
  TASK-1999 (split transaction-handlers.ts)              │
       │    uses wrapHandler from TASK-2002              │
       │                                                 │
       ▼                                                 │
  TASK-2000 (transaction handler type fixes + logic)     │
       │    depends on split files from TASK-1999        │
       │                                                 │
       ▼                                                 │
  TASK-2004 (split system-handlers.ts)                   │
       │    uses wrapHandler from TASK-2002              │
       │    follows patterns from TASK-1999              │
       ▼                                                 ▼
  Sprint Complete ◄──────────────────────────────────────┘
```

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1a | TASK-2001 (bridge types) | None | Parallel with 1b, 1c |
| 1b | TASK-2002 (wrapHandler HOF) | None | Parallel with 1a, 1c |
| 1c | TASK-2003 (contact SQL) | None | Parallel with 1a, 1b |
| 2 | TASK-1999 (split transaction-handlers) | TASK-2002 merged | Sequential |
| 3 | TASK-2000 (transaction type + logic fixes) | TASK-1999 merged | Sequential |
| 4 | TASK-2004 (split system-handlers) | TASK-2002 merged, TASK-1999 merged (pattern) | Sequential |

---

## Merge Plan

All tasks branch from `develop` and merge back to `develop` via PR.

| Task | Branch Name | Base | Target |
|------|-------------|------|--------|
| TASK-2001 | `refactor/task-2001-bridge-type-declarations` | develop | develop |
| TASK-2002 | `refactor/task-2002-wrap-handler-hof` | develop | develop |
| TASK-2003 | `refactor/task-2003-contact-sql-extraction` | develop | develop |
| TASK-1999 | `refactor/task-1999-split-transaction-handlers` | develop | develop |
| TASK-2000 | `refactor/task-2000-transaction-handler-types` | develop | develop |
| TASK-2004 | `refactor/task-2004-split-system-handlers` | develop | develop |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Handler split breaks IPC channel registration | High | Medium | Each new file must register identical channel names; test suite catches missing registrations |
| Import cycle after splitting into smaller files | Medium | Low | Keep handler files as leaf nodes -- they import services, nothing imports them except main.ts |
| `wrapHandler()` changes error response shape subtly | High | Low | TASK-2002 must produce IDENTICAL error responses -- unit tests with snapshot assertions |
| Merge conflicts between Phase 2 tasks | Medium | High | Sequential execution prevents this; each task merges before next starts |
| Large diff makes SR review slow / error-prone | Medium | High | Task files include explicit "no behavior change" criteria; diff should be mostly moves |
| Bridge type changes break runtime if type doesn't match actual IPC | Medium | Low | Types describe existing working code -- no runtime behavior change |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2001 | Type-check proves casts eliminated | N/A | Verify modal interactions still work |
| TASK-2002 | Unit tests for wrapHandler (success, Error, ValidationError, unknown) | N/A | N/A |
| TASK-2003 | Existing contact update tests pass | N/A | N/A |
| TASK-1999 | All existing transaction handler tests pass | N/A | Smoke test: create, edit, delete transaction |
| TASK-2000 | Type-check proves `as any` eliminated for getTransactionDetails | N/A | N/A |
| TASK-2004 | All existing system handler tests pass | N/A | Smoke test: diagnostics, settings |

### CI Gates (All Tasks)

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

### Refactoring Safety Rule

**Every task has the same fundamental acceptance criterion: no behavioral changes.** The IPC responses before and after must be byte-identical for the same inputs. If a handler returned `{ success: false, error: "Something failed" }` before, it must return exactly that after.

---

## End-of-Sprint Validation Checklist

- [x] `transaction-handlers.ts` no longer exists (replaced by 4 domain handler files) -- now a 26-line re-export stub
- [x] `system-handlers.ts` no longer exists (replaced by 3 domain handler files) -- now an 18-line re-export stub
- [x] Zero `as any` casts related to `window.api.transactions` or `window.api.contacts` in production component code
- [x] `wrapHandler()` HOF exists with full test coverage and is adopted in new handler files
- [x] `contacts:update` handler delegates email/phone sync to `contactDbService` (syncContactEmails, syncContactPhones)
- [x] All `require()` calls in handler files converted to ES imports -- 5 intentional require() remain in diagnosticHandlers.ts, systemHandlers.ts (documented: services need lazy loading)
- [x] All existing tests pass unchanged -- CI passed on all 6 PRs
- [x] All PRs merged to develop -- #868, #869, #870, #871, #872, #873
- [x] Backlog CSV updated -- BACKLOG-715 through BACKLOG-720 all marked Completed

---

## Notes

### Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead |
|------|----------|----------|------------|-----------|-------------|
| TASK-1999 | refactor | ~80K | x0.5 | ~40K | ~20K |
| TASK-2000 | refactor+types | ~30K | x0.5 | ~15K | ~10K |
| TASK-2001 | types | ~30K | x1.0 | ~30K | ~15K |
| TASK-2002 | refactor | ~30K | x0.5 | ~15K | ~10K |
| TASK-2003 | refactor | ~25K | x0.5 | ~12K | ~10K |
| TASK-2004 | refactor | ~60K | x0.5 | ~30K | ~15K |
| **Totals** | | | | **~142K** | **~80K** |

Grand total: ~222K estimated billable tokens.
