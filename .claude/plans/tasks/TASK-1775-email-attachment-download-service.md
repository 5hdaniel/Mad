# Task TASK-1775: Email Attachment Download Service

**Sprint:** SPRINT-067
**Phase:** 1 (Foundation)
**Priority:** HIGH
**Estimated Tokens:** ~45K
**Token Cap:** 180K

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

Create a service to download email attachments from Gmail/Outlook APIs and store them locally in the `attachments` table with `storage_path`, following the existing pattern used for text message attachments.

## Non-Goals

- Do NOT implement on-demand download UI (that's TASK-1776)
- Do NOT modify export functionality (that's TASK-1777)
- Do NOT implement thumbnail generation
- Do NOT implement video/audio preview
- Do NOT download attachments larger than 50MB

## Deliverables

1. **New:** `electron/services/emailAttachmentService.ts` - Main service for downloading/storing email attachments
2. **Update:** `electron/services/gmailFetchService.ts` - Expose attachment download capability
3. **Update:** `electron/services/outlookFetchService.ts` - Add attachment download method
4. **Update:** `electron/services/transactionService.ts` - Call attachment download during email linking
5. **Update:** `electron/preload.ts` - Add IPC handler for attachment operations

## Acceptance Criteria

- [ ] Email attachments are downloaded when emails are linked to a transaction
- [ ] Attachments are stored in `~/Library/Application Support/Magic Audit/attachments/`
- [ ] Attachment records are created in `attachments` table with `storage_path`
- [ ] Gmail attachments download correctly using existing `getAttachment()` method
- [ ] Outlook attachments download correctly via Graph API
- [ ] Content hash deduplication prevents duplicate file storage
- [ ] Attachments over 50MB are skipped with warning log
- [ ] Failed downloads don't break the email linking flow
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Service Architecture

Create `electron/services/emailAttachmentService.ts`:

```typescript
/**
 * Email Attachment Service
 * Downloads and stores email attachments from Gmail/Outlook
 *
 * Pattern follows macOSMessagesImportService for consistency
 */
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { app } from "electron";
import databaseService from "./databaseService";
import gmailFetchService from "./gmailFetchService";
import outlookFetchService from "./outlookFetchService";
import logService from "./logService";

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB
const ATTACHMENTS_DIR = path.join(app.getPath("userData"), "attachments");

export interface EmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string; // Gmail attachment ID or Outlook attachment ID
}

export interface DownloadResult {
  success: boolean;
  stored: number;
  skipped: number;
  errors: number;
}

class EmailAttachmentService {
  /**
   * Download and store attachments for an email
   */
  async downloadEmailAttachments(
    userId: string,
    emailId: string,
    externalEmailId: string,
    source: "gmail" | "outlook",
    attachments: EmailAttachmentMeta[]
  ): Promise<DownloadResult> {
    // Implementation here
  }

  /**
   * Generate content hash for deduplication
   */
  private async generateContentHash(buffer: Buffer): Promise<string> {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Store attachment file and create database record
   */
  private async storeAttachment(
    userId: string,
    emailId: string,
    externalEmailId: string,
    filename: string,
    mimeType: string,
    data: Buffer
  ): Promise<boolean> {
    // Implementation here
  }
}

export default new EmailAttachmentService();
```

### Gmail Download Flow

```typescript
// In emailAttachmentService.ts
private async downloadGmailAttachment(
  externalEmailId: string,
  attachmentId: string
): Promise<Buffer> {
  // gmailFetchService already has getAttachment() method
  return gmailFetchService.getAttachment(externalEmailId, attachmentId);
}
```

### Outlook Download Flow

Add to `outlookFetchService.ts`:

```typescript
/**
 * Get email attachment content
 * @param messageId - Outlook message ID
 * @param attachmentId - Attachment ID
 * @returns Attachment content as Buffer
 */
async getAttachment(
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const url = `${this.graphApiUrl}/me/messages/${messageId}/attachments/${attachmentId}`;

  const response = await this._throttledCall(() =>
    axios.get<GraphAttachment>(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })
  );

  // Graph API returns base64-encoded contentBytes
  if (response.data.contentBytes) {
    return Buffer.from(response.data.contentBytes, "base64");
  }

  throw new Error("No attachment content returned");
}
```

### Database Record Pattern

Follow the existing `attachments` table schema:

```sql
-- From schema.sql line 270-296
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,           -- Link to email record
  external_message_id TEXT,           -- Gmail/Outlook message ID
  filename TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes INTEGER,
  storage_path TEXT,                  -- Local file path
  text_content TEXT,                  -- OCR/extracted text (future)
  document_type TEXT,
  document_type_confidence REAL,
  document_type_source TEXT,
  analysis_metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES emails(id) ON DELETE CASCADE
);
```

### Storage Pattern

Match text message attachment storage:

```typescript
const attachmentsDir = path.join(app.getPath("userData"), "attachments");
await fs.mkdir(attachmentsDir, { recursive: true });

// Use content hash as filename for deduplication
const contentHash = await this.generateContentHash(data);
const ext = path.extname(filename) || this.guessExtension(mimeType);
const storagePath = path.join(attachmentsDir, `${contentHash}${ext}`);

// Check if file already exists (deduplication)
try {
  await fs.access(storagePath);
  // File exists, just create DB record pointing to it
} catch {
  // File doesn't exist, write it
  await fs.writeFile(storagePath, data);
}
```

### Integration Point

In `transactionService.ts`, call attachment download after email linking:

```typescript
// After creating email record and communication link
if (originalEmail.attachments && originalEmail.attachments.length > 0) {
  await emailAttachmentService.downloadEmailAttachments(
    userId,
    emailRecord.id,
    originalEmail.id,  // External Gmail/Outlook ID
    source,            // "gmail" or "outlook"
    originalEmail.attachments
  );
}
```

### Error Handling

```typescript
try {
  const data = await this.downloadAttachment(source, externalEmailId, att.attachmentId);
  // Store attachment...
} catch (error) {
  // Log but don't fail the entire email link
  logService.warn("[Email Attachments] Failed to download attachment", "EmailAttachments", {
    filename: att.filename,
    error: error instanceof Error ? error.message : "Unknown error",
  });
  result.errors++;
  continue;
}
```

## Integration Notes

- **Imports from:** `gmailFetchService`, `outlookFetchService`, `databaseService`, `logService`
- **Exports to:** Used by `transactionService.ts` when linking emails
- **Used by:** TASK-1776 (UI display), TASK-1777 (export)
- **Depends on:** None (foundation task)

## Do / Don't

### Do:
- Follow the existing attachment storage pattern from macOSMessagesImportService
- Use content hash for deduplication (same file from different emails = one copy)
- Log all download attempts (success and failure)
- Handle OAuth token refresh gracefully
- Skip oversized attachments with warning

### Don't:
- Don't fail the entire email link if one attachment fails
- Don't download attachments larger than 50MB
- Don't block the UI during downloads (async)
- Don't store duplicate files (use content hash)
- Don't modify the attachment_metadata JSON (it's still useful)

## When to Stop and Ask

- If Gmail API returns unexpected attachment format
- If Outlook Graph API pagination is needed for large attachments
- If storage space concerns arise (need discussion on limits)
- If OAuth refresh fails repeatedly
- If the `attachments` table FK constraint causes issues

## Testing Expectations

### Unit Tests

**Required:** Yes

**New tests to write:**
- `electron/services/__tests__/emailAttachmentService.test.ts`
  - Test download flow with mocked Gmail API
  - Test download flow with mocked Outlook API
  - Test deduplication (same content = one file)
  - Test oversized attachment skip
  - Test error handling (API failure doesn't crash)

**Existing tests to update:**
- `transactionService.test.ts` - Mock attachment download calls

### Coverage
- Coverage impact: Should increase with new service

### Integration / Feature Tests
- Mock email APIs with attachment responses
- Verify attachment records created with storage_path
- Verify files appear in app data directory

### CI Requirements
- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title:** `feat(email): download and store email attachments from Gmail/Outlook`
- **Labels:** `email`, `attachments`, `feature`
- **Depends on:** None

---

## PM Estimate (PM-Owned)

**Category:** `service` (apply 0.5x multiplier)

**Estimated Tokens:** ~45K

**Token Cap:** 180K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| New service creation | emailAttachmentService.ts | +15K |
| Gmail integration | Uses existing getAttachment | +5K |
| Outlook integration | New getAttachment method | +10K |
| Database integration | Insert attachment records | +5K |
| Error handling | Robust, non-blocking | +5K |
| Tests | Medium complexity | +5K |

**Confidence:** Medium

**Risk factors:**
- Outlook API attachment format may differ from docs
- OAuth token handling during download
- Large attachment handling

---

## Branch Information (Set by SR Engineer during Technical Review)

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** feature/TASK-1775-email-attachment-download

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/services/emailAttachmentService.ts
- [ ] electron/services/__tests__/emailAttachmentService.test.ts

Files modified:
- [ ] electron/services/outlookFetchService.ts (add getAttachment)
- [ ] electron/services/transactionService.ts (call download)
- [ ] electron/preload.ts (IPC if needed)

Features implemented:
- [ ] Gmail attachment download
- [ ] Outlook attachment download
- [ ] Local file storage with dedup
- [ ] Database record creation
- [ ] Error handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~45K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
