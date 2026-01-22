# BACKLOG-382: Persistent Export History in Transaction Details

**Created**: 2026-01-22
**Priority**: Medium
**Category**: Feature
**Status**: Pending

---

## Description

Show a persistent export history section in transaction details that displays when the transaction was last exported and where the file was saved.

## Current Behavior

- Export success message appears briefly after export
- User may miss the Finder link if message auto-dismisses
- No way to find the exported file later without re-exporting

## Expected Behavior

In the transaction details (Overview section), show:
```
Last Export
Exported: Jan 22, 2026 at 3:45 PM
Location: ~/Documents/Audits/123-Main-St.pdf
[Open in Finder]
```

## Requirements

### Display
- Show "Last Export" section if transaction has been exported
- Show "Not exported yet" if never exported
- Display export date/time
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

- [ ] Export history section visible in transaction details
- [ ] Shows date/time of last export
- [ ] Shows file path of last export
- [ ] "Open in Finder" button works
- [ ] Handles never-exported state gracefully
- [ ] Updates after each new export

## Related

- BACKLOG-352 (Export Success Message with Finder Link)
- TransactionDetails.tsx
- Export services
