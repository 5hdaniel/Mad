# BACKLOG-494: Display Emails in Natural Thread Format

**Category**: Feature / UX
**Priority**: P0 (Critical)
**Sprint**: SPRINT-052
**Estimated Tokens**: ~25K
**Status**: Pending
**Created**: 2026-01-24

---

## Summary

Emails linked to transactions should be displayed in their natural thread format, similar to how messages (iMessage/SMS) are displayed. Currently emails may not be grouped by conversation thread.

---

## User Story

As a real estate agent using Magic Audit, I want to see emails grouped by conversation thread so that I can easily follow the flow of communication with clients and colleagues, just like I see threaded text message conversations.

---

## Requirements

### Email Thread Grouping

1. Emails must be grouped by conversation/thread
2. Thread grouping should use standard email headers:
   - `In-Reply-To` header
   - `References` header
   - Subject line matching (fallback for broken threads)
3. Thread displays in chronological order within each thread

### Display Requirements

1. Reply chains should be visually connected
2. UX should be consistent with text message thread display
3. Thread view should show:
   - Thread subject/topic
   - Number of emails in thread
   - Date range of thread
   - Expandable/collapsible thread view

### Thread Detection Logic

```
1. Primary: Match on In-Reply-To / References headers
2. Secondary: Match on Message-ID chains
3. Fallback: Subject line normalization (strip Re:, Fwd:, etc.) + contact matching
```

---

## Acceptance Criteria

- [ ] Emails grouped by conversation thread
- [ ] Thread displays in chronological order
- [ ] Reply chains are visually connected
- [ ] Consistent with message thread display UX
- [ ] Thread metadata visible (count, date range)
- [ ] Individual emails within thread are expandable
- [ ] Works for both Gmail and Outlook emails

---

## Technical Approach

### Database/Service Layer

1. Check if email threading metadata is stored during sync:
   - `in_reply_to` header
   - `references` header
   - `message_id`
2. Add thread grouping logic to communication fetching
3. May need to add `thread_id` or `conversation_id` field

### UI Layer

1. Modify email display component to group by thread
2. Create thread container component (similar to message thread cards)
3. Handle expand/collapse of threads
4. Show thread summary when collapsed

---

## Files Likely Involved

| Area | Files |
|------|-------|
| Email Display | `src/components/TransactionDetail.tsx`, `TransactionEmailsTab.tsx` |
| Communication Service | `electron/services/db/communicationDbService.ts` |
| Email Sync | `electron/services/autoLinkService.ts`, `electron/services/email/` |
| Types | `src/types/` email-related types |

---

## Related Items

- SPRINT-052 Email Sync Production
- BACKLOG-457 (Sync Emails from Provider)
- BACKLOG-458 (Email Connection Status)
- Text message thread display (reference for UX consistency)

---

## Testing

1. Sync emails with a multi-message thread
2. Verify emails are grouped by conversation
3. Verify chronological ordering within thread
4. Test expand/collapse functionality
5. Test with both Gmail and Outlook emails
6. Test with broken thread chains (missing headers)

---

## Notes

User specifically requested this feature for SPRINT-052. The goal is UX parity with how text message conversations are displayed.
