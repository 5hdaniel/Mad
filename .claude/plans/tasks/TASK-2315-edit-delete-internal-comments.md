# TASK-2315: Edit/Delete Internal Comments on Support Tickets

**Backlog ID:** BACKLOG-1344
**Sprint:** SPRINT-O
**Branch:** `feature/task-2315-edit-delete-internal-comments`
**Branch From:** `int/identity-provisioning`
**Branch Into:** `int/identity-provisioning`
**Estimated Tokens:** ~25K

---

## Objective

Allow agents to edit or delete their own internal comments (internal_note messages) on support tickets. External replies must NOT be editable or deletable since they are sent as emails.

---

## Context

- Support ticket messages are stored in `support_ticket_messages`
- Schema: `id, ticket_id, sender_id, sender_email, sender_name, message_type, body, created_at, search_vector`
- `message_type` values: `internal_note`, `reply`
- Internal notes have amber/yellow background with lock icon in the ActivityTimeline
- Currently there is no way to edit or delete any message after posting
- Only internal notes should be editable/deletable (replies are emailed to customers)

---

## Requirements

### Must Do:

**Schema Migration:**
1. Add `edited_at TIMESTAMPTZ DEFAULT NULL` column to `support_ticket_messages`
2. Add `edited_by UUID REFERENCES auth.users(id) DEFAULT NULL` column to `support_ticket_messages`
3. Migration should be additive only (no breaking changes)

**Backend (RPCs):**
4. Create `support_edit_internal_note(p_message_id UUID, p_body TEXT)` RPC that:
   - Verifies the message exists and is `message_type = 'internal_note'`
   - Verifies the caller is the original `sender_id`
   - Updates `body`, sets `edited_at = now()`, `edited_by = auth.uid()`
   - Updates `search_vector` with the new body text
   - Returns the updated message
5. Create `support_delete_internal_note(p_message_id UUID)` RPC that:
   - Verifies the message exists and is `message_type = 'internal_note'`
   - Verifies the caller is the original `sender_id`
   - Deletes the message
   - Logs an event in `support_ticket_events` (action: `internal_note_deleted`)

**Frontend:**
6. In `ActivityTimeline.tsx` (or the message card subcomponent), add edit/delete buttons on internal_note messages where `sender_id` matches the current user:
   - Pencil icon for edit
   - Trash icon for delete
   - Only show on hover or as small subtle icons
7. Edit flow:
   - Clicking edit replaces the message body with an inline textarea (pre-filled with current text)
   - Save and Cancel buttons below the textarea
   - On save, call the edit RPC and refresh the timeline
8. Delete flow:
   - Clicking delete shows a confirmation dialog (inline or modal)
   - "Are you sure you want to delete this internal note? This cannot be undone."
   - On confirm, call the delete RPC and refresh the timeline
9. Show "(edited)" indicator on messages where `edited_at IS NOT NULL`
   - Small gray text next to the timestamp, e.g., "Mar 23, 2026 2:30 PM (edited)"

### Must NOT Do:
- Do NOT allow editing or deleting `reply` type messages (external emails)
- Do NOT allow editing/deleting other users' messages
- Do NOT add undo functionality (hard delete is fine for internal notes)
- Do NOT modify the ReplyComposer component

---

## Acceptance Criteria

- [ ] Schema migration adds `edited_at` and `edited_by` columns to `support_ticket_messages`
- [ ] `support_edit_internal_note` RPC works and validates ownership + message_type
- [ ] `support_delete_internal_note` RPC works and validates ownership + message_type
- [ ] Edit/delete buttons appear ONLY on internal_note messages authored by current user
- [ ] Edit/delete buttons do NOT appear on reply messages
- [ ] Edit/delete buttons do NOT appear on other users' internal notes
- [ ] Clicking edit opens inline editor with current text
- [ ] Saving edit updates the message and shows "(edited)" indicator
- [ ] Clicking delete shows confirmation before deleting
- [ ] After delete, message is removed from timeline
- [ ] `npm run type-check` passes
- [ ] Admin portal builds successfully

---

## Files to Modify

- **NEW migration** in `supabase/migrations/` -- Add edited_at, edited_by columns
- **NEW RPCs** in `supabase/migrations/` -- support_edit_internal_note, support_delete_internal_note
- `admin-portal/lib/support-queries.ts` -- Add editInternalNote() and deleteInternalNote() functions
- `admin-portal/lib/support-types.ts` -- Add edited_at, edited_by to SupportTicketMessage type
- `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx` -- Add edit/delete UI to message cards

## Files to Read (for context)

- `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx` -- Current message rendering
- `admin-portal/app/dashboard/support/components/ConversationThread.tsx` -- Message card patterns
- `admin-portal/lib/support-types.ts` -- Current type definitions
- `admin-portal/lib/support-queries.ts` -- Current query patterns
- Existing RPC patterns in `supabase/migrations/` for support_* functions

---

## Implementation Notes

### Message Card Edit/Delete Buttons

Add to the internal_note message card (the one with amber background):

```tsx
{isNote && isOwnMessage && (
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-gray-600">
      <Pencil className="h-3.5 w-3.5" />
    </button>
    <button onClick={() => setConfirmDelete(true)} className="p-1 text-gray-400 hover:text-red-500">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  </div>
)}
```

### Current User Detection

The admin portal likely has a user context/hook. Check for:
- `useAuth()` or similar hook that provides the current user's ID
- Compare with `message.sender_id`

### Edited Indicator

```tsx
{message.edited_at && (
  <span className="text-xs text-gray-400 ml-1">(edited)</span>
)}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI component + RPC, tested via manual QA)
- **RPC testing:** Test via Supabase SQL editor or admin portal UI

### Manual Testing
1. Post an internal note on a ticket
2. Hover over the note -- verify edit/delete buttons appear
3. Click edit -- verify inline editor opens with current text
4. Modify text and save -- verify message updates and "(edited)" appears
5. Post another internal note, then delete it -- verify confirmation and removal
6. Verify edit/delete buttons do NOT appear on reply messages
7. Have another agent's internal note visible -- verify no edit/delete buttons for it

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] Admin portal build succeeds
- [ ] Migration applies cleanly

---

## PR Preparation

- **Title:** `feat: add edit/delete for internal comments on support tickets (BACKLOG-1344)`
- **Branch:** `feature/task-2315-edit-delete-internal-comments`
- **Target:** `int/identity-provisioning`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/identity-provisioning
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Schema migration created and tested
- [ ] RPCs created and tested
- [ ] Code complete
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No way to edit or delete posted internal notes
- **After**: Agents can edit/delete their own internal notes with inline UI
- **Actual Tokens**: ~XK (Est: 25K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The current user's ID is not accessible in the ActivityTimeline context
- The migration would conflict with other pending migrations
- RLS policies block the RPC from accessing the necessary tables
- The existing message card structure makes inline editing difficult to implement
- You encounter blockers not covered in the task file
