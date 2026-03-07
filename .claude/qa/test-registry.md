# QA Test Registry

Tracks all test cases run across sprints. One row per test, updated after each QA session.

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
