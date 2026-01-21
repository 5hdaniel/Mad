# BACKLOG-355: Add "Back to Email Threads" Link in Full Audit PDF

**Created**: 2026-01-21
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

In the full audit PDF (not audit package), text conversations have a "← Back to Text Conversations" link that navigates back to the index. The same functionality is needed for email threads - they should have "← Back to Email Threads" that jumps to the Email Threads section.

## Current State

- Text threads have: "← Back to Text Conversations" link
- Email threads: No back link

## Expected State

- Text threads: "← Back to Text Conversations" (existing)
- Email threads: "← Back to Email Threads" (new)

Both should use PDF internal links to navigate to their respective index sections.

## Acceptance Criteria

- [ ] Email thread pages have "← Back to Email Threads" link
- [ ] Link navigates to Email Threads index section in PDF
- [ ] Styling consistent with text conversation back link

## Related

- pdfExportService.ts
- Similar to existing text thread back link implementation
