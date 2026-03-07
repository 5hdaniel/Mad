# SPRINT-116: Broker Portal Impersonation

**Status:** Ready
**Created:** 2026-03-06
**Backlog Item:** BACKLOG-866
**Integration Branch:** `int/sprint-116-impersonation`
**Merge Target:** `develop`

---

## Sprint Goal

Enable support staff to impersonate users in the broker portal for debugging and support, with full audit trail. Admin clicks "View as User" in the admin portal and opens the broker portal as that user, seeing the actual broker experience -- not just user data in the admin portal.

## Dependencies

- **SPRINT-113** (Admin RBAC) -- MERGED (PR #1062). Establishes `users.impersonate` permission required for this feature.
- **SPRINT-115** (Admin Portal Polish) -- Recommended. Hardens shared components and permission checks before building on top of them.
- **Broker Portal** -- Must exist and be functional (`/Users/daniel/Documents/Mad/broker-portal`).

## Context

The admin-portal-only impersonation view built during SPRINT-113 was scrapped (BACKLOG-838 deferred) because support needs to see the actual broker experience, not just user data. This sprint implements true cross-portal impersonation: admin portal generates a secure token, broker portal accepts it and loads a read-only session as the target user, with a persistent banner and full audit logging.

---

## In-Scope

| Backlog | Title | Priority | Est. Tokens |
|---------|-------|----------|-------------|
| BACKLOG-866 | Broker portal impersonation for support | High | ~100K |

### Task Breakdown

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-A | Impersonation token generation RPC + admin portal UI | ~25K | Pending |
| TASK-B | Broker portal token acceptance + session load | ~30K | Pending |
| TASK-C | Impersonation session banner with countdown timer | ~15K | Pending |
| TASK-D | Audit trail integration (all impersonated actions logged) | ~15K | Pending |
| TASK-E | End-to-end testing and security review | ~15K | Pending |

**Note:** Task IDs (TASK-A through TASK-E) are placeholders. Real TASK-XXXX IDs will be assigned when task files are created.

**Total Estimated:** ~100K tokens

## Out of Scope / Deferred

- Write actions during impersonation (read-only for v1)
- Impersonation of admin portal users (broker portal only)
- Impersonation session extension beyond countdown
- Replaying user actions / session recording

---

## Execution Plan

### Phase 1: Token Infrastructure (Sequential)

- **TASK-A:** Impersonation token generation RPC + admin portal UI
  - Create `admin_generate_impersonation_token(target_user_id UUID)` RPC
  - Token is short-lived (configurable, default 30 min), single-use, stored in DB
  - RPC checks caller has `users.impersonate` permission
  - Admin portal: "View as User" button on user detail page
  - Button opens broker portal URL with token in query param (HTTPS only)
  - Audit log entry: `user.impersonation_started`

### Phase 2: Broker Portal Session (Sequential, depends on Phase 1)

- **TASK-B:** Broker portal token acceptance + session load
  - Broker portal receives `/impersonate?token=xxx` route
  - Validates token (exists, not expired, not used, valid target user)
  - Loads target user session in read-only mode
  - Marks token as consumed
  - Stores impersonation metadata in session (admin user ID, expiry, target user ID)

### Phase 3: UX + Audit (Parallel, depends on Phase 2)

- **TASK-C:** Impersonation session banner with countdown timer
  - Persistent top banner: "Viewing as [User Name] -- Support Session -- XX:XX remaining"
  - Countdown timer showing time until session expires
  - "End Session" button returns to admin portal
  - Banner cannot be dismissed
  - Session auto-expires when countdown reaches zero

- **TASK-D:** Audit trail integration (all impersonated actions logged)
  - All page views during impersonation logged to `admin_audit_logs`
  - Each log entry includes `impersonation_session_id`, admin user ID, target user ID
  - Session end logged: `user.impersonation_ended` (manual or timeout)
  - Impersonation sessions visible in audit log with distinct action type

### Phase 4: Validation (Sequential, depends on Phases 3)

- **TASK-E:** End-to-end testing and security review
  - Test: token generation, acceptance, session load, banner, countdown, auto-expire
  - Test: expired token rejection, used token rejection, missing permission rejection
  - Test: audit trail completeness (start, actions, end)
  - Security: verify no write actions possible during impersonation
  - Security: verify token cannot be reused
  - Security: verify only users with `users.impersonate` can generate tokens

---

## Dependency Graph

```
TASK-A (token RPC + admin UI)
    |
    v
TASK-B (broker portal acceptance)
    |
    +--------+--------+
    |                 |
    v                 v
TASK-C (banner)   TASK-D (audit trail)
    |                 |
    +--------+--------+
             |
             v
         TASK-E (e2e testing + security review)
```

---

## Merge Plan

- Integration branch: `int/sprint-116-impersonation`
- Base from: `develop` (after SPRINT-115 merged, or directly if 115 is not yet ready)
- Separate branch per task with PRs to integration branch
- TASK-A and TASK-B are sequential (B depends on A)
- TASK-C and TASK-D are parallel (both depend on B)
- TASK-E is sequential (depends on C and D)
- Integration branch merges to `develop` after all tasks complete and QA passes

---

## Cross-Repo Considerations

This sprint spans two codebases:
- **admin-portal** (`/Users/daniel/Documents/Mad/admin-portal`) -- TASK-A (UI + RPC), partial TASK-D
- **broker-portal** (`/Users/daniel/Documents/Mad/broker-portal`) -- TASK-B, TASK-C, partial TASK-D

Both are subdirectories of the same monorepo, so a single integration branch covers both.

---

## Testing Plan

| Task | Test Type | Details |
|------|-----------|---------|
| TASK-A | Manual + Unit | RPC generates valid token; permission check enforced; UI button appears only for users with `users.impersonate` |
| TASK-B | Manual + Unit | Token accepted; session loads as target user; expired/used tokens rejected |
| TASK-C | Manual | Banner visible on all pages; countdown accurate; "End Session" works; auto-expire works |
| TASK-D | Manual + Query | All impersonation events appear in audit log with correct metadata |
| TASK-E | E2E + Security | Full flow validation; penetration testing of token reuse, permission bypass, write attempts |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token intercepted in transit | Critical | HTTPS only; short-lived (30 min); single-use; stored hashed in DB |
| Impersonated user gains admin access | Critical | Token only grants read-only broker portal access; no admin portal session created |
| Session outlives countdown | High | Server-side expiry check on every request; client countdown is UX only |
| Broker portal auth flow conflicts with impersonation | Medium | Separate `/impersonate` route bypasses normal OAuth flow |
| Write actions leak through during impersonation | High | Server-side read-only enforcement via session flag; client-side UI disables write controls |

---

## Acceptance Criteria

- [ ] Admin with `users.impersonate` permission can click "View as User" on user detail page
- [ ] Broker portal opens with target user's data loaded (read-only)
- [ ] Persistent banner shows admin identity, target user, and countdown timer
- [ ] Session auto-expires when countdown reaches zero
- [ ] "End Session" button returns to admin portal
- [ ] All impersonation events logged to audit trail (start, page views, end)
- [ ] Expired/used tokens are rejected with clear error message
- [ ] Users without `users.impersonate` permission cannot access the feature
- [ ] No write actions possible during impersonation session
- [ ] `npm run build` passes in both admin-portal and broker-portal
