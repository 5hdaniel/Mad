# BACKLOG-470: Add Price Fields to Create Transaction Flow

## Summary

Add Sale Price and Listing Price fields to the "Audit New Transaction" modal (Step 1).

## Category

Feature

## Priority

P2 - Medium

## Description

### Current State

The Edit Transaction modal has Sale Price and Listing Price fields, but the Create Transaction flow (AddressVerificationStep) does not.

### Expected

Step 1 of "Audit New Transaction" should include:
- Listing Price (optional)
- Sale Price (optional)

These should be saved when the transaction is created.

## Acceptance Criteria

- [ ] Listing Price field added to AddressVerificationStep
- [ ] Sale Price field added to AddressVerificationStep
- [ ] Fields saved when transaction is created
- [ ] Consistent styling with Edit modal

## Files to Modify

- `src/hooks/useAuditTransaction.ts` - Add `sale_price` and `listing_price` to `AddressData` interface
- `src/components/audit/AddressVerificationStep.tsx` - Add price input fields
- `src/components/AuditTransactionModal.tsx` - Pass price change handlers

## Estimated Effort

~5K tokens
