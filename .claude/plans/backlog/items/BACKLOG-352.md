# BACKLOG-352: Export Complete Screen and Persistent Export History

**Created**: 2026-01-21
**Updated**: 2026-01-22
**Priority**: High
**Category**: UX
**Status**: Pending

---

## Description

Improve the export completion experience with better button styling and persistent export history in the Overview tab.

## Current State

Export complete screen shows:
```
Export Complete!
Your export has been saved successfully.

[Open in Finder]  (link style)
[Done]            (button style)
```

Also shows a green auto-dismiss success bar in transaction details.

## Required Changes

### 1. Export Complete Screen - Button Styling
- Make "Open in Finder" look like the "Done" button (styled as a button, keep the folder icon)
- Put both buttons **side by side**

```
Export Complete!
Your export has been saved successfully.

[Open in Finder]  [Done]
     ↑ same style as Done button, with folder icon
```

### 2. Remove Auto-Dismiss Success Bar
Remove the green success bar that appears and auto-dismisses in transaction details after export. It's redundant now.

### 3. Persistent Export History in Overview Tab
Instead of the temporary green bar, add a persistent section in the Overview tab:

```
Last Exported
Jan 22, 2026 at 3:45 PM
[Open in Finder]
```

- Shows when transaction was last exported
- Button to open the exported file location
- Only shows if transaction has been exported at least once
- If never exported, don't show this section (or show "Not exported yet")

## Database Changes (from BACKLOG-382)

```sql
ALTER TABLE transactions ADD COLUMN last_exported_at TEXT;
ALTER TABLE transactions ADD COLUMN last_export_path TEXT;
```

## Acceptance Criteria

- [ ] "Open in Finder" button styled same as "Done" button
- [ ] Both buttons side by side on export complete screen
- [ ] Green auto-dismiss success bar removed
- [ ] Overview tab shows "Last Exported" section with date and open button
- [ ] Export updates last_exported_at and last_export_path in database

## Related

- BACKLOG-382 (Persistent Export History - can be merged with this)
- ExportModal.tsx
- TransactionDetailsTab.tsx (Overview section)
