# TASK-2113: Unified User Detail View with Sentry Integration

**Status:** Completed
**Completed:** 2026-03-05
**Sprint:** SPRINT-111

---

## Goal

Build the `/dashboard/users/[id]` detail page showing a unified view of a user's profile, organization membership, license, devices, audit logs, and recent Sentry errors.

## Non-Goals

- Do NOT add account management actions (enable/disable/suspend) -- that's SPRINT-112
- Do NOT add impersonation -- that's SPRINT-112
- Do NOT modify broker-portal

## Depends On

- TASK-2111 (`admin_get_user_detail` RPC or direct table access via TASK-2110 RLS policies)

## Deliverables

### Files Created

- `admin-portal/app/dashboard/users/[id]/page.tsx` -- main detail page (server component)
- `admin-portal/app/dashboard/users/[id]/components/UserProfileCard.tsx` -- profile summary
- `admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx` -- org membership
- `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx` -- license info
- `admin-portal/app/dashboard/users/[id]/components/DevicesTable.tsx` -- devices list
- `admin-portal/app/dashboard/users/[id]/components/AuditLogTable.tsx` -- recent audit logs
- `admin-portal/app/dashboard/users/[id]/components/SentryErrorsCard.tsx` -- Sentry errors (client component)
- `admin-portal/app/dashboard/users/[id]/not-found.tsx` -- 404 page for invalid user IDs
- `admin-portal/app/api/sentry/user-issues/route.ts` -- API route to proxy Sentry REST API
- `admin-portal/lib/sentry.ts` -- Sentry API client helper

## QA Bug Fixes

- Fixed wrong table/columns on user detail page (was returning 404)
- Fixed back link destination to point to `/dashboard/users`
- Fixed display_name field mismatch between RPC response and UI
- Added missing not-found page for invalid user IDs

## Acceptance Criteria

- [x] `/dashboard/users/[id]` renders the full user detail view
- [x] Profile card shows name, email, status, avatar, subscription tier, last login
- [x] Organization card shows org name, slug, role, joined date
- [x] License card shows type, status, trial info, transaction count/limit
- [x] Devices table shows all user devices with version, platform, last seen
- [x] Audit log table shows last 50 actions with expandable metadata (with pagination)
- [x] Sentry errors show when API token is configured
- [x] Sentry section shows fallback when API unavailable
- [x] Back link navigates to `/dashboard/users`
- [x] Not-found page displayed for invalid user IDs
- [x] `npm run build` passes
- [x] No TypeScript errors

---

## PM Estimate

**Category:** `service`
**Estimated Tokens:** ~35K
**Token Cap:** 70K
**Confidence:** Medium
