# BACKLOG-469: Remove Address from Transaction Details Header

## Summary

Remove the property address subtitle from the Transaction Details modal header. The address is redundant since it's already shown in the transaction info section.

## Category

UX / UI

## Priority

P3 - Low

## Description

### Current State

The Transaction Details header shows:
```
Transaction Details
1600 amphitheatre parkway, mountain view, ca 94043
```

### Expected

The header should only show:
```
Transaction Details
```

The address is already visible in the main content area, so showing it in the header is redundant and takes up space.

## Acceptance Criteria

- [ ] Address subtitle removed from Transaction Details header
- [ ] Header shows only "Transaction Details" title

## Files to Modify

- `src/components/TransactionDetails.tsx` or similar
- Look for the `<p className="text-sm text-green-100">` element with the address

## Estimated Effort

~2K tokens (simple removal)
