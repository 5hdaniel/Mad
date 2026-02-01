# BACKLOG-578: Fix Supabase RLS Infinite Recursion in organization_members

## Summary
Fix Row Level Security policy on `organization_members` table that causes infinite recursion.

## Error
```
[Supabase] Failed to get org membership: infinite recursion detected in policy for relation "organization_members"
```

## Root Cause
An RLS policy on `organization_members` is referencing the same table it's protecting, creating an infinite loop when Supabase tries to evaluate the policy.

## Example of Bad Policy
```sql
-- This causes recursion - querying organization_members to protect organization_members
CREATE POLICY "Users can view org members" ON organization_members
FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  )
);
```

## Solution Options

### Option 1: Use a Security Definer Function
```sql
-- Create a function that bypasses RLS
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM organization_members WHERE user_id = auth.uid();
$$;

-- Use the function in the policy
CREATE POLICY "Users can view org members" ON organization_members
FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
```

### Option 2: Reference a Different Table
```sql
-- Check against a different table that doesn't have this policy
CREATE POLICY "Users can view org members" ON organization_members
FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
  )
);
```

## Steps to Fix
1. Go to Supabase Dashboard → Database → Policies
2. Find `organization_members` table
3. Review existing policies for self-referencing queries
4. Update policy using one of the solutions above
5. Test org membership queries

## Priority
High - causes warning on every org membership check

## Status
Pending
