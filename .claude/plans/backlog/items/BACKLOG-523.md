# BACKLOG-523: Trial Extension Mechanism

**Category**: feature
**Priority**: P2 (Medium)
**Sprint**: -
**Estimated Tokens**: ~25K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Implement a mechanism for extending user trials, supporting both automatic (promotional) and manual (support) extensions.

## Background

Trial extensions are needed for:
- Support cases (user had issues during trial)
- Promotional campaigns (extended trials for events)
- Enterprise evaluations (longer trial for large orgs)

## Requirements

### Extension Types

1. **Manual Extension (Admin)**
   - Admin dashboard action
   - Specify new expiration date
   - Add note/reason
   - Audit logged

2. **Promotional Extension (Automatic)**
   - Apply coupon code
   - Automatic extension on code validation
   - Track extension source

3. **Enterprise Trial**
   - Special trial type with longer duration
   - Custom limits
   - Dedicated support

### Database Changes

```sql
-- Track trial extensions
CREATE TABLE trial_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id),
  extended_by UUID REFERENCES auth.users(id),  -- Admin who extended
  previous_expires_at TIMESTAMPTZ,
  new_expires_at TIMESTAMPTZ,
  extension_type TEXT CHECK (extension_type IN ('manual', 'promotional', 'enterprise')),
  reason TEXT,
  coupon_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RPC function
CREATE OR REPLACE FUNCTION extend_trial(
  p_user_id UUID,
  p_days INTEGER,
  p_reason TEXT
) RETURNS licenses AS $$
  -- Implementation
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### UI Components

1. **Coupon Code Input** - User-facing
2. **Extension Modal** - Admin dashboard
3. **Extension History** - Admin view

## Acceptance Criteria

- [ ] Admin can extend any user's trial
- [ ] Coupon codes work for automatic extension
- [ ] Extension history is tracked
- [ ] User notified of extension
- [ ] Cannot extend already-converted trials

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE
- BACKLOG-521 (Admin Dashboard) - Recommended

## Related Files

- Supabase migration for extensions table
- Admin dashboard extension UI
- Coupon validation logic
