# TASK-2155: Fix get_org_features RPC Auth for Broker Portal

**Backlog ID:** BACKLOG-933
**Sprint:** SPRINT-122
**Phase:** Bug Fix (standalone)
**Depends On:** None (schema already deployed)
**Branch:** `fix/backlog-933-broker-rpc-auth`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~10K

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix the two-part bug that makes feature gates non-functional in the broker portal:

1. The `get_org_features` RPC requires org membership, but broker users aren't org members
2. `feature-gate.ts` doesn't check JSONB error field in RPC response

## Non-Goals

- Do NOT modify the existing `get_org_features` RPC (keep it for desktop app / org members)
- Do NOT change the fail-open policy for unknown features
- Do NOT add new feature definitions or plan changes

## Deliverables

1. **New file:** `supabase/migrations/20260312_broker_get_org_features.sql` — New SECURITY DEFINER RPC
2. **Update:** `broker-portal/lib/feature-gate.ts` — Use new RPC + check JSONB error field

## Implementation Details

### Part 1: New RPC — `broker_get_org_features`

Create a `SECURITY DEFINER` function that:
- Has same logic as `get_org_features` (same feature resolution: default → plan → override)
- Requires only `auth.uid() IS NOT NULL` (authenticated user, not org member)
- Logs access for audit trail (optional)

```sql
CREATE OR REPLACE FUNCTION public.broker_get_org_features(
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  -- Same variables as get_org_features
BEGIN
  -- Only require authentication (no org membership check)
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'org_id', p_org_id,
      'plan_name', 'none',
      'plan_tier', 'none',
      'features', '{}'::jsonb,
      'error', 'not_authenticated'
    );
  END IF;

  -- ... same feature resolution logic as get_org_features ...
END;
$$;
```

**Pattern reference:** Look at existing `admin_*` SECURITY DEFINER RPCs in `supabase/migrations/20260310_b_feature_flags_plan_management.sql` for the pattern.

**Copy the feature resolution logic** from the DEPLOYED `get_org_features` (the version in `20260311224054_fix_get_org_features_rpc.sql`), just remove the org membership check.

### Part 2: Fix `feature-gate.ts`

Update `getOrgFeatures()` to:
1. Call `broker_get_org_features` instead of `get_org_features`
2. Check for JSONB `error` field in the response data
3. Log the error and return fail-open defaults when JSONB error is present

```typescript
export async function getOrgFeatures(orgId: string): Promise<OrgFeatures> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('broker_get_org_features', {
    p_org_id: orgId,
  });

  if (error) {
    console.error('Failed to fetch org features:', error);
    return { org_id: orgId, plan_name: 'unknown', plan_tier: 'unknown', features: {} };
  }

  // Check for JSONB-level error (RPC returns errors as data, not Supabase errors)
  if (data && (data as any).error) {
    console.error('RPC returned error:', (data as any).error);
    return { org_id: orgId, plan_name: 'unknown', plan_tier: 'unknown', features: {} };
  }

  return data as OrgFeatures;
}
```

## File Boundaries

### Files to modify (owned by this task):
- `supabase/migrations/20260312_broker_get_org_features.sql` (new)
- `broker-portal/lib/feature-gate.ts` (update)

### Files this task must NOT modify:
- `admin-portal/` — Not relevant
- `electron/` or `src/` — Not relevant
- `supabase/migrations/20260311224054_fix_get_org_features_rpc.sql` — Don't change existing migration
- The existing `get_org_features` function — Keep it for desktop app

## Acceptance Criteria

- [ ] New `broker_get_org_features` RPC exists and is SECURITY DEFINER
- [ ] RPC returns correct features for any authenticated caller (no org membership required)
- [ ] `feature-gate.ts` calls `broker_get_org_features` instead of `get_org_features`
- [ ] `feature-gate.ts` checks for JSONB `error` field in response
- [ ] JSONB errors trigger fail-open defaults with console.error logging
- [ ] TypeScript compiles (`npm run type-check` in broker-portal/)
- [ ] Lint passes (`npm run lint` in broker-portal/)

## Testing Notes

- Test with `dhaim@bluespaces.com` logged into broker portal
- Verify feature gates work for Izzyrescue org (`e8f93bc4-f516-48cd-88fc-905334e5a16b`)
- Verify disabled features are actually hidden (not fail-open allowed)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist
```
Files created:
- [ ] supabase/migrations/20260312_broker_get_org_features.sql

Files modified:
- [ ] broker-portal/lib/feature-gate.ts

Verification:
- [ ] npm run type-check passes (in broker-portal/)
- [ ] npm run lint passes (in broker-portal/)
```
