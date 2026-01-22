# BACKLOG-392: Improve Client Role Label Based on Transaction Type

**Created**: 2026-01-22
**Priority**: Medium
**Category**: UI/UX Enhancement
**Status**: In Progress

---

## Problem

The "Client" role label doesn't indicate whether the client is a buyer or seller. This can be inferred from the transaction type.

## Solution

Update the Client role label to show context based on transaction type:
- If transaction type is "purchase" → Show "Buyer (Client)"
- If transaction type is "sale" → Show "Seller (Client)"

## Current Behavior
```
Client: John Smith
```

## Expected Behavior
```
# For purchase transaction:
Buyer (Client): John Smith

# For sale transaction:
Seller (Client): John Smith
```

## Files to Modify

- Role formatting utility (likely where BACKLOG-383 changes were made)
- Need to pass transaction type to the role formatter

## Acceptance Criteria

- [ ] Client role shows "Buyer (Client)" for purchase transactions
- [ ] Client role shows "Seller (Client)" for sale transactions
- [ ] Other roles remain unchanged
