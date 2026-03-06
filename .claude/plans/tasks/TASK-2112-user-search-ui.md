# TASK-2112: User Search UI

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Build the `/dashboard/users` search page in the admin portal. Internal users can search for any user across all organizations by name, email, org, or user ID.

## Non-Goals

- Do NOT build the user detail view — that's TASK-2113
- Do NOT add write/management actions
- Do NOT modify broker-portal

## Depends On

- TASK-2111 (`admin_search_users` RPC must exist)

## Deliverables

### Files to Create

- `admin-portal/app/dashboard/users/page.tsx` — search page (server component shell)
- `admin-portal/app/dashboard/users/components/UserSearchBar.tsx` — client component with debounced search input
- `admin-portal/app/dashboard/users/components/UserResultsTable.tsx` — results table
- `admin-portal/lib/admin-queries.ts` — helper to call admin RPCs

### Files to Modify

- `admin-portal/components/layout/Sidebar.tsx` — enable "Users" nav item (`enabled: true`)

## UI Design

- **Search bar** at top with placeholder "Search by name, email, organization, or user ID..."
- Debounced input (300ms delay)
- **Results table** with columns: Name (avatar + name), Email, Organization, Role, Status, Last Login
- Each row is clickable → navigates to `/dashboard/users/[id]`
- **Empty state** (no query): "Search for users by name, email, organization, or user ID"
- **Loading state**: skeleton rows
- **No results**: "No users found for '[query]'"

## Implementation Notes

- Search bar uses `useState` + `useEffect` for debounce
- Results fetched client-side via Supabase browser client: `supabase.rpc('admin_search_users', { search_query })`
- Use `useRouter` for navigation to detail page
- Match admin portal design patterns (Tailwind + lucide-react)

## Acceptance Criteria

- [ ] `/dashboard/users` renders the search page
- [ ] Sidebar "Users" link is enabled and navigates correctly
- [ ] Searching by email returns matching results
- [ ] Searching by name returns matching results
- [ ] Searching by org slug returns matching results
- [ ] Clicking a result row navigates to `/dashboard/users/[id]`
- [ ] Empty, loading, and no-results states all render correctly
- [ ] `npm run build` passes
- [ ] No TypeScript errors

## PR Preparation

- **Title**: `feat: add user search page to admin portal`
- **Base**: `int/sprint-111-admin-p0`

---

## PM Estimate

**Category:** `service`
**Estimated Tokens:** ~25K
**Token Cap:** 50K
**Confidence:** Medium — straightforward UI but interactive search has state management nuances.

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id>
```

### Checklist
```
Files created:
- [ ] admin-portal/app/dashboard/users/page.tsx
- [ ] admin-portal/app/dashboard/users/components/UserSearchBar.tsx
- [ ] admin-portal/app/dashboard/users/components/UserResultsTable.tsx
- [ ] admin-portal/lib/admin-queries.ts

Files modified:
- [ ] admin-portal/components/layout/Sidebar.tsx

Verification:
- [ ] npm run build passes
- [ ] npm run lint passes
```

---

## SR Engineer Review (SR-Owned)

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
- [ ] Task can now be marked complete
