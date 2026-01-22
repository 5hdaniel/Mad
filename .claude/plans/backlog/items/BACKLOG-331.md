# BACKLOG-331: PDF Export Date Range Filtering

## Summary

Filter/truncate messages in PDF export based on transaction start date and closing date. Only include messages that fall within the transaction's date range.

## Problem

Currently, PDF exports include ALL linked messages regardless of when they occurred. Users need exports to only include communications relevant to the transaction timeframe.

## Requirements

1. **Date range filtering at export time**
   - Apply filtering during PDF generation (not at message linking time)
   - Use transaction's start date as lower bound (if set)
   - Use transaction's closing date as upper bound (if set)

2. **Why at export time?**
   - Closing date may not be known when messages are linked
   - User may update closing date after linking messages
   - Keeps linked messages intact for reference, only filters on export

3. **Edge cases**
   - If no start date: include all messages up to closing date
   - If no closing date: include all messages from start date onwards
   - If neither date set: include all linked messages (current behavior)

## Implementation Notes

- Modify `pdfExportService.ts` to filter communications by date range
- Use `sent_at` timestamp for filtering
- Consider adding a small buffer (e.g., 1 day before start, 1 day after close) for edge cases

## Files Likely Affected

- `electron/services/pdfExportService.ts`

## Acceptance Criteria

- [ ] Messages before transaction start date are excluded from PDF
- [ ] Messages after closing date are excluded from PDF
- [ ] Filtering only happens at export, linked messages remain in UI
- [ ] Edge cases handled (missing dates)
- [ ] Export summary shows filtered message count vs total linked

## Priority

Medium - UX improvement for accurate audit reports

## Created

2026-01-19
