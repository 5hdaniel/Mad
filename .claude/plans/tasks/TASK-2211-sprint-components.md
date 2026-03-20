# Task TASK-2211: Sprint Components (SprintList, SprintCard)

**Status:** Pending
**Backlog ID:** BACKLOG-971
**Sprint:** SPRINT-138
**Phase:** Phase 2a -- Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2211-sprint-components`
**Estimated Tokens:** ~18K
**Depends On:** TASK-2208 (foundation)

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

Build the sprint list table and sprint summary card components used by the Sprint list and Sprint detail pages (TASK-2215). These components display sprint metadata, item counts, status badges, and progress information.

## Non-Goals

- Do NOT build the sprint pages (TASK-2215)
- Do NOT build chart components (TASK-2212)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement sprint create/edit forms (Sprint D)

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/SprintList.tsx` (~100 lines)
2. New file: `admin-portal/app/dashboard/pm/components/SprintCard.tsx` (~80 lines)

## File Boundaries

### Files to create (owned by this task):

- `admin-portal/app/dashboard/pm/components/SprintList.tsx`
- `admin-portal/app/dashboard/pm/components/SprintCard.tsx`

### Files this task must NOT modify:

- All existing PM components
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Any page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] SprintList renders a table of sprints with columns: Name, Status, Date Range, Items, Progress
- [ ] SprintList rows are clickable (navigate to sprint detail)
- [ ] SprintList shows sprint status using SPRINT_STATUS_COLORS from pm-types
- [ ] SprintList shows a progress bar (completed items / total items)
- [ ] SprintCard renders a summary card for one sprint with name, goal, status, dates, progress
- [ ] SprintCard shows item count breakdown by status (using item_counts from PmSprint)
- [ ] Both components accept data via props (no direct RPC calls)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### SprintList.tsx (~100 lines)

A table of sprints, similar in style to the existing TaskTable.

```tsx
'use client';

import Link from 'next/link';
import type { PmSprint } from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';

interface SprintListProps {
  sprints: PmSprint[];
  loading?: boolean;
}

export function SprintList({ sprints, loading = false }: SprintListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">No sprints found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Sprint</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Dates</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Items</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Progress</th>
          </tr>
        </thead>
        <tbody>
          {sprints.map((sprint) => {
            const completed = sprint.item_counts?.completed ?? 0;
            const total = sprint.total_items ?? 0;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <tr key={sprint.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <Link href={`/dashboard/pm/sprints/${sprint.id}`} className="hover:text-blue-600">
                    <div className="font-medium text-gray-900">{sprint.name}</div>
                    {sprint.legacy_id && (
                      <span className="text-xs text-gray-400 font-mono">{sprint.legacy_id}</span>
                    )}
                  </Link>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}>
                    {SPRINT_STATUS_LABELS[sprint.status]}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500">
                  {sprint.start_date || sprint.end_date ? (
                    <span className="text-xs">
                      {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : '?'}
                      {' - '}
                      {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : '?'}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">No dates</span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-700">
                  <span className="text-sm">{total}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{progress}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

### SprintCard.tsx (~80 lines)

A card for displaying a single sprint's summary, used on the sprint detail page header.

```tsx
'use client';

import type { PmSprint } from '@/lib/pm-types';
import { SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS } from '@/lib/pm-types';
import { Calendar, Target, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface SprintCardProps {
  sprint: PmSprint;
}

export function SprintCard({ sprint }: SprintCardProps) {
  const counts = sprint.item_counts ?? {};
  const total = sprint.total_items ?? 0;
  const completed = counts.completed ?? 0;
  const inProgress = counts.in_progress ?? 0;
  const blocked = counts.blocked ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{sprint.name}</h2>
          {sprint.goal && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Target className="h-4 w-4" />
              {sprint.goal}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}>
          {SPRINT_STATUS_LABELS[sprint.status]}
        </span>
      </div>

      {/* Date range */}
      {(sprint.start_date || sprint.end_date) && (
        <div className="flex items-center gap-1 mt-3 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : '?'}
          {' - '}
          {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : '?'}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-700">{completed}/{total} items ({progress}%)</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{completed}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{inProgress}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{blocked}</div>
            <div className="text-xs text-gray-500">Blocked</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Integration Notes

- **Imports from:** `@/lib/pm-types` (PmSprint, SPRINT_STATUS_LABELS, SPRINT_STATUS_COLORS)
- **Used by:** TASK-2215 (Sprint list page uses SprintList; Sprint detail page uses SprintCard)
- **Parallel with:** TASK-2209, TASK-2210, TASK-2212, TASK-2213

## Do / Don't

### Do:
- Use the `SPRINT_STATUS_COLORS` and `SPRINT_STATUS_LABELS` maps from pm-types.ts
- Make sprint names in the list clickable (link to `/dashboard/pm/sprints/[id]`)
- Show progress bars using item_counts data from the PmSprint type
- Handle null/undefined item_counts gracefully (default to 0)

### Don't:
- Do NOT make RPC calls inside these components (data comes from parent page)
- Do NOT implement sprint creation UI (Sprint D)
- Do NOT import or use chart components (TASK-2212)

## When to Stop and Ask

- If PmSprint type is missing `item_counts` or `total_items` fields
- If you need to add new types to pm-types.ts

## Testing Expectations

### Unit Tests
- **Required:** No (presentational components, verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add sprint list table and sprint card components`
- **Branch:** `feature/TASK-2211-sprint-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~18K

**Token Cap:** 72K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new component files | +4K |
| Code volume | ~180 lines total | +6K |
| Pattern reuse | Heavy -- follows TaskTable pattern from Sprint B | -3K |
| Data mapping | item_counts to progress bar | +3K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** High (straightforward table + card, patterns well-established)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-03-16*

### Agent ID
```
Engineer Agent ID: agent-aa9be454
```

### Checklist

```
Files created:
- [x] admin-portal/app/dashboard/pm/components/SprintList.tsx
- [x] admin-portal/app/dashboard/pm/components/SprintCard.tsx

Verification:
- [x] npx tsc --noEmit passes
- [x] npm run lint passes
- [x] npm run build passes
```

### Implementation Notes

Created two presentational components following existing PM patterns:
- **SprintList.tsx** (~130 lines): Table with columns (Sprint, Status, Dates, Items, Progress). Uses `SPRINT_STATUS_COLORS`/`SPRINT_STATUS_LABELS`. Loading skeleton and empty state included. Rows link to `/dashboard/pm/sprints/[id]`.
- **SprintCard.tsx** (~100 lines): Card with header (name + goal + status badge), date range, progress bar, and 3-column breakdown (Completed/In Progress/Blocked). Uses lucide-react icons consistent with TaskStatsCards.

No deviations from spec. No existing files modified.

**Issues/Blockers:** None

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured at session end) |
| Duration | (auto-captured at session end) |

**Variance:** PM Est ~18K vs Actual (auto-captured)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
