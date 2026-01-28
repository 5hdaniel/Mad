# BACKLOG-515: Add Server-Time Validation for Trial Expiration

**Category**: security
**Priority**: P1 (High)
**Sprint**: -
**Estimated Tokens**: ~20K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Replace client-side trial expiration checks with server-time validation to prevent users from manipulating their system clock to extend trials.

## Background

Current trial expiration is calculated client-side:
```typescript
const isExpired = new Date(license.trial_expires_at) < new Date();
```

A user can set their system clock back to bypass this check. Server-time validation would use Supabase's `now()` to ensure accurate expiration checks.

## Requirements

### Server-Side Function

```sql
CREATE OR REPLACE FUNCTION is_trial_valid(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM licenses
    WHERE user_id = p_user_id
      AND license_type = 'trial'
      AND trial_expires_at > now()  -- Server time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Client-Side Changes

1. Add RPC call to validate trial using server time
2. Fall back to client-side check only when offline (with grace period)
3. Cache server validation result for 1 hour

## Acceptance Criteria

- [ ] Server-side RPC function created
- [ ] License service uses server-time validation when online
- [ ] Client-side fallback only used during offline grace period
- [ ] Unit tests cover both online and offline scenarios

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE
- BACKLOG-478 (License Validation Service) - IN PROGRESS

## Related Files

- `electron/services/licenseService.ts`
- Supabase migration for RPC function
