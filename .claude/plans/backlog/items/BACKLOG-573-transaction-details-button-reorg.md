# BACKLOG-573: Transaction Details Button Reorganization

## Summary
Reorganize Edit and Delete buttons in Transaction Details for better UX flow.

## Changes

### Edit Summary Button
- Moved from header action buttons to next to "Summary" heading
- Positioned like "Edit Contacts" is positioned next to "Key Contacts"
- Uses blue color scheme to match Edit Contacts

### Delete Transaction Button
- Removed from header action buttons
- Added to bottom center of Overview tab
- Styled as a subtle text button (not prominent)
- Only shown on Overview tab

## Rationale
- Edit actions are contextual to their sections
- Delete is a destructive action that shouldn't be prominent in header
- Matches common patterns where delete is at bottom of detail views

## Files Modified
- `src/components/transactionDetailsModule/components/TransactionHeader.tsx`
- `src/components/transactionDetailsModule/components/TransactionDetailsTab.tsx`
- `src/components/TransactionDetails.tsx`

## Status
Completed - Sprint 066
