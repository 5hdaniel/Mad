-- Atomic increment of scim_tokens request_count and last_used_at
-- Used by the SCIM Edge Function to avoid read-then-write race conditions
CREATE OR REPLACE FUNCTION public.increment_scim_token_usage(p_token_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE scim_tokens
  SET last_used_at = NOW(),
      request_count = request_count + 1
  WHERE id = p_token_id;
$$;
