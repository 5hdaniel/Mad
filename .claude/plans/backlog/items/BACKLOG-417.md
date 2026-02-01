# BACKLOG-417: Display Price Fields in Transaction Summary

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P2 (Medium)
**Category**: UI
**Sprint**: Unassigned
**Estimate**: ~8K tokens

---

## Description

Display Listing Price and Sale Price in the transaction summary/overview section so users can see this information without opening the Edit modal.

## Current State

- Price fields exist in Edit Transaction modal (Step 1)
- Prices are saved to database (`listing_price`, `sale_price`)
- Prices are NOT displayed anywhere in the transaction details view

## Expected State

Show prices in the Overview tab of Transaction Details:

```
Transaction Summary
───────────────────
Property:      123 Main St, City, ST 12345
Type:          Purchase
Audit Period:  Jan 1, 2026 - Jan 21, 2026

Listing Price: $500,000
Sale Price:    $485,000
```

## Requirements

- Display in Overview/Summary section
- Format as currency (e.g., "$500,000")
- Show "—" or "Not set" if price is null
- Optional: Show price difference/negotiation amount

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/TransactionDetailsTab.tsx` | Add price display |

## Acceptance Criteria

- [ ] Listing Price displayed in Overview section
- [ ] Sale Price displayed in Overview section
- [ ] Prices formatted as currency
- [ ] Handles null/undefined gracefully
- [ ] Matches existing summary styling

## Related

- BACKLOG-381: Transaction Details Header Improvements
- Price fields added in Edit Transaction modal
