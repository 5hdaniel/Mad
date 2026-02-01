# Task TASK-1782: Show Attachments in Email Thread View

**Sprint:** SPRINT-067
**Phase:** 5 (added mid-sprint)
**Priority:** MEDIUM
**Estimated Tokens:** ~30K
**Token Cap:** 120K
**Depends On:** TASK-1776 (EmailViewModal attachments - MERGED)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

When viewing an email thread, show attachments for each email in the thread. Currently users have to open each email individually via "View Details" to see attachments.

## Problem

- Email threads show multiple emails in a collapsible view
- Attachments are only visible when opening individual email in EmailViewModal
- Users want to see which emails have attachments without opening each one

## Deliverables

1. **Update:** Thread view component to show attachment indicators/list per email
2. **New:** Collapsible attachment section within each thread email card
3. **Reuse:** Existing attachment fetching logic from TASK-1776

## Acceptance Criteria

- [ ] Each email in thread view shows attachment count badge if has_attachments=true
- [ ] Clicking badge or expand arrow shows attachment list
- [ ] Attachment list shows filename, size, type icon
- [ ] Click attachment to open preview modal or system viewer
- [ ] All CI checks pass

## Implementation Notes

### Thread Email Card Update

In the thread view, each email card should show:
```
┌─────────────────────────────────────────────────┐
│ From: sender@example.com         Jan 31, 2026   │
│ Subject: RE: Property at 123 Main St            │
│                                                 │
│ Email body preview...                           │
│                                                 │
│ 📎 3 attachments                         [▼]    │
│ ├─ contract.pdf (1.2 MB)                        │
│ ├─ photo.jpg (256 KB)                           │
│ └─ disclosure.pdf (89 KB)                       │
└─────────────────────────────────────────────────┘
```

### Reuse Existing Components

- Use `getEmailAttachments` IPC handler from TASK-1776
- Use `AttachmentPreviewModal` from TASK-1778
- Similar UI pattern to EmailViewModal attachments section

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/TransactionEmailsTab.tsx` | Add attachment display to thread emails |
| `src/components/transactionDetailsModule/components/EmailThreadCard.tsx` | Add collapsible attachment section (may need to create) |

---

## Branch Information

**Branch From:** `int/SPRINT-067`
**Branch Name:** `feature/TASK-1782-thread-view-attachments`
