# BACKLOG-405: Fix RLS Policies and Auth Triggers

**Priority:** P1 (Pre-Production)
**Category:** security / auth
**Created:** 2026-01-22
**Status:** Backlog
**Sprint:** TBD

---

## Summary

Re-enable RLS and fix auth triggers that were disabled during initial deployment debugging.

---

## Current State (Demo)

To get the broker portal working, we disabled:

1. **RLS on `profiles`** - `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`
2. **RLS on `organization_members`** - `ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;`
3. **Triggers on `auth.users`**:
   - `on_auth_user_created` → `handle_new_user_profile()`
   - `on_auth_user_created_link_invitations` → `handle_new_user_invitation_link()`

---

## Problems Identified

### 1. Self-referential RLS Policy on organization_members

The policy requires user to be a member to see members:
```sql
CREATE POLICY "members_can_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

**Problem**: Works for seeing OTHER members, but creates chicken-and-egg for seeing OWN membership during auth callback.

**Fix**: Add policy allowing users to see their own row:
```sql
CREATE POLICY "users_can_read_own_membership" ON organization_members
  FOR SELECT USING (user_id = auth.uid());
```

### 2. Trigger Execution Context

The `handle_new_user_profile()` trigger runs `SECURITY DEFINER` but may still hit RLS issues or constraint problems.

**Investigation needed**: Check what exactly fails when trigger runs.

---

## Fix Plan

### Step 1: Fix organization_members RLS

```sql
-- Re-enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Add policy for users to read their own membership
CREATE POLICY "users_can_read_own_membership" ON organization_members
  FOR SELECT USING (user_id = auth.uid());
```

### Step 2: Fix profiles RLS

```sql
-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure trigger can insert (SECURITY DEFINER should handle this)
-- May need to grant INSERT to the function owner
```

### Step 3: Recreate Triggers

```sql
-- Recreate profile trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();

-- Recreate invitation link trigger
CREATE TRIGGER on_auth_user_created_link_invitations
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_invitation_link();
```

### Step 4: Test New User Signup

1. Create new test user via OAuth
2. Verify profile created automatically
3. Verify user can see their org membership
4. Verify auth callback works

---

## Acceptance Criteria

- [ ] RLS re-enabled on profiles
- [ ] RLS re-enabled on organization_members
- [ ] Auth triggers recreated and working
- [ ] New user signup creates profile automatically
- [ ] Existing user login works
- [ ] Users can only see their own data (verify RLS)

---

## Related Items

- SPRINT-050: B2B Broker Portal
- BACKLOG-388: RLS Policies + Storage Bucket

