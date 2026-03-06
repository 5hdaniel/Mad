# SPRINT-111: Admin Portal P0 Features

**Sprint Goal:** Deliver P0 read-only admin features: cross-org data access, user search, user detail view with Sentry integration, and analytics dashboard.

**Branch:** `int/sprint-111-admin-p0`
**Base:** `develop`
**Merge Target:** `develop`

---

## Context

SPRINT-109 (admin portal foundation) is complete. The admin portal is live at `admin.keeprcompliance.com` with auth, internal_roles check, and a dashboard shell. This sprint adds the first real features — all read-only.

### Phase Roadmap

| Sprint | Phase | Scope |
|--------|-------|-------|
| SPRINT-109 | Foundation (DONE) | Scaffold app, internal_roles schema, auth middleware, deploy shell |
| **SPRINT-111** | **P0 Features** | Admin RLS, cross-org search, user detail view, analytics dashboard |
| SPRINT-112 | P1 Features | Account management (enable/disable/suspend), impersonation (BACKLOG-838) |

---

## In-Scope

| # | Task | Backlog | Type | Status |
|---|------|---------|------|--------|
| 1 | TASK-2110: Admin RLS policies + `has_internal_role()` function | BACKLOG-837 | schema | Pending |
| 2 | TASK-2111: Cross-org search + user detail RPCs | BACKLOG-837 | schema | Pending |
| 3 | TASK-2112: User Search UI at `/dashboard/users` | BACKLOG-837 | service | Pending |
| 4 | TASK-2113: User Detail View at `/dashboard/users/[id]` | BACKLOG-837 | service | Pending |
| 5 | TASK-2108: Analytics Dashboard at `/dashboard/analytics` | BACKLOG-840 | service | Pending |

## Out of Scope / Deferred to SPRINT-112

- Account management (enable/disable/suspend) — write operations
- Impersonation (BACKLOG-838) — requires broker portal changes
- Organizations list/detail view
- Settings page
- Write access for support agents

---

## Dependency Graph

```
TASK-2110 (Admin RLS policies + has_internal_role)
    |
    v
TASK-2111 (admin_search_users + admin_get_user_detail RPCs)
    |
    +-------------------+-------------------+
    |                   |                   |
    v                   v                   v
TASK-2112           TASK-2113           TASK-2108
(User Search UI)    (User Detail View)  (Analytics Dashboard)
```

**Phase 1 (Sequential):** TASK-2110 → TASK-2111 — schema migrations via Supabase MCP
**Phase 2 (Parallel):** TASK-2112 + TASK-2113 + TASK-2108 — UI work in isolated worktrees

---

## Execution Plan

### Phase 1: Schema (PM applies via MCP)

1. **TASK-2110** — Apply `has_internal_role()` function + 6 SELECT-only RLS policies
2. **TASK-2111** — Apply `admin_search_users` + `admin_get_user_detail` RPCs

### Phase 2: UI (Parallel engineer agents)

```bash
# Three isolated worktrees
git worktree add ../Mad-task-2112 -b feature/task-2112-user-search int/sprint-111-admin-p0
git worktree add ../Mad-task-2113 -b feature/task-2113-user-detail int/sprint-111-admin-p0
git worktree add ../Mad-task-2108 -b feature/task-2108-admin-analytics int/sprint-111-admin-p0
```

### Phase 3: Integration

1. Merge all 3 feature PRs to `int/sprint-111-admin-p0`
2. Resolve Sidebar.tsx merge conflicts (trivial — additive changes)
3. Merge `int/sprint-111-admin-p0` → `develop`
4. Deploy to Vercel
5. Set `SENTRY_API_TOKEN` env var in Vercel

---

## Key Architectural Decisions

1. **Hybrid RLS + RPC approach** — RLS policies for simple reads, SECURITY DEFINER RPCs for complex queries (search, aggregated detail)
2. **`has_internal_role()` checks ANY role** — all internal users get same read access. Role differentiation for write ops in SPRINT-112.
3. **Sentry via API route** — `/api/sentry/user-issues` proxies Sentry REST API server-side. Keeps token secret, avoids CSP changes.
4. **No service_role key** — admin portal uses anon key + RLS policies. More secure than bypassing RLS entirely.

---

## Merge Plan

1. TASK-2110: Supabase migration (no code PR)
2. TASK-2111: Supabase migration (no code PR)
3. TASK-2112: PR → `int/sprint-111-admin-p0`
4. TASK-2113: PR → `int/sprint-111-admin-p0`
5. TASK-2108: PR → `int/sprint-111-admin-p0`
6. Integration PR: `int/sprint-111-admin-p0` → `develop`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS policy performance (has_internal_role on every row) | Low | STABLE function + indexed lookup. Negligible with current data volume. |
| Sentry API token not configured | Low | Graceful degradation — shows "unavailable" message |
| Sidebar.tsx merge conflicts (3 tasks modify it) | Low | Changes are additive. Document for SR engineer. |
| app_version NULL for most users (TASK-2107 may not be done) | Low | Analytics handles NULL as "Unknown" version category |

---

## Testing & Quality Plan

### TASK-2110 (Schema)
- [ ] `has_internal_role()` returns true for internal users, false for regular users
- [ ] Internal user can SELECT from all 6 tables cross-org
- [ ] Regular user still sees only org-scoped data

### TASK-2111 (Schema)
- [ ] `admin_search_users('test')` returns matches across all orgs
- [ ] Search by email, name, org slug, UUID all work
- [ ] `admin_get_user_detail(uuid)` returns full user profile with all related data
- [ ] Non-internal user gets authorization error

### TASK-2112 (User Search UI)
- [ ] `/dashboard/users` renders search page
- [ ] Sidebar "Users" link enabled and works
- [ ] Search results appear with debounce
- [ ] Clicking row navigates to detail view
- [ ] `npm run build` passes

### TASK-2113 (User Detail View)
- [ ] `/dashboard/users/[id]` renders all 6 sections
- [ ] Sentry errors show when API token configured
- [ ] Graceful fallback when Sentry unavailable
- [ ] Back navigation works
- [ ] `npm run build` passes

### TASK-2108 (Analytics Dashboard)
- [ ] `/dashboard/analytics` renders all dashboard sections
- [ ] Version distribution, counts, platform breakdown display
- [ ] NULL app_version handled gracefully
- [ ] `npm run build` passes

---

## Validation Checklist (Sprint Close)

- [ ] Internal user can search users cross-org at admin.keeprcompliance.com
- [ ] User detail view shows complete profile
- [ ] Analytics dashboard displays system stats
- [ ] Sentry integration works (or gracefully degrades)
- [ ] All PRs merged, no orphaned PRs
- [ ] Effort metrics recorded
- [ ] Backlog statuses updated
- [ ] Deployed to Vercel
