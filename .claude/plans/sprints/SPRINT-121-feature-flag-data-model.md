# SPRINT-121: Feature Flag Data Model (Foundation)

**Created:** 2026-03-06
**Status:** Planned
**Goal:** Design and implement Supabase tables, RPCs, and RLS policies for per-capability feature flags and plan management

---

## Sprint Narrative

Keepr needs a feature flagging and plan management system to control which capabilities each organization has access to. Currently, the `organizations` table has a simple `plan` column (`trial`, `pro`, `enterprise`) but no granular feature control. This sprint creates the foundational data model: independent boolean flags per capability (text_export, email_export, text_attachments, email_attachments, call_log, etc.), plans as bundles of flags, and an RPC for checking feature access by org_id. This is the foundation that Sprint 119 (admin UI + enforcement) builds upon.

---

## In-Scope

| Task | Backlog | Title | Est. Tokens | Status |
|------|---------|-------|-------------|--------|
| TASK-2126 | BACKLOG-891 | Feature Flag & Plan Management Data Model | ~40K | Pending |

### Key Deliverables

1. **Table: `feature_definitions`** -- Canonical list of features (text_export, email_export, text_attachments, email_attachments, call_log, max_transaction_size, etc.)
2. **Table: `plans`** -- Named bundles (trial, pro, enterprise, custom) with tier enum
3. **Table: `plan_features`** -- Junction table mapping plans to features with value overrides
4. **Table: `organization_plans`** -- Links organizations to their active plan, with override capabilities
5. **RPC: `check_feature_access`** -- Given org_id and feature_key, returns boolean/value
6. **RPC: `get_org_features`** -- Given org_id, returns all features with their resolved values
7. **RLS Policies** -- Appropriate access control for all new tables
8. **Seed Data** -- Default plans (trial, pro, enterprise) with feature assignments

## Out of Scope / Deferred

- Admin portal UI for plan management (SPRINT-122, BACKLOG-892)
- Desktop app feature gate enforcement (SPRINT-122, BACKLOG-893)
- Broker portal feature gate enforcement (SPRINT-122, BACKLOG-894)
- Billing/payment integration
- Usage metering or rate limiting
- Feature flag analytics/tracking

---

## Dependencies

- No upstream sprint dependencies -- this is a foundational sprint
- SPRINT-122 (Plan Admin + Feature Gate Enforcement) depends on this sprint completing
- Independent of SPRINT-116 (impersonation) and SPRINT-117 (SOC 2)
- Independent of SPRINT-123 (voice transcription)

---

## Task Breakdown

### Phase 1: Data Model (Sequential -- single task)

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-2126 | Feature Flag & Plan Management Data Model | ~40K | Pending |

**Execution:** Sequential. Single task -- this is the entire sprint.

**Dependency:** None -- foundational.

---

## Dependency Graph

```
TASK-2126 (Schema + RPCs + Seed Data)
    |
    +---> SPRINT-122 TASK-2127 (Plan Admin UI)
    |
    +---> SPRINT-122 TASK-2128 (Desktop Feature Gates)
    |
    +---> SPRINT-122 TASK-2129 (Broker Portal Feature Gates)
```

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| Engineer work | ~40K |
| SR Review (1 review x ~20K) | ~20K |
| **Total** | **~60K** |

---

## Merge Plan

- No integration branch needed (single task)
- Target: `develop`
- Branch: `feature/task-2126-feature-flag-data-model`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing `plan` column on `organizations` conflicts with new system | Medium | New system supplements it; `organization_plans` references the org, old `plan` column can be migrated later |
| Feature definitions too rigid for future needs | Medium | Use `value_type` (boolean/integer/string) for flexible feature values, not just booleans |
| RPC performance for per-request feature checks | Low | Add composite index on org_id + feature_key; cache at app layer |
| Seed data conflicts with existing org plans | Low | Migration checks for existing orgs and creates default plan assignments |

---

## Testing Plan

| Surface | Requirement |
|---------|-------------|
| Migration | Applies cleanly via `supabase db push` |
| RPC correctness | `check_feature_access` returns correct boolean for known org/feature combos |
| RPC correctness | `get_org_features` returns complete feature set for an org |
| RLS | Non-admin users cannot modify plans or feature definitions |
| Seed data | Default plans exist with correct feature assignments after migration |

---

## Task Files

- `.claude/plans/tasks/TASK-2126-feature-flag-data-model.md`
