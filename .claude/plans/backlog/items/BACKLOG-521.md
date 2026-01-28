# BACKLOG-521: Admin Dashboard for License Management

**Category**: feature
**Priority**: P2 (Medium)
**Sprint**: -
**Estimated Tokens**: ~60K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Create an admin dashboard (web-based) for managing user licenses, viewing usage metrics, and handling support requests.

## Background

Admins need visibility into:
- License distribution across users
- Trial conversion rates
- Usage patterns
- Support for manual license adjustments

## Requirements

### Dashboard Features

1. **User License List**
   - Search/filter users
   - View license type, status, usage
   - Sort by various fields

2. **License Details**
   - Full license information
   - Transaction history
   - Device list
   - Manual adjustment capability

3. **Metrics Overview**
   - Total users by license type
   - Trial conversion rate
   - Active devices
   - Transaction volume

4. **Admin Actions**
   - Extend trial
   - Upgrade/downgrade license
   - Reset transaction count
   - Deactivate devices
   - Issue refund (via Stripe)

### Security

- Admin-only RLS policies
- Audit logging for all actions
- Rate limiting

### Implementation Options

1. **Supabase Studio** - Quick, built-in
2. **Next.js Admin App** - Custom, more control
3. **Retool/Appsmith** - Low-code, fast to build

## Acceptance Criteria

- [ ] Admin can view all user licenses
- [ ] Admin can modify licenses
- [ ] All actions are audit logged
- [ ] Access restricted to admin users
- [ ] Dashboard loads quickly with pagination

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE
- BACKLOG-524 (License Audit Logging) - Recommended first

## Related Files

- New admin app or Supabase configuration
- Admin RLS policies
