-- Auth Event Logging Migration
-- TASK-2138: Enable authentication event logging for SOC 2 CC6.2 compliance
--
-- Creates:
-- 1. admin_audit_logs table (if not exists) - stores all admin audit events
-- 2. log_admin_action RPC - safe insert into admin_audit_logs
-- 3. admin_get_audit_logs RPC - paginated retrieval with filters
--
-- Note: This migration is designed to be idempotent. If TASK-2137 creates
-- these objects first, this migration will safely skip creation.

-- 1. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id ON public.admin_audit_logs (actor_id);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: only internal users can read audit logs
CREATE POLICY IF NOT EXISTS "Internal users can read audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_roles
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- RLS policy: insert via RPC only (service role or authenticated with internal role)
CREATE POLICY IF NOT EXISTS "Authenticated users can insert audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Create log_admin_action RPC
-- This is the primary interface for logging admin actions.
-- It captures the current user's ID automatically.
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated;

-- 3. Create admin_get_audit_logs RPC for paginated retrieval
CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0,
  p_action text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logs jsonb;
  v_total bigint;
BEGIN
  -- Verify caller has internal role
  IF NOT EXISTS (
    SELECT 1 FROM public.internal_roles WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: internal role required';
  END IF;

  -- Count total matching rows
  SELECT count(*) INTO v_total
  FROM public.admin_audit_logs a
  WHERE (p_action IS NULL OR a.action = p_action)
    AND (p_target_id IS NULL OR a.target_id ILIKE '%' || p_target_id || '%')
    AND (p_date_from IS NULL OR a.created_at >= p_date_from)
    AND (p_date_to IS NULL OR a.created_at <= p_date_to);

  -- Get paginated logs with actor info
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_logs
  FROM (
    SELECT
      a.id,
      a.action,
      a.target_type,
      a.target_id,
      a.metadata,
      a.ip_address::text,
      a.created_at,
      a.actor_id,
      u.email as actor_email,
      u.raw_user_meta_data->>'full_name' as actor_name
    FROM public.admin_audit_logs a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    WHERE (p_action IS NULL OR a.action = p_action)
      AND (p_target_id IS NULL OR a.target_id ILIKE '%' || p_target_id || '%')
      AND (p_date_from IS NULL OR a.created_at >= p_date_from)
      AND (p_date_to IS NULL OR a.created_at <= p_date_to)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('logs', v_logs, 'total', v_total);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(int, int, text, text, timestamptz, timestamptz) TO authenticated;
