# TASK-2108: Admin Portal Analytics Dashboard

---

## STATUS: Pending

**Previously blocked by:** SPRINT-109 / TASK-2106 (admin portal scaffold) -- now unblocked.
SPRINT-109 is complete (PR #1038 merged to develop 2026-03-05). Admin portal deployed at admin.keeprcompliance.com.

---

## WORKFLOW REQUIREMENT

**This task MUST follow the 15-step agent-handoff workflow.**
See: `.claude/skills/agent-handoff/SKILL.md`

---

## Goal

Add a system-wide analytics/stats page to the admin portal at `/dashboard/analytics`. Provides the support team a single pane of glass for version adoption, user/org/device counts, error rates, and license utilization.

## Non-Goals

- Do NOT build user-level drill-down (that's the user detail view in SPRINT-110)
- Do NOT add write/management actions (that's account management in SPRINT-111)
- Do NOT replace Sentry dashboards entirely — this supplements them

## Branch

`feature/task-2108-admin-analytics` (create when unblocked)

## Prerequisites

- Admin portal scaffold deployed (TASK-2106)
- `app_version` populated in devices table (TASK-2107 / BACKLOG-839)

## Scope

### Dashboard Sections

1. **Active Users by App Version**
   - Query: `SELECT app_version, COUNT(DISTINCT user_id) FROM devices WHERE is_active = true AND last_seen_at > NOW() - INTERVAL '30 days' GROUP BY app_version ORDER BY app_version DESC`
   - Display: Table with version, user count, adoption % (of total active)
   - Chart: Bar chart or pie chart of version distribution

2. **Total Counts**
   - Active users (distinct users with active devices in last 30 days)
   - Total organizations
   - Total active devices
   - Query from `users`, `organizations`, `devices` tables

3. **Error Rate by Version (Sentry API)**
   - Sentry org: `keeprcompliancecom`, region: `https://us.sentry.io`
   - Endpoint: `GET /api/0/organizations/{org}/issues/?query=release:{version}`
   - Display: Table of version + error count + unique users affected
   - Requires Sentry API token stored as env var

4. **Version Adoption Over Time**
   - Requires historical data — may need a new `version_snapshots` table or use `devices.updated_at` as proxy
   - Chart: Line chart showing version % over time (daily granularity)
   - Consider: Scheduled Supabase Edge Function to snapshot daily counts

5. **Platform Breakdown**
   - Query: `SELECT platform, COUNT(DISTINCT user_id) FROM devices WHERE is_active = true GROUP BY platform`
   - Display: macOS vs Windows counts and percentages

6. **License Utilization**
   - Query from `licenses` table: active vs total seats, trial vs paid
   - Display: Utilization % with visual indicator

### Tech Stack

- Next.js 15 App Router page at `admin-portal/app/dashboard/analytics/page.tsx`
- Server components for data fetching (Supabase server client)
- Sentry API calls via server action or API route (keep token server-side)
- Charts: Consider `recharts` (already common in React ecosystem) or lightweight alternative
- Tailwind CSS + lucide-react icons (matching broker portal patterns)

## Files to Create/Modify

- `admin-portal/app/dashboard/analytics/page.tsx` — main page
- `admin-portal/app/dashboard/analytics/components/` — dashboard section components
- `admin-portal/lib/sentry.ts` — Sentry API client helper (may already exist from TASK-2113 — reuse if present)
- `admin-portal/lib/analytics-queries.ts` — Supabase query helpers
- `admin-portal/components/layout/Sidebar.tsx` — add "Analytics" nav item
- `admin-portal/package.json` — add `recharts` dependency

## Acceptance Criteria

- [ ] Analytics page accessible at `/dashboard/analytics` for authenticated internal users
- [ ] Active users by version displayed with counts and percentages
- [ ] Total users/orgs/devices counts displayed
- [ ] Sentry error rates by version displayed (or graceful fallback if API unavailable)
- [ ] Platform breakdown displayed
- [ ] License utilization displayed
- [ ] Page is responsive and matches admin portal design patterns
- [ ] `npm run build` passes in `admin-portal/`
- [ ] No TypeScript errors

## Integration Notes

- **Previously blocked by:** SPRINT-109 / TASK-2106 (admin portal scaffold) -- now unblocked
- **Depends on:** TASK-2107 (app_version data in devices table)
- **Sentry API:** Org slug `keeprcompliancecom`, user set via `Sentry.setUser({ id, email })`
- **Note from SPRINT-109 plan:** Originally slated for SPRINT-111 but moved up per user request

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~30K (new page, multiple data sources, charts)

**Token Cap:** 60K

**Confidence:** Medium — depends on Sentry API complexity and chart library choice.
