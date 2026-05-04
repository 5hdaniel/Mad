-- Migration: Create token_claims table for SOC 2 claim-code infrastructure
-- Task: BACKLOG-1602
--
-- Replaces insecure token passing via URLs with a claim-code pattern:
-- 1. Broker portal creates a short-lived claim via create_token_claim() RPC
-- 2. Desktop app claims the token via the claim-tokens edge function
-- 3. Expired/unclaimed rows are cleaned up every 5 minutes by pg_cron

-- ---------------------------------------------------------------------------
-- Table: token_claims
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS token_claims (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  provider    TEXT,  -- 'azure' or 'google'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 seconds')
);

-- Index for user lookups (claim validation queries)
CREATE INDEX idx_token_claims_user_expires
  ON token_claims (user_id, expires_at);

-- Index for cleanup cron (expired row deletion)
CREATE INDEX idx_token_claims_expires
  ON token_claims (expires_at);

-- ---------------------------------------------------------------------------
-- RLS: Only owning user can SELECT unclaimed, non-expired claims
-- ---------------------------------------------------------------------------

ALTER TABLE token_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own unclaimed non-expired claims"
  ON token_claims
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND claimed_at IS NULL
    AND expires_at > now()
  );

-- No INSERT/UPDATE/DELETE policies for regular users.
-- Inserts are done via create_token_claim() SECURITY DEFINER function (service role).
-- Updates/deletes are done via the claim-tokens edge function (service role).

-- ---------------------------------------------------------------------------
-- RPC: create_token_claim (called by broker portal via service role)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_token_claim(
  p_user_id  UUID,
  p_payload  JSONB,
  p_provider TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id UUID;
BEGIN
  INSERT INTO token_claims (user_id, payload, provider)
  VALUES (p_user_id, p_payload, p_provider)
  RETURNING id INTO v_claim_id;

  RETURN v_claim_id;
END;
$$;

-- Grant execute to service_role (broker portal uses service role key)
GRANT EXECUTE ON FUNCTION create_token_claim(UUID, JSONB, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Cleanup Cron: Delete expired unclaimed claims every 5 minutes
-- ---------------------------------------------------------------------------

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule cleanup job
SELECT cron.schedule(
  'cleanup-expired-token-claims',
  '*/5 * * * *',
  $$DELETE FROM public.token_claims WHERE expires_at < now() AND claimed_at IS NULL$$
);
