# BACKLOG-934: Admin Portal UX -- Cross-links and Navigation for Support Agents

**Type:** feature
**Area:** admin-portal
**Priority:** medium
**Status:** Pending
**Created:** 2026-03-12
**Estimated Effort:** ~20K tokens

---

## Summary

Add cross-links between admin portal pages to help support agents navigate quickly between related entities (users, orgs, plans, licenses). Currently, support agents must manually navigate to each page independently, which slows down troubleshooting and support workflows.

---

## Problem Statement

The admin portal has separate pages for users, organizations, plans, and licenses, but they are not linked to each other. A support agent looking at a user's detail page cannot click through to their organization or the org's plan. This creates a disjointed experience where agents must open multiple tabs or memorize IDs to cross-reference entities.

---

## Scope

### User Detail Page (`/dashboard/users/[id]`)
- Add link to the user's organization (navigates to org detail page)
- Add link to the org's assigned plan (navigates to plan detail page)
- Show org name and plan name inline with clickable links

### Organization Detail Page (`/dashboard/orgs/[id]`)
- Show assigned plan name with link to plan detail page
- Show license summary (active licenses count, seat usage)
- Show plan tier badge

### Plan Detail Page (`/dashboard/plans/[id]`)
- Add section showing organizations currently using this plan
- Show org count with clickable links to each org's detail page
- Show license count per org

### Plan List Page (`/dashboard/plans`)
- Add org count column to plan cards/table
- Make org count clickable (links to filtered org list or plan detail page)

### Breadcrumbs and Back-Navigation
- Add breadcrumb trail on detail pages (e.g., Plans > Enterprise Plan > Settings)
- Add back-navigation links between related entity pages
- Maintain browser history for natural back-button behavior

---

## Files Affected (Expected)

| Location | Change |
|----------|--------|
| `admin-portal/app/dashboard/users/[id]/page.tsx` | Add org/plan links |
| `admin-portal/app/dashboard/users/[id]/components/` | Link components in user cards |
| `admin-portal/app/dashboard/orgs/[id]/page.tsx` | Add plan link, license summary |
| `admin-portal/app/dashboard/plans/[id]/page.tsx` | Add orgs-using-plan section |
| `admin-portal/app/dashboard/plans/page.tsx` | Add org count to plan list |
| `admin-portal/components/ui/Breadcrumbs.tsx` | New shared breadcrumb component |

---

## Acceptance Criteria

1. User detail page shows clickable link to user's org and org's plan
2. Org detail page shows assigned plan name as a link, with license/seat info
3. Plan detail page shows list of orgs using that plan, with links
4. Plan list page shows org count per plan
5. Breadcrumbs are present on all detail pages with correct hierarchy
6. All links navigate correctly and maintain browser history
7. Admin portal builds and type-checks

---

## Notes

- Candidate for SPRINT-127 scheduling
- No database changes required -- all data already available via existing RPCs
- Primarily a UI/UX improvement for admin portal pages
- Related to SPRINT-122 (Plan Admin UI) which builds the base pages this extends
