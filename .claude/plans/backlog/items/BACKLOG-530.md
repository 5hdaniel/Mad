# BACKLOG-530: Remove Service Role Key from Client App

**Created**: 2026-01-27
**Priority**: P0 - Critical Security
**Category**: Security
**Status**: Pending

---

## Problem Statement

The Supabase `service_role` key is shipped in the Electron app binary. This key bypasses ALL Row Level Security (RLS) policies.

**Location**: `electron/services/supabaseService.ts` line 105

## Security Risk

**Severity**: Critical

Anyone who extracts the key from the app binary (trivial with Electron apps) can:
- Access ANY data in Supabase, regardless of RLS policies
- Modify/delete ANY data in the database
- Create/modify user accounts
- Bypass all tenant isolation

This is a **data breach waiting to happen**.

## Root Cause

The `service_role` key was likely added for convenience during development to bypass RLS for certain operations. However, it should NEVER be shipped to clients.

## Solution

### Phase 1: Create Supabase Edge Functions for Privileged Operations

Identify all operations currently using `service_role` and create Edge Functions:

1. **License Operations** (if any bypass RLS)
   - Create `edge-function/license-management`
   - Validate user JWT before performing operations

2. **Admin Operations** (if any)
   - Create `edge-function/admin-operations`
   - Require admin role verification

3. **Device Management** (if any)
   - Create `edge-function/device-management`

### Phase 2: Remove Service Key from Client

1. Remove `SUPABASE_SERVICE_ROLE_KEY` from client code
2. Update all service calls to use `anon` key + user JWT
3. Ensure all RLS policies are properly configured

### Phase 3: Rotate the Compromised Key

1. Generate new service_role key in Supabase dashboard
2. Update any legitimate server-side services
3. Old key is now invalidated

## Acceptance Criteria

- [ ] No `service_role` key in any client-side code
- [ ] All privileged operations go through Edge Functions
- [ ] Edge Functions validate caller identity before acting
- [ ] App functions correctly with only `anon` key
- [ ] Old service_role key has been rotated

## Dependencies

- BACKLOG-532 (RLS Enabled on All Tables) - should be done first to ensure RLS is active

## Estimated Effort

~80K tokens (Edge Functions + client refactoring + testing)

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
