# BACKLOG-361: Remove Progress Bar from Audit Package Exporter

**Created**: 2026-01-21
**Priority**: Low
**Category**: UI
**Status**: Pending

---

## Description

In the Audit Package export process, remove the progress bar and the "X/X" count display. Keep only the spinning animation to indicate the export is in progress.

## Current State

```
Exporting...
[████████░░░░░░░░░░░░]
15 / 47
```

## Expected State

```
Exporting...
[Spinning animation only]
```

## Rationale

The detailed progress can create anxiety if it seems slow, and the current implementation may not accurately reflect actual progress. A simple animation is cleaner and sets appropriate expectations.

## Acceptance Criteria

- [ ] Progress bar removed from Audit Package export
- [ ] X/X count removed
- [ ] Spinning/loading animation remains
- [ ] "Exporting..." or similar status text remains

## Related

- ExportModal.tsx
- Note: This is opposite of BACKLOG-339 which wanted to ADD progress to PDF export
