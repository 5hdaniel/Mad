# Task TASK-2176: Polish - Attachments, Search, Participants, Events

**Backlog ID:** BACKLOG-938
**Sprint:** SPRINT-130
**Status:** Pending

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

---

## Goal

Add the final polish features to both portals: file attachment upload/download on both admin and broker portals, full-text search in the agent ticket queue, participant/CC management in the admin ticket detail sidebar, and the events timeline in the admin ticket detail sidebar. Run `npx tsc --noEmit` on BOTH portals to verify the entire feature compiles cleanly.

## Non-Goals

- Do NOT implement malware scanning on attachments
- Do NOT implement rich text editing
- Do NOT implement saved views
- Do NOT implement collision warnings
- Do NOT implement merge/link tickets
- Do NOT add E2E/Playwright tests
- Do NOT modify the database schema (storage bucket and tables already exist from TASK-2171), EXCEPT for adding small helper RPCs for attachment/participant CRUD if needed

## Deliverables

### Admin Portal (Attachments, Search, Participants, Events)
1. New file: `admin-portal/app/dashboard/support/components/FileUpload.tsx`
2. New file: `admin-portal/app/dashboard/support/components/AttachmentList.tsx`
3. New file: `admin-portal/app/dashboard/support/components/SearchBar.tsx`
4. New file: `admin-portal/app/dashboard/support/components/ParticipantsPanel.tsx`
5. New file: `admin-portal/app/dashboard/support/components/EventsTimeline.tsx`
6. Update: `admin-portal/app/dashboard/support/components/ReplyComposer.tsx` -- Add file upload
7. Update: `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` -- Add participants + events
8. Update: `admin-portal/app/dashboard/support/page.tsx` -- Add search bar
9. Update: `admin-portal/lib/support-queries.ts` -- Add attachment, participant, search functions

### Broker Portal (Attachments)
10. New file: `broker-portal/app/support/components/FileUpload.tsx`
11. New file: `broker-portal/app/support/components/AttachmentList.tsx`
12. Update: `broker-portal/app/support/components/CustomerReplyForm.tsx` -- Add file upload
13. Update: `broker-portal/app/support/new/page.tsx` (or TicketForm.tsx) -- Add file upload to ticket form
14. Update: `broker-portal/lib/support-queries.ts` -- Add attachment functions

### Database (if needed)
15. Optional: `supabase/migrations/20260313_support_attachment_rpcs.sql` -- RPCs for attachment and participant CRUD if tables are read-only

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

### Attachments (Both Portals)
- [ ] File upload component allows selecting files via button or drag-and-drop
- [ ] 10MB per file limit enforced client-side (show error for oversized files)
- [ ] File type whitelist enforced: `png`, `jpg`, `jpeg`, `gif`, `webp`, `pdf`, `txt`, `doc`, `docx`, `csv`, `xlsx`, `mp4`, `mov`, `zip`
- [ ] Rejected file types show clear error message
- [ ] Upload progress indicator shown during upload
- [ ] Uploaded files shown as a list with: filename, size, remove button (before send)
- [ ] In reply composer: attachments uploaded to Supabase Storage, linked to message
- [ ] In ticket form (broker portal): attachments uploaded after ticket creation, linked to ticket
- [ ] In conversation thread: attachments shown as download links with filename and size
- [ ] Download links work (generate signed URL from Supabase Storage)
- [ ] Storage path follows pattern: `{ticket_id}/{attachment_id}/{filename}`

### Search (Admin Portal Only)
- [ ] Search bar at top of ticket queue page
- [ ] Debounced input (300ms delay)
- [ ] Search uses `p_search` param of `support_list_tickets` RPC (tsvector)
- [ ] Search results update the ticket table
- [ ] Clear search button resets to unfiltered view
- [ ] Search works in combination with existing filters

### Participants (Admin Portal Only)
- [ ] Participants panel in ticket detail sidebar
- [ ] Shows current participants (email + role: CC or Watcher)
- [ ] "Add Participant" with email input + role dropdown
- [ ] Remove participant button next to each entry

### Events Timeline (Admin Portal Only)
- [ ] Events timeline in ticket detail sidebar (collapsible section)
- [ ] Shows: event type icon, description, actor, old -> new value, timestamp
- [ ] Chronological order (newest first)

### Type Checking (MANDATORY -- FINAL GATE)
- [ ] `npx tsc --noEmit` passes in `admin-portal/`
- [ ] `npx tsc --noEmit` passes in `broker-portal/`

## Implementation Notes

### Supabase Storage Integration

**Upload:**
```typescript
async function uploadAttachment(ticketId: string, file: File) {
  const supabase = createClient();
  const attachmentId = crypto.randomUUID();
  const storagePath = `${ticketId}/${attachmentId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('support-attachments')
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  // Create attachment record -- may need RPC if tables are read-only
  // Option A: RPC (preferred, consistent with rest of system)
  // Option B: Direct insert if RLS allows
  return { storagePath, attachmentId };
}
```

**Download (signed URL):**
```typescript
async function getAttachmentUrl(storagePath: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
```

**NOTE:** Since tables are read-only at RLS level, the engineer may need to create helper RPCs:
- `support_add_attachment(p_ticket_id, p_message_id, p_file_name, p_file_size, p_file_type, p_storage_path)`
- `support_add_participant(p_ticket_id, p_email, p_name, p_role)`
- `support_remove_participant(p_participant_id)`

Apply these via `mcp__supabase__apply_migration` if needed.

### File Validation Constants

```typescript
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4', 'video/quicktime',
  'application/zip',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### Debounced Search

```typescript
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

### Events Timeline

Event type icons: created=Plus (green), status_changed=Circle (blue), assigned=User (purple), priority_changed=Flag (orange), message_added=MessageSquare (gray). Use lucide-react icons.

### Participants Panel

If participant CRUD needs RPCs, create them as a small migration and apply via Supabase MCP.

## Do / Don't

### Do:
- Reuse existing patterns from the admin portal components
- Handle upload errors gracefully
- Show file size in human-readable format (KB, MB)
- Make the events timeline collapsible (default expanded)

### Don't:
- Do NOT implement malware scanning
- Do NOT install new UI libraries for file upload (use native browser APIs + Tailwind)
- Do NOT exceed 10MB limit

## When to Stop and Ask

- If the `support-attachments` storage bucket doesn't exist
- If `npx tsc --noEmit` reveals errors in code from previous tasks (fix them, but stop if >5 errors)

## Testing Expectations

### Type Checking (MANDATORY -- FINAL GATE)
- [ ] `npx tsc --noEmit` passes in `admin-portal/`
- [ ] `npx tsc --noEmit` passes in `broker-portal/`

## PR Preparation

- **Title**: `feat(support): add attachments, search, participants, and events timeline`
- **Labels**: `feature`, `ui`, `support`
- **Depends on**: TASK-2175

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~50K-70K

**Token Cap:** 280K (4x upper estimate)

**Confidence:** Medium

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~70K vs Actual ~XK (X% over/under)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
