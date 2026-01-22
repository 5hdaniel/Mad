# BACKLOG-345: Verify PDF Export Uses Audit Package as Foundation

**Created**: 2026-01-21
**Priority**: Medium
**Category**: Architecture
**Status**: Pending

---

## Description

The PDF export should be refactored to use the Audit Package (folder export) as its foundation, then add dynamic internal links on top. This consolidates the export logic into a single code path.

## Current State

Currently there are two separate export code paths:
- `pdfExportService.ts` - generates PDF directly
- `folderExportService.ts` - generates audit package (folder with PDFs + attachments)

This has led to:
- Inconsistent date filtering logic between the two exports
- Duplicate code for contact resolution, message formatting, etc.
- Different behavior that confuses users

## Expected Architecture

```
folderExportService.ts (Audit Package)
        │
        ├── Generates all PDFs (emails, texts, attachments)
        ├── Handles date filtering (single source of truth)
        ├── Resolves contact names
        └── Exports to folder structure
              │
              ▼
pdfExportService.ts (PDF Report)
        │
        ├── Uses Audit Package output as base
        ├── Adds dynamic internal links (table of contents, navigation)
        └── Combines into single PDF document
```

## Verification Checklist

- [ ] PDF export date filtering matches Audit Package filtering exactly
- [ ] Contact name resolution is consistent between both exports
- [ ] Message formatting is identical in both outputs
- [ ] No duplicate code for export logic
- [ ] PDF-specific features (links, TOC) layer cleanly on top

## Acceptance Criteria

- [ ] PDF export uses `folderExportService` for content generation
- [ ] Only PDF-specific logic (internal links, single document assembly) in `pdfExportService`
- [ ] Date filtering happens in ONE place only
- [ ] Both exports produce identical content (aside from format/linking)

## Related

- BACKLOG-331: PDF Export Date Range Filtering
- SR Engineer review finding: "Inconsistent date filtering logic between exports"

## Notes

This is a verification task to ensure the consolidation is complete and working correctly. The refactoring may have already been partially done - need to audit current state.
