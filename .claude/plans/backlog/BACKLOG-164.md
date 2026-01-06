# BACKLOG-164: Rename "Bulk Edit" to "Edit" in Transaction List

**Created**: 2026-01-05
**Priority**: Low
**Category**: ui
**Status**: Pending

---

## Problem

The "Bulk Edit" button in the transaction list toolbar is confusing. It should just say "Edit" since it enables selection mode for editing multiple transactions.

## Current Behavior

Button says "Bulk Edit" which implies:
- A special bulk-only operation
- Different from regular editing

## Proposed Change

Rename button from "Bulk Edit" to "Edit" (or "Select" to be clearer about what it does).

## Files Affected

- `src/components/transaction/components/TransactionToolbar.tsx` (line ~306)

## Acceptance Criteria

- [ ] Button text changed from "Bulk Edit" to "Edit"
- [ ] No functional changes

## Estimate

~500 tokens (simple text change)
