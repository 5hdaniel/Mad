# TASK-2118: Organizations List and Detail Pages

**Backlog ID:** BACKLOG-837 (P1)
**Sprint:** SPRINT-112
**Phase:** Phase 2 - UI (Parallel)
**Depends On:** None (read-only, uses existing RLS policies from SPRINT-111)
**Branch:** `feature/task-2118-organizations`
**Branch From:** `int/sprint-112-admin-account-mgmt`
**Branch Into:** `int/sprint-112-admin-account-mgmt`
**Estimated Tokens:** ~12K (service category x 0.5 = ~6K adjusted)

---

## Objective

Create organizations list and detail pages for the admin portal. The list page at `/dashboard/organizations` shows all organizations with member counts and key stats. The detail page at `/dashboard/organizations/[id]` shows the organization's members, licenses, and metadata. Enable the "Organizations" sidebar link. These pages are read-only (no write operations).

---

## Context

### Current State

- The Sidebar has an "Organizations" nav item with `enabled: false` showing "Coming soon"
- Admin RLS policies from SPRINT-111 (TASK-2110) already allow internal users to SELECT from:
  - `organizations` table
  - `organization_members` table
  - `users` table (cross-org)
  - `licenses` table (cross-org)
- No dedicated RPC is needed -- direct table queries work via existing admin RLS

### Data Available

From the existing schema:
- `organizations`: `id`, `name`, `slug`, `created_at`, (and other fields)
- `organization_members`: `organization_id`, `user_id`, `role`, `joined_at`
- `users`: for member details (name, email, status)
- `licenses`: for per-user license info within the org

---

## Requirements

### Must Do:

1. **Organizations List Page** (`/dashboard/organizations`):
   - Server component that fetches all organizations
   - Table with columns: Name, Slug, Members (count), Created, Actions
   - "View" link in Actions column navigates to detail page
   - Sort by name (default) or created date
   - Simple search/filter by name or slug (client-side filtering is acceptable for v1 given low org count)
   - Show total org count at top

2. **Organization Detail Page** (`/dashboard/organizations/[id]`):
   - Server component
   - Back link to organizations list
   - Organization header: name, slug, created date
   - Members table: Name, Email, Role (owner/admin/member), Status, Joined Date
   - Click on member row navigates to `/dashboard/users/[user_id]`
   - License summary: count of active/expired/trial licenses for org members
   - No write operations -- purely informational

3. **Enable Organizations in Sidebar:**
   - In `admin-portal/components/layout/Sidebar.tsx`, change Organizations `enabled: false` to `enabled: true`

4. **Query patterns:**
   ```typescript
   // List page - get all orgs with member counts
   const { data: orgs } = await supabase
     .from('organizations')
     .select('id, name, slug, created_at, organization_members(count)')
     .order('name');

   // Detail page - get org + members with user info
   const { data: org } = await supabase
     .from('organizations')
     .select('*')
     .eq('id', orgId)
     .single();

   const { data: members } = await supabase
     .from('organization_members')
     .select('user_id, role, joined_at, users(id, email, display_name, status)')
     .eq('organization_id', orgId)
     .order('joined_at', { ascending: false });
   ```

### Must NOT Do:
- Do NOT add write operations (edit org, add/remove members) -- this is read-only
- Do NOT create RPCs -- use direct table queries via existing admin RLS policies
- Do NOT modify the user detail or user search pages
- Do NOT add pagination for v1 (low org count, unnecessary complexity)

---

## Acceptance Criteria

- [ ] `/dashboard/organizations` lists all organizations with member counts
- [ ] `/dashboard/organizations/[id]` shows org details with member table
- [ ] Clicking a member row navigates to `/dashboard/users/[user_id]`
- [ ] Back navigation from detail to list works
- [ ] Organizations link enabled in sidebar navigation
- [ ] Search/filter by org name works on list page
- [ ] Empty state shown if no organizations exist
- [ ] `npm run build` passes with no TypeScript errors

---

## Files to Modify

- `admin-portal/components/layout/Sidebar.tsx` -- Enable Organizations nav item

### Files to Create

- `admin-portal/app/dashboard/organizations/page.tsx` -- Organizations list page
- `admin-portal/app/dashboard/organizations/[id]/page.tsx` -- Organization detail page
- `admin-portal/app/dashboard/organizations/components/OrganizationsTable.tsx` -- Org table component (can be client component for search filtering)
- `admin-portal/app/dashboard/organizations/[id]/components/MembersTable.tsx` -- Members table component

### Files to Read (for context)

- `admin-portal/app/dashboard/users/page.tsx` -- Pattern reference for list page with search
- `admin-portal/app/dashboard/users/[id]/page.tsx` -- Pattern reference for detail page
- `admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx` -- Shows org info in user detail (for cross-link consistency)
- `admin-portal/components/layout/Sidebar.tsx` -- Current nav items

---

## Testing Expectations

### Manual Testing
- [ ] Navigate to Organizations -> list page shows all orgs
- [ ] Search by org name -> table filters correctly
- [ ] Click "View" on an org -> detail page loads with members
- [ ] Click on a member -> navigates to user detail page
- [ ] Back link returns to organizations list
- [ ] Empty state renders if no organizations exist

### CI Requirements
- [ ] `npm run build` passes
- [ ] No TypeScript errors

---

## PR Preparation

- **Title:** `feat(admin): add organizations list and detail pages`
- **Branch:** `feature/task-2118-organizations`
- **Target:** `int/sprint-112-admin-account-mgmt`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/sprint-112-admin-account-mgmt
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Organizations list page created
- [ ] Organization detail page created
- [ ] Sidebar Organizations link enabled
- [ ] Code complete
- [ ] npm run build passes
- [ ] No TypeScript errors

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Organizations link disabled, no org browsing capability
- **After**: Full organizations list and detail pages with member info
- **Actual Tokens**: ~XK (Est: 12K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- Admin RLS policies from SPRINT-111 are not allowing cross-org reads
- The `organizations` or `organization_members` table schema differs from expectations
- The sidebar pattern has changed from what is described
- You encounter blockers not covered in the task file
