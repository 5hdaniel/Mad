# BACKLOG-381: Transaction Details Header Improvements

**Created**: 2026-01-22
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

Improve the transaction details view with better information display and consistent edit button placement.

## Changes Required

### 1. Add Audit Period Display
Show the transaction's audit date range prominently in the details:
- Format: "Audit Period: Nov 8, 2025 - Jan 27, 2026"
- Location: Near the top of transaction details (Overview section)

### 2. Add Transaction Type Display
Show whether the transaction is a Purchase or Sale:
- Format: "Type: Purchase" or "Type: Sale"
- Could use badge/pill styling for visual distinction

### 3. Move Edit Details Button
Currently the "Edit Details" button is in the header bar of transaction details. Since we now have section-specific edit buttons (Edit Contacts, etc.), this is inconsistent.

**Current**: Edit button in top header bar
**Expected**: Edit button within the Overview/Details section, consistent with other section edit buttons

## Acceptance Criteria

- [ ] Audit period (started_at - closed_at) displayed in Overview section
- [ ] Transaction type (purchase/sale) displayed prominently
- [ ] Edit Details button moved from header bar to Overview section
- [ ] Edit button styling consistent with other section edit buttons
- [ ] Handles missing dates gracefully (shows "Not set" or similar)

## Related

- TransactionDetails.tsx
- TransactionDetailsTab.tsx (Overview section)
- BACKLOG-335 (Enforce Transaction Start Date)
