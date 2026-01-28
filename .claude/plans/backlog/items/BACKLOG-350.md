# BACKLOG-350: Refactor folderExportService.ts (2057 Lines)

**Created**: 2026-01-21
**Priority**: Low
**Category**: Architecture
**Status**: Pending

---

## Description

`folderExportService.ts` has grown to 2057 lines and handles multiple responsibilities. Consider splitting into focused modules.

## Source

SR Engineer review (2026-01-21): "The file has grown substantially with all the new features. It contains: PDF generation, Text thread handling, Attachment management, Contact name resolution, Multiple HTML template generators."

## Suggested Split

```
electron/services/export/
├── folderExportService.ts      # Orchestration + folder structure
├── pdfGenerationService.ts     # PDF creation with puppeteer
├── textThreadExportService.ts  # Text/SMS thread handling
├── attachmentExportService.ts  # Attachment copying + fallbacks
└── exportTemplates.ts          # HTML template generators
```

## Benefits

- Easier to test individual modules
- Clearer responsibility boundaries
- Reduced cognitive load when editing

## Acceptance Criteria

- [ ] Split into focused modules
- [ ] Maintain existing public API
- [ ] No behavior changes
- [ ] Tests pass after refactor

## Priority

Low - Future refactoring when time permits
