# Task TASK-2217: My Tasks Page

**Status:** Pending
**Backlog ID:** BACKLOG-977
**Sprint:** SPRINT-138
**Phase:** Phase 2b -- Pages (after TASK-2208 only)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2217-my-tasks-page`
**Estimated Tokens:** ~15K
**Depends On:** TASK-2208 (foundation -- placeholder to replace)

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

Build the "My Tasks" page at `/dashboard/pm/my-tasks` showing backlog items assigned to the current user. This is a filtered view of the backlog, using the existing TaskTable, TaskFilters, and badge components from Sprint B. The page replaces the placeholder created by TASK-2208.

**Key advantage:** This task has NO Phase 2a dependencies. It only uses components built in Sprint B. It can be assigned immediately after TASK-2208 merges, even while Phase 2a tasks are still in progress.

## Non-Goals

- Do NOT create new components (reuse existing Sprint B components)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement notification feed on this page (Sprint D)
- Do NOT implement inline editing

## Deliverables

1. Replace file: `admin-portal/app/dashboard/pm/my-tasks/page.tsx` (~150 lines, replaces placeholder)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/my-tasks/page.tsx` (replace placeholder)

### Files this task must NOT modify:

- All PM component files under `pm/components/`
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Other page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Page renders at `/dashboard/pm/my-tasks`
- [ ] Shows "My Tasks" heading
- [ ] Loads items assigned to current user using Supabase auth context
- [ ] Shows filter tabs: All, In Progress, Pending, Testing, Blocked, Completed
- [ ] Shows TaskTable with user's items (reuse existing component)
- [ ] Shows TaskSearchBar for filtering (reuse existing component)
- [ ] Shows item count per tab
- [ ] Items are clickable (navigate to task detail page)
- [ ] Handles loading and empty states
- [ ] Empty state message: "No items assigned to you"
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### Page Structure (~150 lines)

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, UserCheck } from 'lucide-react';
import Link from 'next/link';
import type { PmBacklogItem, ItemStatus, ItemListResponse } from '@/lib/pm-types';
import { listItems } from '@/lib/pm-queries';
import { createClient } from '@/lib/supabase/client';
import { TaskTable } from '../components/TaskTable';
import { TaskSearchBar } from '../components/TaskSearchBar';

type FilterTab = 'all' | ItemStatus;

export default function MyTasksPage() {
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
      } catch (err) {
        console.error('Failed to get user:', err);
      }
    }
    getUser();
  }, []);

  // Load items when user/filter/search changes
  useEffect(() => {
    if (!userId) return;
    async function load() {
      setLoading(true);
      try {
        // Note: listItems filters by assignee when items have assignee_id matching userId
        // We use the backlog list and filter client-side, since pm_list_items
        // doesn't have a p_assignee_id param. If performance becomes an issue,
        // add p_assignee_id to the RPC.
        const result = await listItems({
          status: filter === 'all' ? undefined : filter,
          search: search || undefined,
          page_size: 200,
        });
        // Client-side filter to current user's items
        const myItems = result.items.filter((item) => item.assignee_id === userId);
        setItems(myItems);
        setTotalCount(myItems.length);
      } catch (err) {
        console.error('Failed to load items:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, filter, search]);

  // Count items per tab (from all items, ignoring current filter)
  const [allItems, setAllItems] = useState<PmBacklogItem[]>([]);
  useEffect(() => {
    if (!userId) return;
    async function loadAll() {
      try {
        const result = await listItems({ page_size: 500 });
        setAllItems(result.items.filter((item) => item.assignee_id === userId));
      } catch {
        // Silent -- counts are optional
      }
    }
    loadAll();
  }, [userId]);

  const tabCounts: Record<string, number> = {
    all: allItems.length,
    in_progress: allItems.filter((i) => i.status === 'in_progress').length,
    pending: allItems.filter((i) => i.status === 'pending').length,
    testing: allItems.filter((i) => i.status === 'testing').length,
    blocked: allItems.filter((i) => i.status === 'blocked').length,
    completed: allItems.filter((i) => i.status === 'completed').length,
  };

  const tabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'pending', label: 'Pending' },
    { value: 'testing', label: 'Testing' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/pm" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Items assigned to you</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <TaskSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search your tasks..."
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === tab.value
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tabCounts[tab.value] > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
                {tabCounts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <UserCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No items assigned to you</p>
          <p className="text-gray-400 text-xs mt-1">
            {filter !== 'all'
              ? `No items with status "${filter.replace('_', ' ')}"`
              : 'Items assigned to you will appear here'}
          </p>
        </div>
      ) : (
        <TaskTable items={items} totalCount={totalCount} />
      )}
    </div>
  );
}
```

### How User Filtering Works

The `pm_list_items` RPC does not have a `p_assignee_id` parameter. The page:
1. Fetches items via `listItems()` with status/search filters
2. Filters client-side by `item.assignee_id === currentUserId`
3. This is acceptable for the current data volume (~800 items)

If this becomes a performance issue in the future, we can add a `p_assignee_id` parameter to the RPC (Sprint D enhancement).

### TaskSearchBar and TaskTable Props

Check the existing components to understand their props:
- `TaskSearchBar` expects `value`, `onChange`, and optional `placeholder`
- `TaskTable` expects `items` (array) and `totalCount`

If the existing components have different props than expected, adapt accordingly. Do NOT modify the components -- adjust the page to match their interface.

## Integration Notes

- **Imports from:** Sprint B components (TaskTable, TaskSearchBar), `@/lib/pm-queries`, `@/lib/pm-types`, `@/lib/supabase/client`
- **Replaces:** TASK-2208 placeholder at `pm/my-tasks/page.tsx`
- **Parallel with:** TASK-2209 through TASK-2216 (independent page route)
- **NO Phase 2a dependencies** -- can start as soon as TASK-2208 merges

## Do / Don't

### Do:
- Wrap `supabase.auth.getUser()` in try/catch (per project convention)
- Show item count badges on filter tabs
- Handle the case where userId is null (still loading user)
- Use the same page layout pattern (max-w-7xl, back link, heading)

### Don't:
- Do NOT add a `p_assignee_id` parameter to the RPC (would require modifying pm-queries.ts)
- Do NOT implement notification feed (Sprint D)
- Do NOT create new components -- reuse what Sprint B built
- Do NOT modify any Sprint B component files

## When to Stop and Ask

- If TaskTable or TaskSearchBar props don't match what you expect
- If `supabase.auth.getUser()` returns an error in dev mode
- If client-side filtering of 800+ items causes noticeable lag

## Testing Expectations

### Unit Tests
- **Required:** No

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add my tasks page with user-filtered backlog view`
- **Branch:** `feature/TASK-2217-my-tasks-page`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 page file (replace placeholder) | +3K |
| Code volume | ~150 lines | +5K |
| Pattern reuse | Heavy -- reuses Sprint B components directly | -3K |
| Auth context | Getting current user ID | +2K |
| Tab counts | Loading all items for count computation | +3K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** High (simple filtered view using existing components)

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
Files modified:
- [ ] admin-portal/app/dashboard/pm/my-tasks/page.tsx (replaced placeholder)

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

**Variance:** PM Est ~15K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
