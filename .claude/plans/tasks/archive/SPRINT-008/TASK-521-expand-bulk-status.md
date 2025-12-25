# TASK-521: Expand Bulk Status Change to All Statuses

**Sprint:** SPRINT-008-extension
**Priority:** Medium
**Type:** Enhancement
**Branch:** `refactor/TASK-521-expand-bulk-status` from `feature/transaction-list-ui-refinements`

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 2-4 | High |
| Tokens | ~15K | High |
| Time | 15-30 min | High |

**Basis:** Simple type expansion and UI update, minimal logic changes.

---

## Problem Statement

The bulk status change functionality currently only supports changing transactions to "active" or "closed" status. Users need the ability to bulk change to all 4 statuses:
- `pending` (return to review queue)
- `active` (approve/in progress)
- `closed` (completed)
- `rejected` (mark as rejected)

---

## Solution

Expand the `handleBulkStatusChange` type signature and update the BulkActionBar UI to show all 4 status options.

---

## Acceptance Criteria

- [ ] `handleBulkStatusChange` accepts all 4 status types: pending, active, closed, rejected
- [ ] BulkActionBar shows all 4 status options in the dropdown
- [ ] Each status change works correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Implementation Steps

### Step 1: Update useBulkActions.ts type signature

```typescript
// Change line 22 from:
handleBulkStatusChange: (status: "active" | "closed") => Promise<void>;

// To:
handleBulkStatusChange: (status: "pending" | "active" | "closed" | "rejected") => Promise<void>;
```

### Step 2: Update handleBulkStatusChange function

```typescript
// Change line 165 from:
async (status: "active" | "closed"): Promise<void> => {

// To:
async (status: "pending" | "active" | "closed" | "rejected"): Promise<void> => {
```

### Step 3: Update BulkActionBar UI

Add pending and rejected options to the status dropdown in BulkActionBar.tsx.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transaction/hooks/useBulkActions.ts` | Expand status type |
| `src/components/BulkActionBar.tsx` | Add all status options to dropdown |

---

## Guardrails

- DO NOT modify transaction business logic
- DO NOT change the API contract (backend already supports all statuses)
- ONLY expand the type and UI options

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded
3. PR created targeting `feature/transaction-list-ui-refinements`
4. Ready for SR Engineer review
