-- Pending internal invitations table
-- When an admin invites a user who doesn't exist in public.users yet,
-- we store the invitation here. On first SSO login, the auth callback
-- processes pending invitations and assigns the internal role.

CREATE TABLE IF NOT EXISTS pending_internal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE pending_internal_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_users_can_manage_invitations"
  ON pending_internal_invitations
  FOR ALL
  USING (has_internal_role(auth.uid()))
  WITH CHECK (has_internal_role(auth.uid()));

CREATE POLICY "service_role_full_access_invitations"
  ON pending_internal_invitations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
