# SPRINT-049: Manual Transaction Flow Polish

**Created**: 2026-01-21
**Updated**: 2026-01-22
**Status**: Planning - SR Engineer Review Complete
**Goal**: Make the manual transaction creation, editing, and export flow FLAWLESS

---

## Sprint Overview

This sprint focuses on polishing the manual transaction workflow from start to finish:
- Creating transactions manually
- Assigning contacts to transactions
- Linking emails/texts to transactions
- Transaction details view (all tabs)
- Syncing communications
- Export functionality (PDF, audit package)

---

## Dependency Graph

```
                           LEGEND
                    ────────────────────
                    --> Hard dependency (must complete first)
                    ... Shared file conflict (sequential needed)
                    |   Independent (parallel safe)


    BATCH 1 - PARALLEL (Isolated domains)
    ======================================

    NOTE: BACKLOG-167 (Status Options) was already complete - removed from sprint.

    ┌─────────────┐   |   ┌─────────────┐
    │ BACKLOG-379 │   |   │ BACKLOG-228 │
    │ Setup Btn   │   |   │ UI Freeze   │
    │  (nav)      │   |   │  (perf)     │
    └─────────────┘   |   └─────────────┘


    BATCH 2 - SEQUENTIAL (TransactionDetailsTab.tsx shared)
    ========================================================

    NOTE: BACKLOG-363 (Tab Reorganization) was already complete - removed.
          Track A now starts with BACKLOG-381.

    ┌─────────────┐
    │ BACKLOG-381 │  Header + Audit Period (NOW FIRST)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-383 │  Role Pills Format
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-335 │  Start Date Required
    └─────────────┘


    BATCH 3 - SEQUENTIAL (TransactionMessagesTab.tsx shared)
    =========================================================

    ┌─────────────┐
    │ BACKLOG-356 │  Text Card Refinements
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-357 │  Audit Date Filter Toggle
    └─────────────┘


    BATCH 4 - SEQUENTIAL (ExportModal.tsx shared)
    ==============================================

    ┌─────────────┐
    │ BACKLOG-360 │  Default to Audit Package
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-362 │  Popup Duration
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-352 │  Export Complete + History (DB changes)
    │             │  REQUIRES: Migration file creation
    └─────────────┘


    BATCH 5 - SEQUENTIAL (pdfExportService.ts shared)
    ==================================================

    ┌─────────────┐
    │ BACKLOG-355 │  Email Back Link
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-354 │  Phone in 1:1 Export
    └─────────────┘
```

---

## Execution Plan

### Batch 1: Isolated Bug Fixes (PARALLEL SAFE)

**Can run in separate worktrees simultaneously.**

| Slot | Backlog Item | Title | Files Affected | Est. Tokens |
|------|--------------|-------|----------------|-------------|
| 1A | BACKLOG-379 | Continue Setup Button Fix | `useNavigationFlow.ts`, `Dashboard.tsx` | ~15K |
| ~~1B~~ | ~~BACKLOG-167~~ | ~~Restrict Status Options~~ | ~~ALREADY COMPLETE~~ | ~~0K~~ |
| 1B | BACKLOG-228 | UI Freeze Investigation | Profiling only (read-only analysis) | ~20K |

**Worktree Setup:**
```bash
# Two separate worktrees for parallel execution
git worktree add ../Mad-379 -b fix/task-379-setup-button develop
git worktree add ../Mad-228 -b fix/task-228-ui-freeze develop
```

**Note:** BACKLOG-167 (Restrict Status Options) was already implemented in BulkActionBar.tsx.
The component already restricts "Pending" and "Rejected" statuses for manual transactions.

---

### Batch 2: Transaction Details Tab (SEQUENTIAL)

**Must run sequentially - all modify `TransactionDetailsTab.tsx`.**

| Order | Backlog Item | Title | Files Affected | Est. Tokens |
|-------|--------------|-------|----------------|-------------|
| ~~2.1~~ | ~~BACKLOG-363~~ | ~~Tab Reorganization~~ | ~~ALREADY COMPLETE~~ | ~~0K~~ |
| 2.1 | BACKLOG-381 | Header + Audit Period | `TransactionDetailsTab.tsx` | ~15K |
| 2.2 | BACKLOG-383 | Role Pills Format | `TransactionDetailsTab.tsx` | ~10K |
| 2.3 | BACKLOG-335 | Start Date Required | `AuditTransactionModal.tsx`, `TransactionDetailsTab.tsx`, validation | ~30K |

**Dependency Notes:**
- ~~BACKLOG-363 creates the Overview tab structure that others build on~~ (Already done - TransactionEmailsTab.tsx exists)
- BACKLOG-381 now starts the track - adds header and audit period to Overview tab
- BACKLOG-383 formats role pills in Overview tab
- BACKLOG-335 validates dates displayed in Overview

---

### Batch 3: Messages Tab (SEQUENTIAL)

**Must run sequentially - both modify `TransactionMessagesTab.tsx`.**

| Order | Backlog Item | Title | Files Affected | Est. Tokens |
|-------|--------------|-------|----------------|-------------|
| 3.1 | BACKLOG-356 | Text Card Refinements | `MessageThreadCard.tsx`, `TransactionMessagesTab.tsx` | ~15K |
| 3.2 | BACKLOG-357 | Audit Date Filter Toggle | `TransactionMessagesTab.tsx` | ~25K |

**Dependency Notes:**
- BACKLOG-356 modifies card layout that 357's filter will display
- Can run in parallel with Batch 2 (different tab)

---

### Batch 4: Export Flow (SEQUENTIAL)

**Must run sequentially - all modify `ExportModal.tsx`.**

| Order | Backlog Item | Title | Files Affected | Est. Tokens |
|-------|--------------|-------|----------------|-------------|
| 4.1 | BACKLOG-360 | Default to Audit Package | `ExportModal.tsx` | ~10K |
| 4.2 | BACKLOG-362 | Popup Duration | `ExportModal.tsx`, `ExportSuccessMessage.tsx` | ~5K |
| 4.3 | BACKLOG-352 | Export Complete + History | `ExportModal.tsx`, `ExportComplete.tsx`, `TransactionDetailsTab.tsx`, **DB schema + migration** | ~25K |

**Dependency Notes:**
- BACKLOG-352 has DB schema changes (last_exported_at, last_export_path)
- **IMPORTANT:** BACKLOG-352 MUST create a migration file (not just inline ALTER TABLE)
- BACKLOG-352 also touches TransactionDetailsTab - must wait for Batch 2 to complete
- Can run in parallel with Batch 3 (different component domain)

---

### Batch 5: PDF Export (SEQUENTIAL)

**Must run sequentially - both modify `pdfExportService.ts`.**

| Order | Backlog Item | Title | Files Affected | Est. Tokens |
|-------|--------------|-------|----------------|-------------|
| 5.1 | BACKLOG-355 | Email Back Link | `pdfExportService.ts` | ~10K |
| 5.2 | BACKLOG-354 | Phone in 1:1 Export | `pdfExportService.ts`, `folderExportService.ts` | ~5K |

**Dependency Notes:**
- Both are backend PDF generation changes
- Can run in parallel with Batches 2, 3, 4 (different domain)

---

## Parallel Execution Strategy

### Wave 1: Maximum Parallelization

```
TIME -->

Worktree 1:  [BACKLOG-379]
Worktree 2:  [BACKLOG-228]
                 |
                 v
             MERGE ALL
```

**Note:** BACKLOG-167 removed - already complete.

### Wave 2: Multi-Track Execution

After Wave 1 merges, can run these tracks in parallel:

```
TIME -->

Track A (Transaction Details) - STARTS WITH 381 NOW:
    [381] --> [383] --> [335]

Track B (Messages - parallel with A):
    [356] --> [357]

Track C (PDF Export - parallel with A, B):
    [355] --> [354]
```

**Note:** BACKLOG-363 removed from Track A - already complete (TransactionEmailsTab.tsx exists).

### Wave 3: Export Flow (Depends on Track A)

```
TIME -->

After Track A completes (due to BACKLOG-352 touching TransactionDetailsTab):
    [360] --> [362] --> [352]

Note: BACKLOG-352 requires creating a migration file for DB schema changes.
```

---

## Recommended Execution Order

| Phase | Items | Est. Total | Execution |
|-------|-------|------------|-----------|
| **Wave 1** | 379, 228 | ~35K | Parallel (2 worktrees) |
| **Wave 2A** | 381, 383, 335 | ~55K | Sequential (1 worktree) |
| **Wave 2B** | 356, 357 | ~40K | Sequential, parallel with 2A |
| **Wave 2C** | 355, 354 | ~15K | Sequential, parallel with 2A, 2B |
| **Wave 3** | 360, 362, 352 | ~55K | Sequential, after 2A completes |

**Total Estimated Tokens**: ~200K

**SR Engineer Review Notes (2026-01-22):**
- BACKLOG-363 (Tab Reorganization) removed - already complete
- BACKLOG-167 (Status Options) removed - already complete
- Revised estimate: ~200K (down from ~225K)
- BACKLOG-352 requires explicit migration file creation

---

## Deferred Items

| Backlog Item | Title | Reason |
|--------------|-------|--------|
| BACKLOG-371 | Contact Update Sync | ~50K tokens, scope too large for polish sprint |
| BACKLOG-220 | Unlink Communications UI | Requires schema refactor (BACKLOG-296) |
| BACKLOG-358 | Deleted Messages Tab | Depends on iOS backup parser |

---

## File Conflict Matrix

| File | Backlog Items | Resolution |
|------|---------------|------------|
| `TransactionDetailsTab.tsx` | 381, 383, 335, 352 | Sequential in Batch 2, then 352 after |
| `TransactionMessagesTab.tsx` | 356, 357 | Sequential in Batch 3 |
| `ExportModal.tsx` | 360, 362, 352 | Sequential in Batch 4 |
| `pdfExportService.ts` | 355, 354 | Sequential in Batch 5 |
| `MessageThreadCard.tsx` | 356 | Only 356 - isolated |
| `Dashboard.tsx` | 379 | Only 379 - isolated |
| ~~`BulkActionBar.tsx`~~ | ~~167~~ | ~~Already complete~~ |

**Removed from matrix:**
- BACKLOG-363 - already complete (TransactionEmailsTab.tsx exists)
- BACKLOG-167 - already complete (BulkActionBar.tsx has status restrictions)

---

## Success Criteria

- [ ] All critical bugs in Wave 1 resolved
- [x] Transaction details tabs reorganized (Overview, Messages, Emails, Contacts) - ALREADY DONE
- [ ] Audit period prominently displayed
- [ ] Text messages filterable by audit dates
- [ ] Export defaults to Audit Package
- [ ] Export complete shows persistent history in Overview
- [ ] All role pills formatted properly
- [x] Status options restricted for manual transactions - ALREADY DONE

---

## SR Engineer Review Checklist

Before execution, SR Engineer must validate:

- [x] Dependency graph is accurate for current codebase
- [x] File conflict matrix is complete
- [x] Parallel execution groups are safe
- [x] Token estimates are reasonable (~200K revised)
- [x] Database schema changes in BACKLOG-352 are properly sequenced
- [x] No hidden dependencies missed

**SR Engineer Review Complete: 2026-01-22**

**Findings:**
1. BACKLOG-363 (Tab Reorganization) - Already implemented (TransactionEmailsTab.tsx exists)
2. BACKLOG-167 (Status Options) - Already implemented (BulkActionBar.tsx has logic)
3. BACKLOG-352 - Must create migration file, not just inline ALTER TABLE
4. Revised token estimate: ~200K (down from ~225K)

---

## Risks

| Risk | Mitigation |
|------|------------|
| ~~Tab reorganization (363) may break navigation~~ | ~~Already complete - no risk~~ |
| BACKLOG-352 DB changes may affect other queries | Add migration file (explicit requirement), test existing flows |
| Parallel worktrees may diverge significantly | Keep merges frequent, rebase often |
| BACKLOG-228 investigation may expand scope | Time-box to profiling; fix is separate |

---

## Technical Notes

### Database Changes (BACKLOG-352)

```sql
ALTER TABLE transactions ADD COLUMN last_exported_at TEXT;
ALTER TABLE transactions ADD COLUMN last_export_path TEXT;
```

**IMPORTANT:** Must create a migration file in the migrations directory.
Do NOT use inline ALTER TABLE statements. Follow existing migration patterns.

Example migration file: `migrations/XXXX_add_export_tracking_columns.sql`

### ~~New File (BACKLOG-363)~~ - ALREADY COMPLETE

~~`TransactionEmailsTab.tsx` - New component for dedicated emails tab. Extract from current TransactionDetailsTab.tsx email section.~~

**Status:** TransactionEmailsTab.tsx already exists at:
`src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx`

### Tab Structure (Current - Already Implemented)

```
[Overview] [Messages] [Emails] [Attachments] [Contacts]
```

The tab reorganization (BACKLOG-363) is already complete.
