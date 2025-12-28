# SPRINT-009: Codebase Standards Remediation

**Sprint Goal:** Address all 17 issues identified in the SR Engineer codebase audit, improving security, architecture, type safety, and code quality.

**Created:** 2025-12-24
**Updated:** 2025-12-27
**Status:** Near Completion (15/20 tasks merged)
**Target Branch:** develop

---

## Executive Summary

This sprint remediates findings from a comprehensive SR Engineer audit:
- **2 CRITICAL** security issues (command injection risks)
- **8 HIGH** architecture violations (oversized files, scattered API calls)
- **4 MEDIUM** type safety issues
- **4 LOW** cleanup items

---

## Phase Structure

### Phase 1: Security Hardening (CRITICAL) - COMPLETE
**Execution:** Sequential
**Priority:** MUST complete before other phases

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-600 | AppleScript Injection Fix | `macOSPermissionHelper.ts` | 4-6 | **MERGED** | #212 |
| TASK-601 | PowerShell Spawn Audit | Multiple services | 6-8 | **MERGED** | #214 |

### Phase 2: Main/Preload Extraction (HIGH) - COMPLETE
**Execution:** Sequential (H-1a before H-1b)

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-602 | main.ts Handler Extraction | `main.ts` (1655→<500 lines) | 12-16 | **MERGED** | #215 |
| TASK-603 | preload.ts Refactor | `preload.ts` (1902→<400 lines) | 12-16 | **MERGED** | #216 |

### Phase 3: Service Layer Foundation (HIGH) - COMPLETE
**Execution:** Single task
**Dependency:** Phase 2 complete

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-604 | Renderer Service Layer | `src/services/` (new files) | 10-14 | **MERGED** | #218 |

### Phase 4: Component Refactors (HIGH) - COMPLETE
**Execution:** Parallel (different component files)
**Dependency:** Phase 3 complete

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-605 | Transactions.tsx Split | `Transactions.tsx` (2614→<600 lines) | 14-18 | **MERGED** | #219 |
| TASK-606 | Contacts.tsx Split | `Contacts.tsx` (1638→<500 lines) | 12-16 | **MERGED** | #221 |
| TASK-607 | TransactionDetails.tsx Split | `TransactionDetails.tsx` (1557→<500 lines) | 10-14 | **MERGED** | #222 |

### Phase 5: Electron Services & Migration (HIGH) - COMPLETE
**Execution:** Sequential (H-4 before H-5)
**Dependency:** Phase 3 complete

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-608 | Electron Services Split | `electron/services/` | 10-14 | **MERGED** | #223 |
| TASK-609 | window.electron Migration | 13 files in `src/` | 16-20 | **MERGED** | #224 |

### Phase 6: Type Safety & Security (MEDIUM) - IN PROGRESS
**Execution:** Parallel possible
**Dependency:** Phase 2 complete for M-3; TASK-620 waits for TASK-616/617 if conflicts

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-610 | Any Types Remediation | 37 files, 114 occurrences | 8-10 | **MERGED** | #225 |
| TASK-611 | SQL Field Whitelist | `databaseService.ts` | 6-8 | **MERGED** | #226 |
| TASK-612 | IPC Type Consolidation | `electron/types/`, preload | 8-10 | Pending | - |
| TASK-613 | Onboarding Types Split | `src/types/` | 4-6 | Pending | - |
| TASK-619 | Security Hardening (Query Timeout) | `dbConnection.ts`, docs | 6-8 | **MERGED** | #227 |
| TASK-620 | IPC Rate Limiting | `electron/handlers/`, utils | 6-8 | In Progress | #233 |

### Phase 7: Cleanup (LOW) - IN PROGRESS
**Execution:** Parallel (independent)
**Dependency:** None (can run anytime)

| Task | Title | Files | Est. Turns | Status | PR |
|------|-------|-------|------------|--------|-----|
| TASK-614 | useAppStateMachine Tests | `useAppStateMachine.test.ts` | 6-8 | **MERGED** | #229 |
| TASK-615 | Duplicate Types Removal | Type files | 4-6 | Pending | - |
| TASK-616 | Console.log to logService | Multiple files | 3-4 | Pending | - |
| TASK-617 | Commented Code Removal | Scattered | 4-6 | Pending | - |
| TASK-618 | Orphaned Files Cleanup | Various | 4-6 | **MERGED** | #228 |

---

## Dependency Graph

```mermaid
graph TD
    subgraph Phase1[Phase 1: Security - COMPLETE]
        T600[TASK-600: AppleScript Fix - MERGED]
        T601[TASK-601: PowerShell Audit - MERGED]
    end

    subgraph Phase2[Phase 2: Core Extraction - COMPLETE]
        T602[TASK-602: main.ts - MERGED]
        T603[TASK-603: preload.ts - MERGED]
    end

    subgraph Phase3[Phase 3: Service Foundation - COMPLETE]
        T604[TASK-604: Service Layer - MERGED]
    end

    subgraph Phase4[Phase 4: Components - COMPLETE]
        T605[TASK-605: Transactions.tsx - MERGED]
        T606[TASK-606: Contacts.tsx - MERGED]
        T607[TASK-607: TransactionDetails.tsx - MERGED]
    end

    subgraph Phase5[Phase 5: Electron - COMPLETE]
        T608[TASK-608: Electron Services - MERGED]
        T609[TASK-609: window.electron - MERGED]
    end

    subgraph Phase6[Phase 6: Types & Security - IN PROGRESS]
        T610[TASK-610: Any Types - MERGED]
        T611[TASK-611: SQL Whitelist - MERGED]
        T612[TASK-612: IPC Types - Pending]
        T613[TASK-613: Onboarding Types - Pending]
        T619[TASK-619: Query Timeout - MERGED]
        T620[TASK-620: IPC Rate Limiting - In Review]
    end

    subgraph Phase7[Phase 7: Cleanup - IN PROGRESS]
        T614[TASK-614: Tests - MERGED]
        T615[TASK-615: Duplicate Types - Pending]
        T616[TASK-616: Console.log - Pending]
        T617[TASK-617: Comments - Pending]
        T618[TASK-618: Orphaned Files - MERGED]
    end

    T600 --> T602
    T601 --> T602
    T602 --> T603
    T603 --> T604
    T604 --> T605
    T604 --> T606
    T604 --> T607
    T604 --> T608
    T608 --> T609
    T603 --> T612
    T609 --> T610
    T611 --> T620
    T616 -.-> T620
    T617 -.-> T620
```

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| `electron/main.ts` lines | 1,655 | < 500 |
| `electron/preload.ts` lines | 1,902 | < 400 |
| `Transactions.tsx` lines | 2,614 | < 600 |
| `Contacts.tsx` lines | 1,638 | < 500 |
| `TransactionDetails.tsx` lines | 1,557 | < 500 |
| `any` type occurrences | 114 | < 10 |
| `window.electron` files | 13 | 0 |
| Security vulnerabilities | 2 | 0 |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Merge conflicts in Phase 4 | Low | Medium | Parallel tasks touch different files |
| H-1a/H-1b scope creep | Medium | High | Strict line count targets |
| H-5 migration breaks components | Medium | High | Incremental migration, comprehensive tests |
| C-1/C-2 security regression | Low | Critical | SR Engineer security review required |

---

## Quality Gates

### Per-Task
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [x] `npm test` passes
- [x] Line count targets met
- [x] Engineer metrics recorded

### Per-Phase
- [x] Phase 1-5 tasks merged to develop
- [x] CI pipeline green
- [x] SR Engineer review passed

### Sprint Completion
- [ ] All 20 tasks merged (15/20 complete)
- [x] All line count targets met
- [x] Full test suite passes
- [x] No security vulnerabilities

---

## Task List

| ID | Title | Phase | Priority | Status | PR |
|----|-------|-------|----------|--------|-----|
| TASK-600 | AppleScript Injection Fix | 1 | CRITICAL | **MERGED** | #212 |
| TASK-601 | PowerShell Spawn Audit | 1 | CRITICAL | **MERGED** | #214 |
| TASK-602 | main.ts Handler Extraction | 2 | HIGH | **MERGED** | #215 |
| TASK-603 | preload.ts Refactor | 2 | HIGH | **MERGED** | #216 |
| TASK-604 | Renderer Service Layer | 3 | HIGH | **MERGED** | #218 |
| TASK-605 | Transactions.tsx Split | 4 | HIGH | **MERGED** | #219 |
| TASK-606 | Contacts.tsx Split | 4 | HIGH | **MERGED** | #221 |
| TASK-607 | TransactionDetails.tsx Split | 4 | HIGH | **MERGED** | #222 |
| TASK-608 | Electron Services Split | 5 | HIGH | **MERGED** | #223 |
| TASK-609 | window.electron Migration | 5 | HIGH | **MERGED** | #224 |
| TASK-610 | Any Types Remediation | 6 | MEDIUM | **MERGED** | #225 |
| TASK-611 | SQL Field Whitelist | 6 | MEDIUM | **MERGED** | #226 |
| TASK-612 | IPC Type Consolidation | 6 | MEDIUM | Pending | - |
| TASK-613 | Onboarding Types Split | 6 | MEDIUM | Pending | - |
| TASK-614 | useAppStateMachine Tests | 7 | LOW | **MERGED** | #229 |
| TASK-615 | Duplicate Types Removal | 7 | LOW | Pending | - |
| TASK-616 | Console.log to logService | 7 | LOW | Pending | - |
| TASK-617 | Commented Code Removal | 7 | LOW | Pending | - |
| TASK-618 | Orphaned Files Cleanup | 7 | LOW | **MERGED** | #228 |
| TASK-619 | Security Hardening (Query Timeout) | 6 | MEDIUM | **MERGED** | #227 |
| TASK-620 | IPC Rate Limiting | 6 | MEDIUM | In Progress | #233 |

---

## Progress Summary

**Sprint Progress:** 15/20 tasks merged (75%)

**Completed Phases:**
- Phase 1: Security Hardening (2/2)
- Phase 2: Main/Preload Extraction (2/2)
- Phase 3: Service Layer Foundation (1/1)
- Phase 4: Component Refactors (3/3)
- Phase 5: Electron Services & Migration (2/2)

**In Progress:**
- Phase 6: Type Safety & Security (4/6 - TASK-612, TASK-613 pending, TASK-620 in review)
- Phase 7: Cleanup (2/5 - TASK-615, TASK-616, TASK-617 pending)

**Remaining Tasks:**
1. TASK-612 - IPC Type Consolidation
2. TASK-613 - Onboarding Types Split
3. TASK-615 - Duplicate Types Removal
4. TASK-616 - Console.log to logService
5. TASK-617 - Commented Code Removal
6. TASK-620 - IPC Rate Limiting (awaiting SR review, PR #233)
