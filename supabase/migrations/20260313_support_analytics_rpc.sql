-- Support Analytics RPC
-- Aggregates per-agent metrics from existing support_tickets data.
-- Returns both a summary object and a per-agent breakdown.

CREATE OR REPLACE FUNCTION support_agent_analytics(
  p_period_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_summary JSONB;
  v_agents JSONB;
  v_result JSONB;
BEGIN
  -- Verify caller is an authenticated admin user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_period_start := NOW() - (p_period_days || ' days')::INTERVAL;

  -- Build summary
  SELECT jsonb_build_object(
    'total_open', COALESCE(SUM(CASE WHEN t.status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END), 0),
    'closed_in_period', COALESCE(SUM(CASE WHEN t.status IN ('resolved', 'closed') AND t.resolved_at >= v_period_start THEN 1 ELSE 0 END), 0),
    'avg_first_response_minutes', ROUND(
      AVG(
        CASE WHEN t.first_response_at IS NOT NULL AND t.created_at >= v_period_start
        THEN EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60.0
        ELSE NULL END
      )::NUMERIC, 1
    ),
    'avg_resolution_minutes', ROUND(
      AVG(
        CASE WHEN t.resolved_at IS NOT NULL AND t.created_at >= v_period_start
        THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60.0
        ELSE NULL END
      )::NUMERIC, 1
    )
  ) INTO v_summary
  FROM support_tickets t;

  -- Build per-agent breakdown
  SELECT COALESCE(jsonb_agg(agent_row ORDER BY agent_row->>'agent_name'), '[]'::JSONB)
  INTO v_agents
  FROM (
    SELECT jsonb_build_object(
      'agent_id', au.id,
      'agent_email', au.email,
      'agent_name', COALESCE(aiu.display_name, au.email),
      'open_tickets', COALESCE(SUM(CASE WHEN t.status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END), 0),
      'closed_tickets', COALESCE(SUM(CASE WHEN t.status IN ('resolved', 'closed') AND t.resolved_at >= v_period_start THEN 1 ELSE 0 END), 0),
      'avg_first_response_minutes', ROUND(
        AVG(
          CASE WHEN t.first_response_at IS NOT NULL AND t.created_at >= v_period_start
          THEN EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60.0
          ELSE NULL END
        )::NUMERIC, 1
      ),
      'avg_resolution_minutes', ROUND(
        AVG(
          CASE WHEN t.resolved_at IS NOT NULL AND t.created_at >= v_period_start
          THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60.0
          ELSE NULL END
        )::NUMERIC, 1
      )
    ) AS agent_row
    FROM auth.users au
    INNER JOIN admin_internal_users aiu ON aiu.user_id = au.id
    LEFT JOIN support_tickets t ON t.assignee_id = au.id
    WHERE aiu.is_active = true
    GROUP BY au.id, au.email, aiu.display_name
  ) sub;

  v_result := jsonb_build_object(
    'summary', v_summary,
    'agents', v_agents
  );

  RETURN v_result;
END;
$$;
