# BACKLOG-391: Transaction Overview UI Redundancy - Audit Period Shown Twice

**Created**: 2026-01-22
**Priority**: Medium
**Category**: UI/UX
**Status**: In Progress

---

## Problem

In the Transaction Details Overview tab, audit period information is shown twice:
1. In "Transaction Overview" section: `Audit Period: Sep 1, 2025 - Jan 28, 2026`
2. In separate "Audit Period" section with Start Date, Closing Date, End Date fields

This is redundant and confusing.

## Solution

1. **Remove** the separate "Audit Period" section (with the 3 date fields)
2. **Rename** "Transaction Overview" to "Summary"
3. **Add** Closing Date to the Summary section
4. **Add** Address on a following line (for edit discoverability)

### Before
```
Transaction Overview
Edit Details
Type: Purchase | Audit Period: Sep 1, 2025 - Jan 28, 2026

Audit Period
Start Date: 9/1/2025
Closing Date: 1/3/2026
End Date: 1/28/2026
```

### After
```
Summary
Edit Details
Type: Purchase | Audit Period: Sep 1, 2025 - Jan 28, 2026 | Closing: Jan 3, 2026
Address: 571 Dale Dr, Incline Village, NV 89451, USA
```

## Files to Modify

- `src/components/transactionDetailsModule/components/TransactionOverviewTab.tsx` (or similar)

## Acceptance Criteria

- [ ] "Transaction Overview" renamed to "Summary"
- [ ] Separate "Audit Period" section removed
- [ ] Closing date added to Summary line
- [ ] Address shown on following line
- [ ] Edit Details button still works
