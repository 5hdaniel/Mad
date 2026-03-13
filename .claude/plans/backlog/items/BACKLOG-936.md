# BACKLOG-936: Prevent Assigning Individual Plan to Organizations

**Type:** bug
**Area:** schema
**Priority:** medium
**Status:** Pending
**Created:** 2026-03-12
**Estimated Effort:** ~15K tokens

---

## Summary

The admin portal currently allows assigning the "Individual" plan to an organization. This is semantically wrong -- Individual plans are for solo users without orgs. No validation exists at either the UI or database level to prevent this assignment.

---

## Problem Statement

When an admin assigns a plan to an organization via the admin portal, the "Individual" plan appears in the dropdown alongside team/enterprise plans. If selected, the assignment succeeds without error, creating a logically invalid state: an organization on an Individual plan.

Individual plans are designed for solo users who do not belong to an organization. Assigning one to an org leads to:
- Confusing feature gate behavior (Individual plan features are scoped for single users)
- Incorrect billing/entitlement assumptions
- Data integrity issues in plan-based reporting

---

## Scope

Two complementary fixes are needed:

### 1. Admin Portal UI (frontend guard)
- Filter the plan assignment dropdown for organizations to exclude Individual-tier plans
- Alternatively, disable the Individual option with a tooltip explaining why

### 2. RPC/Database Validation (backend guard)
- The RPC that assigns a plan to an organization should reject Individual-tier plans
- Return a clear error message: "Individual plans cannot be assigned to organizations"
- This prevents the invalid state regardless of how the API is called (admin UI, direct RPC, future integrations)

---

## Files Affected (Expected)

| Location | Change |
|----------|--------|
| `admin-portal/` (plan assignment UI) | Filter or disable Individual plan in org dropdown |
| Supabase RPC (assign plan to org) | Add tier validation check |
| Supabase migration (optional) | CHECK constraint on `organizations.plan_id` referencing tier |

---

## Acceptance Criteria

1. Individual plan does not appear (or is disabled) in the plan assignment dropdown when assigning to an organization
2. If the RPC is called directly with an Individual plan ID for an org, it returns an error
3. Existing orgs incorrectly on Individual plans are flagged (reporting/query, not auto-migrated)
4. Admin portal builds and type-checks
5. No regression to valid plan assignments (Team, Enterprise, etc.)

---

## Dependencies

- **Related:** BACKLOG-930 (License/Plan/Tier Unification) -- tier constraints being formalized in SPRINT-127
- **Related:** BACKLOG-933 (Admin Portal Delete Plan with Org Protection) -- similar plan-level guard pattern

---

## Notes

- This may be partially addressed by SPRINT-127's tier constraint work (BACKLOG-930), which introduces structural guardrails on plan-tier relationships. If tier constraints include an "individual tier cannot be assigned to orgs" rule, the backend guard may come for free.
- The UI fix in the admin portal should be done regardless, as a defense-in-depth measure.
- Consider whether a data migration is needed to fix any existing orgs that were incorrectly assigned an Individual plan.
