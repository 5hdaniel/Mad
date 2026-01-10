# TASK-1012: Display Attachments (Images/GIFs) in Text Messages

**Backlog ID:** BACKLOG-187
**Sprint:** SPRINT-029
**Phase:** Phase 2 - Message Attachments
**Branch:** `feature/TASK-1012-message-attachments`
**Estimated Tokens:** ~50K
**Token Cap:** 200K

---

## Objective

Import and display image and GIF attachments inline within text message conversations. Currently, messages with attachments only show placeholder text ("[Attachment - Photo/Video/File]"). This feature will import actual attachment files and display them inline in message bubbles.

---

## Context

This is an audit-critical feature. Real estate agents often share property photos, contracts, and documents via text message. These attachments are important evidence in transaction audits.

**Current Behavior:**
- Messages with attachments show placeholder text: "[Attachment - Photo/Video/File]"
- `has_attachments` flag is stored but actual files are not imported
- No visual preview of images/GIFs

**Desired Behavior:**
1. Import attachment files from macOS Messages storage
2. Store attachments in app's data directory
3. Display images/GIFs inline in message bubbles
4. Support common formats: JPG, PNG, GIF, HEIC
5. Show thumbnail with option to view full size

---

## Requirements

### Must Do:
1. Query macOS Messages `attachment` table during import
2. Copy attachment files to app's data directory
3. Store attachment metadata (path, type, size) in database
4. Update ConversationViewModal to render inline images
5. Display GIFs with animation
6. Handle missing/deleted attachments gracefully
7. Work for both 1:1 and group conversations

### Must NOT Do:
- Import video files (too large, out of scope for MVP)
- Modify original macOS Messages storage
- Store duplicate copies of large files without deduplication
- Break existing message import/display functionality

---

## Technical Notes

### macOS Messages Attachment Storage

Attachments are stored in `~/Library/Messages/Attachments/` with references in the `attachment` table.

### Implementation Steps

1. **Schema Update:** Add attachment metadata to messages table or create new attachments table
2. **Import Service:** Query `attachment` table and copy files during import
3. **Storage:** Use app's data directory with deduplication (content hash)
4. **UI:** Update ConversationViewModal to render inline images
5. **Error Handling:** Show placeholder for missing/unsupported attachments

### Storage Considerations

- Attachments can be large (photos)
- Consider thumbnail generation for preview
- May need cleanup/pruning strategy
- Respect user's storage preferences

---

## Acceptance Criteria

- [ ] Import attachments from macOS Messages database
- [ ] Store attachments in app's data directory
- [ ] Display images inline in message bubbles
- [ ] Display GIFs with animation
- [ ] Show placeholder for unsupported formats
- [ ] Handle missing attachments gracefully
- [ ] Works for both 1:1 and group conversations
- [ ] All existing tests pass
- [ ] New tests added for attachment import/display

---

## Files to Modify

- `electron/services/macOSMessagesImportService.ts` - Add attachment import
- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Display attachments
- Database schema (migration) - Add attachment metadata
- `electron/preload.ts` - IPC for attachment access if needed

## Files to Read (for context)

- `electron/services/macOSMessagesImportService.ts` - Current import implementation
- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Current message display
- `electron/services/databaseService/core/` - Database schema patterns

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  - Attachment import tests (mock macOS Messages)
  - Attachment display tests (render images)
  - Error handling tests (missing files)
- **Existing tests to update:** Message import tests may need updates

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(messages): display image and GIF attachments inline`
- **Branch:** `feature/TASK-1012-message-attachments`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- macOS Messages attachment table structure differs from expected
- Attachment file permissions prevent copying
- Storage requirements exceed reasonable limits (>500MB per conversation)
- HEIC conversion proves problematic
- You encounter blockers not covered in the task file
