# QA Test Registry

Tracks all test cases run across sprints. One row per test, updated after each QA session.

---

## SPRINT-134 Tests (Support Portal & Audit Log Polish)

**QA Date:** 2026-03-16
**Tasks:** TASK-2188 (Customer Ticket Closing), TASK-2189 (Audit Log Payloads), TASK-2190 (Missing Audit Actions), PR #1162 (Customer Sidebar)

| Test ID | Title | Status | Last Run | Notes |
|---------|-------|--------|----------|-------|
| TEST-134-001 | Close Ticket Button — Visible on Active Ticket | PASS | 2026-03-16 | Button renders as small red text in header |
| TEST-134-002 | Close Ticket — Confirmation Dialog Content | PASS | 2026-03-16 | Exact spec text confirmed, Cancel and Close Ticket buttons present |
| TEST-134-003 | Close Ticket — Successful Close Flow | PASS | 2026-03-16 | Status updates in-place, reply form replaced, button hidden |
| TEST-134-004 | Close Ticket Button — Hidden on Closed Ticket | PASS | 2026-03-16 | Button absent on closed ticket; list view shows Closed status |
| TEST-134-005 | Closed Ticket — Reply Composer Replaced by Closed Message | PASS | 2026-03-16 | "This ticket is closed." shown; message history intact |
| TEST-134-006 | Customer Ticket Sidebar — Two-Column Layout | PASS | 2026-03-16 | 2:1 column ratio at desktop; single-column at mobile |
| TEST-134-007 | Customer Ticket Sidebar — Field Content | PASS | 2026-03-16 | All 5 sections present: Status, Priority, Category, Requester, Dates |
| TEST-134-008 | Audit Log — Role Update Has Before/After Payload | PASS | 2026-03-16 | role.update and role.update_permissions both have structured before/after |
| TEST-134-009 | Audit Log — User Suspend Has Before/After Payload | PASS | 2026-03-16 | before: {email, status}, after: {status, reason, licenses_suspended} |
| TEST-134-010 | Audit Log — Plan Feature Toggle Uses log_admin_action | PASS | 2026-03-16 | Verified via live function definition — no direct INSERT remaining |
| TEST-134-011 | Audit Log — Impersonation Start/End Logged via log_admin_action | PASS | 2026-03-16 | All 3 impersonation RPCs confirmed; validate token logging is net-new |
| TEST-134-012 | Regression — Ticket Detail Page Still Loads Normally | PASS | 2026-03-16 | List, open ticket, closed ticket all load cleanly |

---

## SPRINT-133 Tests (Phase 2 — Support Ticket UX Enhancements — Admin Portal)

**QA Date:** 2026-03-16
**Tasks:** TASK-2185 (Requester Lookup), TASK-2186 (Related Tickets Panel), TASK-2187 (Activity Timeline)

| Test ID | Title | Status | Last Run | Notes |
|---------|-------|--------|----------|-------|
| TEST-133-P2-001 | Create Ticket Dialog — Search Autocomplete Renders | PASS | 2026-03-16 | — |
| TEST-133-P2-002 | Create Ticket Dialog — Requester Selection Auto-Fill | PASS | 2026-03-16 | — |
| TEST-133-P2-003 | Create Ticket Dialog — Recent Tickets Panel | PASS | 2026-03-16 | — |
| TEST-133-P2-004 | Create Ticket Dialog — Manual Entry Fallback | PASS | 2026-03-16 | — |
| TEST-133-P2-005 | Related Tickets Panel — Auto-Related Tickets Display | PASS | 2026-03-16 | Fix applied: white text on search input |
| TEST-133-P2-006 | Related Tickets Panel — Manual Link Creation | PASS | 2026-03-16 | Fix applied: duplicate link error message improved |
| TEST-133-P2-007 | Related Tickets Panel — Unlink | PASS | 2026-03-16 | — |
| TEST-133-P2-008 | Unified Activity Timeline — Chronological Order | PASS | 2026-03-16 | Deviation: sort order changed to newest-first per user feedback |
| TEST-133-P2-009 | Unified Activity Timeline — Internal Notes and Composer Position | PASS | 2026-03-16 | — |
| TEST-133-P2-010 | Integration — Ticket Link Events in Activity Timeline | PASS | 2026-03-16 | Fix applied: RPC joined auth.users; frontend reads actor_name |
| TEST-133-P2-011 | Integration — Phone + Preferred Contact Persists End-to-End | SKIP | 2026-03-16 | Deferred — retest before sprint close |
| TEST-133-P2-012 | Regression — Existing Ticket Creation Still Works | SKIP | 2026-03-16 | Deferred — run before next sprint touching CreateTicketDialog |

---

## SPRINT-133 Tests (Phase 1 — Support Widget — Broker Portal)

**QA Date:** 2026-03-15
**Tasks:** SupportWidget, dashboard layout, /dashboard/support/new route

| Test ID | Title | Status | Last Run | Notes |
|---------|-------|--------|----------|-------|
| TEST-133-001 | Widget button visible on dashboard | PASS | 2026-03-15 | — |
| TEST-133-002 | Widget button visible on all dashboard sub-pages | PASS | 2026-03-15 | — |
| TEST-133-003 | Screenshot capture — spinner shows then dialog opens | PASS | 2026-03-15 | — |
| TEST-133-004 | Screenshot preview appears below attachments section | PASS | 2026-03-15 | — |
| TEST-133-005 | Remove screenshot button works | PASS | 2026-03-15 | — |
| TEST-133-006 | Dashboard nav visible behind the dialog overlay | PASS | 2026-03-15 | — |
| TEST-133-007 | Form validation — subject and description minimum length | PASS | 2026-03-15 | Fix applied: text-gray-900 bg-white added to widget inputs |
| TEST-133-008 | Form submission creates ticket and shows success state | PASS | 2026-03-15 | Fix applied: dialog maintains consistent size on success state |
| TEST-133-009 | Browser diagnostics collapsible section | PASS | 2026-03-15 | — |
| TEST-133-010 | /dashboard/support/new page keeps nav bar visible | PASS | 2026-03-15 | — |

---

## SPRINT-127 Tests (Batch 3: canExport/canSubmit Migration to useFeatureGate)

**QA Date:** 2026-03-12
**Tasks:** TASK-2159 (PR #1132)

| Test ID | Title | Status | Last Run | Notes |
|---------|-------|--------|----------|-------|
| TEST-127-011 | Export button visible for plans with text_export or email_export | PASS | 2026-03-12 | Export modal opened cleanly for dhaim@bluespaces.com on Team plan |
| TEST-127-012 | Submit for Review hidden on Individual plan | PASS | 2026-03-12 | Verified via live plan switch; Export unaffected during switch |
| TEST-127-013 | Submit for Review visible on Team plan | PASS | 2026-03-12 | Visible after restoring Izzyrescue to Team plan; requires app restart |
| TEST-127-014 | No UI flicker when navigating between screens | PASS | 2026-03-12 | Render fast enough to be imperceptible; hasInitialized guard confirmed working |
| TEST-127-015 | AI detection features gated consistently across all surfaces | PASS | 2026-03-12 | Toolbar, StatusWrapper, SyncStatusIndicator, Settings tab all consistent |
| TEST-127-016 | Start New Audit modal renders correctly regardless of plan type | PASS | 2026-03-12 | AI options absent with ai_detection disabled; no blank gaps |
| TEST-127-017 | Settings AI tab gated, non-AI tabs unaffected | PASS | 2026-03-12 | AI tab absent from tab bar; all other tabs fully functional |

---

## SPRINT-127 Tests (Batch 2: Admin Tier Constraints + Broker Portal Feature Keys)

**QA Date:** 2026-03-12
**Tasks:** TASK-2157 (PR #1129), TASK-2158 (PR #1130)

| Test ID | Title | Status | Last Run | Notes |
|---------|-------|--------|----------|-------|
| TEST-127-001 | Plan List Shows Correct Tier Labels | PASS | 2026-03-12 | "Individual", "Team", "Enterprise" displayed correctly; no "Trial"/"Pro" |
| TEST-127-002 | Locked Features on Individual Plan | PASS | 2026-03-12 | Team/enterprise min_tier features greyed out with lock icon and tooltip |
| TEST-127-003 | Platform Grouping of Export/Attachment Features | PASS | 2026-03-12 | "Broker Portal" and "Desktop App" section headers; all 8 keys correctly grouped |
| TEST-127-004 | Feature Dependency Enforcement — Greyed Out Dependents | PASS | 2026-03-12 | Fix applied: feature_dependencies query was selecting non-existent `id` column |
| TEST-127-005 | Enabling a Feature Auto-Enables Its Dependencies | PASS | 2026-03-12 | Fix applied: features with tier-locked deps now show "Blocked by tier" badge |
| TEST-127-006 | Disabling a Feature Warns About Dependents | PASS | 2026-03-12 | Warning dialog lists specific dependent feature names; cancel preserves state |
| TEST-127-007 | Tier Downgrade Shows Error With Conflicting Feature List | PASS | 2026-03-12 | Fix applied: RPC error messages now show human-readable text with feature list |
| TEST-127-008 | Submissions List — Normal Access (broker_portal_access Enabled) | PASS | 2026-03-12 | 7 Izzyrescue submissions visible; no old key name errors |
| TEST-127-009 | broker_portal_access Gate — Submission Detail Blocked State | PASS | 2026-03-12 | Blocked message shown correctly when Izzyrescue on Individual plan |
| TEST-127-010 | broker_portal_access Gate — Submissions List Filters Blocked Orgs | PASS | 2026-03-12 | All 7 submissions hidden on Individual plan; reappeared after restore to Team |

---

## SPRINT-113 Tests (Admin Portal Granular RBAC System)

**QA Date:** 2026-03-06
**Branch:** `int/sprint-113-admin-rbac` (PR #1062)

| Test ID | Title | Status | Last Run | Notes |
|---------|-------|--------|----------|-------|
| TEST-113-001 | Super Admin Retains Full Dashboard Access | PASS | 2026-03-06 | All 6 sidebar items visible, role label correct |
| TEST-113-002 | Seeded Default Roles Present | PASS | 2026-03-06 | L&D role seeded via SQL; all 8 default roles confirmed |
| TEST-113-003 | Permission Matrix Correct for Seeded Roles | PASS | 2026-03-06 | Support Rep and Marketing verified |
| TEST-113-004 | Create a Custom Role | PASS | 2026-03-06 | Name, description, empty matrix, permissions persist |
| TEST-113-005 | Assign Custom Role and Verify Enforcement | PASS | 2026-03-06 | Critical bug found+fixed: is_super_admin() TEXT ref |
| TEST-113-006 | Remove Permission and Verify Immediate Restriction | PASS | 2026-03-06 | Sidebar and middleware enforce immediately |
| TEST-113-007 | Super Admin Role Cannot Be Deleted or Edited | PASS | 2026-03-06 | System badge, read-only matrix, no delete button |
| TEST-113-008 | Non-Super-Admin Cannot Access Role Management | PASS | 2026-03-06 | Settings hidden; Roles tab hidden without roles.view |
| TEST-113-009 | Delete a Custom Role | PASS | 2026-03-06 | Confirmation dialog; RPC blocks deletion with active users |
| TEST-113-010 | Audit Log Page Loads and Displays Entries | PASS | 2026-03-06 | 23 entries, all action types, badges, actor, timestamps |
| TEST-113-011 | Audit Log Filters Work Correctly | PASS | 2026-03-06 | Search RPC fixed to partial match across actor/metadata |
| TEST-113-012 | Audit Log Pagination | SKIP | 2026-03-06 | Only 23 entries; threshold is 25 — retry with more data |
| TEST-113-013 | Impersonate Button Visibility | SKIP | 2026-03-06 | Feature scrapped — BACKLOG-838 deferred, BACKLOG-866 created |
| TEST-113-014 | Start Impersonation Session | SKIP | 2026-03-06 | Feature scrapped — BACKLOG-838 deferred, BACKLOG-866 created |
| TEST-113-015 | Impersonation View and End Session | SKIP | 2026-03-06 | Feature scrapped — BACKLOG-838 deferred, BACKLOG-866 created |
| TEST-113-016 | Add User Flow Uses Role Slugs | PASS | 2026-03-06 | Dropdown shows display names, submits slugs correctly |
| TEST-113-017 | Audit Log Blocked Without audit.view | PASS | 2026-03-06 | Covered by TEST-113-006 evidence |
| TEST-113-018 | Build Passes With No TypeScript Errors | PASS | 2026-03-06 | tsc --noEmit clean, npm run build clean |
| TEST-113-019 | Internal Users Search and Table UX | PASS | 2026-03-06 | Search, filter, empty states, Added By sort fixed |
| TEST-113-020 | Role User Count Badges | PASS | 2026-03-06 | Clickable user count per role, filters Internal Users tab |
| TEST-113-021 | Collapsible Sidebar + Tab Switching | PASS | 2026-03-06 | Settings sub-items switch tabs via ?tab= query param |
| TEST-113-022 | Audit Log Pagination with Page Size Selector | PASS | 2026-03-06 | 25/50/100 per page dropdown, pagination controls |
| TEST-113-023 | Delete Role Blocks When Users Assigned | PASS | 2026-03-06 | Dialog closes on error, error message shown above roles list |
