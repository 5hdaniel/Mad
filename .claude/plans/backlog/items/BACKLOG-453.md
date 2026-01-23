# BACKLOG-453: Fix Portal Auth for Multi-Org Brokers

## Summary

Broker portal auth callback fails for users who are brokers in multiple organizations due to `.maybeSingle()` query returning error on multiple rows.

## Category

Portal / Bug Fix

## Priority

P1 - High (Blocks multi-org users from logging in)

## Description

### Problem

In `broker-portal/app/auth/callback/route.ts`, the membership check uses `.maybeSingle()`:

```typescript
const { data: membership } = await supabase
  .from('organization_members')
  .select('role, organization_id')
  .eq('user_id', user.id)
  .in('role', ['broker', 'admin'])
  .maybeSingle();  // <-- BUG: fails if user is in multiple orgs
```

When a user is a broker in multiple organizations:
- `.maybeSingle()` expects 0 or 1 row
- Multiple rows cause it to error/return null
- User gets "not_authorized" error despite being a valid broker

### Solution

Change the query to handle multiple memberships:

```typescript
const { data: membership } = await supabase
  .from('organization_members')
  .select('role, organization_id')
  .eq('user_id', user.id)
  .in('role', ['broker', 'admin'])
  .limit(1)
  .single();
```

Or use `.maybeSingle()` but handle the multi-org case:

```typescript
const { data: memberships } = await supabase
  .from('organization_members')
  .select('role, organization_id')
  .eq('user_id', user.id)
  .in('role', ['broker', 'admin'])
  .limit(1);

const membership = memberships?.[0];
```

### Discovered

Found during QA testing (TEST-051-006) when setting up multi-org test user.

## Acceptance Criteria

- [ ] Users who are brokers in multiple orgs can log in
- [ ] Auth callback selects first valid membership
- [ ] Existing single-org users still work
- [ ] Add test case for multi-org broker login

## Estimated Effort

~10K tokens (simple fix)

## Related Items

- TEST-051-006: RLS Policies testing
- BACKLOG-452: Admin User Management UI
