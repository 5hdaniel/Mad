# Task TASK-1781: Fix UI Attachment Count Display

**Sprint:** SPRINT-067
**Phase:** 5 (added mid-sprint)
**Priority:** HIGH
**Estimated Tokens:** ~25K
**Token Cap:** 100K
**Depends On:** None

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix the submission preview UI to show the actual count of downloaded attachments from the `attachments` table, rather than counting from email metadata JSON. Optionally show separate counts for text message and email attachments.

## Problem

Currently:
- UI uses `useTransactionAttachments` hook which counts from `attachment_metadata` JSON in communications
- Submission service counts actual downloaded files from `attachments` table
- This mismatch shows "0 files" in UI when there are actually downloaded attachments

## Deliverables

1. **New IPC Handler:** `transactions:get-attachment-counts` - Returns counts from attachments table
2. **Update:** `src/components/transactionDetailsModule/hooks/useTransactionAttachments.ts` - Use new IPC handler
3. **Update:** Display shows "X text, Y email attachments" or combined count

## Acceptance Criteria

- [ ] Submission preview shows actual downloaded attachment count
- [ ] Count matches what submission service will upload
- [ ] Optionally shows breakdown: "5 text message, 3 email attachments"
- [ ] All CI checks pass

## Implementation Notes

### New IPC Handler

```typescript
// electron/transaction-handlers.ts
ipcMain.handle(
  "transactions:get-attachment-counts",
  async (event, transactionId: string, auditStart?: string, auditEnd?: string) => {
    const db = databaseService.getRawDatabase();

    // Count text message attachments
    const textCount = db.prepare(`
      SELECT COUNT(DISTINCT a.id) as count
      FROM attachments a
      INNER JOIN messages m ON a.message_id = m.id
      INNER JOIN communications c ON (
        (c.message_id IS NOT NULL AND c.message_id = m.id)
        OR (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
      )
      WHERE c.transaction_id = ?
      AND a.storage_path IS NOT NULL
      ${auditStart ? 'AND m.sent_at >= ?' : ''}
      ${auditEnd ? 'AND m.sent_at <= ?' : ''}
    `).get(transactionId, ...[auditStart, auditEnd].filter(Boolean)) as { count: number };

    // Count email attachments
    const emailCount = db.prepare(`
      SELECT COUNT(DISTINCT a.id) as count
      FROM attachments a
      INNER JOIN emails e ON a.email_id = e.id
      INNER JOIN communications c ON c.email_id = e.id
      WHERE c.transaction_id = ?
      AND a.email_id IS NOT NULL
      AND a.storage_path IS NOT NULL
      ${auditStart ? 'AND e.sent_at >= ?' : ''}
      ${auditEnd ? 'AND e.sent_at <= ?' : ''}
    `).get(transactionId, ...[auditStart, auditEnd].filter(Boolean)) as { count: number };

    return {
      success: true,
      data: {
        textAttachments: textCount.count,
        emailAttachments: emailCount.count,
        total: textCount.count + emailCount.count
      }
    };
  }
);
```

### Update Hook

Update `useTransactionAttachments` to call this IPC handler and return accurate counts.

## Files to Modify

| File | Change |
|------|--------|
| `electron/transaction-handlers.ts` | Add `transactions:get-attachment-counts` handler |
| `electron/preload/transactionBridge.ts` | Add bridge method |
| `src/window.d.ts` | Add type declaration |
| `src/components/transactionDetailsModule/hooks/useTransactionAttachments.ts` | Use new IPC |

---

## Branch Information

**Branch From:** `int/SPRINT-067`
**Branch Name:** `feature/TASK-1781-fix-attachment-count-ui`
