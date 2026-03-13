# BACKLOG-937: Org-Level Feature Overrides (Entitlement Overrides)

## Problem

Plan features are plan-level — changing `max_transaction_size` on the Team plan affects ALL Team customers. There's no way to:
1. **Support**: Give one org a few extra transactions while investigating an issue
2. **Sales**: Offer custom transaction volumes/pricing per deal without creating a new plan

## Solution

Add an `org_feature_overrides` table that allows per-org exceptions to plan features.

### Resolution Hierarchy
```
Org override (if set & not expired) → Plan feature → Global default
```

### Schema

```sql
CREATE TABLE org_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES feature_definitions(id),
  value TEXT NOT NULL,           -- Override value (e.g., "150" for max_transaction_size)
  reason TEXT,                   -- Why the override exists (support ticket, sales deal, etc.)
  created_by UUID REFERENCES auth.users(id),  -- Who set it
  expires_at TIMESTAMPTZ,       -- Auto-revert date (NULL = permanent)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, feature_id)
);
```

### RPC Changes

Update `check_feature_access()` to check overrides first:
```sql
-- 1. Check org_feature_overrides (non-expired)
-- 2. Fall back to plan_features
-- 3. Fall back to feature_definitions.default_value
```

### Admin Portal Changes

- **Org detail page**: Add "Feature Overrides" section
  - List active overrides with feature name, value, reason, expiry, who set it
  - "Add Override" button → pick feature, set value, optional reason and expiry
  - "Remove Override" button → reverts to plan feature
- **Visual indicators**: Badge on overridden features so support/sales can see at a glance
- **Audit log**: Log override create/update/delete/expire events

### Desktop App Changes

- No changes needed — `useFeatureGate` already calls `check_feature_access()` RPC
- Override resolution happens server-side in the RPC

### Use Cases

| Scenario | Action | Expiry |
|----------|--------|--------|
| Support: customer hit limit during investigation | Override max_transaction_size +5 | 30 days |
| Sales: volume deal for 500 transactions | Override max_transaction_size = 500 | NULL (permanent) |
| Beta: enable AI detection for one org | Override ai_detection = true | NULL |
| Promo: temporary feature access | Override any feature | End of promo period |

## Acceptance Criteria

- [ ] `org_feature_overrides` table created with RLS policies
- [ ] `check_feature_access()` RPC checks overrides before plan features
- [ ] Expired overrides are ignored (not deleted, for audit trail)
- [ ] Admin portal: org detail page shows overrides section
- [ ] Admin portal: can add/edit/remove overrides with reason and optional expiry
- [ ] Audit log captures override changes
- [ ] Desktop app reads correct values without any client-side changes
- [ ] Override badge visible in admin UI

## Estimation

~60K tokens (schema + RPC + admin UI + tests)

## Dependencies

- SPRINT-127 (plan features system) — must be merged first
