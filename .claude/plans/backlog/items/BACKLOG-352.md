# BACKLOG-352: Export Success Message with Finder Link and Close Transaction Prompt

**Created**: 2026-01-21
**Priority**: High
**Category**: UX
**Status**: Pending

---

## Description

When exporting from the transaction details window, the success message should be consistent with the export modal flow. Two key improvements needed:

1. Show a hyperlink to open Finder and navigate to the exported file
2. Ask the user if they want to mark the transaction as closed

**Important**: The close transaction prompt must appear BEFORE the success message with the Finder link. If shown simultaneously, the success message may auto-dismiss before the user decides whether to close the transaction, causing them to miss the Finder link.

## Expected Flow

1. Export completes
2. Prompt: "Would you like to mark this transaction as closed?" [Yes] [No]
3. User selects option
4. Success message appears: "Export complete! [Open in Finder]"
5. Message persists until dismissed

## Acceptance Criteria

- [ ] Success message includes clickable "Open in Finder" link
- [ ] Close transaction prompt appears before success message
- [ ] Success message only appears after user responds to close prompt
- [ ] Behavior is consistent whether export triggered from modal or transaction details page

## Related

- Export modal component
- Transaction details page
