# TASK-2161: Add max_seats Feature Definition

**Sprint:** SPRINT-127
**Backlog:** BACKLOG-930
**Phase:** Phase 1 (schema)
**Branch:** `feature/task-2161-max-seats-feature-definition`
**Status:** Completed
**Estimated Effort:** ~5K tokens

---

## Summary

Add a `max_seats` feature definition with `value_type: 'integer'` to control seat limits per plan. Set default values per tier (Individual = 1, Team = 5, Enterprise = 50). The existing `multi_seat` boolean controls whether multi-seat is available; `max_seats` controls how many seats are allowed.

## Prerequisites

- TASK-2156 merged (tier constraints schema, min_tier column, feature_definitions table structure)

---

## Scope

### 1. Insert `max_seats` Feature Definition

Insert a new row into `feature_definitions`:

```sql
INSERT INTO feature_definitions (key, name, description, category, value_type, min_tier)
VALUES (
  'max_seats',
  'Maximum Seats',
  'Maximum number of user seats allowed for the organization',
  'access',
  'integer',
  NULL
);
```

Key details:
- `key`: `max_seats`
- `category`: `access`
- `value_type`: `integer`
- `min_tier`: `NULL` (available to all tiers -- the integer value itself controls the limit)

### 2. Seed `plan_features` for All Plans

For ALL existing plans, create `plan_features` rows with default integer values:

| Plan Tier | max_seats value | enabled |
|-----------|----------------|---------|
| Individual | 1 | true |
| Team | 5 | true |
| Enterprise | 50 | true |
| Custom | 50 | true |

```sql
INSERT INTO plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, fd.id, true,
  CASE p.tier
    WHEN 'individual' THEN 1
    WHEN 'team' THEN 5
    WHEN 'enterprise' THEN 50
    WHEN 'custom' THEN 50
  END
FROM plans p
CROSS JOIN feature_definitions fd
WHERE fd.key = 'max_seats'
ON CONFLICT (plan_id, feature_id) DO NOTHING;
```

### 3. NOT in Scope

- No application code changes (admin portal already renders integer features with input fields)
- No Electron changes
- No broker portal changes
- No RPC changes (existing `admin_update_plan_feature` already handles integer values)
- No feature dependency rules for `max_seats`

---

## Files to Modify

- `supabase/migrations/YYYYMMDD_add_max_seats_feature.sql` (new migration file)

## Files NOT to Modify

- No admin-portal/ changes
- No electron/ changes
- No broker-portal/ changes
- No src/ changes

---

## Key Design Decision

`max_seats` has `min_tier = NULL` because ALL tiers get a seat limit -- the limit value itself varies by plan (1, 5, 50). This is different from `multi_seat` which is a boolean controlling whether multi-seat capability is available at all. Both features work together:

- `multi_seat = false` + `max_seats = 1` = Individual (single seat, no multi-seat UI)
- `multi_seat = true` + `max_seats = 5` = Team (multi-seat enabled, capped at 5)
- `multi_seat = true` + `max_seats = 50` = Enterprise (multi-seat enabled, capped at 50)

---

## Testing Checklist

- [ ] Migration applies cleanly
- [ ] `max_seats` feature_definition exists with correct attributes (key, category=access, value_type=integer, min_tier=NULL)
- [ ] Individual plan has `max_seats` plan_feature with value = 1
- [ ] Team plan has `max_seats` plan_feature with value = 5
- [ ] Enterprise plan has `max_seats` plan_feature with value = 50
- [ ] Custom plan has `max_seats` plan_feature with value = 50
- [ ] All plan_features rows have `enabled = true`
- [ ] Existing RPCs (`check_feature_access`, `get_org_features`, `admin_update_plan_feature`) work with the new feature

---

## Acceptance Criteria

1. Single migration file adds `max_seats` feature_definition and seeds plan_features
2. All existing plans have a `max_seats` plan_feature with the correct integer value for their tier
3. Migration is idempotent-safe (uses ON CONFLICT DO NOTHING)
4. No application code changes required

---

## Implementation Summary

**Completed by:** Engineer agent
**Branch:** `feature/task-2161-max-seats-feature-definition`

### What was done

1. Created migration file `supabase/migrations/20260312_add_max_seats_feature.sql`
2. Inserted `max_seats` feature definition with `value_type: 'integer'`, `category: 'access'`, `min_tier: NULL`
3. Seeded `plan_features` for all existing plans (Individual=1, Team=5, Enterprise=50)
4. Deployed migration to Supabase via `execute_sql`
5. Verified all data inserted correctly

### Verification Results

| Check | Result |
|-------|--------|
| feature_definition exists | key=max_seats, category=access, value_type=integer, min_tier=NULL |
| Individual plan_feature | enabled=true, value=1 |
| Team plan_feature | enabled=true, value=5 |
| Enterprise plan_feature | enabled=true, value=50 |
| Migration idempotent (ON CONFLICT DO NOTHING) | Yes |

### Notes

- No Custom plan exists in current database; the CASE handles it if one is created later
- No application code changes needed (admin portal already renders integer features)

**Issues/Blockers:** None
