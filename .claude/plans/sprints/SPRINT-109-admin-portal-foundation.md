# SPRINT-109: Admin Portal Foundation

**Sprint Goal:** Stand up the internal support/admin portal at `admin.keeprcompliance.com` with auth that restricts access to internal users only. Deliver a deployed, login-protected shell with sidebar navigation — no features yet, just the foundation.

**Branch:** `int/sprint-109-admin-portal`
**Base:** `develop`
**Merge Target:** `develop`

---

## Context

BACKLOG-837 is a large effort broken into 3 sprints. This is Phase 1 — foundation only.

### Phase Roadmap

| Sprint | Phase | Scope |
|--------|-------|-------|
| **SPRINT-109** | **Foundation** | Scaffold app, internal_roles schema, auth middleware, deploy shell to Vercel |
| SPRINT-110 | P0 Features | Cross-org user search RPC, unified user detail view (profile + org + license + devices + audit logs + Sentry errors), admin RLS policies |
| SPRINT-111 | P1 Features | Account management (enable/disable/suspend), impersonation (BACKLOG-838), analytics dashboard (BACKLOG-840) |

### Key Context for Future Sprints

**Supabase schema (existing tables the admin portal reads):**
- `users` — id, email, first_name, last_name, status, is_active, subscription_tier, login_count, last_login_at, suspended_at, suspension_reason
- `organizations` — id + org details
- `organization_members` — user_id, organization_id, role (admin/agent/it_admin), license_status
- `licenses` — user_id, license_type, status, transaction_count, transaction_limit, trial_status, expires_at
- `devices` — user_id, device_id, device_name, os, app_version (NULL until BACKLOG-839), platform, is_active, last_seen_at
- `audit_logs` — user_id, action, resource_type, resource_id, metadata (jsonb), timestamp, success
- `transaction_submissions` — user transactions
- `submission_messages` / `submission_attachments` — transaction data

**Current org-scoped RLS:** All tables use RLS policies scoped to the user's organization. The admin portal needs policies that bypass org scoping for internal roles (read-only cross-org access).

**Cross-org user search RPC (SPRINT-110):** Needs a Postgres function like `admin_search_users(query text)` that searches by name/email/org slug/user UUID across all orgs. Current RLS prevents this — the RPC must use `SECURITY DEFINER` with internal role validation inside the function.

**Sentry integration (SPRINT-110):** Sentry org slug is `keeprcompliancecom`, region URL `https://us.sentry.io`. The desktop app sets `Sentry.setUser({ id, email })` on login. Admin portal can query Sentry API by user email to pull recent errors. Use Sentry REST API — no SDK needed server-side.

**Impersonation (SPRINT-111 / BACKLOG-838):** Admin portal generates short-lived scoped tokens. Broker portal (`app.keeprcompliance.com`) accepts them via a new API route, starts a read-only session with a persistent banner. Dual identity logging (agent ID + impersonated user ID).

**Broker portal structure to mirror:**
- Next.js 15 App Router, React 18, TypeScript strict
- Supabase SSR (`@supabase/ssr` + `@supabase/supabase-js`)
- Tailwind CSS + lucide-react icons
- `AuthProvider` context (client-side session management)
- Middleware for route protection + role checks
- Runs on port 3001 (broker), admin should use 3002

---

## In-Scope

| # | Task | Backlog | Status |
|---|------|---------|--------|
| 1 | TASK-2105: Create internal_roles table + seed data | BACKLOG-837 | Completed |
| 2 | TASK-2106: Scaffold admin portal app with auth + deploy | BACKLOG-837 | Completed |

## Out of Scope / Deferred

- Cross-org user search (SPRINT-110)
- User detail view (SPRINT-110)
- Admin RLS policies for reading other tables (SPRINT-110)
- Account management actions (SPRINT-111)
- Impersonation (SPRINT-111 / BACKLOG-838)
- Analytics dashboard (SPRINT-111 / BACKLOG-840)
- Version tracking (BACKLOG-839)

---

## Dependency Graph

```
TASK-2105 (Schema: internal_roles table + seed)
    |
    v
TASK-2106 (App: scaffold + auth middleware + deploy)
```

TASK-2105 must complete first — the auth middleware in TASK-2106 queries `internal_roles` to validate access.

---

## Merge Plan

1. TASK-2105 is a Supabase migration (can be applied via MCP or dashboard)
2. TASK-2106 creates `admin-portal/` directory with all app code, PR to `int/sprint-109-admin-portal`
3. After both complete, merge `int/sprint-109-admin-portal` → `develop` via PR

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| New Next.js app breaks CI | Medium | CI config may need `admin-portal/` included in build matrix — check ci.yml |
| Supabase cookie domain conflicts between app. and admin. subdomains | Medium | Supabase SSR handles this — cookies are scoped per domain automatically |
| Internal role check adds latency to every request | Low | Single indexed query on user_id — negligible |

---

## Testing & Quality Plan

### TASK-2105 (Schema)
- [ ] Migration applies cleanly
- [ ] `internal_roles` table exists with correct columns
- [ ] Seed data present (dhaim@bluespaces.com as super_admin)
- [ ] RLS enabled on internal_roles table

### TASK-2106 (App)
- [ ] `npm run build` succeeds in `admin-portal/`
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes (if configured)
- [ ] Login page loads at `admin.keeprcompliance.com`
- [ ] Non-internal users are rejected at login
- [ ] Internal user (dhaim@bluespaces.com) can access dashboard shell
- [ ] Sign out works and returns to login page
- [ ] Deployed to Vercel and accessible

---

## Validation Checklist (Sprint Close)

- [ ] `admin.keeprcompliance.com` loads login page
- [ ] Internal user can sign in and see dashboard shell
- [ ] Non-internal user is rejected
- [ ] `internal_roles` table exists with seed data
- [ ] All PRs merged, no orphaned PRs
- [ ] Effort metrics recorded
- [ ] BACKLOG-837 status stays `In Progress` (not complete until P0 features ship)
