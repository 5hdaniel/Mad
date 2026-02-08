-- TASK-1925 Prerequisite: Fix default_member_role from 'member' to 'agent'
-- 'member' is not a valid role in organization_members (which only allows: agent, broker, admin, it_admin)
-- If JIT join uses the default, the INSERT into organization_members would fail

-- Step 1: Change the default from 'member' to 'agent'
ALTER TABLE public.organizations
  ALTER COLUMN default_member_role SET DEFAULT 'agent';

-- Step 2: Update any existing rows with the invalid default
UPDATE public.organizations
  SET default_member_role = 'agent'
  WHERE default_member_role = 'member';

-- Step 3: Update the CHECK constraint to remove 'member' as a valid value
-- Drop old constraint and add new one without 'member'
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_default_member_role_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_default_member_role_check
  CHECK (default_member_role IN ('agent', 'broker', 'admin'));
