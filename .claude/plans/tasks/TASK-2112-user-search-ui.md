# TASK-2112: User Search UI

**Status:** Completed
**Completed:** 2026-03-05
**Sprint:** SPRINT-111

---

## Goal

Build the `/dashboard/users` search page in the admin portal. Internal users can search for any user across all organizations by name, email, org, or user ID.

## Non-Goals

- Do NOT build the user detail view -- that's TASK-2113
- Do NOT add write/management actions
- Do NOT modify broker-portal

## Depends On

- TASK-2111 (`admin_search_users` RPC must exist)

## Deliverables

### Files Created

- `admin-portal/app/dashboard/users/page.tsx` -- search page (server component shell)
- `admin-portal/app/dashboard/users/components/UserSearchBar.tsx` -- client component with debounced search input
- `admin-portal/app/dashboard/users/components/UserResultsTable.tsx` -- results table
- `admin-portal/lib/admin-queries.ts` -- helper to call admin RPCs

### Files Modified

- `admin-portal/components/layout/Sidebar.tsx` -- enabled "Users" nav item

## Acceptance Criteria

- [x] `/dashboard/users` renders the search page
- [x] Sidebar "Users" link is enabled and navigates correctly
- [x] Searching by email returns matching results
- [x] Searching by name returns matching results
- [x] Searching by org slug returns matching results
- [x] Clicking a result row navigates to `/dashboard/users/[id]`
- [x] Empty, loading, and no-results states all render correctly
- [x] `npm run build` passes
- [x] No TypeScript errors

---

## PM Estimate

**Category:** `service`
**Estimated Tokens:** ~25K
**Token Cap:** 50K
**Confidence:** Medium
