# TASK-607: TransactionDetails.tsx Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 4 - Component Refactors
**Priority:** HIGH
**Status:** Complete
**Depends On:** TASK-604
**Parallel With:** TASK-605, TASK-606

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** 2025-12-25 (session start)
**Task End:** 2025-12-25 (same session)
**Wall-Clock Time:** ~25 min (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | 1 | ~4K | 5 min |
| Implementation | 4 | ~16K | 18 min |
| Debugging | 1 | ~4K | 2 min |
| **Total** | 6 | ~24K | 25 min |

**Estimated vs Actual:**
- Est Turns: 3-4 → Actual: 6 (variance: +50%)
- Est Wall-Clock: 15-20 min → Actual: 25 min (variance: +25%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 10-14 | **3-4** | - |
| **Tokens** | ~50K | ~15K | - |
| **Time** | 1.5-2h | **15-20 min** | **15-20 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Split `src/components/TransactionDetails.tsx` (1,557 lines) into smaller, focused components, reducing to < 500 lines.

---

## Current State

`TransactionDetails.tsx` contains:
- Transaction header display
- Tab navigation (Details, Communications, Documents, Audit Log)
- Contact role management
- Communication thread display
- Document handling
- Status management
- Edit functionality

---

## Requirements

### Must Do
1. Extract tab content into separate components
2. Extract hooks for data management
3. Use service layer from TASK-604
4. Reduce TransactionDetails.tsx to < 500 lines

### Must NOT Do
- Change tab behavior
- Break communication threading
- Modify audit log display

---

## Proposed Extraction

### Components
| Component | Purpose | Lines (est.) |
|-----------|---------|--------------|
| `TransactionHeader.tsx` | Title, status, actions | ~100 |
| `TransactionDetailsTab.tsx` | Details tab content | ~150 |
| `TransactionCommunicationsTab.tsx` | Communications list | ~200 |
| `TransactionDocumentsTab.tsx` | Documents list | ~100 |
| `TransactionAuditLogTab.tsx` | Audit log display | ~80 |
| `TransactionContactRoles.tsx` | Contact role section | ~120 |

### Hooks
| Hook | Purpose | Lines (est.) |
|------|---------|--------------|
| `useTransactionDetails.ts` | Transaction data fetching | ~80 |
| `useTransactionTabs.ts` | Tab state management | ~40 |
| `useTransactionCommunications.ts` | Communication fetching | ~60 |

---

## Directory Structure (Implemented)

```
src/components/transactionDetailsModule/
  index.ts
  types.ts
  components/
    index.ts
    TransactionHeader.tsx
    TransactionTabs.tsx
    TransactionDetailsTab.tsx
    TransactionContactsTab.tsx
    ExportSuccessMessage.tsx
    modals/
      index.ts
      ArchivePromptModal.tsx
      DeleteConfirmModal.tsx
      UnlinkEmailModal.tsx
      EmailViewModal.tsx
      RejectReasonModal.tsx
  hooks/
    index.ts
    useTransactionDetails.ts
    useTransactionTabs.ts
    useTransactionCommunications.ts
    useSuggestedContacts.ts
```

**Note:** Module renamed to `transactionDetailsModule` to avoid Windows case-sensitivity conflict with `TransactionDetails.tsx`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/transactionDetails/index.ts` | Barrel export |
| `src/components/transactionDetails/components/index.ts` | Component exports |
| `src/components/transactionDetails/components/TransactionHeader.tsx` | Header |
| `src/components/transactionDetails/components/TransactionDetailsTab.tsx` | Details tab |
| `src/components/transactionDetails/components/TransactionCommunicationsTab.tsx` | Comms tab |
| `src/components/transactionDetails/components/TransactionDocumentsTab.tsx` | Docs tab |
| `src/components/transactionDetails/components/TransactionAuditLogTab.tsx` | Audit tab |
| `src/components/transactionDetails/components/TransactionContactRoles.tsx` | Roles |
| `src/components/transactionDetails/hooks/index.ts` | Hook exports |
| `src/components/transactionDetails/hooks/useTransactionDetails.ts` | Data fetch |
| `src/components/transactionDetails/hooks/useTransactionTabs.ts` | Tab state |
| `src/components/transactionDetails/hooks/useTransactionCommunications.ts` | Comms fetch |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/TransactionDetails.tsx` | Reduce to < 500 lines |

---

## Testing Requirements

1. **Existing Tests**
   - All TransactionDetails tests pass
   - No behavior changes

2. **Manual Verification**
   - All tabs render correctly
   - Tab switching works
   - Data loads properly
   - Actions (edit, status change) work

---

## Acceptance Criteria

- [x] `TransactionDetails.tsx` < 500 lines (381 lines, down from 1,557)
- [x] All tab components extracted (TransactionDetailsTab, TransactionContactsTab)
- [x] All hooks extracted (useTransactionDetails, useTransactionTabs, useTransactionCommunications, useSuggestedContacts)
- [x] All modals extracted (ArchivePrompt, DeleteConfirm, UnlinkEmail, EmailView, RejectReason)
- [x] All existing tests pass (14/14 TransactionDetails tests)
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [ ] SR Engineer architecture review passed

## Implementation Summary

**Line Count Results:**
- Before: 1,557 lines
- After: 381 lines
- Reduction: 75.5%

**Files Created:**
- `src/components/transactionDetailsModule/types.ts` - Shared types
- `src/components/transactionDetailsModule/index.ts` - Barrel export
- `src/components/transactionDetailsModule/hooks/index.ts` - Hooks barrel
- `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts` - Data fetching hook
- `src/components/transactionDetailsModule/hooks/useTransactionTabs.ts` - Tab state hook
- `src/components/transactionDetailsModule/hooks/useTransactionCommunications.ts` - Communication ops hook
- `src/components/transactionDetailsModule/hooks/useSuggestedContacts.ts` - AI suggestions hook
- `src/components/transactionDetailsModule/components/index.ts` - Components barrel
- `src/components/transactionDetailsModule/components/TransactionHeader.tsx` - Header with actions
- `src/components/transactionDetailsModule/components/TransactionTabs.tsx` - Tab navigation
- `src/components/transactionDetailsModule/components/TransactionDetailsTab.tsx` - Details tab content
- `src/components/transactionDetailsModule/components/TransactionContactsTab.tsx` - Contacts tab with AI suggestions
- `src/components/transactionDetailsModule/components/ExportSuccessMessage.tsx` - Export success banner
- `src/components/transactionDetailsModule/components/modals/index.ts` - Modals barrel
- `src/components/transactionDetailsModule/components/modals/ArchivePromptModal.tsx`
- `src/components/transactionDetailsModule/components/modals/DeleteConfirmModal.tsx`
- `src/components/transactionDetailsModule/components/modals/UnlinkEmailModal.tsx`
- `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx`
- `src/components/transactionDetailsModule/components/modals/RejectReasonModal.tsx`

**Note:** The module was renamed to `transactionDetailsModule` (lowercase 'd' in Module) to avoid case-sensitivity conflicts on Windows, where the existing `TransactionDetails.tsx` file would conflict with a folder named `transactionDetails`.

---

## Branch

```
feature/TASK-607-transaction-details-split
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
