# SPRINT-122: Plan Admin + Feature Gate Enforcement

**Created:** 2026-03-06
**Status:** Planned
**Goal:** Build admin UI for plan management and enforce feature gates in both the desktop app and broker portal

---

## Sprint Narrative

With the feature flag data model in place (SPRINT-121), this sprint adds the three consumer layers: (1) an admin portal UI for managing plans and assigning them to organizations, (2) desktop app enforcement that checks feature flags before allowing gated actions, and (3) broker portal enforcement that hides/disables gated features server-side. These three tasks are independent of each other and can be parallelized -- they each consume the RPCs from SPRINT-121 but touch completely separate codebases (admin-portal, electron, broker-portal).

---

## In-Scope

| Task | Backlog | Title | Est. Tokens | Status |
|------|---------|-------|-------------|--------|
| TASK-2127 | BACKLOG-892 | Plan Administration UI (admin-portal) | ~35K | Pending |
| TASK-2128 | BACKLOG-893 | Desktop App Feature Gate Enforcement (electron) | ~30K | Pending |
| TASK-2129 | BACKLOG-894 | Broker Portal Feature Gate Enforcement (admin-portal/broker-portal) | ~25K | Pending |

### Key Deliverables

1. **Admin Portal -- Plan Management Pages:**
   - Plans list page (view all plans, create new)
   - Plan detail page (edit features in a plan)
   - Organization plan assignment (on org detail page)
   - Feature definitions list (read-only reference)

2. **Desktop App -- Feature Gate Service:**
   - `FeatureGateService` that checks `check_feature_access` RPC on sync
   - Gate checks before text export, email export, attachment inclusion, call log access
   - Graceful degradation: show upgrade prompt when feature is gated
   - Cache feature flags locally with TTL

3. **Broker Portal -- Server-Side Feature Gates:**
   - Server component checks before rendering gated features
   - Hide export buttons, attachment sections, call log tab when gated
   - Feature check utility using `get_org_features` RPC

## Out of Scope / Deferred

- Billing/payment integration
- Self-service plan upgrade flow
- Usage metering or rate limiting
- Feature flag analytics/tracking
- Real-time feature flag updates (polling with TTL is sufficient)

---

## Dependencies

- **SPRINT-121 (Feature Flag Data Model) MUST be completed first** -- all three tasks depend on the schema, RPCs, and seed data from TASK-2126
- Independent of SPRINT-116 (impersonation) and SPRINT-117 (SOC 2)
- Independent of SPRINT-123 (voice transcription)

---

## Task Breakdown

### Phase 1: All Tasks (Parallel)

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-2127 | Plan Administration UI | ~35K | Pending |
| TASK-2128 | Desktop App Feature Gate Enforcement | ~30K | Pending |
| TASK-2129 | Broker Portal Feature Gate Enforcement | ~25K | Pending |

**Execution:** Parallel -- all three tasks are independent.

**Dependency:** All depend on SPRINT-121 TASK-2126 being merged.

**Safe for parallel because:**
- TASK-2127 modifies only `admin-portal/` files
- TASK-2128 modifies only `electron/` and `src/` files
- TASK-2129 modifies only `broker-portal/` files
- No shared files, no merge conflict risk

---

## Dependency Graph

```
SPRINT-121 TASK-2126 (Feature Flag Data Model)
    |
    +---> TASK-2127 (Admin Portal Plan Management)
    |
    +---> TASK-2128 (Desktop App Feature Gates)
    |
    +---> TASK-2129 (Broker Portal Feature Gates)
```

No dependencies between the three tasks -- fully parallel.

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| Engineer work (3 tasks parallel) | ~90K |
| SR Review (3 reviews x ~15K) | ~45K |
| **Total** | **~135K** |

---

## Merge Plan

- No integration branch needed (tasks are fully independent, no shared files)
- All PRs target `develop`
- Merge order: Any order -- no interdependencies
- Each task uses its own feature branch:
  - `feature/task-2127-plan-admin-ui`
  - `feature/task-2128-desktop-feature-gates`
  - `feature/task-2129-broker-feature-gates`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| SPRINT-121 not completed before this sprint starts | Critical | Hard dependency -- do NOT start this sprint until TASK-2126 is merged |
| Desktop app offline access to feature flags | Medium | Cache feature flags in SQLite with TTL; fall back to cached values when offline |
| Admin accidentally removes features from active plan | Medium | Confirmation dialog before plan changes; audit log all plan modifications |
| Inconsistent feature gate behavior across platforms | Medium | All platforms use same `check_feature_access` / `get_org_features` RPCs |
| Parallel merge conflicts | Low | Tasks touch completely separate directories -- no shared files |

---

## Testing Plan

| Surface | Requirement | Owner |
|---------|-------------|-------|
| Admin portal type-check + build | Must pass | TASK-2127 |
| Plan CRUD operations | Create, read, update plans via admin UI | TASK-2127 |
| Desktop feature gate service | Unit tests for gate checks and caching | TASK-2128 |
| Desktop upgrade prompts | UI shows upgrade message when feature gated | TASK-2128 |
| Broker portal feature hiding | Gated features not rendered in server components | TASK-2129 |
| Existing CI | All existing tests continue to pass | All tasks |

---

## Task Files

- `.claude/plans/tasks/TASK-2127-plan-admin-ui.md`
- `.claude/plans/tasks/TASK-2128-desktop-feature-gates.md`
- `.claude/plans/tasks/TASK-2129-broker-feature-gates.md`
