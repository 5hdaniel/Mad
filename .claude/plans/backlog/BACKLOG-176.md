# BACKLOG-176: Show New Messages Count Instead of Total During Import

**Created**: 2026-01-05
**Priority**: Medium
**Category**: ui
**Status**: Pending

---

## Description

During macOS Messages import, the progress indicator shows total messages processed (e.g., "Importing messages... 676,647 / 676,647") which is misleading since most are skipped. Should show new messages found instead.

## Current Behavior

```
Importing messages... 676,647 / 676,647
```

Log shows: `Import complete: 0 imported, 676647 skipped`

## Desired Behavior

Show meaningful progress that reflects actual new data:
- "Scanning messages... X new found" (during import)
- "Import complete: X new messages added" (when done)
- Or: "Scanning messages... (X skipped, Y new)"

## Rationale

- Current UI makes it seem like we're importing 676k messages every time
- Users may think the app is slow or redundant
- The actual work (finding NEW messages) is hidden
- We already track skipped vs imported counts

## Technical Notes

The import service already calculates:
```typescript
// From log: "0 imported, 676647 skipped"
```

Just need to surface this to the UI during progress updates.

## Acceptance Criteria

- [ ] Progress shows new messages count, not total processed
- [ ] Final status shows "X new messages added" or "All caught up"
- [ ] Skipped count optionally shown (e.g., hover/tooltip)

## Estimated Tokens

~10,000

## Related Items

- MacOSMessagesImportService
- Dashboard sync status display

---
