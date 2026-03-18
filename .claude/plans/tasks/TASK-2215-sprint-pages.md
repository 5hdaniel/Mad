# Task TASK-2215: Sprint List + Detail Pages

**Status:** Pending
**Backlog ID:** BACKLOG-975
**Sprint:** SPRINT-138
**Phase:** Phase 2b -- Pages (after TASK-2211 + TASK-2212)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2215-sprint-pages`
**Estimated Tokens:** ~22K
**Depends On:** TASK-2211 (sprint components), TASK-2212 (chart components)

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

Build the Sprint list page at `/dashboard/pm/sprints` showing all sprints with a velocity chart, and the Sprint detail page at `/dashboard/pm/sprints/[id]` showing a sprint's tasks, progress, burndown chart, and estimate-vs-actual chart. These pages replace the placeholders created by TASK-2208.

## Non-Goals

- Do NOT modify sprint or chart components (TASK-2211 and TASK-2212 own those)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement sprint create/edit forms (Sprint D)
- Do NOT implement sprint deletion or archival

## Deliverables

1. Replace file: `admin-portal/app/dashboard/pm/sprints/page.tsx` (~120 lines, replaces placeholder)
2. Replace file: `admin-portal/app/dashboard/pm/sprints/[id]/page.tsx` (~200 lines, replaces placeholder)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/sprints/page.tsx` (replace placeholder)
- `admin-portal/app/dashboard/pm/sprints/[id]/page.tsx` (replace placeholder)

### Files this task must NOT modify:

- All PM component files under `pm/components/`
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Other page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

### Sprint List Page (`/dashboard/pm/sprints`)
- [ ] Shows page heading "Sprints"
- [ ] Renders VelocityChart at the top with data from `getSprintVelocity(10)`
- [ ] Renders SprintList table below with data from `listSprints()`
- [ ] Sprint rows are clickable (navigate to sprint detail)
- [ ] Shows filter tabs: All, Active, Planned, Completed
- [ ] Handles loading and error states

### Sprint Detail Page (`/dashboard/pm/sprints/[id]`)
- [ ] Shows SprintCard component with sprint summary
- [ ] Shows task list (items assigned to this sprint) using SprintDetailResponse data
- [ ] Shows BurndownChart with computed burndown data
- [ ] Shows EstVsActualChart comparing estimated vs actual tokens per item
- [ ] Shows total tokens metrics (estimated vs actual)
- [ ] "Back to Sprints" link
- [ ] Handles loading and error states
- [ ] Handles sprint not found (shows error message)

### Both Pages
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### Sprint List Page (~120 lines)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { PmSprint, SprintVelocityEntry, SprintStatus } from '@/lib/pm-types';
import { listSprints, getSprintVelocity } from '@/lib/pm-queries';
import { SprintList } from '../components/SprintList';
import { VelocityChart } from '../components/VelocityChart';

type FilterTab = 'all' | SprintStatus;

export default function SprintsPage() {
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [velocity, setVelocity] = useState<SprintVelocityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    async function load() {
      try {
        const [sprintData, velocityData] = await Promise.all([
          listSprints(),
          getSprintVelocity(10),
        ]);
        setSprints(sprintData);
        setVelocity(velocityData);
      } catch (err) {
        console.error('Failed to load sprints:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSprints = filter === 'all'
    ? sprints
    : sprints.filter((s) => s.status === filter);

  const tabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'planned', label: 'Planned' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/pm" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
        <p className="text-sm text-gray-500 mt-1">Sprint planning, tracking, and velocity</p>
      </div>

      {/* Velocity Chart */}
      <div className="mb-6">
        <VelocityChart data={velocity} />
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

      {/* Sprint list */}
      <SprintList sprints={filteredSprints} loading={loading} />
    </div>
  );
}
```

### Sprint Detail Page (~200 lines)

```tsx
'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { SprintDetailResponse } from '@/lib/pm-types';
import { getSprintDetail } from '@/lib/pm-queries';
import { SprintCard } from '../../components/SprintCard';
import { BurndownChart, type BurndownDataPoint } from '../../components/BurndownChart';
import { EstVsActualChart, type EstVsActualEntry } from '../../components/EstVsActualChart';
import { TaskStatusBadge } from '../../components/TaskStatusBadge';
import { TaskPriorityBadge } from '../../components/TaskPriorityBadge';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SprintDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [detail, setDetail] = useState<SprintDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSprintDetail(id);
        setDetail(data);
      } catch (err) {
        console.error('Failed to load sprint:', err);
        setError('Sprint not found or failed to load');
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
        <div className="h-40 bg-gray-100 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard/pm/sprints" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Sprints
        </Link>
        <div className="text-center py-12">
          <p className="text-gray-500">{error || 'Sprint not found'}</p>
        </div>
      </div>
    );
  }

  // Compute burndown data from items
  const burndownData = computeBurndown(detail);

  // Compute est vs actual data from items
  const estVsActualData = computeEstVsActual(detail);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/pm/sprints" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Sprints
        </Link>
      </div>

      {/* Sprint summary card */}
      <SprintCard sprint={detail.sprint} />

      {/* Token metrics summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <MetricCard label="Total Items" value={detail.metrics.total_items} />
        <MetricCard label="Completed" value={detail.metrics.completed_items} />
        <MetricCard label="Est. Tokens" value={`${Math.round(detail.metrics.total_est_tokens / 1000)}K`} />
        <MetricCard label="Actual Tokens" value={`${Math.round(detail.metrics.total_actual_tokens / 1000)}K`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <BurndownChart data={burndownData} totalItems={detail.metrics.total_items} />
        <EstVsActualChart data={estVsActualData} />
      </div>

      {/* Items table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Est.</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Actual</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <Link href={`/dashboard/pm/tasks/${item.id}`} className="hover:text-blue-600">
                      <span className="text-xs text-gray-400 font-mono mr-1">{item.legacy_id}</span>
                      <span className="text-gray-900">{item.title}</span>
                    </Link>
                  </td>
                  <td className="py-2 px-3"><TaskStatusBadge status={item.status} /></td>
                  <td className="py-2 px-3"><TaskPriorityBadge priority={item.priority} /></td>
                  <td className="py-2 px-3 text-gray-500">{item.est_tokens ? `${Math.round(item.est_tokens / 1000)}K` : '-'}</td>
                  <td className="py-2 px-3 text-gray-500">{item.actual_tokens ? `${Math.round(item.actual_tokens / 1000)}K` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper: compute burndown from sprint items
function computeBurndown(detail: SprintDetailResponse): BurndownDataPoint[] {
  // Simple burndown: show total items vs completed over sprint date range
  // Since we don't have daily completion data, show start (all items) and current state
  const total = detail.metrics.total_items;
  const completed = detail.metrics.completed_items;
  const remaining = total - completed;

  if (!detail.sprint.start_date) return [];

  const start = new Date(detail.sprint.start_date);
  const end = detail.sprint.end_date ? new Date(detail.sprint.end_date) : new Date();
  const today = new Date();
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const data: BurndownDataPoint[] = [];
  for (let i = 0; i <= days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ideal = Math.max(0, total - (total * i / days));

    // For actual: show total at start, remaining at today, nothing after today
    let actual: number;
    if (date <= today) {
      // Linear interpolation from total to remaining (simplified)
      const daysSoFar = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSoFar === 0) {
        actual = total;
      } else {
        const rate = (total - remaining) / daysSoFar;
        actual = Math.max(0, total - (rate * i));
      }
    } else {
      actual = remaining; // Projected flat line
    }

    data.push({
      date: dayStr,
      ideal: Math.round(ideal * 10) / 10,
      remaining: Math.round(actual * 10) / 10,
    });
  }

  return data;
}

// Helper: compute est vs actual from sprint items
function computeEstVsActual(detail: SprintDetailResponse): EstVsActualEntry[] {
  return detail.items
    .filter((item) => item.est_tokens || item.actual_tokens)
    .map((item) => ({
      name: item.legacy_id || item.title.slice(0, 20),
      estimated: Math.round((item.est_tokens || 0) / 1000),
      actual: Math.round((item.actual_tokens || 0) / 1000),
    }));
}

// Simple metric card
function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}
```

### Next.js 15 Dynamic Route Params

In Next.js 15, `params` is a Promise. Use React's `use()` hook:

```tsx
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  // ...
}
```

## Integration Notes

- **Imports from:** TASK-2211 components (SprintList, SprintCard), TASK-2212 components (VelocityChart, BurndownChart, EstVsActualChart), existing Sprint B badges (TaskStatusBadge, TaskPriorityBadge), `@/lib/pm-queries`, `@/lib/pm-types`
- **Replaces:** TASK-2208 placeholders at `pm/sprints/page.tsx` and `pm/sprints/[id]/page.tsx`
- **Parallel with:** TASK-2214, TASK-2216, TASK-2217 (different page routes)

## Do / Don't

### Do:
- Use `Promise.all()` to load sprints and velocity data in parallel on the list page
- Compute burndown data from sprint detail (not a separate RPC)
- Handle sprint not found gracefully (show message, link back)
- Use `use()` hook for params in Next.js 15 (not `useParams()`)

### Don't:
- Do NOT implement sprint creation UI (Sprint D)
- Do NOT implement sprint status change from these pages (Sprint D)
- Do NOT modify any component files
- Do NOT add complex burndown logic -- the simple linear interpolation is sufficient for v1

## When to Stop and Ask

- If `getSprintDetail()` returns data in unexpected shape
- If `use(params)` causes issues with the page's useEffect hooks
- If BurndownDataPoint or EstVsActualEntry types are not exported from chart components

## Testing Expectations

### Unit Tests
- **Required:** No (page-level components with RPC calls, verified via type-check + manual E2E)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add sprint list page with velocity chart and sprint detail page with burndown`
- **Branch:** `feature/TASK-2215-sprint-pages`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~22K

**Token Cap:** 88K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 page files (replace placeholders) | +4K |
| Code volume | ~320 lines total | +8K |
| Data computation | Burndown + EstVsActual helpers | +4K |
| Component assembly | Both pages assemble multiple components | +3K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** Medium (burndown computation and chart data preparation are the unknowns)

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
- [ ] admin-portal/app/dashboard/pm/sprints/page.tsx (replaced placeholder)
- [ ] admin-portal/app/dashboard/pm/sprints/[id]/page.tsx (replaced placeholder)

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

**Variance:** PM Est ~22K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
