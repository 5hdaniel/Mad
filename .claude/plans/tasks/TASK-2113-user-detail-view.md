# TASK-2113: Unified User Detail View with Sentry Integration

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Build the `/dashboard/users/[id]` detail page showing a unified view of a user's profile, organization membership, license, devices, audit logs, and recent Sentry errors.

## Non-Goals

- Do NOT add account management actions (enable/disable/suspend) — that's SPRINT-112
- Do NOT add impersonation — that's SPRINT-112
- Do NOT modify broker-portal

## Depends On

- TASK-2111 (`admin_get_user_detail` RPC or direct table access via TASK-2110 RLS policies)

## Deliverables

### Files to Create

- `admin-portal/app/dashboard/users/[id]/page.tsx` — main detail page (server component)
- `admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx` — profile summary
- `admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx` — org membership
- `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx` — license info
- `admin-portal/app/dashboard/users/[id]/components/DevicesTable.tsx` — devices list
- `admin-portal/app/dashboard/users/[id]/components/AuditLogTable.tsx` — recent audit logs
- `admin-portal/app/dashboard/users/[id]/components/SentryErrorsCard.tsx` — Sentry errors (client component)
- `admin-portal/app/api/sentry/user-issues/route.ts` — API route to proxy Sentry REST API (MUST verify auth + internal role before proxying)
- `admin-portal/lib/sentry.ts` — Sentry API client helper

### Files to Modify

- `admin-portal/.env.local.example` — add `SENTRY_API_TOKEN` and `SENTRY_ORG_SLUG`

## Page Layout

```
+------------------------------------------+
| <- Back to Search    User: John Doe      |
+------------------------------------------+
| [Profile Card]       | [License Card]    |
| Name, email, status  | Type, status,     |
| last login, avatar   | trial info,       |
| subscription tier    | transaction usage  |
+------------------------------------------+
| [Organization Card]                      |
| Org name, slug, role, joined date        |
+------------------------------------------+
| [Devices Table]                          |
| device_name | os | platform | version   |
| last_seen   | is_active                  |
+------------------------------------------+
| [Audit Logs]         | [Sentry Errors]   |
| Last 50 actions      | Recent issues     |
| Expandable metadata  | from Sentry API   |
+------------------------------------------+
```

## Sentry Integration

- **API Route:** `POST /api/sentry/user-issues` accepts `{ email: string }`
- **Server-side call:** `GET https://us.sentry.io/api/0/organizations/keeprcompliancecom/issues/?query=user.email:${email}&limit=10&sort=date`
- **Auth:** `Authorization: Bearer ${process.env.SENTRY_API_TOKEN}`
- **Response:** Map to `{ id, title, shortId, count, userCount, lastSeen, level, permalink }`
- **Graceful degradation:** If `SENTRY_API_TOKEN` not set or API fails → show "Sentry integration unavailable"
- **SentryErrorsCard** is a client component that fetches from the API route

## Data Fetching

- Server component calls `admin_get_user_detail` RPC (or parallel Supabase queries — engineer's choice)
- Sentry data fetched client-side (may be slow, should not block SSR)

## Acceptance Criteria

- [ ] `/dashboard/users/[id]` renders the full user detail view
- [ ] Profile card shows name, email, status, avatar, subscription tier, last login
- [ ] Organization card shows org name, slug, role, joined date
- [ ] License card shows type, status, trial info, transaction count/limit
- [ ] Devices table shows all user devices with version, platform, last seen
- [ ] Audit log table shows last 50 actions with expandable metadata
- [ ] Sentry errors show when API token is configured
- [ ] Sentry section shows fallback when API unavailable
- [ ] Back link navigates to `/dashboard/users`
- [ ] `npm run build` passes
- [ ] No TypeScript errors

## PR Preparation

- **Title**: `feat: add unified user detail view with Sentry integration to admin portal`
- **Base**: `int/sprint-111-admin-p0`

---

## PM Estimate

**Category:** `service`
**Estimated Tokens:** ~35K
**Token Cap:** 70K
**Confidence:** Medium — multiple data sources and Sentry API integration add complexity.

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
- [ ] admin-portal/app/dashboard/users/[id]/page.tsx
- [ ] admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx
- [ ] admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx
- [ ] admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx
- [ ] admin-portal/app/dashboard/users/[id]/components/DevicesTable.tsx
- [ ] admin-portal/app/dashboard/users/[id]/components/AuditLogTable.tsx
- [ ] admin-portal/app/dashboard/users/[id]/components/SentryErrorsCard.tsx
- [ ] admin-portal/app/api/sentry/user-issues/route.ts
- [ ] admin-portal/lib/sentry.ts

Files modified:
- [ ] admin-portal/.env.local.example

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
