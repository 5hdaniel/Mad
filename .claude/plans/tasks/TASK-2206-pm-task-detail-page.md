# Task TASK-2206: PM Task Detail Page

**Status:** Pending
**Backlog ID:** BACKLOG-966
**Sprint:** SPRINT-137
**Phase:** Phase 2b -- Pages (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2206-pm-task-detail-page`
**Estimated Tokens:** ~20K
**Depends On:** TASK-2200 (types/queries), TASK-2201 (badges), TASK-2203 (sidebar/timeline/description/comments), TASK-2204 (links/deps/labels)

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

Create the task detail page at `/dashboard/pm/tasks/[id]` with a 2-column layout: main content area (left) showing description, activity timeline, and comment composer, and a sidebar (right) with metadata, status controls, labels, dependencies, and linked items. This is the primary page for viewing and managing a single PM item.

## Non-Goals

- Do NOT create or modify shared components (they already exist from TASK-2201/2203/2204)
- Do NOT implement inline markdown editor (display body as preformatted text)
- Do NOT implement file attachments (v2)
- Do NOT add npm dependencies
- Do NOT create the backlog page (TASK-2205) or dashboard page (TASK-2207)

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/tasks/[id]/page.tsx` (~230 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/tasks/[id]/page.tsx` (new)

### Files this task must NOT modify:

- All files under `admin-portal/app/dashboard/pm/components/` -- Owned by other tasks
- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- Any other page files in `admin-portal/app/dashboard/pm/`
- Any support pages or components

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Page renders at `/dashboard/pm/tasks/[id]` where [id] is a UUID
- [ ] Page fetches item detail using `getItemDetail(id)` on mount
- [ ] 2-column layout: main content (left, ~60%) + sidebar (right, ~40%)
- [ ] Header shows: back arrow, item_number, title, status badge, priority badge, type badge
- [ ] Main content area shows: TaskDescription, TaskActivityTimeline, TaskCommentComposer (in that order)
- [ ] Sidebar shows: TaskSidebar with all metadata fields
- [ ] Below sidebar: DependencyPanel, LinkedItemsPanel, LabelPicker
- [ ] Adding a comment refreshes the timeline
- [ ] Changing status/priority/etc in sidebar refreshes the page data
- [ ] Delete button (with confirmation) soft-deletes the item and navigates back to backlog
- [ ] Page handles loading state (skeleton) and error state
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

**Pattern template:** `admin-portal/app/dashboard/support/[id]/page.tsx` (229 lines)

Follow the support ticket detail page structure closely. Same state management, same 2-column layout, same refresh-on-action pattern.

### Page Structure

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionsProvider';
import { PERMISSIONS } from '@/lib/permissions';
import { getItemDetail, deleteItem } from '@/lib/pm-queries';
import type { ItemDetailResponse } from '@/lib/pm-types';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { TaskPriorityBadge } from '../../components/TaskPriorityBadge';
import { TaskTypeBadge } from '../../components/TaskTypeBadge';
import { TaskDescription } from '../../components/TaskDescription';
import { TaskActivityTimeline } from '../../components/TaskActivityTimeline';
import { TaskCommentComposer } from '../../components/TaskCommentComposer';
import { TaskSidebar } from '../../components/TaskSidebar';
import { DependencyPanel } from '../../components/DependencyPanel';
import { LinkedItemsPanel } from '../../components/LinkedItemsPanel';
import { LabelPicker } from '../../components/LabelPicker';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const { hasPermission } = usePermissions();

  const [detail, setDetail] = useState<ItemDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const data = await getItemDetail(itemId);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // ... delete handler (same pattern as support) ...

  if (loading) return <LoadingSkeleton />;
  if (error || !detail) return <ErrorDisplay error={error} />;

  const { item, comments, events, dependencies, links, labels } = detail;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header: Back, item_number, title, badges, delete */}
      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main content: 3/5 width */}
        <div className="lg:col-span-3 space-y-6">
          <TaskDescription itemId={item.id} description={item.description} body={item.body} onUpdate={loadDetail} />
          <TaskCommentComposer itemId={item.id} onCommentAdded={loadDetail} />
          <TaskActivityTimeline comments={comments} events={events} />
        </div>
        {/* Sidebar: 2/5 width */}
        <div className="lg:col-span-2 space-y-6">
          <TaskSidebar item={item} onUpdate={loadDetail} />
          <LabelPicker itemId={item.id} currentLabels={labels} onUpdate={loadDetail} />
          <DependencyPanel itemId={item.id} dependencies={dependencies} onUpdate={loadDetail} />
          <LinkedItemsPanel itemId={item.id} links={links} onUpdate={loadDetail} />
        </div>
      </div>
    </div>
  );
}
```

### Header Layout

```tsx
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-4">
    <button onClick={() => router.push('/dashboard/pm/backlog')} className="p-1 rounded hover:bg-gray-100">
      <ArrowLeft className="h-5 w-5 text-gray-500" />
    </button>
    <div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 font-mono">#{item.item_number}</span>
        {item.legacy_id && <span className="text-xs text-gray-400">({item.legacy_id})</span>}
      </div>
      <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <TaskTypeBadge type={item.type} />
    <TaskStatusBadge status={item.status} />
    <TaskPriorityBadge priority={item.priority} />
    {hasPermission(PERMISSIONS.PM_ADMIN) && (
      <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-red-500 hover:bg-red-50 rounded">
        <Trash2 className="h-4 w-4" />
      </button>
    )}
  </div>
</div>
```

### Delete Confirmation

Same pattern as support detail page:
```tsx
{showDeleteConfirm && (
  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
    <p className="text-sm text-red-800">Are you sure you want to delete this item? This action will soft-delete the item.</p>
    <div className="flex gap-2 mt-3">
      <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
      <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">
        Cancel
      </button>
    </div>
  </div>
)}
```

### Loading Skeleton

Same pattern as support -- animated pulse placeholders:
```tsx
function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-64 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
```

## Integration Notes

- **Imports from:** `@/lib/pm-types`, `@/lib/pm-queries` (TASK-2200)
- **Uses components from:** TASK-2201 (TaskStatusBadge, TaskPriorityBadge, TaskTypeBadge), TASK-2203 (TaskSidebar, TaskDescription, TaskCommentComposer, TaskActivityTimeline), TASK-2204 (DependencyPanel, LinkedItemsPanel, LabelPicker)
- **Parallel with:** TASK-2205, TASK-2207 (different page routes)
- **Navigated from:** Backlog page row click, dashboard links, sidebar nav

## Do / Don't

### Do:
- Follow the support detail page layout and patterns exactly
- Refresh data after every mutation (comment, status change, label add, etc.)
- Show the legacy_id alongside item_number for migrated items
- Permission-gate the delete button with `PM_ADMIN`
- Use 5-column grid (3:2 ratio) for main:sidebar layout

### Don't:
- Do NOT implement real-time updates (polling is v2)
- Do NOT add breadcrumbs (v2)
- Do NOT implement "next/previous item" navigation
- Do NOT modify component files -- only import and compose
- Do NOT use different layout than 3:2 grid split

## When to Stop and Ask

- If any component from TASK-2201/2203/2204 has different props than documented
- If `getItemDetail()` return shape doesn't include comments, events, dependencies, links, labels
- If the `pm/tasks/[id]/` directory structure causes routing issues
- If permission constants are missing from `@/lib/permissions`

## Testing Expectations

### Unit Tests
- **Required:** No (page-level assembly, verified via type-check + manual E2E)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add task detail page with 2-column layout`
- **Branch:** `feature/TASK-2206-pm-task-detail-page`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new file (plus directories) | +5K |
| Code volume | ~230 lines | +5K |
| Pattern reuse | Very high -- follows support detail page | -5K |
| Component integration | Many component imports to wire up | +5K |

**Confidence:** High

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
- [ ] admin-portal/app/dashboard/pm/tasks/[id]/page.tsx

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

**Variance:** PM Est ~20K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
