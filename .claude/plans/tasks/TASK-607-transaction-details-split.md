# TASK-607: TransactionDetails.tsx Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 4 - Component Refactors
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-604
**Parallel With:** TASK-605, TASK-606

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 3-4 → Actual: _ (variance: _%)
- Est Wall-Clock: 15-20 min → Actual: _ min (variance: _%)
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

## Directory Structure

```
src/components/transactionDetails/
  index.ts
  components/
    index.ts
    TransactionHeader.tsx
    TransactionDetailsTab.tsx
    TransactionCommunicationsTab.tsx
    TransactionDocumentsTab.tsx
    TransactionAuditLogTab.tsx
    TransactionContactRoles.tsx
  hooks/
    index.ts
    useTransactionDetails.ts
    useTransactionTabs.ts
    useTransactionCommunications.ts
```

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

- [ ] `TransactionDetails.tsx` < 500 lines
- [ ] Uses service layer (no direct window.api calls)
- [ ] All tab components extracted
- [ ] All hooks extracted
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer architecture review passed

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
