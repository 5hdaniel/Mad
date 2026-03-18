# Task TASK-2208: Install @dnd-kit + Placeholder Pages for 404 Routes

**Status:** In Review
**Backlog ID:** BACKLOG-968
**Sprint:** SPRINT-138
**Phase:** Phase 1 -- Foundation (Sequential)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2208-dndkit-placeholder-pages`
**Estimated Tokens:** ~8K
**Depends On:** None (first task in sprint)

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

Install the @dnd-kit packages needed for the Kanban board and create simple placeholder pages for all PM sidebar routes that currently return 404 (board, sprints, projects, my-tasks, settings). This eliminates broken navigation and unblocks all subsequent Sprint C tasks.

## Non-Goals

- Do NOT implement any actual page functionality (just "Coming Soon" placeholders)
- Do NOT create any PM components
- Do NOT modify existing PM pages (dashboard, backlog, task detail)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT configure or use @dnd-kit in this task (just install it)

## Deliverables

1. Install npm packages: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
2. New file: `admin-portal/app/dashboard/pm/board/page.tsx` (~25 lines placeholder)
3. New file: `admin-portal/app/dashboard/pm/sprints/page.tsx` (~25 lines placeholder)
4. New file: `admin-portal/app/dashboard/pm/sprints/[id]/page.tsx` (~25 lines placeholder)
5. New file: `admin-portal/app/dashboard/pm/projects/page.tsx` (~25 lines placeholder)
6. New file: `admin-portal/app/dashboard/pm/projects/[id]/page.tsx` (~25 lines placeholder)
7. New file: `admin-portal/app/dashboard/pm/my-tasks/page.tsx` (~25 lines placeholder)
8. New file: `admin-portal/app/dashboard/pm/settings/page.tsx` (~25 lines placeholder)

## File Boundaries

### Files to create (owned by this task):

- `admin-portal/app/dashboard/pm/board/page.tsx`
- `admin-portal/app/dashboard/pm/sprints/page.tsx`
- `admin-portal/app/dashboard/pm/sprints/[id]/page.tsx`
- `admin-portal/app/dashboard/pm/projects/page.tsx`
- `admin-portal/app/dashboard/pm/projects/[id]/page.tsx`
- `admin-portal/app/dashboard/pm/my-tasks/page.tsx`
- `admin-portal/app/dashboard/pm/settings/page.tsx`

### Files to modify (owned by this task):

- `admin-portal/package.json` (add @dnd-kit dependencies)
- `admin-portal/package-lock.json` (auto-updated by npm install)

### Files this task must NOT modify:

- All existing PM pages (`pm/page.tsx`, `pm/backlog/page.tsx`, `pm/tasks/[id]/page.tsx`)
- All PM components under `pm/components/`
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Any other files outside admin-portal/

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are in package.json dependencies
- [ ] `npm install` completes without errors
- [ ] `/dashboard/pm/board` renders a placeholder page (not 404)
- [ ] `/dashboard/pm/sprints` renders a placeholder page (not 404)
- [ ] `/dashboard/pm/sprints/[any-id]` renders a placeholder page (not 404)
- [ ] `/dashboard/pm/projects` renders a placeholder page (not 404)
- [ ] `/dashboard/pm/projects/[any-id]` renders a placeholder page (not 404)
- [ ] `/dashboard/pm/my-tasks` renders a placeholder page (not 404)
- [ ] `/dashboard/pm/settings` renders a placeholder page (not 404)
- [ ] Each placeholder shows the page name and "Coming Soon" text
- [ ] Each placeholder has a "Back to Dashboard" link to `/dashboard/pm`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### Install @dnd-kit

```bash
cd admin-portal
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Placeholder Page Template

Use this pattern for all placeholder pages:

```tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BoardPlaceholderPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/pm"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Board</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kanban board view -- Coming Soon
        </p>
      </div>
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
        <div className="text-center">
          <p className="text-gray-400 text-lg font-medium">Coming Soon</p>
          <p className="text-gray-300 text-sm mt-1">This page is under development</p>
        </div>
      </div>
    </div>
  );
}
```

Adapt the title and description for each route:

| Route | Title | Description |
|-------|-------|-------------|
| `/dashboard/pm/board` | Board | Kanban board view |
| `/dashboard/pm/sprints` | Sprints | Sprint planning and tracking |
| `/dashboard/pm/sprints/[id]` | Sprint Detail | Sprint detail view |
| `/dashboard/pm/projects` | Projects | Project management |
| `/dashboard/pm/projects/[id]` | Project Detail | Project detail view |
| `/dashboard/pm/my-tasks` | My Tasks | Tasks assigned to you |
| `/dashboard/pm/settings` | Settings | PM module settings |

**Note:** For dynamic route pages (`[id]/page.tsx`), use `'use client'` and access the ID from params if needed for display, but the placeholder doesn't need to use it. Just ensure the file exists at the correct path so Next.js routing works.

### Dynamic Route Placeholder

```tsx
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SprintDetailPlaceholderPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/pm/sprints"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sprints
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Sprint Detail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sprint detail view -- Coming Soon
        </p>
      </div>
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
        <div className="text-center">
          <p className="text-gray-400 text-lg font-medium">Coming Soon</p>
          <p className="text-gray-300 text-sm mt-1">This page is under development</p>
        </div>
      </div>
    </div>
  );
}
```

## Integration Notes

- **Required by:** All subsequent Sprint C tasks (TASK-2209 through TASK-2217)
- **@dnd-kit used by:** TASK-2209 (KanbanBoard, KanbanColumn, KanbanCard), TASK-2210 (BacklogSidePanel)
- **Placeholder pages replaced by:** TASK-2214 (board), TASK-2215 (sprints), TASK-2216 (projects), TASK-2217 (my-tasks)
- **Settings placeholder stays** until Sprint D

## Do / Don't

### Do:
- Install exact @dnd-kit packages: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Use consistent placeholder layout across all pages
- Use the existing `max-w-7xl mx-auto` container pattern
- Include back navigation on every placeholder

### Don't:
- Do NOT use @dnd-kit in any file yet (just install it)
- Do NOT import or use pm-queries.ts in placeholder pages (no data fetching)
- Do NOT add `'use client'` on static placeholder pages (only on dynamic `[id]` routes if needed)
- Do NOT modify the PM dashboard page (it already exists and works)
- Do NOT install any other packages besides @dnd-kit

## When to Stop and Ask

- If @dnd-kit packages fail to install or have peer dependency conflicts
- If any existing PM page breaks after npm install
- If you need to modify tsconfig.json or next.config for @dnd-kit compatibility

## Testing Expectations

### Unit Tests
- **Required:** No

### CI Requirements
- [ ] `npm install` completes without errors
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): install @dnd-kit and add placeholder pages for all PM routes`
- **Branch:** `feature/TASK-2208-dndkit-placeholder-pages`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| npm install | 1 command | +1K |
| Placeholder pages | 7 nearly identical files | +5K |
| Boilerplate | All pages follow same pattern | -1K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** High (simple, repetitive work)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-03-16*

### Agent ID
```
Engineer Agent ID: a45d5e84
```

### Checklist

```
Packages installed:
- [x] @dnd-kit/core (^6.3.1)
- [x] @dnd-kit/sortable (^10.0.0)
- [x] @dnd-kit/utilities (^3.2.2)

Files created:
- [x] admin-portal/app/dashboard/pm/board/page.tsx
- [x] admin-portal/app/dashboard/pm/sprints/page.tsx
- [x] admin-portal/app/dashboard/pm/sprints/[id]/page.tsx
- [x] admin-portal/app/dashboard/pm/projects/page.tsx
- [x] admin-portal/app/dashboard/pm/projects/[id]/page.tsx
- [x] admin-portal/app/dashboard/pm/my-tasks/page.tsx
- [x] admin-portal/app/dashboard/pm/settings/page.tsx

Verification:
- [x] npx tsc --noEmit passes
- [x] npm run lint passes
- [x] npm run build passes
```

### Implementation Notes

- All placeholder pages follow consistent template with back navigation, title, description, and "Coming Soon" dashed border card
- Static pages (no 'use client') for: board, sprints, projects, my-tasks, settings
- Dynamic pages ('use client') for: sprints/[id], projects/[id]
- No existing files modified beyond package.json/package-lock.json
- No deviations from task spec

**Issues/Blockers:** None

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |

**Variance:** PM Est ~8K vs Actual (auto-captured)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #1195
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
