# Task TASK-1777: Include Email Attachments in Export

**Sprint:** SPRINT-067
**Phase:** 3
**Priority:** HIGH
**Estimated Tokens:** ~25K
**Token Cap:** 100K
**Depends On:** TASK-1775

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Extend the `exportAttachments()` method in `folderExportService.ts` to include email attachments (stored in the `attachments` table) alongside text message attachments in the audit package export.

## Non-Goals

- Do NOT modify the attachment download service (that's TASK-1775)
- Do NOT modify the UI display (that's TASK-1776)
- Do NOT change the folder structure (attachments/ folder already exists)
- Do NOT implement attachment preview in export
- Do NOT download attachments during export (they should already be stored)

## Deliverables

1. **Update:** `electron/services/folderExportService.ts` - Query email attachments and include in export

## Acceptance Criteria

- [ ] Email attachments are copied to attachments/ folder during export
- [ ] manifest.json includes email attachments with `messageType: "email"`
- [ ] Email attachments show email subject as `originalMessage`
- [ ] Missing email attachment files are logged and noted in manifest
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)
- [ ] Existing text message attachment export still works

## Implementation Notes

### Current State

The `exportAttachments()` method (line 1427-1698) currently:
1. Receives `communications` array (emails + texts)
2. Queries `attachments` table by `message_id` matching `comm.message_id` or `comm.id`
3. Copies files from `storage_path` to export folder
4. Creates manifest.json

**The problem:** Email attachments are now stored with `message_id` pointing to the `emails.id`, but the `communications` array passes `email_id` (the junction link) not the actual email content ID.

### Fix Required

Update the query to handle email attachments:

```typescript
// In exportAttachments()

// For emails: message_id in attachments table points to emails.id
// The communication has email_id which is the emails.id

// Build list of email IDs from communications
const emailIds = communications
  .filter((comm) => comm.communication_type === "email" && comm.email_id)
  .map((comm) => comm.email_id) as string[];

// Build list of message IDs from text messages
const textMessageIds = communications
  .filter((comm) =>
    comm.communication_type === "sms" ||
    comm.communication_type === "imessage" ||
    comm.communication_type === "text"
  )
  .map((comm) => comm.message_id || comm.id)
  .filter(Boolean) as string[];

// Combine all IDs for attachment query
const allMessageIds = [...emailIds, ...textMessageIds];
```

### Updated Query Pattern

```typescript
// Query attachments for both email IDs and text message IDs
const placeholders = allMessageIds.map(() => "?").join(", ");
const attachmentRows = db
  .prepare(`
    SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
    FROM attachments
    WHERE message_id IN (${placeholders})
  `)
  .all(...allMessageIds);
```

### Map Building

Update the map to handle both email and text communications:

```typescript
// Map email_id to communication for emails
const emailIdToComm = new Map<string, Communication>();
const emailIdToCommIndex = new Map<string, number>();

communications.forEach((comm, index) => {
  if (comm.communication_type === "email" && comm.email_id) {
    emailIdToComm.set(comm.email_id, comm);
    emailIdToCommIndex.set(comm.email_id, index + 1);
  }
  // Existing text message mapping...
  if (comm.message_id) {
    messageIdToComm.set(comm.message_id, comm);
    messageIdToCommIndex.set(comm.message_id, index + 1);
  }
  if (comm.id) {
    messageIdToComm.set(comm.id, comm);
    messageIdToCommIndex.set(comm.id, index + 1);
  }
});
```

### Communication Lookup

When processing each attachment, look up in both maps:

```typescript
for (const att of attachmentRows) {
  // Try email lookup first (attachment.message_id = emails.id)
  let comm = emailIdToComm.get(att.message_id);
  let commIndex = emailIdToCommIndex.get(att.message_id);

  // Fall back to text message lookup
  if (!comm) {
    comm = messageIdToComm.get(att.message_id);
    commIndex = messageIdToCommIndex.get(att.message_id);
  }

  // ... rest of export logic
}
```

### Manifest Entry for Emails

Ensure `getOriginalMessage` handles emails properly (it already does):

```typescript
const getOriginalMessage = (comm: Communication): string => {
  const type = getMessageType(comm);
  if (type === "email") {
    return comm.subject || "(No Subject)";  // Email subject
  }
  // Text message handling...
};
```

### Test Case

Add test for email attachment export:

```typescript
it("should export email attachments to attachments folder", async () => {
  // Mock email communication with attachment
  const mockEmail: Communication = {
    id: "comm-1",
    email_id: "email-1",
    communication_type: "email",
    subject: "Contract Review",
    has_attachments: true,
    // ...
  };

  // Mock attachment record
  // attachment.message_id = "email-1" (points to emails.id)

  // Execute export

  // Assert: attachment file copied to output
  // Assert: manifest includes email attachment with messageType: "email"
});
```

## Integration Notes

- **Imports from:** `databaseService`, `fs/promises`, `path`
- **Exports to:** Audit package folder
- **Used by:** Users exporting audit packages
- **Depends on:** TASK-1775 (attachments must exist in database with storage_path)

## Do / Don't

### Do:
- Query attachments by both email_id and message_id
- Include email subject as original message reference
- Log email attachments separately from text attachments in summary
- Handle missing files gracefully (note in manifest, don't fail)

### Don't:
- Don't try to download attachments during export (should already be stored)
- Don't change the manifest format (add to existing structure)
- Don't break existing text message attachment export
- Don't duplicate files (same dedup logic)

## When to Stop and Ask

- If email_id vs message_id linking is unclear
- If the attachment query returns unexpected results
- If performance issues arise with many email attachments
- If storage_path is missing for email attachments

## Testing Expectations

### Unit Tests

**Required:** Yes

**Existing tests to update:**
- `electron/services/__tests__/folderExportService.test.ts`
  - Add test for email attachment export
  - Add test for mixed email + text attachment export
  - Add test for missing email attachment file handling

### Coverage
- Coverage impact: Should maintain or increase

### Manual Testing
- Export audit package for transaction with email attachments
- Verify email attachment files in attachments/ folder
- Verify manifest.json includes email attachments with `messageType: "email"`
- Verify text message attachments still export correctly

### CI Requirements
- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title:** `feat(export): include email attachments in audit package export`
- **Labels:** `export`, `attachments`, `feature`
- **Depends on:** TASK-1775

---

## PM Estimate (PM-Owned)

**Category:** `service` (apply 0.5x multiplier)

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Query update | Add email_id handling | +8K |
| Map building | Handle email communications | +5K |
| Testing | Add/update tests | +7K |
| Integration | Verify with existing code | +5K |

**Confidence:** High (similar work done in TASK-1141)

---

## Branch Information (Set by SR Engineer during Technical Review)

**Branch From:** develop (after TASK-1775 merges)
**Branch Into:** develop
**Branch Name:** feature/TASK-1777-export-email-attachments

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] None (updating existing)

Files modified:
- [ ] electron/services/folderExportService.ts
- [ ] electron/services/__tests__/folderExportService.test.ts

Features implemented:
- [ ] Email attachment query
- [ ] Email_id to communication mapping
- [ ] Email attachments in manifest
- [ ] Updated logging

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual export test with email attachments
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document any>

**Issues encountered:**
<Document any>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

```
SR Engineer Agent ID: <agent_id>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
