# Task TASK-2207: PM Dashboard Page

**Status:** Pending
**Backlog ID:** BACKLOG-967
**Sprint:** SPRINT-137
**Phase:** Phase 2b -- Pages (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2207-pm-dashboard-page`
**Estimated Tokens:** ~12K
**Depends On:** TASK-2200 (types/queries), TASK-2202 (TaskStatsCards)

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

Create a static PM dashboard page at `/dashboard/pm` showing summary stats, quick links to key sections, and a recent activity preview. This is the PM module landing page -- the first thing users see when clicking "Dashboard" in the Projects sidebar section.

## Non-Goals

- Do NOT implement configurable dashboard widgets (v2)
- Do NOT implement charts (Sprint C)
- Do NOT implement real-time updates
- Do NOT create or modify shared components
- Do NOT add npm dependencies

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/page.tsx` (~150 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/page.tsx` (new)

### Files this task must NOT modify:

- All files under `admin-portal/app/dashboard/pm/components/` -- Owned by other tasks
- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- Other page files (`backlog/page.tsx`, `tasks/[id]/page.tsx`)
- Any support pages or components

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Page renders at `/dashboard/pm`
- [ ] Shows "Project Management" heading with subtitle
- [ ] Displays `TaskStatsCards` with aggregate counts
- [ ] Shows quick-link cards to: Backlog, Board (placeholder), Sprints (placeholder), My Tasks (placeholder)
- [ ] Shows a "Recent Activity" section with last 10 events from `getMyNotifications()`
- [ ] Quick links that point to unbuilt pages show "(Coming Soon)" label
- [ ] Page handles loading and error states
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

This is the simplest page in the sprint -- a static dashboard with stats and navigation cards.

### Page Structure

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ListChecks,
  KanbanSquare,
  Calendar,
  UserCheck,
  FolderKanban,
  Activity,
} from 'lucide-react';
import { getMyNotifications } from '@/lib/pm-queries';
import type { PmEvent } from '@/lib/pm-types';
import { TaskStatsCards } from './components/TaskStatsCards';

export default function PmDashboardPage() {
  const [recentActivity, setRecentActivity] = useState<PmEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      try {
        // Load last 7 days of notifications
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const data = await getMyNotifications(since);
        setRecentActivity(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch (err) {
        console.error('Failed to load activity:', err);
      } finally {
        setLoadingActivity(false);
      }
    }
    loadActivity();
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of backlog items, sprints, and projects</p>
      </div>

      {/* Stats Cards */}
      <TaskStatsCards />

      {/* Quick Links Grid */}
      {/* Recent Activity */}
    </div>
  );
}
```

### Quick Links Section

A 2x3 grid of navigation cards:

```tsx
const quickLinks = [
  { label: 'Backlog', description: 'Browse and manage all work items', href: '/dashboard/pm/backlog', icon: ListChecks, ready: true },
  { label: 'Board', description: 'Kanban board view', href: '/dashboard/pm/board', icon: KanbanSquare, ready: false },
  { label: 'Sprints', description: 'Sprint planning and tracking', href: '/dashboard/pm/sprints', icon: Calendar, ready: false },
  { label: 'My Tasks', description: 'Items assigned to you', href: '/dashboard/pm/my-tasks', icon: UserCheck, ready: false },
  { label: 'Projects', description: 'Manage project groupings', href: '/dashboard/pm/projects', icon: FolderKanban, ready: false },
];

// Render as grid of cards:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 mb-8">
  {quickLinks.map((link) => (
    <Link key={link.href} href={link.ready ? link.href : '#'} className={`block p-4 rounded-lg border ${link.ready ? 'border-gray-200 hover:border-blue-300 hover:shadow-sm' : 'border-gray-100 opacity-60 cursor-not-allowed'} transition-all`}>
      <div className="flex items-center gap-3">
        <link.icon className="h-5 w-5 text-gray-400" />
        <div>
          <div className="font-medium text-gray-900">
            {link.label}
            {!link.ready && <span className="ml-2 text-xs text-gray-400">(Coming Soon)</span>}
          </div>
          <div className="text-sm text-gray-500">{link.description}</div>
        </div>
      </div>
    </Link>
  ))}
</div>
```

### Recent Activity Section

A simple list of the last 10 events:

```tsx
<div className="mt-8">
  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
    <Activity className="h-5 w-5 text-gray-400" />
    Recent Activity
  </h2>
  {loadingActivity ? (
    <div className="animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
    </div>
  ) : recentActivity.length === 0 ? (
    <p className="text-sm text-gray-500">No recent activity</p>
  ) : (
    <div className="space-y-2">
      {recentActivity.map((event) => (
        <div key={event.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-50">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <div className="flex-1 text-sm text-gray-700">
            {/* Format event description inline */}
            {event.event_type.replace(/_/g, ' ')}
            {event.new_value && <span className="font-medium"> {event.new_value}</span>}
          </div>
          <div className="text-xs text-gray-400">
            {new Date(event.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

**Note on `getMyNotifications` return shape:** The RPC returns JSONB. The actual shape may be an array of events or an object with an events array. Check the actual RPC return in `20260316_pm_rpcs.sql` and adapt accordingly.

## Integration Notes

- **Imports from:** `@/lib/pm-queries` (TASK-2200), `./components/TaskStatsCards` (TASK-2202)
- **Navigated from:** Sidebar "Dashboard" link under Projects section
- **Parallel with:** TASK-2205, TASK-2206 (different page routes)
- **Next.js routing:** `app/dashboard/pm/page.tsx` auto-registers as `/dashboard/pm`

## Do / Don't

### Do:
- Keep it simple -- this is a landing page, not a full analytics dashboard
- Mark unbuilt pages as "Coming Soon" with reduced opacity
- Show loading state for recent activity
- Use the same max-w-7xl container as other PM pages

### Don't:
- Do NOT implement charts or graphs (Sprint C)
- Do NOT add click-through from activity items to detail pages (v2)
- Do NOT implement notification polling (Sprint C)
- Do NOT add dashboard customization

## When to Stop and Ask

- If `TaskStatsCards` component is not available (TASK-2202 not merged yet)
- If `getMyNotifications()` RPC returns a different shape than expected
- If you need to create the `pm/` directory (it should exist from TASK-2201)

## Testing Expectations

### Unit Tests
- **Required:** No (static page, verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add PM dashboard landing page with stats and quick links`
- **Branch:** `feature/TASK-2207-pm-dashboard-page`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~12K

**Token Cap:** 48K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new file | +3K |
| Code volume | ~150 lines | +4K |
| Pattern reuse | Moderate -- layout patterns from other pages | -2K |
| Static content | Most of the page is static cards/links | +2K |

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
- [ ] admin-portal/app/dashboard/pm/page.tsx

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

**Variance:** PM Est ~12K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
