# SPRINT-126: Feature Gate Rework + Completion

**Created:** 2026-03-11
**Status:** Planned
**Goal:** Fix critical bugs in the desktop feature gate service, then QA-test and merge all feature gate PRs
**Supersedes:** SPRINT-122 (Plan Admin + Feature Gate Enforcement)

---

## Sprint Narrative

SPRINT-122 ran TASK-2127, TASK-2128, TASK-2129 in parallel. QA testing revealed that PR #1124 (TASK-2128 -- Desktop Feature Gate Service) has 7 bugs, 3 of which are critical and make the entire feature gate system non-functional. Since the desktop service and both the admin portal and broker portal share the same `get_org_features` RPC (which has a SQL logic bug applied live but not in the migration file), TASK-2128 must be fixed first before the other two can be meaningfully tested.

This sprint restructures the work into a sequential dependency chain: fix TASK-2128 first, then QA the remaining PRs.

TASK-2152 (iPhone Sync macOS button) is independent and proceeds via SPRINT-125 -- it is listed here only for coordination visibility.

---

## In-Scope

| Task | Backlog | Title | Est. Tokens | Status |
|------|---------|-------|-------------|--------|
| TASK-2153 | BACKLOG-927 | Fix Desktop Feature Gate Service (TASK-2128 rework) | ~25K | Planned |
| TASK-2127 | BACKLOG-924 | Plan Administration UI -- QA + merge | ~10K | Blocked (pending Phase 1) |
| TASK-2129 | BACKLOG-926 | Broker Portal Feature Gates -- QA + merge | ~10K | Blocked (pending Phase 1) |

### Independent (SPRINT-125, coordinated here)

| Task | Backlog | Title | Est. Tokens | Status |
|------|---------|-------|-------------|--------|
| TASK-2152 | BACKLOG-924 | iPhone Sync macOS Button -- commit stash + merge | ~5K | Ready |

---

## Out of Scope / Deferred

- Billing/payment integration
- Self-service plan upgrade flow
- Usage metering or rate limiting
- Feature flag analytics/tracking
- New feature gate features beyond fixing what exists

---

## Dependencies

- **SPRINT-124 (Feature Flag Data Model) -- COMPLETED** -- schema, RPCs, seed data merged
- **TASK-2153 MUST merge before TASK-2127 or TASK-2129 can be QA tested** -- the RPC fix in the migration is shared
- TASK-2152 is fully independent (no feature gate dependency)

---

## Task Breakdown

### Phase 1: TASK-2128 Rework (Sequential -- blocks all else)

| Task | Title | Branch | Est. Tokens | Status |
|------|-------|--------|-------------|--------|
| TASK-2153 | Fix Desktop Feature Gate Service | `feature/task-2128-desktop-feature-gates` (existing) | ~25K | Planned |

**What this fixes (7 SR findings):**

| ID | Severity | Issue | Fix Required |
|----|----------|-------|-------------|
| C1 | Critical | `Array.isArray(data)` never parses JSONB object response | Fix response parsing to handle object format |
| C4 | Critical | `IF v_org_plan IS NOT NULL` on RECORD type -- override/plan logic never runs | Create NEW corrective migration (deployed migration is wrong) |
| C6 | Critical | ExportModal shows date fields alongside UpgradePrompt | Render only UpgradePrompt when gated |
| I1 | Important | Test mocks use array format matching the bug | Fix mocks to use real JSONB object format |
| I2 | Important | Error response uses `'[]'::jsonb` but success uses object | Make error response format consistent |
| I5 | Important | Persisted disk cache has no max age | Add max age check to persisted cache |
| I6 | Important | `FeatureAccess` type duplicated in 5 places | Consolidate to single canonical definition |

**Critical note on C4:** Migration `20260311182011_feature_flags_plan_management` is already deployed to Supabase. The SQL fix was applied live but the migration file still has the bug. A NEW migration file must be created to fix this -- do NOT edit the existing migration.

**Execution:** Sequential. This task blocks Phase 2.

**Branch:** Work continues on existing branch `feature/task-2128-desktop-feature-gates` (PR #1124). The engineer commits the fixes (some already exist uncommitted on the branch), pushes, and requests SR re-review.

### Phase 2: QA Test + Merge Remaining PRs (After Phase 1 merges)

| Task | Title | Branch | PR | Action |
|------|-------|--------|-----|--------|
| TASK-2127 | Plan Admin UI | `feature/task-2127-plan-admin-ui` | #1123 | QA test, apply SR note (add `{ key: 'plans', label: 'Plans' }` to PERMISSION_CATEGORIES), merge |
| TASK-2129 | Broker Portal Feature Gates | `feature/task-2129-broker-feature-gates` | #1122 | QA test, verify with fixed RPC, merge |

**Execution:** TASK-2127 and TASK-2129 can be QA tested in parallel after Phase 1 merges (they touch different codebases).

**TASK-2127 known issue:** SR Engineer noted that `PERMISSION_CATEGORIES` in `permissions.ts` needs `{ key: 'plans', label: 'Plans' }` added. This should be addressed during QA.

**Existing worktrees:**
- `Mad-TASK-2127` for TASK-2127
- `Mad-TASK-2129` for TASK-2129

### Independent: TASK-2152 (SPRINT-125)

| Task | Title | Branch | PR | Action |
|------|-------|--------|-----|--------|
| TASK-2152 | iPhone Sync macOS Button | `fix/backlog-924-iphone-sync-macos` | #1121 | Pop stash, commit, push, SR review, merge |

**Status:** QA passed 3/3 tests. Additional fixes in `stash@{0}`:
- Live update of import source setting (callback chain)
- Dashboard cards refactored to use DashboardActionCard component
- iPhone sync button renamed

**This can proceed immediately -- no dependency on feature gates.**

---

## Dependency Graph

```
SPRINT-124 TASK-2126 (Feature Flag Data Model) [COMPLETED]
    |
    +---> TASK-2153 (Fix TASK-2128 Desktop Feature Gates) [Phase 1]
              |
              +---> TASK-2127 (Admin Portal Plan Management) [Phase 2]
              |
              +---> TASK-2129 (Broker Portal Feature Gates) [Phase 2]

TASK-2152 (iPhone Sync Button) [Independent -- SPRINT-125]
```

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| TASK-2153 Engineer (fix 7 bugs) | ~25K |
| TASK-2153 SR Re-review | ~15K |
| TASK-2127 QA + fixes | ~10K |
| TASK-2129 QA + fixes | ~10K |
| TASK-2127/2129 SR review | ~20K |
| TASK-2152 stash commit + SR review | ~5K |
| **Total** | **~85K** |

**Note:** This does NOT include tokens already spent in SPRINT-122. The original engineer work for TASK-2127, TASK-2128, TASK-2129 is already done -- this sprint covers rework, QA, and merge only.

---

## Merge Plan

### Phase 1 Merge (TASK-2153)
- Branch: `feature/task-2128-desktop-feature-gates`
- PR: #1124 (existing, changes requested)
- Target: `develop`
- **Must merge before Phase 2 starts**

### Phase 2 Merges (TASK-2127, TASK-2129)
- PR #1123: `feature/task-2127-plan-admin-ui` -> `develop`
- PR #1122: `feature/task-2129-broker-feature-gates` -> `develop`
- Merge order: Any order (they touch different codebases)
- Both must sync with develop after TASK-2153 merges (to pick up the corrective migration)

### Independent Merge (TASK-2152)
- PR #1121: `fix/backlog-924-iphone-sync-macos` -> `develop`
- Can merge anytime

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Corrective migration conflicts with deployed state | High | Test migration against live Supabase before merging; the fix is already live, migration just records it |
| Phase 2 PRs have additional bugs found during QA | Medium | Budget ~10K per task for QA fixes; if scope expands, create new tasks |
| Merge conflicts after syncing with develop | Low | Each PR touches different directories; sync before QA testing |
| TASK-2127 PERMISSION_CATEGORIES fix introduces issues | Low | Small change; verify admin sidebar renders correctly |

---

## Testing Plan

| Surface | Requirement | Owner | Phase |
|---------|-------------|-------|-------|
| Desktop feature gate service | All 7 SR findings resolved | TASK-2153 | 1 |
| RPC response parsing | Correctly parses JSONB object (not array) | TASK-2153 | 1 |
| Corrective migration | Runs cleanly on deployed DB state | TASK-2153 | 1 |
| ExportModal gating | Only UpgradePrompt renders when gated | TASK-2153 | 1 |
| Cache max age | Persisted cache expires after configured period | TASK-2153 | 1 |
| FeatureAccess type | Single canonical definition, no duplicates | TASK-2153 | 1 |
| Plan admin CRUD | Create, read, update plans | TASK-2127 | 2 |
| Plan assignment | Assign plans to orgs | TASK-2127 | 2 |
| Broker portal gating | Export/attachment sections hidden when gated | TASK-2129 | 2 |
| iPhone sync button | Appears on macOS with iphone-sync source | TASK-2152 | Independent |
| All CI checks | Tests, type-check, lint pass | All tasks | All phases |

---

## Task Files

- `.claude/plans/tasks/TASK-2153-fix-desktop-feature-gates.md` (NEW)
- `.claude/plans/tasks/TASK-2127-plan-admin-ui.md` (existing)
- `.claude/plans/tasks/TASK-2128-desktop-feature-gates.md` (existing -- reference for context)
- `.claude/plans/tasks/TASK-2129-broker-feature-gates.md` (existing)
- `.claude/plans/tasks/TASK-2152-iphone-sync-macos-button.md` (existing -- SPRINT-125)
