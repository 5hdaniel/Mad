# Task TASK-2216: Project List + Detail Pages

**Status:** Pending
**Backlog ID:** BACKLOG-976
**Sprint:** SPRINT-138
**Phase:** Phase 2b -- Pages (after TASK-2213)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2216-project-pages`
**Estimated Tokens:** ~18K
**Depends On:** TASK-2213 (project components)

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

Build the Project list page at `/dashboard/pm/projects` showing all projects in a card grid, and the Project detail page at `/dashboard/pm/projects/[id]` showing a project's sprints, item breakdown by status, and a list of items. These pages replace the placeholders created by TASK-2208.

## Non-Goals

- Do NOT modify project components (TASK-2213 owns those)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement project create/edit/archive forms (Sprint D)
- Do NOT implement a project-scoped board (v2 enhancement)

## Deliverables

1. Replace file: `admin-portal/app/dashboard/pm/projects/page.tsx` (~100 lines, replaces placeholder)
2. Replace file: `admin-portal/app/dashboard/pm/projects/[id]/page.tsx` (~180 lines, replaces placeholder)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/projects/page.tsx` (replace placeholder)
- `admin-portal/app/dashboard/pm/projects/[id]/page.tsx` (replace placeholder)

### Files this task must NOT modify:

- All PM component files under `pm/components/`
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Other page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

### Project List Page (`/dashboard/pm/projects`)
- [ ] Shows page heading "Projects"
- [ ] Renders ProjectList component with data from `listProjects()`
- [ ] Shows filter tabs: All, Active, Archived
- [ ] Handles loading and empty states
- [ ] "Back to Dashboard" link

### Project Detail Page (`/dashboard/pm/projects/[id]`)
- [ ] Shows project name, description, status
- [ ] Shows sprints associated with this project (from `getProjectDetail()`)
- [ ] Shows item status breakdown as a horizontal stacked bar or stat cards
- [ ] Shows list of items in the project (from `listItems({ project_id })`)
- [ ] Items are clickable (link to task detail page)
- [ ] "Back to Projects" link
- [ ] Handles loading and not-found states

### Both Pages
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### Project List Page (~100 lines)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { PmProject, ProjectStatus } from '@/lib/pm-types';
import { listProjects } from '@/lib/pm-queries';
import { ProjectList } from '../components/ProjectList';

type FilterTab = 'all' | ProjectStatus;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await listProjects();
        setProjects(data);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredProjects = filter === 'all'
    ? projects
    : projects.filter((p) => p.status === filter);

  const tabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/pm" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500 mt-1">Organize work into projects</p>
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
          </button>
        ))}
      </div>

      {/* Project grid */}
      <ProjectList projects={filteredProjects} loading={loading} />
    </div>
  );
}
```

### Project Detail Page (~180 lines)

```tsx
'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import type { ProjectDetailResponse, PmBacklogItem, ItemListResponse } from '@/lib/pm-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/pm-types';
import { getProjectDetail, listItems } from '@/lib/pm-queries';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { TaskPriorityBadge } from '../../components/TaskPriorityBadge';
import { SprintList } from '../../components/SprintList';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [projectData, itemsData] = await Promise.all([
          getProjectDetail(id),
          listItems({ project_id: id, page_size: 50 }),
        ]);
        setDetail(projectData);
        setItems(itemsData.items);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError('Project not found or failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-100 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard/pm/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div className="text-center py-12">
          <p className="text-gray-500">{error || 'Project not found'}</p>
        </div>
      </div>
    );
  }

  // Compute total items from status breakdown
  const statusBreakdown = detail.items_by_status || {};
  const totalItems = Object.values(statusBreakdown).reduce((sum, count) => sum + (count as number), 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/pm/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>

      {/* Project header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <FolderKanban className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{detail.project.name}</h1>
            {detail.project.description && (
              <p className="text-sm text-gray-500 mt-1">{detail.project.description}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
            detail.project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
          }`}>
            {detail.project.status === 'active' ? 'Active' : 'Archived'}
          </span>
        </div>

        {/* Status breakdown bar */}
        {totalItems > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Item Status</span>
              <span className="text-sm text-gray-700 font-medium">{totalItems} total</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {Object.entries(statusBreakdown).map(([status, count]) => {
                const pct = ((count as number) / totalItems) * 100;
                if (pct === 0) return null;
                const colorMap: Record<string, string> = {
                  completed: 'bg-green-500',
                  in_progress: 'bg-blue-500',
                  testing: 'bg-yellow-500',
                  pending: 'bg-gray-300',
                  blocked: 'bg-red-500',
                  deferred: 'bg-orange-400',
                };
                return (
                  <div
                    key={status}
                    className={`${colorMap[status] || 'bg-gray-300'} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}: ${count}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sprints section */}
      {detail.sprints.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sprints</h2>
          <SprintList sprints={detail.sprints} />
        </div>
      )}

      {/* Items table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Items ({items.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <Link href={`/dashboard/pm/tasks/${item.id}`} className="hover:text-blue-600">
                      {item.legacy_id && <span className="text-xs text-gray-400 font-mono mr-1">{item.legacy_id}</span>}
                      <span className="text-gray-900">{item.title}</span>
                    </Link>
                  </td>
                  <td className="py-2 px-3"><TaskStatusBadge status={item.status} /></td>
                  <td className="py-2 px-3"><TaskPriorityBadge priority={item.priority} /></td>
                  <td className="py-2 px-3 text-gray-500 capitalize">{item.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

## Integration Notes

- **Imports from:** TASK-2213 components (ProjectList), TASK-2211 components (SprintList), Sprint B badges (TaskStatusBadge, TaskPriorityBadge), `@/lib/pm-queries`, `@/lib/pm-types`
- **Replaces:** TASK-2208 placeholders at `pm/projects/page.tsx` and `pm/projects/[id]/page.tsx`
- **Parallel with:** TASK-2214, TASK-2215, TASK-2217 (different page routes)

## Do / Don't

### Do:
- Use `Promise.all()` to load project detail and items in parallel
- Show a horizontal stacked bar for status breakdown
- Use `use()` hook for params in Next.js 15
- Handle project not found gracefully

### Don't:
- Do NOT implement project creation UI (Sprint D)
- Do NOT implement a project-scoped board
- Do NOT modify any component files

## When to Stop and Ask

- If `getProjectDetail()` returns data in unexpected shape
- If `ProjectDetailResponse.items_by_status` is not a Record<string, number>

## Testing Expectations

### Unit Tests
- **Required:** No

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add project list and project detail pages`
- **Branch:** `feature/TASK-2216-project-pages`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~18K

**Token Cap:** 72K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 page files (replace placeholders) | +4K |
| Code volume | ~280 lines total | +7K |
| Data loading | Promise.all for parallel load | +2K |
| Status breakdown bar | Custom stacked bar component | +3K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** High (straightforward page assembly, patterns established)

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
- [ ] admin-portal/app/dashboard/pm/projects/page.tsx (replaced placeholder)
- [ ] admin-portal/app/dashboard/pm/projects/[id]/page.tsx (replaced placeholder)

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

**Variance:** PM Est ~18K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
