# BACKLOG-518: Remove Direct INSERT RLS Policy on Licenses Table

**Category**: security
**Priority**: P1 (High)
**Sprint**: -
**Estimated Tokens**: ~5K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Remove the RLS policy that allows users to directly INSERT into the licenses table. License creation should only happen through the `create_trial_license()` RPC function.

## Background

Current RLS policy allows:
```sql
CREATE POLICY "Users can insert own license"
  ON licenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

This allows users to create their own license records with arbitrary values (e.g., `license_type = 'team'`). License creation should be controlled server-side.

## Requirements

### Remove Permissive Policy

```sql
DROP POLICY IF EXISTS "Users can insert own license" ON licenses;
```

### Modify RPC Function

Ensure `create_trial_license()` uses `SECURITY DEFINER` to bypass RLS:
```sql
CREATE OR REPLACE FUNCTION create_trial_license(p_user_id UUID)
RETURNS licenses AS $$
  -- Function body
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Client-Side Changes

1. Ensure license creation only goes through `license:create` IPC handler
2. Remove any direct Supabase inserts to licenses table

## Acceptance Criteria

- [ ] INSERT policy removed from licenses table
- [ ] `create_trial_license()` function has SECURITY DEFINER
- [ ] License creation only possible through RPC
- [ ] Direct INSERT attempts return permission error

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE

## Related Files

- Supabase migration to drop policy
- `electron/services/licenseService.ts`
