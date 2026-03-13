# SPRINT-122: Plan Admin + Feature Gate Enforcement

**Created:** 2026-03-06
**Closed:** 2026-03-11
**Status:** Deprecated -- Superseded by SPRINT-126 (completed 2026-03-12)
**Goal:** Build admin UI for plan management and enforce feature gates in both the desktop app and broker portal

---

## Sprint Narrative

With the feature flag data model in place (SPRINT-121), this sprint adds the three consumer layers: (1) an admin portal UI for managing plans and assigning them to organizations, (2) desktop app enforcement that checks feature flags before allowing gated actions, and (3) broker portal enforcement that hides/disables gated features server-side. These three tasks are independent of each other and can be parallelized -- they each consume the RPCs from SPRINT-121 but touch completely separate codebases (admin-portal, electron, broker-portal).

---

## Closure Reason

**SPRINT-122 is superseded by SPRINT-126 (Feature Gate Rework + Completion).**

During QA testing of the three parallel PRs, the SR Engineer identified 7 issues in PR #1124 (TASK-2128 -- Desktop Feature Gate Service), including 3 critical bugs that make the entire feature gate system non-functional:

1. **C1**: `featureGateService.ts` used `Array.isArray(data)` to parse the RPC response -- features were never actually parsed from the JSONB object format.
2. **C4**: SQL RPC `get_org_features` had a broken `IF v_org_plan IS NOT NULL` check on a RECORD type -- override/plan logic never executed. The fix was applied live to Supabase but the deployed migration file is incorrect and needs a NEW corrective migration.
3. **C6**: ExportModal renders date fields alongside UpgradePrompt when gated -- only the UpgradePrompt should render.

Additional important issues: test mocks matching the bug (I1), inconsistent error response format (I2), no cache max age (I5), FeatureAccess type duplicated in 5 places (I6).

Since TASK-2128 is the foundation layer (provides the `get_org_features` RPC that TASK-2127 and TASK-2129 also consume), all three tasks are blocked until the rework is complete.

**Decision:** Close SPRINT-122, create SPRINT-126 with corrected dependency graph:
- Phase 1: TASK-2153 (fix TASK-2128 bugs) -- sequential, blocks everything
- Phase 2: QA test TASK-2127 and TASK-2129 after TASK-2128 merges
- Independent: TASK-2152 (iPhone sync) proceeds separately via SPRINT-125

### Open PRs at Closure

| PR | Task | Branch | Status | Action |
|----|------|--------|--------|--------|
| #1124 | TASK-2128 | `feature/task-2128-desktop-feature-gates` | Changes Requested | Rework in SPRINT-126 Phase 1 |
| #1123 | TASK-2127 | `feature/task-2127-plan-admin-ui` | Open, Not Tested | QA in SPRINT-126 Phase 2 |
| #1122 | TASK-2129 | `feature/task-2129-broker-feature-gates` | Open, Not Tested | QA in SPRINT-126 Phase 2 |

### Existing Worktrees

| Worktree | Branch | Status |
|----------|--------|--------|
| `Mad-TASK-2127` | `feature/task-2127-plan-admin-ui` | Preserved for Phase 2 |
| `Mad-TASK-2129` | `feature/task-2129-broker-feature-gates` | Preserved for Phase 2 |

---

## Original In-Scope (for reference)

| Task | Backlog | Title | Est. Tokens | Final Status |
|------|---------|-------|-------------|--------------|
| TASK-2127 | BACKLOG-924 | Plan Administration UI (admin-portal) | ~35K | Blocked by TASK-2128 |
| TASK-2128 | BACKLOG-925 | Desktop App Feature Gate Enforcement (electron) | ~30K | Changes Requested (7 bugs) |
| TASK-2129 | BACKLOG-926 | Broker Portal Feature Gate Enforcement (broker-portal) | ~25K | Blocked by TASK-2128 |

---

## Lessons Learned

1. **Tasks sharing an RPC are NOT independent.** TASK-2127, TASK-2128, and TASK-2129 all consume `get_org_features`. A bug in the RPC (C4) or in response parsing (C1) blocks all consumers. The original plan called these "fully parallel" but the shared RPC creates a hidden dependency.
2. **QA testing should happen before declaring parallel safety.** The original plan noted "no shared files, no merge conflict risk" but did not consider shared runtime dependencies (RPCs, response shapes).
3. **Deployed migrations need corrective migrations, not edits.** The C4 SQL fix was applied live to Supabase but the migration file still has the bug. Future deployments would reintroduce the bug without a new corrective migration.
