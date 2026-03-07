# SPRINT-116: Broker Portal Impersonation

**Created:** 2026-03-07
**Status:** In Progress
**Goal:** Enable admin support staff to view the broker portal as any user for support/debugging
**Integration Branch:** `int/sprint-116-impersonation`

---

## Sprint Narrative

Support staff need to see exactly what a broker sees -- not just their data in the admin portal, but the actual broker portal experience. This sprint implements true cross-portal impersonation: admin clicks "View as User" in the admin portal, which opens the broker portal loaded as that user's session with a persistent support banner.

---

## In-Scope

| Backlog | Title | Priority | Est. Complexity |
|---------|-------|----------|-----------------|
| BACKLOG-866 | Broker portal impersonation for support | High | High |
| BACKLOG-838 | Add impersonation support to admin portal (UI + schema) | High | High |

### Key Deliverables

1. **Schema:** `impersonation_sessions` table with time-limited tokens (30 min)
2. **RPCs:** `admin_start_impersonation`, `admin_end_impersonation`, `admin_validate_impersonation_token`
3. **Admin Portal:** "View as User" button on user detail page (permission-gated to `users.impersonate`)
4. **Broker Portal:** Accept impersonation token, load as target user, show purple support banner with countdown
5. **Audit:** All impersonation sessions logged to `admin_audit_logs`

## Out of Scope / Deferred

- Electron desktop app impersonation (Phase 2, future)
- Write operations during impersonation (read-only for now)
- Impersonation session management page (active sessions list)

---

## Dependencies

- SPRINT-113 (RBAC) -- Completed
- SPRINT-115 (admin polish) -- Completed

---

## Task Breakdown

### Phase 1: Schema Foundation (Sequential)

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-2122 | Impersonation Schema & RPCs | ~33K | Pending |

**Execution:** Sequential. Must complete before Phase 2 starts.

**Dependency:** None -- foundational task.

### Phase 2: Portal Integration (Parallel)

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-2123 | Admin Portal "View as User" Button | ~20K | Pending |
| TASK-2124 | Broker Portal Impersonation Session & Support Banner | ~35K | Pending |

**Execution:** Parallel -- no shared files between admin-portal and broker-portal.

**Dependency:** Both depend on TASK-2122 (schema must be merged first).

**Safe for parallel because:**
- TASK-2123 modifies only `admin-portal/` files
- TASK-2124 modifies only `broker-portal/` files
- No shared files, no merge conflict risk

### Phase 3: Integration & Hardening (Sequential)

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-2125 | E2E Validation & Read-Only Enforcement | ~15K | Pending |

**Execution:** Sequential. Must complete after Phase 2 tasks merge.

**Dependency:** TASK-2123 and TASK-2124 must both be merged.

---

## Dependency Graph

```
TASK-2122 (Schema & RPCs)
    |
    +---> TASK-2123 (Admin Portal UI)  ----+
    |                                      |
    +---> TASK-2124 (Broker Portal)    ----+
                                           |
                                      TASK-2125 (E2E & Hardening)
```

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| Engineer work | ~103K |
| SR Review (4 reviews x ~15K) | ~60K |
| **Total** | **~163K** |

---

## Merge Plan

- Integration branch: `int/sprint-116-impersonation` (from `develop`)
- All PRs target `int/sprint-116-impersonation`
- Merge order: TASK-2122 -> TASK-2123 + TASK-2124 (parallel) -> TASK-2125
- After TASK-2125 merges, merge `int/sprint-116-impersonation` -> `develop`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Impersonation token security | Critical | Short TTL (30 min), HTTP-only cookie, audit logging, permission-gated |
| Session confusion (admin vs impersonated) | High | Persistent purple banner, read-only mode, no real auth session created |
| Cross-portal auth complexity | Medium | Use UUID tokens looked up server-side, not JWTs; service role client for data access |
| RLS data access during impersonation | Medium | Use Supabase service role client to bypass RLS; only used server-side |
| Write operation leakage | Medium | Three-layer defense: UI hiding, server component guards, API route guards |

---

## Task Files

- `.claude/plans/tasks/TASK-2122-impersonation-schema-rpcs.md`
- `.claude/plans/tasks/TASK-2123-admin-portal-view-as-user.md`
- `.claude/plans/tasks/TASK-2124-broker-portal-impersonation-session.md`
- `.claude/plans/tasks/TASK-2125-impersonation-e2e-readonly.md`
