# TASK-2225: Backlog Table -- Add Assignee Column

**Backlog ID:** BACKLOG-1023
**Sprint:** SPRINT-141
**Phase:** 3 (Medium Features)
**Branch:** `feature/task-2225-assignee-column`
**Estimated Tokens:** ~15K (ui category, x1.0 multiplier)

---

## Objective

Add an "Assignee" column to the backlog TaskTable component showing the assigned user's display name (or "Unassigned"). This column should appear between the "Priority" and "Area" columns.

---

## Context

The TaskTable (`TaskTable.tsx`, 335 lines) currently shows these columns: ID, Title, Type, Status, Priority, Area, Est, Created. There is no Assignee column. Each `PmBacklogItem` has an `assignee_id` field (UUID string or null) but not the user's name.

To display the assignee name, we need to resolve `assignee_id` -> display name. Options:
1. Enrich `PmBacklogItem` in the RPC to include `assignee_name` (preferred, no extra call)
2. Load the user list via `listAssignableUsers()` and build a lookup map client-side
3. Add an `assignee_name` field to the `pm_list_items` RPC return

Since modifying the RPC may be out of scope (no Supabase migration), Option 2 (client-side lookup) is the safest approach.

---

## Requirements

### Must Do:
1. **Add "Assignee" column** to the TaskTable between Priority and Area
2. **Display assignee name:** Show `display_name` or email for the assigned user, or "Unassigned" if `assignee_id` is null
3. **User name resolution:** Load user list via `listAssignableUsers()` in the parent page and pass a `userMap` prop to TaskTable. Alternatively, have TaskTable load users internally.
4. **Sortable column (optional):** Sorting by assignee is complex (would need server-side sort). Make the column header non-sortable for now.
5. **Ensure no layout breakage:** The table should not overflow horizontally on standard screens. If needed, reduce the "Area" or "Created" column width.

### Must NOT Do:
- Do NOT modify `pm-queries.ts` RPC call signatures
- Do NOT add a new Supabase migration
- Do NOT add new npm dependencies
- Do NOT change the `PmBacklogItem` type definition (use external lookup map instead)

---

## Acceptance Criteria

- [ ] TaskTable shows "Assignee" column between Priority and Area
- [ ] Assigned items show the user's display_name (or email fallback)
- [ ] Unassigned items show "Unassigned" in gray text
- [ ] Backlog page loads user list and passes it to TaskTable
- [ ] Table layout is not broken on standard screen widths (>= 1280px)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/components/TaskTable.tsx` -- Add Assignee column
- `admin-portal/app/dashboard/pm/backlog/page.tsx` -- Load user map and pass to TaskTable

## Files to Read (for context)

- `admin-portal/lib/pm-queries.ts` -- `listAssignableUsers()` (line 768)
- `admin-portal/lib/pm-types.ts` -- `PmBacklogItem` (assignee_id field)
- `admin-portal/app/dashboard/pm/backlog/page.tsx` -- Current backlog page

---

## Implementation Notes

**TaskTable prop change:**

```typescript
interface TaskTableProps {
  // ... existing props
  userMap?: Map<string, { display_name: string | null; email: string }>;
}
```

**User lookup in backlog page:**

```tsx
// In backlog/page.tsx:
const [userMap, setUserMap] = useState<Map<string, { display_name: string | null; email: string }>>(new Map());

useEffect(() => {
  listAssignableUsers().then(users => {
    const map = new Map<string, { display_name: string | null; email: string }>();
    for (const user of users) {
      map.set(user.id, { display_name: user.display_name, email: user.email });
    }
    setUserMap(map);
  }).catch(() => {});
}, []);

// Pass to TaskTable:
<TaskTable
  items={items}
  userMap={userMap}
  // ... other props
/>
```

**Assignee column in TaskTable:**

Add between Priority and Area:
```tsx
// In the header:
<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Assignee
</th>

// In each row:
<td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
  {item.assignee_id && userMap?.has(item.assignee_id)
    ? (userMap.get(item.assignee_id)!.display_name || userMap.get(item.assignee_id)!.email)
    : <span className="text-gray-300">Unassigned</span>
  }
</td>
```

**Note on other pages using TaskTable:**
TaskTable is used by:
- `backlog/page.tsx` -- Main usage, needs userMap
- `projects/[id]/page.tsx` -- Also shows items, should also get userMap
- `my-tasks/page.tsx` -- Shows user's own items, should also get userMap

When adding the prop, make it optional (`userMap?`) so pages that don't provide it gracefully degrade (show assignee_id or "Unassigned").

Consider loading the userMap at a higher level or creating a shared hook:
```tsx
function useUserMap() {
  const [userMap, setUserMap] = useState(new Map());
  useEffect(() => {
    listAssignableUsers().then(users => {
      const map = new Map();
      for (const u of users) map.set(u.id, { display_name: u.display_name, email: u.email });
      setUserMap(map);
    }).catch(() => {});
  }, []);
  return userMap;
}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Backlog page: verify "Assignee" column appears in table header
  2. Items with assignee_id show the user's name
  3. Items without assignee_id show "Unassigned" (gray)
  4. Table layout is not broken (no horizontal scroll on normal screens)
  5. Project detail page (if updated): same assignee column behavior

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(pm): add Assignee column to backlog table`
- **Branch:** `feature/task-2225-assignee-column`
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
- **Actual Tokens**: ~XK (Est: 15K)
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
- `listAssignableUsers()` returns empty (RPC permission issue)
- Adding the column causes significant layout breakage on standard screens
- Other pages that use TaskTable (projects, my-tasks) need to be updated simultaneously
- You encounter blockers not covered in the task file
