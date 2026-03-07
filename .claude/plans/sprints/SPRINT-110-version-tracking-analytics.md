# SPRINT-110: Version Tracking, Analytics Dashboard & Invite Verification

**Sprint Goal:** Populate the `app_version` column on device check-in (BACKLOG-839), plan the admin portal analytics dashboard (BACKLOG-840, blocked), and verify invite links work on the new `app.keeprcompliance.com` domain (BACKLOG-841).

**Branch:** Feature branches per task (no integration branch needed — independent items)
**Base:** `develop`
**Merge Target:** `develop`

---

## Context

Three backlog items spanning Electron, admin portal, and infra. BACKLOG-840 was previously blocked by SPRINT-109 (admin portal scaffold) -- now unblocked since SPRINT-109 is complete (PR #1038 merged).

---

## In-Scope

| # | Task | Backlog | Status | Blocker |
|---|------|---------|--------|---------|
| 1 | TASK-2107: Populate app_version on device check-in | BACKLOG-839 | Pending | None |
| 2 | TASK-2108: Admin portal analytics dashboard (plan only) | BACKLOG-840 | Pending | None (SPRINT-109 complete) |
| 3 | TASK-2109: Verify invite links on app.keeprcompliance.com | BACKLOG-841 | Pending | None |

## Out of Scope / Deferred

- Admin portal scaffold (SPRINT-109 / BACKLOG-837)
- Sentry Release Health session tracking (optional part of BACKLOG-839, deferred)
- Any admin portal features beyond analytics dashboard

---

## Dependency Graph

```
TASK-2107 (app_version in device check-in) ──┐
                                              ├── Independent, run in parallel
TASK-2109 (verify invite links)         ──────┘

TASK-2108 (analytics dashboard) ── Pending (SPRINT-109 complete, unblocked)
```

TASK-2107 and TASK-2109 have no dependencies and can execute in parallel.
TASK-2108 is now unblocked (SPRINT-109 complete, admin portal deployed).

---

## Execution Plan

### Phase 1: Parallel (TASK-2107 + TASK-2109)

Both are independent and small. Run in parallel using isolated worktrees:

```bash
# TASK-2107 worktree
git worktree add ../Mad-task-2107 -b feature/task-2107-device-app-version develop

# TASK-2109 worktree
git worktree add ../Mad-task-2109 -b chore/task-2109-verify-invite-links develop
```

### Phase 2: TASK-2108 (unblocked)

SPRINT-109 is complete. Admin portal scaffold is deployed. TASK-2108 can now proceed.

---

## Merge Plan

1. TASK-2107: PR `feature/task-2107-device-app-version` -> `develop`
2. TASK-2109: PR `chore/task-2109-verify-invite-links` -> `develop` (if any code changes needed; otherwise just verification)
3. TASK-2108: PR `feature/task-2108-admin-analytics` -> `develop` (unblocked, ready for implementation)

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| `app.getVersion()` returns wrong value in dev mode | Low | Already used in Sentry init and error logging — proven pattern |
| Vercel env var doesn't propagate | Low | Trigger manual redeployment after setting |
| SPRINT-109 delays block TASK-2108 | Medium | Task file ready, can start immediately when unblocked |

---

## Testing & Quality Plan

### TASK-2107 (Device Version)
- [ ] Login on dev build
- [ ] Query `SELECT device_id, app_version FROM devices WHERE user_id = '<id>'`
- [ ] `app_version` shows version string (not NULL)
- [ ] Heartbeat also updates `app_version`

### TASK-2109 (Invite Links)
- [ ] `NEXT_PUBLIC_APP_URL` set in Vercel Production env
- [ ] Redeployment triggered
- [ ] Invite link generated uses `app.keeprcompliance.com` (not www)
- [ ] Clicking invite link loads invite page correctly

### TASK-2108 (Analytics — deferred)
- Acceptance criteria defined in task file for future implementation

---

## Validation Checklist (Sprint Close)

- [ ] `app_version` populated on device check-in (TASK-2107)
- [ ] Invite links use correct domain (TASK-2109)
- [ ] TASK-2108 task file exists with complete spec (blocked, not implemented)
- [ ] All PRs merged, no orphaned PRs
- [ ] Effort metrics recorded
- [ ] Backlog statuses updated
