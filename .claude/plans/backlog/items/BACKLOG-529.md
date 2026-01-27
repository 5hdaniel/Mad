# BACKLOG-529: License Transfer Between Accounts

**Category**: feature
**Priority**: P3 (Low)
**Sprint**: -
**Estimated Tokens**: ~35K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Implement the ability to transfer a license from one user account to another, supporting account consolidation and license reassignment.

## Background

License transfers needed for:
- User email change (new account)
- Reselling/gifting licenses
- Account recovery scenarios
- Business acquisitions

## Requirements

### Transfer Scenarios

1. **Self-Transfer**
   - User initiates transfer to own new email
   - Verification required on both accounts
   - Data migration optional

2. **Admin Transfer**
   - Admin initiates on behalf of user
   - Audit logged
   - Notification to both parties

3. **Purchase Transfer**
   - License purchased as gift
   - Recipient claims via code
   - No data migration

### Process Flow

1. **Initiation**
   - Source user requests transfer
   - Provide target email
   - Generate transfer token

2. **Verification**
   - Email sent to target
   - Target confirms acceptance
   - Token expires in 48 hours

3. **Execution**
   - Deactivate source devices
   - Update license user_id
   - Migrate data (optional)
   - Send confirmation

### Database Changes

```sql
-- Transfer requests table
CREATE TABLE license_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id),
  source_user_id UUID REFERENCES auth.users(id),
  target_email TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  transfer_token TEXT UNIQUE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed')),
  include_data BOOLEAN DEFAULT false,
  initiated_by TEXT CHECK (initiated_by IN ('user', 'admin')),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Security Considerations

- Rate limit transfer requests (1 per 24h)
- Require source account verification
- Require target account verification
- Cool-off period after transfer (7 days)
- Cannot transfer during active subscription

## Acceptance Criteria

- [ ] Self-transfer flow works end-to-end
- [ ] Admin transfer works with proper logging
- [ ] Email verification on both ends
- [ ] Token expires correctly
- [ ] Data migration is optional and works
- [ ] Cool-off period enforced

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE
- BACKLOG-524 (Audit Logging) - Recommended

## Related Files

- `supabase/functions/license-transfer/`
- Transfer request UI
- Email templates for transfer flow
