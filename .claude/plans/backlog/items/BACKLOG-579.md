# BACKLOG-579: List Attachment Filenames in Export PDF

**Category:** Enhancement
**Priority:** High
**Status:** In-Progress
**Sprint:** SPRINT-067
**Created:** 2026-02-01

---

## Description

Update PDF export to list attachment filenames instead of just showing count. Users need to see which files are in the attachments folder.

### Current Behavior

In the exported PDF, emails with attachments show:
```
Attachments (5)
Attachments are available in the /attachments folder
```

### Desired Behavior

List each attachment filename so users can find them:
```
Attachments (5)
- contract_v2.pdf (1.2 MB)
- property_photo.jpg (256 KB)
- disclosure.pdf (89 KB)
- inspection_report.pdf (2.1 MB)
- addendum.docx (45 KB)
```

---

## Task Reference

- **Task:** TASK-1780
- **PR:** #701

---

## Notes

Added mid-sprint as a user-identified improvement during TASK-1777 testing.
