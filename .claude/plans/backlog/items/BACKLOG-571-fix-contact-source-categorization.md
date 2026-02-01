# BACKLOG-571: Fix Contact Source Categorization for Imports

## Summary
Use `source: "contacts_app"` instead of `"manual"` when importing from Contacts App so they appear in the "Imported" filter category.

## Problem
Contacts imported from the macOS Contacts App were being created with `source: "manual"`, causing them to appear in the "Manual" filter category instead of "Imported".

## Solution
Changed the source parameter when creating contacts from external sources:
- `ContactAssignmentStep.tsx`: Changed `source: "manual"` → `source: "contacts_app"`
- `Contacts.tsx`: Added `source: "contacts_app"` (was missing)

## Filter Category Logic
- `source: "manual"` → Shows in "Manual" filter (green pill)
- `source: "contacts_app"` → Shows in "Imported" filter (blue pill)
- `source: "sms"` → Shows in "Messages" filter (amber pill)
- `is_message_derived: true` → Shows in "Contacts App" filter (violet pill)

## Files Modified
- `src/components/audit/ContactAssignmentStep.tsx`
- `src/components/Contacts.tsx`

## Status
Completed - Sprint 066

## Note
Existing contacts imported with wrong source will still show in "Manual". Only new imports use correct source.
