# BACKLOG-431: Add Sale Price and Listing Price to Transaction Details Step

## Summary

The "Sale Price" and "Listing Price" fields are missing from Step 1 (Transaction Details) of the "Audit New Transaction" flow. These fields should be visible and editable.

## Category

Bug / Missing Feature

## Priority

P2 - High (Core transaction data missing from UI)

## Description

### Problem

When creating a new transaction audit via "Audit New Transaction", Step 1 (Transaction Details) does not display:
- Sale Price
- Listing Price

These are essential transaction fields that users need to enter as part of the audit process.

### Expected Behavior

Step 1 should include input fields for:
- **Listing Price** - The price the property was listed at
- **Sale Price** - The final sale/purchase price

### Current Behavior

These fields are not visible in the Transaction Details step.

### Implementation Notes

- Check if the fields exist in the form schema but are hidden
- Add input fields with proper currency formatting (e.g., $XXX,XXX)
- Fields should be optional (not all transactions have both prices)
- Consider placement near other transaction metadata (type, dates, address)

## Acceptance Criteria

- [ ] Listing Price field visible in Step 1 of Audit New Transaction
- [ ] Sale Price field visible in Step 1 of Audit New Transaction
- [ ] Fields accept currency input with proper formatting
- [ ] Values are saved to the transaction record
- [ ] Fields are optional (can be left blank)

## Estimated Effort

~8K tokens

## Dependencies

None

## Related Items

- Transaction creation flow
- BACKLOG-430: Default Representation Start Date
