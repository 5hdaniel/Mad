# Task TASK-2290: Add Category Editing to Ticket Detail Sidebar

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Add a category editing dropdown to the support ticket detail sidebar (`TicketSidebar.tsx`) so agents can change a ticket's category from "Uncategorized" (or any category) to another. Currently the category section is read-only text.

## Non-Goals

- Do NOT add subcategory editing (can be a follow-up)
- Do NOT add category management/CRUD (creating new categories)
- Do NOT modify the ticket table inline edit (that is TASK-2295)
- Do NOT change category display in the ticket list table

## Deliverables

1. Update: `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` -- replace read-only category display with editable dropdown
2. Update: `admin-portal/lib/support-queries.ts` -- add `updateTicketCategory()` function
3. New migration (if needed): Supabase RPC `support_update_ticket_category` or verify existing RPC handles it

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/support/components/TicketSidebar.tsx`
- `admin-portal/lib/support-queries.ts`
- Supabase migration (if new RPC needed)

### Files this task must NOT modify:

- `admin-portal/app/dashboard/support/components/TicketTable.tsx` -- Owned by TASK-2292/2293/2294/2295
- `admin-portal/app/dashboard/support/components/TicketFilters.tsx`

## Acceptance Criteria

- [ ] Category section in TicketSidebar shows a dropdown instead of read-only text
- [ ] Dropdown lists all available categories from `support_categories` table
- [ ] Selecting a new category and clicking Save updates the ticket's `category_id`
- [ ] The change is reflected immediately in the sidebar (optimistic or after refresh)
- [ ] "Uncategorized" option available (set category_id to NULL)
- [ ] Error handling: show error message if update fails
- [ ] Loading state while saving
- [ ] All CI checks pass

## Implementation Notes

### Current State

In `TicketSidebar.tsx`, the Category section (around line 252-263) renders as read-only:
```tsx
{/* Category */}
<div className="px-4 py-3">
  <label>Category</label>
  <div>
    <Tag className="h-3.5 w-3.5 text-gray-400" />
    {ticket.category_name || 'Uncategorized'}
  </div>
</div>
```

### Approach

1. **Fetch categories** -- Use existing category fetch from `support-queries.ts` (check for `getCategories()` or similar)
2. **Add state and handler** -- Follow the same pattern as priority editing (lines 79-91): `selectedCategory`, `updatingCategory`, `handleCategorySave()`
3. **Add or reuse RPC** -- Check if `support_update_ticket` or similar generic update RPC exists. If not, create `support_update_ticket_category(p_ticket_id UUID, p_category_id UUID)`.

### Pattern to Follow

Match the existing priority edit pattern in the same file:
```tsx
<select value={selectedCategory} onChange={...}>
  <option value="">Uncategorized</option>
  {categories.map((cat) => (
    <option key={cat.id} value={cat.id}>{cat.name}</option>
  ))}
</select>
<button onClick={handleCategorySave}>Save</button>
```

## Integration Notes

- TASK-2295 (inline edit) will add inline category editing in the table -- this task covers the sidebar only
- The `SupportTicket` type already has `category_id`, `category_name` fields

## Do / Don't

### Do:

- Follow the exact same UI pattern as the priority dropdown in TicketSidebar
- Load categories on mount (same as agents are loaded)
- Handle the null/uncategorized case

### Don't:

- Add subcategory selection (scope creep)
- Change the category data model or `support_categories` table
- Modify other sidebar sections

## When to Stop and Ask

- If there's no existing RPC to update ticket category and you need to create one
- If the categories table structure is different than expected
- If category editing needs org-level scoping

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI component -- manual testing)

### Coverage

- Coverage impact: Not enforced for this UI change

### Integration / Feature Tests

- Required scenarios:
  - Open ticket detail with "Uncategorized" category
  - Select a category from dropdown, save
  - Verify category persists after page refresh
  - Change category back to "Uncategorized"

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-3 files | +5K |
| Code volume | ~50 lines new code | +3K |
| Complexity | Low -- follows existing pattern | +2K |

**Confidence:** High

**Risk factors:**
- May need new Supabase RPC if none exists for category update

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-03-20*

### Agent ID

```
Engineer Agent ID: agent-afdd2b74
```

### Checklist

```
Files modified:
- [x] admin-portal/app/dashboard/support/components/TicketSidebar.tsx
- [x] admin-portal/lib/support-queries.ts
- [x] supabase/migrations/20260320_support_update_ticket_category.sql

Features implemented:
- [x] Category dropdown in sidebar
- [x] Save/loading/error states
- [x] Uncategorized option

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
```

### Changes Made

1. **New Supabase RPC** (`support_update_ticket_category`): SECURITY DEFINER function following the priority RPC pattern -- auth guard, category validation, no-op on same value, event logging with human-readable category names.

2. **`updateTicketCategory()` query function**: Added to `support-queries.ts` following `updateTicketPriority()` pattern. Accepts `ticketId` and nullable `categoryId`.

3. **TicketSidebar category dropdown**: Replaced read-only Tag + text display with editable select dropdown + Save button. Fetches top-level categories on mount via `getCategories()`. "Uncategorized" maps to `category_id = NULL`. Save button disabled when value unchanged. Loading/error states match existing priority/status pattern.

**Issues/Blockers:** None

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
