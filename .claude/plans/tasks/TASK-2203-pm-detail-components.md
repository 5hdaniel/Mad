# Task TASK-2203: PM Detail Components (Sidebar, Description, Comments, Timeline)

**Status:** Pending
**Backlog ID:** BACKLOG-963
**Sprint:** SPRINT-137
**Phase:** Phase 2a -- Shared Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2203-pm-detail-components`
**Estimated Tokens:** ~25K
**Depends On:** TASK-2200 (types + queries + timeline utils must exist)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Create four components that form the task detail page's core: a sidebar for metadata/actions, an editable description panel, a comment composer, and a unified activity timeline (comments + events). These are the right-column and main-content components for the 2-column task detail layout.

## Non-Goals

- Do NOT create the task detail page itself (TASK-2206 assembles these)
- Do NOT create badge components (TASK-2201)
- Do NOT create linked items/dependency/label panels (TASK-2204)
- Do NOT modify any existing support components
- Do NOT add npm dependencies

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/TaskSidebar.tsx` (~350 lines)
2. New file: `admin-portal/app/dashboard/pm/components/TaskDescription.tsx` (~120 lines)
3. New file: `admin-portal/app/dashboard/pm/components/TaskCommentComposer.tsx` (~100 lines)
4. New file: `admin-portal/app/dashboard/pm/components/TaskActivityTimeline.tsx` (~250 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/components/TaskSidebar.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskDescription.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskCommentComposer.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskActivityTimeline.tsx` (new)

### Files this task must NOT modify:

- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-timeline-utils.ts` -- Owned by TASK-2200
- Any badge components -- Owned by TASK-2201
- Any table/filter components -- Owned by TASK-2202
- Any panel/picker components -- Owned by TASK-2204
- Any support components under `admin-portal/app/dashboard/support/components/`

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `TaskSidebar` displays and allows editing: Status (dropdown with transitions), Priority, Type, Area, Sprint, Project, Assignee, Est/Actual Tokens, Start/Due Date, Labels
- [ ] `TaskSidebar` validates status transitions using `ALLOWED_TRANSITIONS` map
- [ ] `TaskDescription` renders item description/body as text and supports inline editing
- [ ] `TaskCommentComposer` provides a textarea + submit button for adding comments
- [ ] `TaskActivityTimeline` renders a unified timeline of comments and events (newest first)
- [ ] `TaskActivityTimeline` uses `buildPmTimeline`, `getPmEventIcon`, `getPmEventDescription` from pm-timeline-utils
- [ ] All components import types/queries from `@/lib/pm-types` and `@/lib/pm-queries`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### TaskSidebar.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` (351 lines)

**Changes from support TicketSidebar:**

The PM sidebar has MORE fields than support. Add these sections:

| Section | Widget | RPC on change |
|---------|--------|---------------|
| Status | Dropdown (filtered by `ALLOWED_TRANSITIONS`) | `updateItemStatus()` |
| Priority | Dropdown (low/medium/high/critical) | `updateItemField(id, 'priority', value)` |
| Type | Dropdown (feature/bug/chore/...) | `updateItemField(id, 'type', value)` |
| Area | Dropdown or text input | `updateItemField(id, 'area', value)` |
| Sprint | Dropdown (from `listSprints()`) | `assignToSprint([id], sprintId)` or `removeFromSprint([id])` |
| Project | Dropdown (from `listProjects()`) | `updateItemField(id, 'project_id', value)` |
| Assignee | Dropdown (internal users) | `assignItem(id, userId)` |
| Est Tokens | Number input | `updateItemField(id, 'est_tokens', value)` |
| Actual Tokens | Display only (read-only) | -- |
| Start Date | Date input | `updateItemField(id, 'start_date', value)` |
| Due Date | Date input | `updateItemField(id, 'due_date', value)` |
| Labels | Display only (add/remove handled by LabelPicker in TASK-2204) | -- |
| Legacy ID | Display only | -- |
| Created/Updated | Display only (timestamps) | -- |

**Props interface:**
```typescript
interface TaskSidebarProps {
  item: PmBacklogItem;
  onUpdate: () => void; // callback to refresh parent
}
```

**Implementation pattern:**
- Each editable field uses the same pattern: display value, on click/change call the appropriate RPC, then call `onUpdate()` to refresh
- Status dropdown only shows valid transitions from `ALLOWED_TRANSITIONS[currentStatus]`
- Sprint/Project/Assignee dropdowns load options on mount via `listSprints()`, `listProjects()`, and a user list query
- For Assignee, reuse the same `getAssignableAgents()` pattern from support-queries or add a similar query. Since PM module internal users are the same set, you can call the existing `support_list_agents` RPC or just list internal_roles users. Use the support query if available, otherwise create a simple wrapper.
- Overdue highlighting: if `due_date` is in the past and status is not completed, show due date in red

### TaskDescription.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/ConversationThread.tsx` -- specifically the `TicketDescription` export (referenced in the detail page)

**Simpler version for PM:**
- Display the item's `description` field (short text) and optionally `body` (long markdown)
- Click-to-edit mode: clicking the description toggles a textarea
- On blur or Enter, call `updateItemField(id, 'description', newValue)` then `onUpdate()`
- Body field: display as preformatted/markdown text (read-only for now -- full markdown editor is v2)

**Props interface:**
```typescript
interface TaskDescriptionProps {
  itemId: string;
  description: string | null;
  body: string | null;
  onUpdate: () => void;
}
```

### TaskCommentComposer.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/ReplyComposer.tsx` (332 lines) -- **heavily simplified**

**Remove from support version:**
- Remove reply/note toggle (PM has no internal notes concept)
- Remove file upload
- Remove response templates
- Remove attachment functionality

**Keep:**
- Textarea with placeholder "Add a comment..."
- Submit button
- Loading state during submission
- Clear textarea after successful submit

**Props interface:**
```typescript
interface TaskCommentComposerProps {
  itemId: string;
  onCommentAdded: () => void;
}
```

**Implementation:**
```typescript
async function handleSubmit() {
  if (!body.trim()) return;
  setSubmitting(true);
  try {
    await addComment(itemId, null, body.trim());
    setBody('');
    onCommentAdded();
  } catch (err) {
    console.error('Failed to add comment:', err);
  } finally {
    setSubmitting(false);
  }
}
```

### TaskActivityTimeline.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx` (306 lines)

**Changes from support ActivityTimeline:**
- Import `PmTimelineEntry` from `@/lib/pm-types`
- Import `buildPmTimeline`, `getPmEventIcon`, `getPmEventDescription`, `getPmActorName` from `@/lib/pm-timeline-utils`
- Replace message rendering (support has sender_name, message_type, attachments) with simpler comment rendering (just author + body + timestamp)
- Event rendering uses PM event types (status_changed, assigned, dependency_added, label_added, etc.)
- Remove attachment display (PM comments have no attachments in v1)
- Keep the same vertical timeline line + circle icon pattern

**Props interface:**
```typescript
interface TaskActivityTimelineProps {
  comments: PmComment[];
  events: PmEvent[];
}
```

**The component calls `buildPmTimeline(comments, events)` to merge and sort, then renders each entry.**

## Integration Notes

- **Imports from:** `@/lib/pm-types`, `@/lib/pm-queries`, `@/lib/pm-timeline-utils` (all TASK-2200)
- **Used by:** TASK-2206 (Task detail page -- assembles all four components)
- **Parallel with:** TASK-2201, TASK-2202, TASK-2204 (different files, no overlap)

## Do / Don't

### Do:
- Follow the support component patterns closely for layout consistency
- Use `useCallback` for event handlers
- Show loading/error states for async operations
- Use `text-gray-900 bg-white` on all form inputs
- Keep the sidebar in a scrollable container (it may be tall)

### Don't:
- Do NOT implement markdown rendering (show body as preformatted text)
- Do NOT add file upload to comments (v2 feature)
- Do NOT add inline editing for body field (description only for now)
- Do NOT create a separate "events timeline" component -- use unified timeline
- Do NOT import from support components (create independent PM versions)

## When to Stop and Ask

- If `pm-timeline-utils.ts` doesn't export the expected functions
- If `pm-queries.ts` doesn't have a user/agent list function for the assignee dropdown
- If the `PmEvent` type doesn't have `actor_name` or `actor_email` fields
- If you need to call support RPCs from PM components

## Testing Expectations

### Unit Tests
- **Required:** No (presentational + thin RPC wrappers, verified via type-check)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add sidebar, description, comment, and timeline components`
- **Branch:** `feature/TASK-2203-pm-detail-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new files | +10K |
| Code volume | ~820 lines total (350+120+100+250) | +10K |
| TaskSidebar complexity | Many editable fields + dropdowns | +5K |
| Pattern reuse | High for timeline, moderate for sidebar | -5K |

**Confidence:** Medium

**Risk factors:**
- TaskSidebar is the most complex component in the sprint (many interactive fields)
- Assignee dropdown may need a new query or reuse of support agent list

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
- [ ] admin-portal/app/dashboard/pm/components/TaskSidebar.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskDescription.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskCommentComposer.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskActivityTimeline.tsx

Verification:
- [ ] npx tsc --noEmit passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~25K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
