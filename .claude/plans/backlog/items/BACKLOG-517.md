# BACKLOG-517: Add DB Trigger for Transaction Count Enforcement

**Category**: security
**Priority**: P1 (High)
**Sprint**: -
**Estimated Tokens**: ~10K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Add a database trigger to enforce transaction limits server-side, preventing bypasses through direct API calls or client manipulation.

## Background

Current transaction limit is client-enforced:
```typescript
const canCreate = status.transactionCount < status.transactionLimit;
```

While the `increment_transaction_count()` RPC exists, there's no server-side enforcement preventing a user from creating transactions beyond their limit.

## Requirements

### Database Trigger

```sql
CREATE OR REPLACE FUNCTION check_transaction_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_license licenses%ROWTYPE;
BEGIN
  -- Get user's license
  SELECT * INTO v_license
  FROM licenses
  WHERE user_id = NEW.user_id;

  -- Check if user is on trial and at limit
  IF v_license.license_type = 'trial'
     AND v_license.transaction_count >= v_license.transaction_limit THEN
    RAISE EXCEPTION 'Transaction limit reached. Please upgrade your license.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Auto-increment count on successful transaction insert
  UPDATE licenses
  SET transaction_count = transaction_count + 1
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_transaction_limit
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_transaction_limit();
```

### Client-Side Changes

1. Handle transaction limit error gracefully
2. Show upgrade prompt when limit reached

## Acceptance Criteria

- [ ] Database trigger prevents transactions beyond limit
- [ ] Transaction count auto-incremented on insert
- [ ] Error message returned to client is user-friendly
- [ ] Client handles limit error and shows upgrade prompt

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE

## Related Files

- Supabase migration for trigger
- Transaction creation service/handlers
