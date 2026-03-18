# TASK-2222: Project Detail Redesign -- Collapsible Sprints + Inline Create + Drag-to-Assign

**Backlog ID:** BACKLOG-1026
**Sprint:** SPRINT-141
**Phase:** 2 (Core Features)
**Branch:** `feature/task-2222-project-detail-redesign`
**Estimated Tokens:** ~50K (ui category, x1.0 multiplier)

---

## Objective

Redesign the project detail page (`/dashboard/pm/projects/[id]`) to combine the items table and sprints list into a unified view with a responsive side-by-side layout (wide) or stacked layout (narrow). Each sprint section is collapsible with an item table inside. Add inline "+ Add item" rows and a "+ Create new sprint" row. Optionally support drag from backlog to sprint to auto-assign.

---

## Context

The current project detail page (`projects/[id]/page.tsx`, 374 lines) shows:
- Back link, project header with status badge
- Status summary with progress bar + status badges
- Token metric cards (4 cards: est tokens, actual tokens, variance, days open)
- Items section with TaskTable + "New Item" button (BACKLOG-1025 just merged)
- Sprints section with SprintList table

The redesign combines these into a more functional layout where sprints are the organizing principle, each with its own collapsible item table.

---

## Requirements

### Must Do:
1. **Responsive layout:**
   - **Wide viewport (>= 1024px):** Side-by-side panels. Left panel = backlog items not assigned to a sprint. Right panel = sprint list with collapsible sections.
   - **Narrow viewport (< 1024px):** Stacked. Backlog panel on top, sprint sections below.

2. **Sprint sections:**
   - Each sprint renders as a collapsible section (header with name, status badge, progress bar, chevron toggle)
   - Expanded: shows an item table with items assigned to that sprint
   - Collapsed: shows only the header line
   - Default state: active sprints expanded, completed/cancelled sprints collapsed

3. **Inline item creation:**
   - Each sprint section has a "+ Add item" row at the bottom
   - Clicking opens a minimal inline form (just title input + submit button)
   - Creates the item with `createItem({ title, sprint_id, project_id })`
   - The unassigned backlog panel also has a "+ Add item" row

4. **Sprint creation:**
   - A "+ Create new sprint" row at the bottom of the sprint list
   - Clicking opens inline form (name + optional goal)
   - Creates sprint with `createSprint(name, goal, projectId)`

5. **Keep existing features:**
   - Project header with name, description, status badge
   - Status summary progress bar (can be simplified/moved to header area)
   - Token metric cards (keep or collapse into a summary row)
   - Back link to projects list

6. **Drag-to-assign (NICE-TO-HAVE):**
   - Drag an item from the backlog panel to a sprint section header to assign it
   - Uses @dnd-kit (already installed)
   - If this pushes the estimate beyond 50K tokens, skip it and document as deferred

### Must NOT Do:
- Do NOT modify the SprintList or SprintCard components (this page builds its own sprint sections)
- Do NOT modify `pm-queries.ts` function signatures
- Do NOT add new npm dependencies beyond what is already installed
- Do NOT change the project list page (`projects/page.tsx`)

---

## Acceptance Criteria

- [ ] Wide viewport: side-by-side layout (backlog panel | sprint sections)
- [ ] Narrow viewport: stacked layout (backlog panel above sprint sections)
- [ ] Each sprint renders as collapsible section with header (name, status, progress, toggle)
- [ ] Active sprints default to expanded; completed/cancelled default to collapsed
- [ ] Sprint section expanded view shows item table
- [ ] "+ Add item" inline row in each sprint section creates item assigned to that sprint
- [ ] "+ Add item" in backlog panel creates unassigned item
- [ ] "+ Create new sprint" row creates sprint for this project
- [ ] Project header still shows name, status, description
- [ ] Back link to projects list works
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/projects/[id]/page.tsx` -- Complete redesign of the page layout

## Files to Create (potentially)

- `admin-portal/app/dashboard/pm/components/ProjectSprintSection.tsx` -- Collapsible sprint section component (optional, could be inline)
- `admin-portal/app/dashboard/pm/components/InlineItemCreate.tsx` -- Inline item creation row (optional, could be inline)

## Files to Read (for context)

- `admin-portal/lib/pm-queries.ts` -- `listItems()`, `createItem()`, `createSprint()`, `getProjectDetail()`, `assignToSprint()`
- `admin-portal/lib/pm-types.ts` -- `PmProject`, `PmSprint`, `PmBacklogItem`, `ProjectDetailResponse`
- `admin-portal/app/dashboard/pm/components/TaskTable.tsx` -- Existing table pattern for items
- `admin-portal/app/dashboard/pm/board/page.tsx` -- Reference for DnD patterns (if implementing drag-to-assign)

---

## Implementation Notes

**Page structure (wide viewport):**

```
+------------------------------------------------------------------+
| < Back to Projects                                                |
| [FolderKanban] Project Name            [Active]                   |
| Description text...                                               |
|                                                                   |
| [Est: 45K] [Actual: 38K] [Variance: -16%] [12 days open]        |
+------------------------------------------------------------------+
| Backlog (unassigned)        |  Sprints                            |
| +--------------------------+|  +---sprint header: SPRINT-141 [Active] 3/10 ==>|
| | Title    Status  Priority||  |  item table rows...                           |
| | Item A   Pending Medium  ||  |  + Add item                                  |
| | Item B   Pending Low     ||  +----------------------------------------------+
| | + Add item               ||  +---sprint header: SPRINT-140 [Completed] 10/10|
| +--------------------------+|  |  (collapsed)                                  |
|                             |  +----------------------------------------------+
|                             |  + Create new sprint                             |
+------------------------------------------------------------------+
```

**Collapsible sprint section pattern:**
```tsx
function SprintSection({ sprint, projectId, onRefresh }: { sprint: PmSprint; projectId: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(sprint.status === 'active');
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && items.length === 0) {
      // Lazy-load items only when expanded
      setLoading(true);
      listItems({ sprint_id: sprint.id, project_id: projectId, page_size: 100 })
        .then(res => setItems(res.items))
        .finally(() => setLoading(false));
    }
  }, [expanded]);

  const completed = sprint.item_counts?.completed ?? 0;
  const total = sprint.total_items ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100">
        {expanded ? <ChevronDown /> : <ChevronRight />}
        <span className="font-medium text-gray-900">{sprint.name}</span>
        <StatusBadge status={sprint.status} />
        <div className="flex-1" />
        <ProgressBar pct={pct} />
        <span className="text-xs text-gray-500">{completed}/{total}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-2">
          {loading ? <Skeleton /> : <MiniItemTable items={items} />}
          <InlineItemCreate sprintId={sprint.id} projectId={projectId} onCreated={onRefresh} />
        </div>
      )}
    </div>
  );
}
```

**Inline item creation pattern:**
```tsx
function InlineItemCreate({ sprintId, projectId, onCreated }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-2">
        <Plus className="h-3 w-3" /> Add item
      </button>
    );
  }

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!title.trim()) return;
      setSubmitting(true);
      await createItem({ title, sprint_id: sprintId || undefined, project_id: projectId });
      setTitle('');
      setAdding(false);
      setSubmitting(false);
      onCreated();
    }} className="flex items-center gap-2 py-2">
      <input type="text" value={title} onChange={e => setTitle(e.target.value)}
             placeholder="Item title..." className="flex-1 text-sm border rounded px-2 py-1" autoFocus />
      <button type="submit" disabled={submitting || !title.trim()}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
        Add
      </button>
      <button type="button" onClick={() => { setAdding(false); setTitle(''); }}
              className="text-xs text-gray-500">Cancel</button>
    </form>
  );
}
```

**Backlog panel (left side, items with no sprint):**
Use `listItems({ project_id: projectId, page_size: 100 })` and filter to items where `sprint_id === null`.

**Responsive layout:**
```tsx
<div className="flex flex-col lg:flex-row gap-6">
  {/* Backlog panel */}
  <div className="w-full lg:w-1/3 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
    ...backlog items...
  </div>

  {/* Sprint sections */}
  <div className="flex-1 space-y-4">
    {sprints.map(sprint => <SprintSection key={sprint.id} sprint={sprint} ... />)}
    <InlineSprintCreate projectId={projectId} onCreated={refreshAll} />
  </div>
</div>
```

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Navigate to a project detail page
  2. Verify side-by-side layout on wide screen, stacked on narrow
  3. Verify active sprints are expanded, completed are collapsed
  4. Click sprint header to toggle collapse
  5. Click "+ Add item" in a sprint section, type title, submit -- item appears in table
  6. Click "+ Add item" in backlog panel -- item appears unassigned
  7. Click "+ Create new sprint" -- sprint appears in list
  8. Verify back link works

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(pm): redesign project detail with collapsible sprints and inline create`
- **Branch:** `feature/task-2222-project-detail-redesign`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 50K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Drag-to-assign implementation would push the scope beyond 50K tokens -- defer it
- The `getProjectDetail` RPC does not return enough data for sprint sections (may need individual `listItems` calls per sprint)
- You need to create more than 2 new component files (scope creep signal)
- The responsive layout requires a fundamentally different component architecture
- You encounter blockers not covered in the task file
