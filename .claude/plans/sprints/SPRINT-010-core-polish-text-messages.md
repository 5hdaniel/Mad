# SPRINT-010: Core Polish & Text Messages

**Sprint Goal:** Fix critical bugs, enhance email rendering, add text messages tab to transaction details, and improve Dashboard AI visibility.

**Created:** 2025-12-28
**Status:** Planning
**Target Branch:** develop

---

## Executive Summary

This sprint combines bug fixes, UI enhancements, and a new feature:
- **1 Bug Fix**: Contact selection issue (BACKLOG-103)
- **1 Enhancement**: HTML email rendering (BACKLOG-054)
- **1 New Feature**: Text messages tab in transaction details (BACKLOG-105)
- **1 UI Enhancement**: Dashboard AI detection visibility (BACKLOG-104)

---

## Phase Structure

### Phase 1: Bug Fixes (HIGH Priority)
**Execution:** Sequential (investigation required)

| Task | Title | Category | Est. Turns | Status |
|------|-------|----------|------------|--------|
| TASK-700 | Fix Contact Selection Issue | ui/bug | 4-8 | Pending |

### Phase 2: Email Enhancements (MEDIUM Priority)
**Execution:** Can run in parallel with Phase 1

| Task | Title | Category | Est. Turns | Status |
|------|-------|----------|------------|--------|
| TASK-701 | HTML Email Rendering | ui | 8-12 | Pending |

### Phase 3: Text Messages Feature (HIGH Priority)
**Execution:** Sequential (each builds on prior)
**Dependency:** None (can start immediately)

| Task | Title | Category | Est. Turns | Status |
|------|-------|----------|------------|--------|
| TASK-702 | Add Messages Tab Infrastructure | ui | 4-6 | Pending |
| TASK-703 | Message Thread Display Component | ui | 6-8 | Pending |
| TASK-704 | Attach/Unlink Messages Modal | ui | 10-14 | Pending |

### Phase 4: Dashboard Enhancement (MEDIUM Priority)
**Execution:** Independent
**Dependency:** None

| Task | Title | Category | Est. Turns | Status |
|------|-------|----------|------------|--------|
| TASK-705 | Dashboard AI Detection Display | ui | 6-10 | Pending |

---

## Dependency Graph

```mermaid
graph TD
    subgraph Phase1[Phase 1: Bug Fixes]
        T700[TASK-700: Contact Selection Fix]
    end

    subgraph Phase2[Phase 2: Email]
        T701[TASK-701: HTML Email Rendering]
    end

    subgraph Phase3[Phase 3: Text Messages]
        T702[TASK-702: Messages Tab Infrastructure]
        T703[TASK-703: Message Thread Display]
        T704[TASK-704: Attach/Unlink Modal]
    end

    subgraph Phase4[Phase 4: Dashboard]
        T705[TASK-705: Dashboard AI Display]
    end

    T702 --> T703
    T703 --> T704
```

---

## Execution Order (SR Engineer Recommendation)

### Batch 1: Parallel (Can start immediately)
| Task | Title | Est. Turns | Parallel Safe |
|------|-------|------------|---------------|
| TASK-700 | Fix Contact Selection Issue | 4-8 | Yes - modifies contact selection only |
| TASK-701 | HTML Email Rendering | 8-12 | Yes - modifies EmailViewModal only |
| TASK-705 | Dashboard AI Detection Display | 6-10 | Yes - modifies Dashboard.tsx only |

**Note:** These 3 tasks can run in parallel using separate Claude Web sessions.

### Batch 2: Sequential (Phase 3 - Messages Feature)
| Order | Task | Title | Est. Turns | Wait For |
|-------|------|-------|------------|----------|
| 1 | TASK-702 | Add Messages Tab Infrastructure | 4-6 | Can start with Batch 1 |
| 2 | TASK-703 | Message Thread Display Component | 6-8 | TASK-702 merged |
| 3 | TASK-704 | Attach/Unlink Messages Modal | 10-14 | TASK-703 merged |

**CRITICAL:** Phase 3 MUST be sequential. Each task depends on the previous.

### Execution Timeline (Optimal)

```
Time →
├─── Batch 1 (Parallel) ───────────────────┤
│  TASK-700: Contact Fix (4-8 turns)       │
│  TASK-701: HTML Email (8-12 turns)       │
│  TASK-705: Dashboard AI (6-10 turns)     │
│  TASK-702: Messages Tab (4-6 turns)      │
├──────────────────────────────────────────┤
│           ↓ (TASK-702 merged)            │
├─── Batch 2a ─────────────────────────────┤
│  TASK-703: Message Thread (6-8 turns)    │
├──────────────────────────────────────────┤
│           ↓ (TASK-703 merged)            │
├─── Batch 2b ─────────────────────────────┤
│  TASK-704: Attach/Unlink (10-14 turns)   │
└──────────────────────────────────────────┘
```

**Parallel Execution Notes:**
- Batch 1 can run 4 tasks in parallel (different files, no conflicts)
- Phase 3 is strictly sequential (TASK-702 -> TASK-703 -> TASK-704)
- TASK-702 can start immediately alongside Batch 1

---

## Backlog Items Addressed

| Backlog ID | Title | Tasks |
|------------|-------|-------|
| BACKLOG-103 | Fix Contact Selection Issue | TASK-700 |
| BACKLOG-054 | Render Email HTML | TASK-701 |
| BACKLOG-105 | Text Messages Tab in Transaction Details | TASK-702, TASK-703, TASK-704 |
| BACKLOG-104 | Dashboard UI to Emphasize Auto-Detection | TASK-705 |

---

## Estimated Totals

| Metric | Estimate |
|--------|----------|
| Total Tasks | 6 |
| Total Turns | 39-59 |
| Total Tokens | ~195K-310K |
| Total Time | ~5-8 hours |

**Updated Estimates (SR Engineer Review):**

| Task | Original Est. | Updated Est. | Change Reason |
|------|---------------|--------------|---------------|
| TASK-700 | 4-8 | 4-8 | No change |
| TASK-701 | 6-10 | 8-12 | +2 for dependency install, CSP verification |
| TASK-702 | 4-6 | 4-6 | No change |
| TASK-703 | 6-8 | 6-8 | No change |
| TASK-704 | 6-8 | 10-14 | +4 for required IPC handler creation |
| TASK-705 | 6-10 | 6-10 | No change |

**Note:** TASK-704 increased significantly because IPC handlers must be created (not optional).

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Contact selection issue more complex than expected | Medium | Medium | Allocate buffer time for investigation |
| HTML rendering security concerns (XSS) | Low | High | Use DOMPurify or iframe sandbox |
| Message data structure incompatible | Low | Medium | Review schema before implementation |
| Dashboard performance impact | Low | Medium | Lazy load AI detection counts |

---

## Quality Gates

### Per-Task
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Engineer metrics recorded
- [ ] Implementation Summary completed

### Sprint Completion
- [ ] All 6 tasks merged
- [ ] No regressions in existing functionality
- [ ] Manual testing completed for each feature
- [ ] Full test suite passes

---

## Task List Summary

| ID | Title | Phase | Priority | Parallel | Est. Turns | Status |
|----|-------|-------|----------|----------|------------|--------|
| TASK-700 | Fix Contact Selection Issue | 1 | HIGH | Yes | 4-8 | Pending |
| TASK-701 | HTML Email Rendering | 2 | MEDIUM | Yes | 8-12 | Pending |
| TASK-702 | Add Messages Tab Infrastructure | 3 | HIGH | Yes* | 4-6 | Pending |
| TASK-703 | Message Thread Display Component | 3 | HIGH | No | 6-8 | Pending |
| TASK-704 | Attach/Unlink Messages Modal | 3 | HIGH | No | 10-14 | Pending |
| TASK-705 | Dashboard AI Detection Display | 4 | MEDIUM | Yes | 6-10 | Pending |

*TASK-702 can run in parallel with Batch 1, but TASK-703/704 must wait for it.

---

## SR Engineer Technical Review

**Status:** COMPLETED
**Review Date:** 2025-12-28

### Review Summary

All 6 task files have been reviewed and updated with:
- Technical corrections for IPC endpoints
- File path clarifications
- Execution recommendations (parallel vs sequential)
- Pre-implementation notes added to each task

### Key Corrections Applied

| Task | Critical Correction |
|------|---------------------|
| TASK-700 | Verify edit modal is `AuditTransactionModal.tsx`, not separate file |
| TASK-701 | Pre-install `dompurify @types/dompurify`, verify CSP settings |
| TASK-702 | Use `transactions.getDetails`, NOT `window.api.communications` |
| TASK-703 | Use `body_text` with fallback to `body_plain` |
| TASK-704 | MUST create IPC handlers (they don't exist) - estimate increased |
| TASK-705 | Use `transactions.getAll` + filter, NOT `getPendingReviewCount` |

### Architectural Concerns

1. **TASK-704 Scope:** Originally estimated as UI-only, but requires creating 3 new IPC handlers in `transactionBridge.ts` and exposing in `preload.ts`. This is backend + frontend work.

2. **No `window.api.communications`:** This namespace does not exist. Engineers must use existing `transactions.getDetails` endpoint.

---

## Progress Tracking

**Sprint Progress:** 0/6 tasks merged (0%)

- Phase 1: 0/1 complete
- Phase 2: 0/1 complete
- Phase 3: 0/3 complete
- Phase 4: 0/1 complete
