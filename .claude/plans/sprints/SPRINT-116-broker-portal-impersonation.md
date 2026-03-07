# SPRINT-116: Broker Portal Impersonation

**Created:** 2026-03-07
**Status:** Completed
**Completed:** 2026-03-07
**Goal:** Enable admin support staff to view the broker portal as any user for support/debugging

---

## Sprint Narrative

Support staff need to see exactly what a broker sees — not just their data in the admin portal, but the actual broker portal experience. This sprint implements true cross-portal impersonation: admin clicks "View as User" in the admin portal, which opens the broker portal loaded as that user's session with a persistent support banner.

---

## In-Scope

| Backlog | Title | Priority | Est. Complexity | Status |
|---------|-------|----------|-----------------|--------|
| BACKLOG-866 | Broker portal impersonation for support | High | High | Completed |
| BACKLOG-838 | Add impersonation support to admin portal (UI + schema) | High | High | Completed |

### Task Execution Summary

| Task | Title | PR | Status |
|------|-------|----|--------|
| TASK-2122 | Impersonation schema + RPCs | #1077 | Merged |
| TASK-2123 | Admin portal "View as User" button | #1078 | Merged |
| TASK-2124 | Broker portal impersonation session | #1079 | Merged |
| TASK-2125 | E2E read-only enforcement | #1080 | Merged |

### Key Deliverables

1. **Schema:** `impersonation_sessions` table with time-limited tokens (30 min)
2. **RPCs:** `admin_start_impersonation`, `admin_end_impersonation`, `admin_get_impersonated_user_data`
3. **Admin Portal:** "View as User" button on user detail page (permission-gated to `users.impersonate`)
4. **Broker Portal:** Accept impersonation token, load as target user, show purple support banner with countdown
5. **Audit:** All impersonation sessions logged to `admin_audit_logs`

## Out of Scope / Deferred

- Electron desktop app impersonation (Phase 2, future)
- Write operations during impersonation (read-only for now)

---

## Dependencies

- SPRINT-113 (RBAC) — Completed
- SPRINT-115 (admin polish) — Completed

---

## Merge Plan

- Integration branch: `int/sprint-116-impersonation`
- Separate PRs for schema, admin portal UI, broker portal changes
- Target: `develop`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Impersonation token security | Critical | Short TTL (30 min), audit logging, permission-gated |
| Session confusion (admin vs impersonated) | High | Persistent purple banner, read-only mode |
| Cross-portal auth complexity | Medium | Use signed tokens, not shared sessions |
