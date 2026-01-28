# BACKLOG-359: Add Audit Date Range to Summary PDF Title

**Created**: 2026-01-21
**Priority**: Low
**Category**: UI
**Status**: Pending

---

## Description

In the summary PDF export, add the date range that the transaction audit covers directly under the title. This makes it immediately clear what time period the audit represents.

## Current State

```
Transaction Audit Summary
123 Main Street, Los Angeles, CA

[Summary content...]
```

## Expected State

```
Transaction Audit Summary
123 Main Street, Los Angeles, CA
Audit Period: January 1, 2026 - January 15, 2026

[Summary content...]
```

## Acceptance Criteria

- [ ] Date range displayed under title in summary PDF
- [ ] Uses transaction start_date and closed_at/end_date
- [ ] Human-readable date format (e.g., "January 1, 2026")
- [ ] Labeled as "Audit Period:" for clarity

## Related

- pdfExportService.ts
- Transaction start_date and closed_at fields
