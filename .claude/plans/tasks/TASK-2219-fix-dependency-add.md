# TASK-2219: Fix Dependency Add (Depends On / Blocks) Not Working

**Backlog ID:** BACKLOG-1022
**Sprint:** SPRINT-141
**Phase:** 1 (Bug Fixes)
**Branch:** `fix/task-2219-dependency-add`
**Estimated Tokens:** ~20K (ui category, x1.0 multiplier)

---

## Objective

Fix the dependency management in the Task Detail page sidebar. When clicking "Add dependency" or "Add blocker" in the DependencyPanel, the search and add workflow should function correctly. Currently, adding dependencies (Depends On / Blocks) is not working.

---

## Context

The DependencyPanel component (`DependencyPanel.tsx`) renders in the Task Detail sidebar. It receives `dependencies: PmDependency[]` from the parent page. The critical issue is visible at line 257-258 of `tasks/[id]/page.tsx`:

```tsx
<DependencyPanel
  itemId={item.id}
  dependencies={[]}   // <-- HARDCODED EMPTY ARRAY!
  onUpdate={loadDetail}
/>
```

The `dependencies` prop is **always passed as `[]`** instead of actual dependency data from the item detail response. This means:
1. Existing dependencies never render
2. The count always shows "Dependencies (0)"
3. Add/remove may work server-side but the UI never reflects changes

Additionally, the `pm_get_item_detail` RPC response (`ItemDetailResponse`) does NOT include a `dependencies` field -- it returns `item`, `comments`, `events`, `links`, `labels`, `children`. Dependencies are NOT part of the response structure.

---

## Requirements

### Must Do:
1. **Investigate how dependencies should be fetched** -- Either:
   a. The `pm_get_item_detail` RPC needs to also return dependencies (preferred), OR
   b. A separate RPC call is needed to list dependencies for an item
2. **Pass real dependency data to DependencyPanel** instead of `[]`
3. **Verify the add workflow** -- After fixing data flow, confirm that clicking "Add dependency", searching, and selecting an item creates the dependency
4. **Verify the remove workflow** -- Clicking the X on a dependency row removes it
5. **Verify the search works** -- The `searchItemsForLink` call with `excludeId` returns results

### Must NOT Do:
- Do NOT modify `CreateTaskDialog.tsx` (separate fix in TASK-2218)
- Do NOT redesign the DependencyPanel layout
- Do NOT add new npm dependencies

---

## Acceptance Criteria

- [ ] DependencyPanel shows actual dependencies (not always empty)
- [ ] "Add dependency" button opens search, typing returns results
- [ ] Selecting a search result creates a `depends_on` dependency via RPC
- [ ] "Add blocker" button opens search, selecting creates a `blocks` dependency
- [ ] Remove (X) button removes the dependency
- [ ] Circular dependency error message displays correctly
- [ ] Dependency count in header reflects actual count
- [ ] After add/remove, the panel refreshes to show updated state
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/tasks/[id]/page.tsx` -- Pass real dependency data to DependencyPanel
- `admin-portal/app/dashboard/pm/components/DependencyPanel.tsx` -- May need adjustments for data shape
- `admin-portal/lib/pm-queries.ts` -- May need a new `listDependencies()` function or updated `getItemDetail` response
- `admin-portal/lib/pm-types.ts` -- May need to update `ItemDetailResponse` to include dependencies

## Files to Read (for context)

- `admin-portal/lib/pm-queries.ts` -- `addDependency()`, `removeDependency()` (lines 213-240)
- `admin-portal/lib/pm-types.ts` -- `PmDependency`, `ItemDetailResponse` (lines 157-163, 257-264)

---

## Implementation Notes

**Root cause analysis:**

1. **The `dependencies={[]}` hardcode** on line 258 of `tasks/[id]/page.tsx` is the primary issue. This was likely a placeholder that was never wired up.

2. **Missing data source:** `ItemDetailResponse` has `links: PmTaskLink[]` but NOT `dependencies: PmDependency[]`. The `pm_get_item_detail` RPC would need to be extended, OR we need a separate fetch.

**Recommended approach (in priority order):**

**Option A: Add a client-side dependency fetch (simplest, no migration needed)**
```tsx
// In tasks/[id]/page.tsx, add a separate state + fetch:
const [dependencies, setDependencies] = useState<PmDependency[]>([]);

// Create a listDependencies function in pm-queries.ts
// OR query the pm_dependencies table directly via Supabase client
```

**Option B: Check if pm_get_item_detail already returns dependency data**
- The RPC might already include dependencies under a different key
- Run `pm_get_item_detail` for an item with known dependencies and inspect the full response
- If dependencies are returned but not typed, update `ItemDetailResponse`

**For Option A, add to pm-queries.ts:**
```typescript
export async function listItemDependencies(itemId: string): Promise<PmDependency[]> {
  const supabase = createClient();
  // Check if there's a pm_list_dependencies RPC or query the table directly
  const { data, error } = await supabase
    .from('pm_dependencies')
    .select('*')
    .or(`source_id.eq.${itemId},target_id.eq.${itemId}`);
  if (error) throw error;
  return (data ?? []) as PmDependency[];
}
```

**SR Review Note:** RLS will very likely block direct table access (all PM tables use SECURITY DEFINER RPCs). If so, you MUST create a Supabase migration with a new `pm_list_item_dependencies(p_item_id UUID)` RPC. This is pre-approved — do not stop-and-ask for this specific migration. Use `mcp__supabase__apply_migration` to deploy it.

**Then wire up in page.tsx:**
```tsx
const [dependencies, setDependencies] = useState<PmDependency[]>([]);

const loadDeps = useCallback(async () => {
  const deps = await listItemDependencies(itemId);
  setDependencies(deps);
}, [itemId]);

useEffect(() => { loadDeps(); }, [loadDeps]);

// Pass to component:
<DependencyPanel
  itemId={item.id}
  dependencies={dependencies}
  onUpdate={() => { loadDetail(); loadDeps(); }}
/>
```

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Navigate to any task detail page
  2. In sidebar, find "Dependencies (0)" section
  3. Click "Add dependency" -> search -> select item -> verify dependency appears
  4. Click "Add blocker" -> search -> select item -> verify blocker appears
  5. Click X on a dependency -> verify it disappears
  6. Navigate away and back -> verify dependencies persist

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `fix(pm): wire up dependency data in task detail sidebar`
- **Branch:** `fix/task-2219-dependency-add`
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
- **Actual Tokens**: ~XK (Est: 20K)
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
- RLS blocks direct table query AND no existing RPC covers dependencies listing
- A Supabase migration is required (needs approval before proceeding)
- The DependencyPanel component needs fundamental redesign
- You encounter blockers not covered in the task file
