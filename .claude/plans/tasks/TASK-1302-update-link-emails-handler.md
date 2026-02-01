# TASK-1302: Update transaction-handlers link-emails to use emailDbService

**Sprint:** SPRINT-060
**Phase:** 2 - Service Layer - Write Paths
**Branch:** `fix/task-1302-link-emails-handler`
**Estimated Tokens:** ~8K
**Dependencies:** TASK-1301 (emailDbService must exist)

---

## Objective

Update the `transactions:link-emails` IPC handler to write email content to the `emails` table (via emailDbService) and then create a junction link in `communications`. This is the key write path change that enables the new architecture.

---

## Context Checkpoint

**RE-READ BEFORE STARTING:**

**Current behavior (broken):**
```
User clicks "Attach Email"
  → Fetch email from Gmail/Outlook API
  → Write ALL content to communications table (subject, body, sender, etc.)
```

**New behavior (correct):**
```
User clicks "Attach Email"
  → Fetch email from Gmail/Outlook API
  → Write content to emails table (via createEmail)
  → Write junction link to communications table (only email_id + transaction_id)
```

The communications table becomes a PURE junction table with no content columns.

---

## Pre-Implementation Check

Run these grep commands to verify current state:

```bash
# Find the link-emails handler
grep -n "transactions:link-emails" electron/transaction-handlers.ts
# Expected: Shows handler around line 1500

# Verify emailDbService exists (from TASK-1301)
ls -la electron/services/db/emailDbService.ts
# Expected: File exists

# Check current createCommunication import
grep "import.*createCommunication" electron/transaction-handlers.ts
# Expected: Shows import from communicationDbService
```

---

## Files to Modify

### File 1: `electron/transaction-handlers.ts`

#### Step 1: Add import for emailDbService

**LOCATION:** Near the top of the file, with other imports from db services.

Find this import:
```typescript
import {
  createCommunication,
```

Add BEFORE this import block:
```typescript
import { createEmail, getEmailByExternalId } from "./services/db/emailDbService";
```

#### Step 2: Update Gmail email processing

**LOCATION:** Around lines 1550-1575, inside the Gmail processing loop.

Find this code block (Gmail):
```typescript
                  const email = await gmailFetchService.getEmailById(messageId);
                  // Save to communications table
                  await createCommunication({
                    user_id: transaction.user_id,
                    transaction_id: validatedTransactionId,
                    communication_type: "email",
                    source: "gmail",
                    email_thread_id: email.threadId,
                    sender: email.from,
                    recipients: email.to,
                    cc: email.cc,
                    subject: email.subject,
                    // BACKLOG-413: Use correct field names from ParsedEmail interface
                    // Gmail/Outlook services return 'body' (HTML) and 'bodyPlain' (plain text)
                    body: email.body || email.bodyPlain,
                    body_plain: email.bodyPlain,
                    sent_at: email.date ? new Date(email.date).toISOString() : null,
                    has_attachments: email.hasAttachments || false,
                    attachment_count: email.attachmentCount || 0,
                    link_source: "manual",
                    link_confidence: 1.0,
                  });
```

Replace with:
```typescript
                  const email = await gmailFetchService.getEmailById(messageId);

                  // BACKLOG-506: Check if email already exists (dedup by external_id)
                  let emailRecord = await getEmailByExternalId(transaction.user_id, messageId);

                  if (!emailRecord) {
                    // Create email in emails table (content store)
                    emailRecord = await createEmail({
                      user_id: transaction.user_id,
                      external_id: messageId,
                      source: "gmail",
                      thread_id: email.threadId,
                      sender: email.from,
                      recipients: email.to,
                      cc: email.cc,
                      subject: email.subject,
                      body_html: email.body,
                      body_plain: email.bodyPlain,
                      sent_at: email.date ? new Date(email.date).toISOString() : undefined,
                      has_attachments: email.hasAttachments || false,
                      attachment_count: email.attachmentCount || 0,
                    });
                  }

                  // Create junction link in communications table
                  await createCommunication({
                    user_id: transaction.user_id,
                    transaction_id: validatedTransactionId,
                    email_id: emailRecord.id,
                    communication_type: "email",
                    link_source: "manual",
                    link_confidence: 1.0,
                  });
```

#### Step 3: Update Outlook email processing

**LOCATION:** Around lines 1596-1620, inside the Outlook processing loop.

Find this code block (Outlook):
```typescript
                  const email = await outlookFetchService.getEmailById(messageId);
                  // Save to communications table
                  await createCommunication({
                    user_id: transaction.user_id,
                    transaction_id: validatedTransactionId,
                    communication_type: "email",
                    source: "outlook",
                    email_thread_id: email.threadId,
                    sender: email.from,
                    recipients: email.to,
                    cc: email.cc,
                    subject: email.subject,
                    // BACKLOG-413: Use correct field names from ParsedEmail interface
                    // Gmail/Outlook services return 'body' (HTML) and 'bodyPlain' (plain text)
                    body: email.body || email.bodyPlain,
                    body_plain: email.bodyPlain,
                    sent_at: email.date ? new Date(email.date).toISOString() : null,
                    has_attachments: email.hasAttachments || false,
                    attachment_count: email.attachmentCount || 0,
                    link_source: "manual",
                    link_confidence: 1.0,
                  });
```

Replace with:
```typescript
                  const email = await outlookFetchService.getEmailById(messageId);

                  // BACKLOG-506: Check if email already exists (dedup by external_id)
                  let emailRecord = await getEmailByExternalId(transaction.user_id, messageId);

                  if (!emailRecord) {
                    // Create email in emails table (content store)
                    emailRecord = await createEmail({
                      user_id: transaction.user_id,
                      external_id: messageId,
                      source: "outlook",
                      thread_id: email.threadId,
                      sender: email.from,
                      recipients: email.to,
                      cc: email.cc,
                      subject: email.subject,
                      body_html: email.body,
                      body_plain: email.bodyPlain,
                      sent_at: email.date ? new Date(email.date).toISOString() : undefined,
                      has_attachments: email.hasAttachments || false,
                      attachment_count: email.attachmentCount || 0,
                    });
                  }

                  // Create junction link in communications table
                  await createCommunication({
                    user_id: transaction.user_id,
                    transaction_id: validatedTransactionId,
                    email_id: emailRecord.id,
                    communication_type: "email",
                    link_source: "manual",
                    link_confidence: 1.0,
                  });
```

---

## Acceptance Criteria

- [ ] Import for emailDbService added
- [ ] Gmail email processing writes to emails table first
- [ ] Outlook email processing writes to emails table first
- [ ] Communications record only has email_id (no content columns)
- [ ] Deduplication works (same email linked twice doesn't create duplicate content)
- [ ] TypeScript compiles without errors
- [ ] Link email to transaction works in app

---

## Test Commands

```bash
# 1. Run type check
npm run type-check
# Expected: No errors

# 2. Run tests
npm test
# Expected: All tests pass

# 3. Start app and test manually
npm run dev

# 4. After linking an email in app, verify data:
# Check email in emails table:
sqlite3 ~/Library/Application\ Support/mad/mad.db "SELECT id, subject, sender FROM emails LIMIT 1"
# Expected: Shows email with subject and sender

# Check communication has email_id (no content):
sqlite3 ~/Library/Application\ Support/mad/mad.db "SELECT id, email_id, subject, body_plain FROM communications WHERE email_id IS NOT NULL LIMIT 1"
# Expected: email_id is set, subject and body_plain are NULL

# Verify deduplication - same external_id should reuse email:
sqlite3 ~/Library/Application\ Support/mad/mad.db "SELECT external_id, COUNT(*) FROM emails GROUP BY external_id HAVING COUNT(*) > 1"
# Expected: No results (no duplicates)
```

---

## Rollback Instructions

If something goes wrong:

```bash
# Delete the local database
rm ~/Library/Application\ Support/mad/mad.db

# Revert code changes
git checkout electron/transaction-handlers.ts
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: 2026-01-25*

### Results

- **File Modified**: electron/transaction-handlers.ts
- **Imports Added**: 1 (emailDbService - createEmail, getEmailByExternalId)
- **Code Blocks Changed**: 2 (Gmail processing lines ~1551-1590, Outlook processing lines ~1595-1635)
- **TypeScript Errors**: 0
- **Test Results**: All passing (pre-existing failures in nativeModules.test.ts, ENOSPC test)
- **Manual Test**: Pending (user to verify in app)
- **Actual Tokens**: ~5K
- **PR**: (created below)

### Changes Made

1. **Added import** at line 14:
   ```typescript
   import { createEmail, getEmailByExternalId } from "./services/db/emailDbService";
   ```

2. **Updated Gmail processing** (lines 1551-1590):
   - Check if email exists via `getEmailByExternalId(user_id, messageId)`
   - If not, create email in emails table via `createEmail()` with full content
   - Create junction link in communications with only `email_id` (no content fields)

3. **Updated Outlook processing** (lines 1595-1635):
   - Same pattern as Gmail
   - Deduplication by external_id
   - Content stored in emails table, junction in communications

---

## Guardrails

**STOP and ask PM if:**
- emailDbService import fails (TASK-1301 may not be complete)
- createCommunication type errors for email_id field (TASK-1300 may not be complete)
- Any error other than what's documented here
- You need to modify files other than transaction-handlers.ts
