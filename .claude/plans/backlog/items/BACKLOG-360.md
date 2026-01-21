# BACKLOG-360: Default Export to Audit Package, One PDF as "Coming Soon"

**Created**: 2026-01-21
**Priority**: High
**Category**: UI
**Status**: Pending

---

## Description

Update the export modal to:
1. Default selection to "Audit Package" (folder export)
2. Mark "One PDF" option as "Coming Soon" and disable it for now

This prioritizes the more complete Audit Package export as the default user experience.

## Current State

- Export modal shows multiple format options
- No clear default or one may be PDF

## Expected State

- "Audit Package" is pre-selected by default
- "One PDF" option shows "(Coming Soon)" label and is disabled/greyed out
- Other options available as before

## UI Mockup

```
Export Format:
◉ Audit Package (Recommended)
  Organized folder with PDFs and attachments

○ One PDF (Coming Soon)
  Single combined PDF document
  [Disabled/greyed out]

○ Summary Only
  Brief overview PDF
```

## Acceptance Criteria

- [ ] Audit Package is default selected option
- [ ] One PDF shows "(Coming Soon)" label
- [ ] One PDF option is disabled and cannot be selected
- [ ] Clear visual distinction for disabled option
- [ ] Default persists on modal reopen

## Notes

This supersedes BACKLOG-344 which only addressed adding Audit Package to settings. This item specifically addresses the export modal defaults.

## Related

- ExportModal.tsx
- BACKLOG-344 (related but different scope)
