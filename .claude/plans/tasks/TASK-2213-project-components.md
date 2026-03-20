# Task TASK-2213: Project Components (ProjectList, ProjectCard)

**Status:** Pending
**Backlog ID:** BACKLOG-973
**Sprint:** SPRINT-138
**Phase:** Phase 2a -- Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2213-project-components`
**Estimated Tokens:** ~12K
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

Build the project list and project card components used by the Project pages (TASK-2216). The project list shows a grid of project cards with progress bars and item/sprint counts. The project card shows a single project's summary.

## Non-Goals

- Do NOT build the project pages (TASK-2216)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement project create/edit/archive functionality (Sprint D)

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/ProjectList.tsx` (~70 lines)
2. New file: `admin-portal/app/dashboard/pm/components/ProjectCard.tsx` (~80 lines)

## File Boundaries

### Files to create (owned by this task):

- `admin-portal/app/dashboard/pm/components/ProjectList.tsx`
- `admin-portal/app/dashboard/pm/components/ProjectCard.tsx`

### Files this task must NOT modify:

- All existing PM components
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Any page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] ProjectList renders a responsive grid of ProjectCard components
- [ ] ProjectList handles loading state with skeleton cards
- [ ] ProjectList handles empty state with "No projects" message
- [ ] ProjectCard shows project name, description, status, item count, sprint count
- [ ] ProjectCard shows a progress bar based on items_by_status (from ProjectDetailResponse)
- [ ] ProjectCard is clickable (navigates to `/dashboard/pm/projects/[id]`)
- [ ] Both components accept data via props (no direct RPC calls)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### ProjectList.tsx (~70 lines)

A responsive grid of project cards.

```tsx
'use client';

import type { PmProject } from '@/lib/pm-types';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: PmProject[];
  loading?: boolean;
}

export function ProjectList({ projects, loading = false }: ProjectListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">No projects found</p>
        <p className="text-xs text-gray-400 mt-1">Create a project to organize your work</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

### ProjectCard.tsx (~80 lines)

A card for displaying a single project.

```tsx
'use client';

import Link from 'next/link';
import { FolderKanban, ListChecks, Calendar } from 'lucide-react';
import type { PmProject } from '@/lib/pm-types';

interface ProjectCardProps {
  project: PmProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const itemCount = project.item_count ?? 0;
  const sprintCount = project.active_sprint_count ?? 0;

  return (
    <Link href={`/dashboard/pm/projects/${project.id}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FolderKanban className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{project.description}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
            project.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {project.status === 'active' ? 'Active' : 'Archived'}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <ListChecks className="h-3.5 w-3.5" />
            <span>{itemCount} items</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{sprintCount} active sprints</span>
          </div>
        </div>

        {/* Progress bar (if items exist) */}
        {itemCount > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: '0%' }} // Actual progress computed by parent page
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
```

**Note on progress:** The ProjectCard receives a PmProject which has `item_count` but no status breakdown. To show accurate progress, the Project pages (TASK-2216) will use `getProjectDetail()` which returns `items_by_status`. The ProjectCard can accept an optional `progress` prop or the ProjectList page can compute it. For now, the card renders a placeholder bar.

## Integration Notes

- **Imports from:** `@/lib/pm-types` (PmProject)
- **Used by:** TASK-2216 (Project list page uses ProjectList; Project detail page may use ProjectCard for header)
- **Parallel with:** TASK-2209, TASK-2210, TASK-2211, TASK-2212

## Do / Don't

### Do:
- Make project names clickable (link to `/dashboard/pm/projects/[id]`)
- Use responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Handle null/undefined item_count and active_sprint_count (default to 0)
- Keep the card compact and scannable

### Don't:
- Do NOT make RPC calls inside these components (data comes from parent)
- Do NOT implement project create/edit/archive UI
- Do NOT add tabs or complex layouts inside ProjectCard (keep it as a summary card)

## When to Stop and Ask

- If PmProject type is missing expected fields (item_count, active_sprint_count)
- If you need to add progress-related props that require type changes

## Testing Expectations

### Unit Tests
- **Required:** No (presentational components, verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add project list grid and project card components`
- **Branch:** `feature/TASK-2213-project-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~12K

**Token Cap:** 48K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new component files | +4K |
| Code volume | ~150 lines total | +4K |
| Pattern reuse | Heavy -- follows SprintCard/SprintList pattern | -3K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** High (simple card + grid, well-established patterns)

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
- [ ] admin-portal/app/dashboard/pm/components/ProjectList.tsx
- [ ] admin-portal/app/dashboard/pm/components/ProjectCard.tsx

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
