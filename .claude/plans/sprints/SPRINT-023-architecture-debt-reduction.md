# SPRINT-023: Architecture Debt Reduction

**Status:** APPROVED (SR Engineer Review Complete 2026-01-04, Scope Revised 2026-01-04)
**Created:** 2026-01-04
**Target:** develop

---

## Executive Summary

SPRINT-023 follows the completed State Coordination Overhaul (SPRINT-020/021/022) with a focus on **architecture debt reduction**. The codebase now has a clean state machine foundation, but several large files identified in the SR Engineer architecture review remain problematic.

### Sprint Context

| Sprint | Status | Focus |
|--------|--------|-------|
| SPRINT-020 | Complete | State Coordination Foundation |
| SPRINT-021 | Complete | State Coordination Migration |
| SPRINT-022 | Complete | State Coordination Cleanup |
| **SPRINT-023** | **Planned** | **Architecture Debt Reduction** |

### Note on SPRINT-016

SPRINT-016 (Component Refactoring) was created 2026-01-02 but never executed. Its task IDs (TASK-920-926) collided with SPRINT-017/18/19 tasks. SPRINT-016 is now **DEPRECATED** - its scope is absorbed into SPRINT-023 with fresh task IDs.

---

## Critical Discovery: db/* Services Already Exist (2026-01-04)

**The db/* domain services ALREADY EXIST from BACKLOG-058 (PR #137, Dec 2025).**

| Existing Service | Lines | Status |
|-----------------|-------|--------|
| `db/core/dbConnection.ts` | ~100 | Connection management |
| `db/userDbService.ts` | 209 | User CRUD |
| `db/transactionDbService.ts` | 364 | Transaction operations |
| `db/contactDbService.ts` | 520 | Contact management |
| `db/communicationDbService.ts` | 396 | Email/SMS storage |
| `db/sessionDbService.ts` | 90 | Session management |
| `db/oauthTokenDbService.ts` | 201 | OAuth token storage |
| `db/feedbackDbService.ts` | 118 | Feedback storage |
| `db/auditLogDbService.ts` | 188 | Audit logging |
| `db/llmSettingsDbService.ts` | 213 | LLM settings |
| `db/transactionContactDbService.ts` | 350 | Transaction-contact links |

**The problem:** `databaseService.ts` (3,877 lines) still contains ALL the logic duplicated. Phase 5 (wire up delegation) was never completed after PR #137.

**Impact on TASK-961/962:**
- TASK-961: Changed from "create services" to "wire delegation"
- TASK-962: Changed from "extract domains" to "consumer migration" (OPTIONAL)
- Estimates REDUCED due to simpler scope

---

## Backlog Items Included

| ID | Title | Priority | Category | Est. Tokens |
|----|-------|----------|----------|-------------|
| **BACKLOG-149** | Delete Deprecated EmailOnboardingScreen.tsx | Medium | refactor | ~15K |
| **BACKLOG-148** | Wire databaseService.ts Delegation (Phase 5) | High | refactor | ~20K |
| **BACKLOG-148** | Consumer Migration to db/* (OPTIONAL) | Low | refactor | ~25K |
| **BACKLOG-152** | Split TransactionDetails.tsx into Tab Components | Medium | refactor | ~25K |
| **BACKLOG-140** | Duplicate Transaction Re-Import Prevention | High | service | ~30K |

**Total Sprint Estimate:** ~90K tokens (reduced from ~130K due to scope clarification)

---

## Task Breakdown

### TASK-960: Delete Deprecated EmailOnboardingScreen (BACKLOG-149)

**Category:** refactor
**Adjusted Estimate:** ~15K tokens (including SR overhead)
**Token Cap:** 60K

**Deliverables:**
- Verify migration to EmailConnectStep.tsx is complete
- Delete `src/components/EmailOnboardingScreen.tsx`
- Remove orphaned imports/references
- Update barrel exports if needed

**Files:**
- `src/components/EmailOnboardingScreen.tsx` (DELETE)
- Any files importing it (modify)

**Rationale:** Quick win that removes 1,203 lines of dead code, reducing codebase size and confusion.

---

### TASK-961: Wire databaseService.ts Delegation to db/* (BACKLOG-148 Phase 5)

**Category:** refactor
**Adjusted Estimate:** ~15-20K tokens (REDUCED - no new files to create)
**Token Cap:** 80K
**Depends On:** None

**Scope Change (2026-01-04):**
- **Original:** Create db/* structure and extract core
- **Revised:** Wire delegation to EXISTING db/* services

**Deliverables:**
- Document method mapping (databaseService.ts -> db/*)
- Wire all methods to delegate to existing db/* services
- Remove duplicate implementation code
- Reduce databaseService.ts from 3,877 to <500 lines

**Files:**
- `electron/services/databaseService.ts` (modify - reduce to <500 lines)
- NO new files needed (db/* services exist)

---

### TASK-962: Consumer Migration to db/* (BACKLOG-148 - OPTIONAL)

**Category:** refactor
**Adjusted Estimate:** ~20-25K tokens (REDUCED - import changes only)
**Token Cap:** 100K
**Depends On:** TASK-961
**Status:** OPTIONAL - Decide after TASK-961 completion

**Scope Change (2026-01-04):**
- **Original:** Extract domain services
- **Revised:** Migrate 37 consumers from facade to direct db/* imports

**Deliverables:**
- Audit 37 consumer files
- Migrate imports to direct db/* services
- Delete databaseService.ts facade
- Update test imports

**Files:**
- 37 consumer files (modify imports)
- `electron/services/databaseService.ts` (DELETE - optional)

**Recommendation:** Defer unless there's a compelling reason. Facade pattern is valid long-term architecture.

---

### TASK-963: Split TransactionDetails.tsx into Tab Components (BACKLOG-152)

**Category:** refactor
**Adjusted Estimate:** ~25K tokens (including SR overhead)
**Token Cap:** 100K
**Depends On:** None (parallel safe with TASK-960/961)

**Deliverables:**
- Extract tab components to `tabs/` directory
- Replace direct `window.api` calls with service abstractions
- Reduce main component to <400 lines

**Files:**
- `src/components/transaction/components/TransactionDetails.tsx` (modify)
- `src/components/transaction/components/tabs/index.ts` (new)
- `src/components/transaction/components/tabs/TransactionInfoTab.tsx` (new)
- `src/components/transaction/components/tabs/CommunicationsTab.tsx` (new)
- `src/components/transaction/components/tabs/AttachmentsTab.tsx` (new)

---

### TASK-964: Duplicate Transaction Re-Import Prevention (BACKLOG-140)

**Category:** service
**Adjusted Estimate:** ~30K tokens (including SR overhead, 0.5x service multiplier applied)
**Token Cap:** 120K
**Depends On:** TASK-961 (database delegation should be done first)

**Deliverables:**
- Investigate transaction import flow
- Add deduplication check before importing
- Add logging for skipped transactions
- Add tests for deduplication logic

**Files:**
- `electron/services/transactionService.ts` or `electron/services/db/transactionDbService.ts` (modify)
- Related import/sync services (investigate and modify)
- Test files (new/modify)

---

## Phase Structure

### Phase 1: Quick Win + Parallel Analysis

| Task | Files | Parallel Safe |
|------|-------|---------------|
| TASK-960 | `EmailOnboardingScreen.tsx` (DELETE) | Yes |
| TASK-961 | `databaseService.ts` (wire delegation) | Yes |
| TASK-963 | `TransactionDetails.tsx`, `tabs/*` | Yes |

**Note:** All three touch completely different files and can be executed in parallel using worktrees.

---

### Phase 2: Database Cleanup (OPTIONAL)

| Task | Depends On | Execution |
|------|------------|-----------|
| TASK-962 | TASK-961 | Sequential (after Phase 1) - **OPTIONAL** |

**Decision Point:** After TASK-961, decide whether consumer migration adds value.

---

### Phase 3: Service Fix

| Task | Depends On | Execution |
|------|------------|-----------|
| TASK-964 | TASK-961 | Sequential (after Phase 1) |

**Rationale:** TASK-964 touches database services, so it should wait for delegation wiring to complete to avoid conflicts.

---

## Dependency Graph

```
Phase 1 (Parallel)                    Phase 2 (Optional)   Phase 3
      |                                 |                    |
  TASK-960 (Delete EmailOnboarding)     |                    |
      |                                 |                    |
  TASK-961 (Wire Delegation) ---------> TASK-962 (Consumer   --> TASK-964 (Dedup Fix)
      |                                  Migration)          |
  TASK-963 (TransactionDetails) --------+                    |
                                        (OPTIONAL)
```

**Critical Path:** TASK-961 -> TASK-964

**Optional Path:** TASK-961 -> TASK-962 (defer recommended)

---

## Estimated Effort Summary

| Task | Category | Est. Tokens | Token Cap | Phase | Status |
|------|----------|-------------|-----------|-------|--------|
| TASK-960 | refactor | ~15K | 60K | 1 | Required |
| TASK-961 | refactor | ~20K | 80K | 1 | Required |
| TASK-962 | refactor | ~25K | 100K | 2 | **OPTIONAL** |
| TASK-963 | refactor | ~25K | 100K | 1 | Required |
| TASK-964 | service | ~30K | 120K | 3 | Required |
| **Total (Required)** | - | **~90K** | **360K** | - | - |
| **Total (All)** | - | **~115K** | **460K** | - | - |

**Notes:**
- Estimates REDUCED from original due to scope clarification
- TASK-961/962 are simpler than originally planned
- TASK-962 is optional (facade pattern is valid)
- Token caps set at 4x upper estimate per BACKLOG-133

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| EmailOnboardingScreen migration incomplete | Low | Medium | Thorough usage search before deletion |
| Delegation wiring causes type mismatches | Low | Medium | Type checking will catch |
| Missing db/* equivalents for some methods | Medium | Medium | Add to db/* services if needed |
| TransactionDetails tabs break functionality | Low | Medium | Component tests, manual testing |
| Duplicate detection requires schema changes | Low | Medium | Investigation task first |

---

## Quality Gates

### Per-Task Gates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Token usage < 4x estimate (cap)
- [ ] Worktree used for parallel tasks

### Sprint-Level Gates
- [ ] All required tasks merged to develop (TASK-960, 961, 963, 964)
- [ ] `EmailOnboardingScreen.tsx` deleted
- [ ] `databaseService.ts` < 500 lines (delegates to db/*)
- [ ] `TransactionDetails.tsx` < 400 lines
- [ ] No duplicate transaction imports
- [ ] No test regressions

---

## Out of Scope (Deferred to Future Sprints)

- **TASK-962**: Consumer migration (OPTIONAL - may stay deferred permanently)
- **BACKLOG-098**: Split AuditTransactionModal.tsx (next sprint candidate)
- **BACKLOG-099**: Split EmailOnboardingScreen.tsx (N/A after TASK-960)
- **BACKLOG-111 Phase 2+**: Remaining service migration (40+ component files)
- **BACKLOG-150, 151**: Low-priority line count reductions

---

## Success Criteria

- [ ] 1,203 lines of deprecated code removed (EmailOnboardingScreen)
- [ ] databaseService.ts reduced from 3,877 to <500 lines (via delegation)
- [ ] TransactionDetails.tsx reduced from 832 to <400 lines
- [ ] Duplicate transaction re-import bug fixed
- [ ] No functional regressions

---

## SR Engineer Review Required

Before task execution:

- [x] Verify TASK-960 deletion is safe (EmailConnectStep.tsx is complete)
- [x] Confirm Phase 1 parallel safety (worktree isolation)
- [x] Review TASK-961/962 scope revision (wire delegation, not create)
- [x] Validate TASK-964 can proceed after TASK-961
- [x] Add branch info to task files

### SR Engineer Review Summary (2026-01-04)

**Status: APPROVED**

**Key Findings:**

1. **TASK-960 (Delete EmailOnboarding):** SAFE to proceed. No active imports found. File has `@deprecated` header.

2. **TASK-961 (Wire Delegation):** SCOPE REVISED.
   - db/* services exist (PR #137, Dec 2025)
   - Task is about wiring delegation, not creating services
   - Estimate reduced from ~30K to ~20K

3. **TASK-962 (Consumer Migration):** MARKED OPTIONAL.
   - Facade pattern is valid long-term architecture
   - Defer unless there's a compelling reason

4. **TASK-963 (TransactionDetails):** APPROVED. 832 lines with 4 `window.api` calls identified.

5. **TASK-964 (Duplicate Prevention):** APPROVED. Now depends on TASK-961 only (not TASK-962).

**Phase 1 Parallel Safety:** CONFIRMED
- TASK-960: `src/components/EmailOnboardingScreen.tsx` (delete)
- TASK-961: `electron/services/databaseService.ts` (wire delegation)
- TASK-963: `src/components/transaction/components/TransactionDetails.tsx`, `tabs/*`

All three touch completely different files. Worktree isolation sufficient.

**Branch Names Added to Task Files:**
- TASK-960: `refactor/TASK-960-delete-emailonboarding`
- TASK-961: `refactor/TASK-961-db-delegation-wiring`
- TASK-962: `refactor/TASK-962-db-consumer-migration` (OPTIONAL)
- TASK-963: `refactor/TASK-963-transaction-details-tabs`
- TASK-964: `fix/TASK-964-duplicate-transaction-prevention`

---

## Notes

### Deprecation of SPRINT-016

SPRINT-016 was planned 2026-01-02 but never executed. Its task IDs (TASK-920-926) were reused by subsequent sprints (SPRINT-017/18/19). To avoid confusion:

1. SPRINT-016 is marked **DEPRECATED**
2. Its relevant items (BACKLOG-098, 099, 111) are candidates for future sprints
3. SPRINT-023 uses fresh task IDs (TASK-960+)
4. BACKLOG-149 (delete deprecated file) may make BACKLOG-099 unnecessary

### Post-BACKLOG-142 Stability

The State Coordination Overhaul (BACKLOG-142) unified the state management approach. This sprint benefits from that foundation:

- No more race conditions between hooks
- Clear state machine as single source of truth
- Simpler debugging and testing

### db/* Services Discovery (2026-01-04)

The domain services created in PR #137 (Dec 2025) were never fully integrated. This sprint completes that work by:
1. Wiring databaseService.ts to delegate to db/*
2. Optionally migrating consumers directly to db/*

This is "Phase 5" of the original BACKLOG-058 work.
