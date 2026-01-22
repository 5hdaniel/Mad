# TASK-1155: Add Audit Date Range to Summary PDF Title

**Backlog ID:** BACKLOG-359
**Sprint:** SPRINT-048
**Phase:** 1 (Track B - PDF Services, Parallel)
**Branch:** `feature/task-1155-pdf-date-range`
**Estimated Turns:** 4-6
**Estimated Tokens:** 8K-15K

---

## Objective

Add the audit date range (start date - end date) directly under the title in the Summary PDF export. This makes it immediately clear what time period the audit represents.

---

## Context

Currently the Summary PDF shows:
```
Transaction Audit Summary
123 Main Street, Los Angeles, CA

[Summary content...]
```

Users need to see the audit period prominently displayed:
```
Transaction Audit Summary
123 Main Street, Los Angeles, CA
Audit Period: January 1, 2026 - January 15, 2026

[Summary content...]
```

This helps compliance officers immediately understand the scope of the audit.

---

## Requirements

### Must Do:
1. Add "Audit Period: [start] - [end]" under the address in Summary PDF
2. Use transaction `started_at` and `closed_at` fields
3. Format dates in human-readable format (e.g., "January 1, 2026")
4. Handle cases where dates are missing (show "N/A" or omit)

### Must NOT Do:
- Change the Full PDF export (only Summary PDF)
- Modify date storage or parsing logic
- Add dates to other sections of the PDF

---

## Acceptance Criteria

- [ ] Date range displayed under title in Summary PDF
- [ ] Uses transaction started_at and closed_at fields
- [ ] Human-readable date format (e.g., "January 1, 2026")
- [ ] Labeled as "Audit Period:" for clarity
- [ ] Handles missing dates gracefully (N/A or omit)

---

## Files to Modify

- `electron/services/folderExportService.ts` - Modify `generateSummaryHTML()` method (lines 260-486)

## Files to Read (for context)

- `electron/services/folderExportService.ts` - Summary PDF generation (lines 260-486)
- `electron/types/models.ts` - Transaction type with date fields

---

## Technical Notes

### Current Header (lines 406-413)
```html
<div class="header">
  <h1>Transaction Audit Summary</h1>
  <div class="subtitle">Generated on ${formatDate(new Date())}</div>
</div>

<div class="property-info">
  <h2>Property Information</h2>
  <div class="address">${transaction.property_address || "N/A"}</div>
</div>
```

### Target Header
```html
<div class="header">
  <h1>Transaction Audit Summary</h1>
  <div class="address">${transaction.property_address || "N/A"}</div>
  <div class="audit-period">
    Audit Period: ${formatDate(transaction.started_at)} - ${formatDate(transaction.closed_at)}
  </div>
  <div class="subtitle">Generated on ${formatDate(new Date())}</div>
</div>
```

### Date Formatting
Use the existing `formatDate` function (lines 274-281):
```typescript
const formatDate = (dateString?: string | Date | null): string => {
  if (!dateString) return "N/A";
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (HTML generation, test manually)
- **Existing tests to update:** None expected

### Manual Testing
- [ ] Export Audit Package with both dates set
- [ ] Open Summary_Report.pdf
- [ ] Verify "Audit Period: X - Y" appears under address
- [ ] Test with only start date (should show start - N/A or similar)
- [ ] Test with neither date (should show N/A - N/A or omit line)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(export): add audit date range to summary pdf header`
- **Branch:** `feature/task-1155-pdf-date-range`
- **Target:** `int/sprint-ui-export-and-details`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/sprint-ui-export-and-details
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Summary PDF has title and address only
- **After**: Summary PDF shows Audit Period under address
- **Actual Turns**: X (Est: 4-6)
- **Actual Tokens**: ~XK (Est: 8-15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Transaction dates are not available from the service
- You need to modify the Transaction type
- You encounter blockers not covered in the task file
