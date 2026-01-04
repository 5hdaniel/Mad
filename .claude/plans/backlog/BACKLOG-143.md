# BACKLOG-143: Prevent Duplicate Contact Imports

## Summary

When importing contacts from the database, contacts can be imported multiple times. The system should either filter out already-imported contacts from the import list, or show an informational message after import indicating how many were imported vs. already existed.

## Problem

Currently when a user imports contacts:
1. The same contacts can be imported repeatedly
2. No indication is given that contacts already exist in the system
3. This leads to duplicate contact entries

## Proposed Solutions

### Option A: Filter Import List (Recommended)
- Before showing the list of contacts available for import, check which ones already exist in the system
- Hide or gray out contacts that have already been imported
- Show a count: "X contacts available (Y already imported)"

### Option B: Post-Import Summary
- Allow all contacts to be selected for import
- During import, check for duplicates and skip them
- Show a summary message after import:
  - "Imported X new contacts"
  - "Y contacts were already in your system and skipped"

### Option C: Hybrid Approach
- Show all contacts in the import list
- Mark already-imported contacts with a badge/icon
- Allow re-import with confirmation ("This contact already exists. Update?")
- Show summary after import

## Acceptance Criteria

- [ ] Users cannot accidentally create duplicate contacts
- [ ] Clear feedback on what was imported vs. skipped
- [ ] Existing contacts are identified before or during import
- [ ] Works for all contact import sources (database, vCard, etc.)

## Technical Notes

- Need to define what makes a contact "the same" (email? phone? name combination?)
- Consider matching logic: exact match vs. fuzzy match
- May need to update contact import service and UI components

## Priority

**Medium** - User experience issue, causes data quality problems

## Category

`enhancement`

## Estimation

| Factor | Estimate |
|--------|----------|
| Tokens | ~40K |
| Token Cap | 160K |
| Complexity | Medium |

## Related

- Contact import functionality
- Contact management UI

---

*Created: 2026-01-03*
*Status: Pending*
