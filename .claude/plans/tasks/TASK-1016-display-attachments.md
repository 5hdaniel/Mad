# Task TASK-1016: Display Attachments (Images/GIFs) in Text Messages

**STATUS: DEFERRED TO SPRINT-031**

This task has been deferred from SPRINT-030 because:
1. TASK-1013 + hotfixes consumed sprint capacity
2. This is a significant feature (~55K tokens) requiring new services and schema changes
3. Better to complete Phase 1 (TASK-1014, TASK-1015) thoroughly

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

Import and display image/GIF attachments from macOS Messages inline within message conversations. Currently, messages with attachments only show a placeholder text.

## Non-Goals

- Do NOT import video attachments (images/GIFs only for MVP)
- Do NOT add attachment editing or annotation features
- Do NOT implement cloud storage for attachments
- Do NOT add thumbnail generation (display originals, with size limits)
- Do NOT make attachment size limit configurable (see BACKLOG-189 for that)

## Deliverables

1. Update: `electron/services/macOSMessagesImportService.ts` - Import attachment files
2. Create: `electron/services/attachmentStorageService.ts` - Manage app-local attachment storage
3. Update: `electron/database/schema.sql` - Add attachments table or columns
4. Update: `src/components/transactionDetailsModule/components/MessageBubble.tsx` - Display inline images
5. Update: `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Handle attachment loading

## Acceptance Criteria

- [ ] Import attachments from macOS Messages database during sync
- [ ] Store attachments in app's data directory (not in SQLite)
- [ ] Display images inline in message bubbles
- [ ] Display GIFs with animation
- [ ] Show placeholder for unsupported formats (video, audio, etc.)
- [ ] Handle missing/deleted attachments gracefully (show "not found" placeholder)
- [ ] Works for both 1:1 and group conversations
- [ ] Respects existing 50MB size limit (skip larger files)
- [ ] All CI checks pass

## Implementation Notes

### macOS Messages Attachment Storage

Attachments are stored in `~/Library/Messages/Attachments/` with references in the `attachment` table.

Query to get attachments:
```sql
SELECT
  a.rowid,
  a.filename,
  a.mime_type,
  a.total_bytes,
  a.transfer_name,
  maj.message_id
FROM attachment a
JOIN message_attachment_join maj ON a.rowid = maj.attachment_id
WHERE a.mime_type LIKE 'image/%'
```

### App Storage Structure

```
~/Library/Application Support/Magic Audit/
  attachments/
    {message_id}/
      {attachment_id}_{filename}
```

### Attachment Storage Service

```typescript
// electron/services/attachmentStorageService.ts
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

const ATTACHMENTS_DIR = path.join(app.getPath('userData'), 'attachments');
const MAX_SIZE_MB = 50;

export async function storeAttachment(
  messageId: string,
  attachmentId: string,
  sourcePath: string,
  filename: string
): Promise<string | null> {
  const stats = await fs.stat(sourcePath);
  if (stats.size > MAX_SIZE_MB * 1024 * 1024) {
    console.warn(`Attachment ${filename} exceeds ${MAX_SIZE_MB}MB, skipping`);
    return null;
  }

  const destDir = path.join(ATTACHMENTS_DIR, messageId);
  await fs.mkdir(destDir, { recursive: true });

  const destPath = path.join(destDir, `${attachmentId}_${filename}`);
  await fs.copyFile(sourcePath, destPath);

  return destPath;
}

export async function getAttachmentPath(
  messageId: string,
  attachmentId: string,
  filename: string
): Promise<string | null> {
  const filePath = path.join(ATTACHMENTS_DIR, messageId, `${attachmentId}_${filename}`);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null; // File not found
  }
}
```

### Database Schema Addition

```sql
CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  local_path TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);
```

### Import Service Updates (macOSMessagesImportService.ts)

```typescript
async function importAttachments(messageId: string, messagesDbPath: string) {
  const attachmentQuery = `
    SELECT a.rowid, a.filename, a.mime_type, a.total_bytes
    FROM attachment a
    JOIN message_attachment_join maj ON a.rowid = maj.attachment_id
    WHERE maj.message_id = ?
      AND a.mime_type LIKE 'image/%'
  `;

  // ... query and copy each attachment
  for (const att of attachments) {
    const sourcePath = path.join(
      os.homedir(),
      'Library/Messages/Attachments',
      att.filename // May need path parsing
    );

    const localPath = await storeAttachment(
      messageId,
      att.rowid.toString(),
      sourcePath,
      path.basename(att.filename)
    );

    if (localPath) {
      await db.run(`
        INSERT INTO message_attachments (id, message_id, filename, mime_type, size_bytes, local_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [generateId(), messageId, att.filename, att.mime_type, att.total_bytes, localPath]);
    }
  }
}
```

### UI Updates (MessageBubble.tsx)

```tsx
interface AttachmentData {
  id: string;
  filename: string;
  mimeType: string;
  localPath: string;
}

interface MessageBubbleProps {
  message: Message;
  attachments?: AttachmentData[];
  // ... other props
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, attachments }) => {
  return (
    <div className="message-bubble">
      {/* Show attachments before message text */}
      {attachments && attachments.length > 0 && (
        <div className="message-attachments">
          {attachments.map(att => (
            <AttachmentPreview key={att.id} attachment={att} />
          ))}
        </div>
      )}
      <div className="message-text">{message.body}</div>
    </div>
  );
};

const AttachmentPreview: React.FC<{ attachment: AttachmentData }> = ({ attachment }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Load image from local path via IPC
    window.api.attachments.getFileUrl(attachment.localPath)
      .then(url => setImageSrc(url))
      .catch(() => setError(true));
  }, [attachment.localPath]);

  if (error) {
    return <div className="attachment-placeholder">Image not found</div>;
  }

  if (!imageSrc) {
    return <div className="attachment-loading">Loading...</div>;
  }

  return (
    <img
      src={imageSrc}
      alt={attachment.filename}
      className="attachment-image max-w-full rounded"
    />
  );
};
```

### IPC Handler for File Access

```typescript
// Add to preload.ts
attachments: {
  getFileUrl: (localPath: string) => ipcRenderer.invoke('attachments:getFileUrl', localPath)
}

// Add handler
ipcMain.handle('attachments:getFileUrl', async (event, localPath) => {
  // Convert local path to file:// URL or base64
  // Security: Validate path is within attachments directory
  const attachmentsDir = path.join(app.getPath('userData'), 'attachments');
  if (!localPath.startsWith(attachmentsDir)) {
    throw new Error('Invalid attachment path');
  }

  const data = await fs.readFile(localPath);
  const mimeType = getMimeType(localPath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
});
```

## Integration Notes

- Imports from: macOS Messages database
- Exports to: Message display components
- Used by: ConversationViewModal, MessageBubble
- Depends on: Phase 1 tasks complete (TASK-1013, 1014, 1015)

## Do / Don't

### Do:
- Validate attachment paths are within expected directories (security)
- Handle missing files gracefully
- Show loading states while fetching attachments
- Log import errors but don't fail the entire import

### Don't:
- Store attachments in SQLite (use filesystem)
- Import videos or audio (images only for now)
- Implement thumbnail generation
- Add attachment deletion features

## When to Stop and Ask

- If macOS Messages attachment storage differs significantly from expected
- If file permissions prevent copying attachments
- If the attachment table structure is different than documented
- If implementing IPC for file access is more complex than expected

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Attachment storage service functions
  - Attachment import logic
  - AttachmentPreview component
- Existing tests to update:
  - MessageBubble tests (new attachment prop)

### Coverage

- Coverage impact: Should increase slightly with new code

### Integration / Feature Tests

- Required scenarios:
  - Import message with image attachment
  - Display attachment in conversation view
  - Handle missing attachment gracefully

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(messages): display image/GIF attachments inline`
- **Labels**: `enhancement`, `feature`, `messages`
- **Depends on**: TASK-1013, TASK-1014, TASK-1015 (Phase 1 complete)

---

## PM Estimate (PM-Owned)

**Category:** `service` + `ui` (significant feature)

**Estimated Tokens:** ~50-55K

**Token Cap:** 220K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| New service creation | attachmentStorageService.ts | +15K |
| Import service updates | Complex attachment querying | +15K |
| UI components | AttachmentPreview, MessageBubble updates | +10K |
| Schema changes | New table, migration | +5K |
| IPC handlers | File access security | +5K |
| Tests | Medium complexity | +5K |

**Confidence:** Medium

**Risk factors:**
- macOS attachment storage may be more complex than documented
- File permission issues on macOS
- IPC file access patterns unfamiliar

**Similar past tasks:** TASK-1012 attempted attachments, ~591K tokens (but was full feature including video)

**Note:** This is a STRETCH GOAL. If Phase 1 takes longer than expected, this task may be deferred to SPRINT-031.

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
- [ ] attachmentStorageService.ts

Files modified:
- [ ] macOSMessagesImportService.ts
- [ ] schema.sql
- [ ] MessageBubble.tsx
- [ ] ConversationViewModal.tsx
- [ ] preload.ts (IPC)
- [ ] relevant handlers

Features implemented:
- [ ] Attachment import during sync
- [ ] Attachment storage service
- [ ] Inline image display
- [ ] GIF animation
- [ ] Missing file handling

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
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~55K vs Actual ~XK (X% over/under)

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

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~55K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

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
