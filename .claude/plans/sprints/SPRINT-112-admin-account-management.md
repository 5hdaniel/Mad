# SPRINT-112: Admin Portal Account Management

**Status:** Planned
**Created:** 2026-03-05
**Backlog Items:** BACKLOG-837 (P1 features), BACKLOG-744
**Integration Branch:** `int/sprint-112-admin-account-mgmt`
**Merge Target:** `develop`

---

## Sprint Goal

Add write operations to the admin portal: suspend/unsuspend users, edit licenses, manage internal users, view organizations, with full audit trail. All changes are admin-portal-only (no broker portal changes). This sprint creates the write actions that RBAC (SPRINT-113) will later gate with granular permissions.

---

## Admin Portal Sprint Sequence (SR Engineer Recommendation)

| Order | Sprint | Scope | Risk | Status |
|-------|--------|-------|------|--------|
| 1 | **SPRINT-112** | **Account Management (admin portal only)** | **Low** | **This Sprint** |
| 2 | SPRINT-113 | RBAC (admin portal + Supabase schema) | Medium | Planned |
| 3 | Future | Impersonation (admin + broker portal + edge function) | High | Backlog |

**Rationale:** Account management is self-contained in the admin portal -- lowest risk, fastest to deliver. It creates the write actions that RBAC will later gate, and provides the `admin_audit_logs` table that impersonation will also reuse.

---

## Dependencies

- **SPRINT-111** (P0 features) -- COMPLETE. Established the admin portal pages, admin RLS policies, `has_internal_role()`, cross-org search, user detail view, analytics dashboard.
- **SPRINT-109** (foundation) -- COMPLETE. Admin portal scaffold, internal_roles table, auth middleware.

---

## Context

### Current State (Post SPRINT-111)

The admin portal is live at `admin.keeprcompliance.com` with:
- Auth via Supabase + `internal_roles` table check
- `has_internal_role()` SECURITY DEFINER function for RLS
- `admin_search_users` RPC for cross-org user search
- `admin_get_user_detail` RPC for user profile data
- User search UI at `/dashboard/users`
- User detail view at `/dashboard/users/[id]`
- Analytics dashboard at `/dashboard/analytics`
- Sidebar with Dashboard, Analytics, Users enabled; Organizations and Settings disabled

**What is missing (this sprint adds):**
- No write operations at all -- the portal is entirely read-only
- No audit logging for admin actions
- No ability to suspend/unsuspend users
- No ability to edit license status, expiry, or tier
- No internal user management UI (adding/removing users from `internal_roles`)
- No organizations list/detail page
- Sidebar "Organizations" and "Settings" links are disabled

### Key Files

| File | Purpose |
|------|---------|
| `admin-portal/components/layout/Sidebar.tsx` | Navigation sidebar (Organizations/Settings currently disabled) |
| `admin-portal/app/dashboard/users/[id]/page.tsx` | User detail page (read-only, needs action buttons) |
| `admin-portal/lib/admin-queries.ts` | Client-side admin RPC calls |
| `admin-portal/lib/supabase/client.ts` | Browser Supabase client |
| `admin-portal/lib/supabase/server.ts` | Server-side Supabase client |

---

## In-Scope Tasks

| # | Task | Title | Type | Est. Tokens | Status |
|---|------|-------|------|-------------|--------|
| 1 | TASK-2114 | Admin audit log schema + logging helper | schema | ~10K | Pending |
| 2 | TASK-2115 | Admin write RPCs (suspend/unsuspend, edit license) | schema | ~12K | Pending |
| 3 | TASK-2116 | User detail page action buttons (suspend, edit license) | service | ~15K | Pending |
| 4 | TASK-2117 | Internal user management page at /dashboard/settings | service | ~18K | Pending |
| 5 | TASK-2118 | Organizations list and detail pages | service | ~12K | Pending |

**Total Estimated:** ~67K tokens (before SR review overhead)

---

## Out of Scope / Deferred

- **Impersonation** -- Separate high-risk sprint (requires broker portal changes, edge function). Tracked as BACKLOG-838.
- **RBAC / granular permissions** -- SPRINT-113 (BACKLOG-850). This sprint uses simple `has_internal_role()` checks; SPRINT-113 will upgrade to permission-based checks.
- **Add/edit transactions on behalf of user** -- P2 feature, future sprint.
- **Support ticket integration** -- P2 feature, future sprint.
- **License conversion (individual to org)** -- BACKLOG-851, separate workflow requiring data migration profiling.

---

## Dependency Graph

```
TASK-2114 (Admin audit log schema + helper)
    |
    v
TASK-2115 (Admin write RPCs: suspend/unsuspend + edit license)
    |
    +------------------------------+
    |                              |
    v                              v
TASK-2116                     TASK-2117
(User detail action buttons)  (Internal user mgmt /settings)

TASK-2118 (Organizations list/detail -- independent, read-only)
```

**Phase 1 (Sequential, Schema):** TASK-2114 -> TASK-2115
  - Applied via Supabase MCP, no app code changes
  - TASK-2115 depends on TASK-2114 (write RPCs log to admin_audit_logs)

**Phase 2 (Parallel, UI):** TASK-2116 + TASK-2117 + TASK-2118
  - TASK-2116 and TASK-2117 depend on TASK-2115 (call the write RPCs)
  - TASK-2118 is independent (read-only, no write RPCs needed)
  - All three touch different pages/routes -- safe for parallel execution with worktree isolation
  - Shared file: `Sidebar.tsx` (TASK-2117 enables Settings, TASK-2118 enables Organizations) -- trivial additive changes, SR Engineer resolves at merge

---

## Execution Plan

### Phase 1: Schema (PM applies via Supabase MCP)

1. **TASK-2114** -- Create `admin_audit_logs` table + `log_admin_action()` helper function
2. **TASK-2115** -- Create SECURITY DEFINER RPCs: `admin_suspend_user`, `admin_unsuspend_user`, `admin_update_license`

### Phase 2: UI (Parallel engineer agents with worktree isolation)

```bash
# Three isolated worktrees
git worktree add ../Mad-task-2116 -b feature/task-2116-user-actions int/sprint-112-admin-account-mgmt
git worktree add ../Mad-task-2117 -b feature/task-2117-internal-users int/sprint-112-admin-account-mgmt
git worktree add ../Mad-task-2118 -b feature/task-2118-organizations int/sprint-112-admin-account-mgmt
```

### Phase 3: Integration

1. Merge all 3 feature PRs to `int/sprint-112-admin-account-mgmt`
2. Resolve `Sidebar.tsx` merge conflicts (trivial -- TASK-2117 enables Settings, TASK-2118 enables Organizations)
3. Merge `int/sprint-112-admin-account-mgmt` -> `develop`
4. Deploy to Vercel

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Suspend/unsuspend does not immediately invalidate active sessions | Medium | Document behavior -- suspend sets status flag, session validator on next check-in will see it. Not instant but acceptable for v1. |
| License edit allows invalid state transitions (e.g., expired -> trial) | Medium | RPC validates allowed transitions. Task file specifies valid transitions explicitly. |
| Sidebar.tsx merge conflicts from parallel tasks | Low | Changes are additive (enable: false -> true). SR Engineer resolves at integration. |
| No RBAC yet -- any internal user can perform write actions | Medium | Acceptable for v1. Only 3 internal users exist currently. SPRINT-113 adds granular permissions. |
| audit_logs vs admin_audit_logs confusion | Low | Separate table for admin actions. Existing `audit_logs` table is for user-facing audit trail. Naming makes the distinction clear. |

---

## Testing & Quality Plan

### TASK-2114 (Schema)
- [ ] `admin_audit_logs` table created with correct columns
- [ ] `log_admin_action()` function inserts an entry with actor_id, action, target_id, metadata
- [ ] Non-internal users cannot read admin_audit_logs (RLS)

### TASK-2115 (Schema)
- [ ] `admin_suspend_user(target_user_id)` sets user status to 'suspended' and logs action
- [ ] `admin_unsuspend_user(target_user_id)` sets user status to 'active' and logs action
- [ ] `admin_update_license(license_id, changes)` updates license fields and logs action
- [ ] All RPCs reject non-internal callers (SECURITY DEFINER + has_internal_role check)
- [ ] Cannot suspend a super_admin user

### TASK-2116 (User Detail Actions)
- [ ] Suspend button visible on user detail page for active users
- [ ] Unsuspend button visible for suspended users
- [ ] Edit License button opens modal with current values pre-filled
- [ ] Confirmation dialog before suspend/unsuspend
- [ ] Success/error toast messages
- [ ] Page refreshes data after action
- [ ] `npm run build` passes

### TASK-2117 (Internal User Management)
- [ ] `/dashboard/settings` page renders internal user list
- [ ] Add internal user form (email + role selection)
- [ ] Remove internal user with confirmation
- [ ] Settings link enabled in sidebar
- [ ] `npm run build` passes

### TASK-2118 (Organizations)
- [ ] `/dashboard/organizations` lists all organizations
- [ ] `/dashboard/organizations/[id]` shows org detail (members, licenses)
- [ ] Organizations link enabled in sidebar
- [ ] Read-only -- no write actions
- [ ] `npm run build` passes

---

## Acceptance Criteria

- [ ] Admin users can suspend and unsuspend customer users
- [ ] Admin users can edit license status, expiry, and tier
- [ ] All admin write actions are logged in admin_audit_logs with actor identity
- [ ] Internal user management is available at /dashboard/settings
- [ ] Organizations list and detail views are functional
- [ ] All sidebar links are enabled (no more "Coming soon")
- [ ] No TypeScript errors, `npm run build` passes
- [ ] All PRs merged, no orphaned PRs
- [ ] Deployed to Vercel

---

## Validation Checklist (Sprint Close)

- [ ] Suspend a user -> verify status changes, audit log entry created
- [ ] Unsuspend the same user -> verify status reverts, audit log entry created
- [ ] Edit a license expiry date -> verify change persists, audit log entry created
- [ ] Add an internal user -> verify they can log in to admin portal
- [ ] Remove an internal user -> verify they can no longer access admin portal
- [ ] Organizations page lists all orgs with member counts
- [ ] All sidebar links enabled and functional
- [ ] Effort metrics recorded
- [ ] Backlog statuses updated
