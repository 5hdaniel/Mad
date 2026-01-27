# BACKLOG-524: License Audit Logging

**Category**: feature
**Priority**: P2 (Medium)
**Sprint**: -
**Estimated Tokens**: ~20K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Implement comprehensive audit logging for all license-related actions to support compliance, debugging, and analytics.

## Background

Audit logging is needed for:
- Compliance requirements
- Debugging user issues
- Understanding usage patterns
- Fraud detection

## Requirements

### Events to Log

1. **License Events**
   - License created
   - License upgraded/downgraded
   - Trial extended
   - License suspended/reactivated

2. **Device Events**
   - Device registered
   - Device deactivated
   - Device limit reached

3. **Usage Events**
   - Transaction count incremented
   - Transaction limit reached
   - Feature usage (AI detection)

4. **Admin Events**
   - Manual license modification
   - Trial extension
   - Device removal

### Database Schema

```sql
CREATE TABLE license_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  actor_id UUID REFERENCES auth.users(id),  -- Who performed action (null if system)
  actor_type TEXT CHECK (actor_type IN ('user', 'admin', 'system')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_license_id ON license_audit_log(license_id);
CREATE INDEX idx_audit_user_id ON license_audit_log(user_id);
CREATE INDEX idx_audit_created_at ON license_audit_log(created_at);
```

### Retention Policy

- Keep detailed logs for 90 days
- Keep aggregated summaries indefinitely
- Automatic cleanup via pg_cron

## Acceptance Criteria

- [ ] All license events logged
- [ ] All device events logged
- [ ] Admin actions include actor info
- [ ] Logs queryable from admin dashboard
- [ ] Retention policy implemented

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE

## Related Files

- Supabase migration for audit table
- Audit logging utility functions
- Admin dashboard audit viewer
