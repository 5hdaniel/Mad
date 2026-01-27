# BACKLOG-382: Persistent Export History in Transaction Card & Details

**Created**: 2026-01-22
**Updated**: 2026-01-27
**Priority**: Medium
**Category**: Feature
**Status**: Pending

---

## Description

Show last export information in both the transaction card (dashboard list) and transaction details page. Users should be able to see at a glance which transactions have been exported and when.

## Current Behavior

- Export success message appears briefly after export
- User may miss the Finder link if message auto-dismisses
- No way to find the exported file later without re-exporting
- No indication on dashboard which transactions have been exported

## Expected Behavior

### Transaction Card (Dashboard)
Show compact export status:
```
123 Main St                    Exported: Jan 22
Purchase | 5 emails, 3 texts   [or "Not exported" in muted text]
```

### Transaction Details (Overview Tab)
Show full export section:
```
Last Export
Exported: Jan 22, 2026 at 3:45 PM
Location: ~/Documents/Audits/123-Main-St.pdf
[Open in Finder]
```

## Requirements

### Transaction Card Display
- Show "Exported: [date]" if exported (compact format, e.g., "Jan 22")
- Show "Not exported" in muted/gray text if never exported
- Keep it subtle - don't clutter the card

### Transaction Details Display
- Show "Last Export" section if transaction has been exported
- Show "Not exported yet" if never exported
- Display export date/time (full format)
- Display file path (truncated if too long)
- Clickable "Open in Finder" link

### Data Storage
- Store last export timestamp in transaction record
- Store last export file path in transaction record
- Update on each successful export

### Database Changes
```sql
ALTER TABLE transactions ADD COLUMN last_exported_at TEXT;
ALTER TABLE transactions ADD COLUMN last_export_path TEXT;
```

## Acceptance Criteria

### Transaction Card
- [ ] Shows "Exported: [date]" on cards for exported transactions
- [ ] Shows "Not exported" (muted) for never-exported transactions
- [ ] Date format is compact (e.g., "Jan 22" or "Jan 22, 2026")

### Transaction Details
- [ ] Export history section visible in Overview tab
- [ ] Shows full date/time of last export
- [ ] Shows file path of last export
- [ ] "Open in Finder" button works
- [ ] Handles never-exported state gracefully

### General
- [ ] Updates after each new export
- [ ] Database columns added (`last_exported_at`, `last_export_path`)

## Related

- BACKLOG-352 (Export Success Message with Finder Link)
- BACKLOG-367 (Consolidate duplicate export date columns)
- TransactionCard.tsx
- TransactionDetails.tsx
- Export services
