# Task TASK-2200: PM Types, Queries, and Timeline Utils

**Status:** Pending
**Backlog ID:** BACKLOG-960
**Sprint:** SPRINT-137
**Phase:** Phase 1 -- Foundation Layer
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2200-pm-types-queries-timeline`
**Estimated Tokens:** ~25K
**Depends On:** None (SPRINT-135 deliverables already merged to feature/pm-module)

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

Create three foundational library files for the PM module: TypeScript type definitions (`pm-types.ts`), Supabase RPC query functions (`pm-queries.ts`), and timeline utility functions (`pm-timeline-utils.ts`). These files are the data layer that every PM component and page will import from.

## Non-Goals

- Do NOT create any React components or pages
- Do NOT modify existing support module files
- Do NOT create any Supabase migrations (schema is done in SPRINT-135)
- Do NOT modify `permissions.ts` or `Sidebar.tsx` (done in SPRINT-135)
- Do NOT add any npm dependencies

## Deliverables

1. New file: `admin-portal/lib/pm-types.ts` (~300 lines)
2. New file: `admin-portal/lib/pm-queries.ts` (~400 lines)
3. New file: `admin-portal/lib/pm-timeline-utils.ts` (~120 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/lib/pm-types.ts` (new)
- `admin-portal/lib/pm-queries.ts` (new)
- `admin-portal/lib/pm-timeline-utils.ts` (new)

### Files this task must NOT modify:

- `admin-portal/lib/support-types.ts` -- Existing support module
- `admin-portal/lib/support-queries.ts` -- Existing support module
- `admin-portal/lib/timeline-utils.ts` -- Existing support module
- Any files under `admin-portal/app/` -- Components/pages are other tasks
- Any files under `admin-portal/components/` -- Existing layout components

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `admin-portal/lib/pm-types.ts` exports all PM type definitions, enums, status transitions, color maps
- [ ] `admin-portal/lib/pm-queries.ts` exports functions wrapping all 36 PM RPCs
- [ ] `admin-portal/lib/pm-timeline-utils.ts` exports `buildPmTimeline`, `getPmEventIcon`, `getPmEventDescription`, `getPmActorName`
- [ ] All type definitions match the actual Supabase RPC return shapes from `20260316_pm_rpcs.sql`
- [ ] Query functions use `createClient()` from `@/lib/supabase/client` (same pattern as support-queries.ts)
- [ ] `npx tsc --noEmit` passes (from `admin-portal/`)
- [ ] `npm run lint` passes (from `admin-portal/`)
- [ ] `npm run build` passes (from `admin-portal/`)
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### 1. pm-types.ts

**Pattern template:** `admin-portal/lib/support-types.ts` (292 lines)

This file defines all TypeScript types for the PM module. Adapt the structure from `support-types.ts` but with PM-specific types.

#### Types to Define

**Status/Priority/Type enums:**
```typescript
export type ItemStatus = 'pending' | 'in_progress' | 'testing' | 'completed' | 'blocked' | 'deferred' | 'obsolete' | 'reopened';
export type ItemPriority = 'low' | 'medium' | 'high' | 'critical';
export type ItemType = 'feature' | 'bug' | 'chore' | 'refactor' | 'test' | 'docs' | 'security' | 'performance';
export type DependencyType = 'depends_on' | 'blocks' | 'related_to';
export type LinkType = 'blocked_by' | 'blocks' | 'related_to' | 'parent_child';
export type SprintStatus = 'planned' | 'active' | 'completed' | 'deprecated';
```

**Core interfaces (match RPC return shapes):**
```typescript
export interface PmBacklogItem {
  id: string;
  item_number: number;
  legacy_id: string | null;
  title: string;
  description: string | null;
  body: string | null;
  type: ItemType;
  area: string | null;
  status: ItemStatus;
  priority: ItemPriority;
  parent_id: string | null;
  project_id: string | null;
  sprint_id: string | null;
  assignee_id: string | null;
  est_tokens: number | null;
  actual_tokens: number | null;
  variance: number | null;
  sort_order: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  // Joined from RPCs
  labels?: PmLabel[];
  child_count?: number;
}

export interface PmSprint { ... }
export interface PmProject { ... }
export interface PmTask { ... }
export interface PmComment { ... }
export interface PmEvent { ... }
export interface PmDependency { ... }
export interface PmLabel { ... }
export interface PmTaskLink { ... }
export interface PmSavedView { ... }
```

**Request/Response types:**
```typescript
export interface ItemListParams {
  status?: ItemStatus | null;
  priority?: ItemPriority | null;
  type?: ItemType | null;
  area?: string | null;
  sprint_id?: string | null;
  project_id?: string | null;
  search?: string | null;
  labels?: string[] | null;
  parent_id?: string | null;
  page?: number;
  page_size?: number;
}

export interface ItemListResponse {
  items: PmBacklogItem[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface ItemDetailResponse {
  item: PmBacklogItem;
  comments: PmComment[];
  events: PmEvent[];
  dependencies: PmDependency[];
  links: PmTaskLink[];
  labels: PmLabel[];
}

export interface PmStats {
  total_items: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_type: Record<string, number>;
}

export interface CreateItemParams {
  title: string;
  description?: string | null;
  type?: ItemType;
  area?: string | null;
  priority?: ItemPriority;
  parent_id?: string | null;
  project_id?: string | null;
  sprint_id?: string | null;
  est_tokens?: number | null;
  start_date?: string | null;
  due_date?: string | null;
}
```

**Status transition map (from DB CHECK constraints):**
```typescript
export const ALLOWED_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  pending: ['in_progress', 'blocked', 'deferred'],
  in_progress: ['testing', 'blocked', 'deferred', 'pending'],
  testing: ['completed', 'in_progress', 'blocked'],
  completed: ['reopened'],
  blocked: ['pending', 'in_progress'],
  deferred: ['pending'],
  obsolete: [],
  reopened: ['in_progress', 'pending'],
};
```

**Label/color maps:**
```typescript
export const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  testing: 'Testing',
  completed: 'Completed',
  blocked: 'Blocked',
  deferred: 'Deferred',
  obsolete: 'Obsolete',
  reopened: 'Reopened',
};

export const STATUS_COLORS: Record<ItemStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  testing: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
  deferred: 'bg-orange-100 text-orange-800',
  obsolete: 'bg-gray-100 text-gray-500',
  reopened: 'bg-purple-100 text-purple-800',
};

export const PRIORITY_LABELS: Record<ItemPriority, string> = { ... };
export const PRIORITY_COLORS: Record<ItemPriority, string> = { ... };
export const TYPE_LABELS: Record<ItemType, string> = { ... };
export const TYPE_COLORS: Record<ItemType, string> = { ... };
```

**Timeline entry type:**
```typescript
export type PmTimelineEntry =
  | { type: 'comment'; data: PmComment; timestamp: string }
  | { type: 'event'; data: PmEvent; timestamp: string };
```

**CRITICAL**: Check the actual column names in `20260316_pm_schema.sql` and return shapes in `20260316_pm_rpcs.sql` (on the `feature/pm-module` branch). The types must match exactly. Run:
```bash
git show origin/feature/pm-module:supabase/migrations/20260316_pm_schema.sql | grep "CREATE TABLE\|  [a-z]"
git show origin/feature/pm-module:supabase/migrations/20260316_pm_rpcs.sql
```

### 2. pm-queries.ts

**Pattern template:** `admin-portal/lib/support-queries.ts` (408 lines)

Wrap every PM RPC in a typed function. Follow the exact same pattern: `createClient()`, `supabase.rpc(name, params)`, cast result.

**Functions to create (1:1 with RPCs):**

```typescript
// Core CRUD
export async function listItems(params: ItemListParams): Promise<ItemListResponse> { ... }
export async function getItemDetail(itemId: string): Promise<ItemDetailResponse> { ... }
export async function createItem(params: CreateItemParams): Promise<{ id: string; item_number: number }> { ... }
export async function updateItemStatus(itemId: string, newStatus: string): Promise<...> { ... }
export async function updateItemField(itemId: string, field: string, value: string): Promise<...> { ... }
export async function assignItem(itemId: string, assigneeId: string): Promise<...> { ... }
export async function deleteItem(itemId: string): Promise<...> { ... }
export async function reorderItem(itemId: string, newParentId?: string, sortOrder?: number): Promise<...> { ... }
export async function addComment(itemId: string | null, taskId: string | null, body: string): Promise<...> { ... }

// Dependencies
export async function addDependency(sourceId: string, targetId: string, type?: string): Promise<...> { ... }
export async function removeDependency(dependencyId: string): Promise<void> { ... }

// Labels
export async function createLabel(name: string, color?: string, projectId?: string): Promise<...> { ... }
export async function addItemLabel(itemId: string, labelId: string): Promise<...> { ... }
export async function removeItemLabel(itemId: string, labelId: string): Promise<...> { ... }
export async function listLabels(projectId?: string): Promise<PmLabel[]> { ... }

// Links
export async function linkItems(sourceId: string, targetId: string, linkType: string): Promise<...> { ... }
export async function unlinkItems(linkId: string): Promise<...> { ... }
export async function searchItemsForLink(query: string, excludeId?: string): Promise<...> { ... }

// Sprint
export async function assignToSprint(itemIds: string[], sprintId: string): Promise<...> { ... }
export async function removeFromSprint(itemIds: string[]): Promise<...> { ... }
export async function listSprints(): Promise<PmSprint[]> { ... }
export async function getSprintDetail(sprintId: string): Promise<...> { ... }
export async function createSprint(name: string, goal?: string, projectId?: string, startDate?: string, endDate?: string): Promise<...> { ... }
export async function updateSprintStatus(sprintId: string, status: string): Promise<...> { ... }
export async function getSprintVelocity(count?: number): Promise<...> { ... }

// Projects
export async function listProjects(): Promise<PmProject[]> { ... }
export async function createProject(name: string, description?: string): Promise<...> { ... }
export async function getProjectDetail(projectId: string): Promise<...> { ... }

// Board & Stats
export async function getBoardTasks(sprintId?: string, projectId?: string, area?: string): Promise<...> { ... }
export async function getStats(): Promise<PmStats> { ... }
export async function bulkUpdate(itemIds: string[], updates: Record<string, unknown>): Promise<...> { ... }

// Saved Views
export async function saveView(name: string, filtersJson: Record<string, unknown>, isShared?: boolean): Promise<...> { ... }
export async function listSavedViews(): Promise<PmSavedView[]> { ... }
export async function deleteSavedView(viewId: string): Promise<void> { ... }

// Notifications
export async function getMyNotifications(since?: string): Promise<...> { ... }

// Agent helper
export async function getItemByLegacyId(legacyId: string): Promise<PmBacklogItem> { ... }
```

**CRITICAL**: Check the exact RPC parameter names. They use `p_` prefix in SQL:
```sql
-- Example: pm_list_items takes p_status, p_priority, p_type, etc.
-- In the query function, map JS params to SQL params:
const { data, error } = await supabase.rpc('pm_list_items', {
  p_status: params.status || null,
  p_priority: params.priority || null,
  ...
});
```

### 3. pm-timeline-utils.ts

**Pattern template:** `admin-portal/lib/timeline-utils.ts` (114 lines)

Adapt the support timeline utils for PM events. The structure is identical but the event types differ.

```typescript
import type { PmComment, PmEvent, PmTimelineEntry } from './pm-types';

export function buildPmTimeline(comments: PmComment[], events: PmEvent[]): PmTimelineEntry[] {
  // Same merge + sort pattern as support timeline
  // Filter out 'comment_added' events (the comment itself is shown)
  // Sort newest-first
}

export function getPmEventIcon(eventType: string): { symbol: string; color: string } {
  // Map PM event types to icons:
  // created, status_changed, assigned, priority_changed,
  // item_linked, item_unlinked, dependency_added, dependency_removed,
  // label_added, label_removed, sprint_changed, field_updated
}

export function getPmEventDescription(event: PmEvent): string {
  // Map PM event types to human-readable descriptions
}

export function getPmActorName(event: PmEvent): string | null {
  // Same actor extraction pattern as support timeline
}
```

## Integration Notes

- **Exports to**: Every component and page in SPRINT-137 imports from these files
- **Used by**: TASK-2201 through TASK-2207
- **Depends on**: SPRINT-135 deliverables (RPCs must exist in Supabase)
- **Pattern source**: `admin-portal/lib/support-types.ts`, `support-queries.ts`, `timeline-utils.ts`

## Do / Don't

### Do:
- Follow the exact same code patterns as `support-types.ts` and `support-queries.ts`
- Use `createClient()` from `@/lib/supabase/client` for all queries
- Cast RPC results with `as unknown as <Type>` (same as support queries)
- Check actual RPC signatures from `20260316_pm_rpcs.sql` before coding
- Export all types and functions (components will import them)
- Use JSDoc comments on exported functions

### Don't:
- Do NOT import from support modules (create independent PM types)
- Do NOT use `supabase.from('pm_*')` direct table queries (use RPCs only)
- Do NOT add React/JSX to these files (pure TypeScript)
- Do NOT modify any existing files
- Do NOT guess at RPC return shapes -- check the SQL

## When to Stop and Ask

- If any RPC returns a shape that doesn't match what's documented in the plan
- If `createClient()` import path has changed from what's in support-queries.ts
- If you find RPCs missing from the migration that are listed in the plan
- If type-check reveals conflicts with existing types

## Testing Expectations

### Unit Tests
- **Required:** No (type definitions and thin RPC wrappers -- same decision as support module)
- **Optional:** Timeline utils could have tests adapting `timeline-utils.test.ts`, but not required

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add PM types, queries, and timeline utilities`
- **Branch:** `feature/TASK-2200-pm-types-queries-timeline`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `types` + `service`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new files | +15K |
| Code volume | ~820 lines total (300+400+120) | +8K |
| Pattern reuse | High -- adapting from support module | -5K |
| RPC verification | Need to check SQL file | +2K |

**Confidence:** High

**Risk factors:**
- RPC return shapes may differ from what's documented in the plan vs actual SQL
- 36 RPCs is a lot of wrapper functions to write

**Similar past tasks:** TASK-2196 (PM permissions, actual: ~8K -- but this is 3x the scope)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/lib/pm-types.ts
- [ ] admin-portal/lib/pm-queries.ts
- [ ] admin-portal/lib/pm-timeline-utils.ts

Features implemented:
- [ ] All PM type definitions and enums
- [ ] All 36 RPC wrapper functions
- [ ] Status transition map
- [ ] Color/label maps
- [ ] Timeline builder + event icon/description functions

Verification:
- [ ] npx tsc --noEmit passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**

**Suggestion for similar tasks:**

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
