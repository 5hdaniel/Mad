# BACKLOG-570: Silent Refresh Pattern for Contact Imports

## Summary
Prevent loading flicker after importing contacts by using silent refresh that doesn't show loading state.

## Problem
When importing a contact from the Contacts App, the contact list would flash a loading spinner, causing a jarring UX.

## Solution
- Added `silentRefreshContacts` function to `useAuditTransaction` hook
- Added `silentLoadContacts` function to `useContactList` hook
- These functions refresh data without setting `loading: true`
- Applied consistently across Contacts screen, New Audit, and Edit Contacts flows

## Files Modified
- `src/hooks/useAuditTransaction.ts`
- `src/components/contact/hooks/useContactList.ts`
- `src/components/audit/ContactAssignmentStep.tsx`
- `src/components/Contacts.tsx`

## Status
Completed - Sprint 066
