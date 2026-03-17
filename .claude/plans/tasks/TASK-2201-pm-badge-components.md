# Task TASK-2201: PM Badge Components (Status, Priority, Type, Label)

**Status:** Pending
**Backlog ID:** BACKLOG-961
**Sprint:** SPRINT-137
**Phase:** Phase 2a -- Shared Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2201-pm-badge-components`
**Estimated Tokens:** ~10K
**Depends On:** TASK-2200 (types + color maps must exist)

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

Create four small badge/pill components for displaying PM item status, priority, type, and labels. These are reused by the table, sidebar, and detail pages throughout the PM module.

## Non-Goals

- Do NOT create table, filter, or page components (other tasks)
- Do NOT modify any existing support badge components
- Do NOT add any npm dependencies
- Do NOT create the `components/` directory structure for PM pages -- just the component files

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/TaskStatusBadge.tsx` (~35 lines)
2. New file: `admin-portal/app/dashboard/pm/components/TaskPriorityBadge.tsx` (~30 lines)
3. New file: `admin-portal/app/dashboard/pm/components/TaskTypeBadge.tsx` (~35 lines)
4. New file: `admin-portal/app/dashboard/pm/components/LabelBadge.tsx` (~30 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/components/TaskStatusBadge.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskPriorityBadge.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskTypeBadge.tsx` (new)
- `admin-portal/app/dashboard/pm/components/LabelBadge.tsx` (new)

### Files this task must NOT modify:

- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- `admin-portal/app/dashboard/support/components/*` -- Existing support components
- Any other `admin-portal/app/dashboard/pm/components/*` files -- Owned by TASK-2202/2203/2204

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `TaskStatusBadge` renders a colored pill for each `ItemStatus` value
- [ ] `TaskPriorityBadge` renders a colored pill for each `ItemPriority` value
- [ ] `TaskTypeBadge` renders a colored pill for each `ItemType` value
- [ ] `LabelBadge` renders a colored pill with the label's custom color
- [ ] All badges import types and color maps from `@/lib/pm-types`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### TaskStatusBadge.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/StatusBadge.tsx` (23 lines)

```typescript
import type { ItemStatus } from '@/lib/pm-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/pm-types';

interface TaskStatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

export function TaskStatusBadge({ status, className = '' }: TaskStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]} ${className}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
```

### TaskPriorityBadge.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/PriorityBadge.tsx` (23 lines)

Same pattern as status badge but with `ItemPriority`, `PRIORITY_LABELS`, `PRIORITY_COLORS`.

### TaskTypeBadge.tsx

**NEW component** (no direct support equivalent). Same pill pattern but for `ItemType`:

```typescript
import type { ItemType } from '@/lib/pm-types';
import { TYPE_LABELS, TYPE_COLORS } from '@/lib/pm-types';

interface TaskTypeBadgeProps {
  type: ItemType;
  className?: string;
}

export function TaskTypeBadge({ type, className = '' }: TaskTypeBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[type]} ${className}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}
```

### LabelBadge.tsx

A pill that uses the label's own color (hex) as the background:

```typescript
interface LabelBadgeProps {
  name: string;
  color: string; // hex color like '#6B7280'
  onRemove?: () => void;
  className?: string;
}

export function LabelBadge({ name, color, onRemove, className = '' }: LabelBadgeProps) {
  // Use the hex color with 20% opacity for background, full color for text
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${name}`}>
          x
        </button>
      )}
    </span>
  );
}
```

## Integration Notes

- **Imports from:** `admin-portal/lib/pm-types.ts` (TASK-2200)
- **Used by:** TASK-2202 (TaskTable), TASK-2205 (Backlog page), TASK-2206 (Task detail page)
- **Parallel with:** TASK-2202, TASK-2203, TASK-2204 (different files, no overlap)

## Do / Don't

### Do:
- Follow the exact same pattern as support StatusBadge/PriorityBadge
- Keep components tiny and focused (one responsibility each)
- Export as named exports (not default)
- Use Tailwind utility classes for styling

### Don't:
- Do NOT add click handlers or interactive behavior (these are display-only)
- Do NOT import from support components
- Do NOT use inline styles except for LabelBadge (which needs dynamic hex colors)

## When to Stop and Ask

- If `pm-types.ts` doesn't export the expected color maps or type aliases
- If the `admin-portal/app/dashboard/pm/components/` directory doesn't exist (create it)

## Testing Expectations

### Unit Tests
- **Required:** No (pure presentational components, ~30 lines each)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add badge components for status, priority, type, and labels`
- **Branch:** `feature/TASK-2201-pm-badge-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new files | +5K |
| Code volume | ~130 lines total | +3K |
| Pattern reuse | Very high -- near-identical to support badges | -3K |

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
- [ ] admin-portal/app/dashboard/pm/components/TaskStatusBadge.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskPriorityBadge.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskTypeBadge.tsx
- [ ] admin-portal/app/dashboard/pm/components/LabelBadge.tsx

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

**Variance:** PM Est ~10K vs Actual ~XK

### Notes

**Issues encountered:**

**Reviewer notes:**

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
