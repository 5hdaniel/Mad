# Task TASK-1971: Supabase Monitoring (DB Size, Connections, Query Latency)

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Create a Supabase Edge Function `system-health` that returns database size, active connection count, and slow queries. This provides operational visibility as user count grows.

## Non-Goals

- Do NOT add alerting or PagerDuty integration
- Do NOT add a dashboard UI in the app
- Do NOT add performance monitoring (this is operational health only)
- Do NOT expose this to non-admin users

## Deliverables

1. New: Supabase Edge Function `system-health` — deployed via Supabase MCP

## Acceptance Criteria

- [ ] Edge Function `system-health` deployed and accessible
- [ ] Returns JSON with: `db_size_bytes`, `active_connections`, `slow_queries`
- [ ] JWT-verified (only authenticated users can call)
- [ ] Admin-only (check user role or use service_role key)
- [ ] Returns sensible data when queried via curl
- [ ] All CI checks pass (no local code changes)

## Implementation Notes

### Edge Function

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // Verify JWT (handled by Supabase if verify_jwt is true)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Database size
  const { data: sizeData } = await supabase.rpc('pg_database_size_current');
  // OR use raw SQL via supabase-js

  const dbSize = await supabase
    .from('_analytics') // placeholder - use RPC
    .select();

  // Active connections
  const { data: connData } = await supabase.rpc('get_active_connections');

  // Slow queries (active queries running > 5 seconds)
  const { data: slowData } = await supabase.rpc('get_slow_queries');

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    db_size_bytes: sizeData,
    active_connections: connData,
    slow_queries: slowData,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Required RPC Functions (or raw SQL)

Create these as Supabase RPC functions or execute raw SQL:

```sql
-- Database size
SELECT pg_database_size(current_database()) as size_bytes;

-- Active connections
SELECT count(*) as count FROM pg_stat_activity;

-- Slow queries (active > 5 seconds)
SELECT pid, query, state, query_start,
       now() - query_start as duration
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < now() - interval '5 seconds'
ORDER BY query_start ASC;
```

### Auth: Admin-Only

The function should verify the calling user is an admin. Options:
1. Use `verify_jwt: true` + check user role in the function
2. Accept only service_role key calls (simplest for now)

### Deployment

Deploy via Supabase MCP `deploy_edge_function` tool. No local files needed.

## Integration Notes

- Independent of all other 080C tasks
- No local code changes — entirely Supabase-side
- May need Supabase migration for RPC functions (use `apply_migration`)

## Do / Don't

### Do:
- Use service_role key for pg_stat queries (requires elevated access)
- Include a timestamp in the response
- Format database size in human-readable form as well as bytes

### Don't:
- Do NOT expose query text from slow queries (may contain sensitive data — truncate)
- Do NOT allow non-admin access
- Do NOT cache results (health data should always be fresh)

## When to Stop and Ask

- If Supabase Edge Functions can't execute `pg_stat_activity` queries
- If the service_role key doesn't have access to system catalog views
- If RPC function creation requires specific database permissions

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (Edge Function, tested via curl)
- Verify via: `curl -H "Authorization: Bearer <token>" <function-url>`

### CI Requirements
- No local code changes — CI not affected

## PR Preparation

- **Title:** `feat(monitoring): add Supabase system-health Edge Function`
- **Labels:** `feature`, `monitoring`, `supabase`
- **Depends on:** None

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~25K
**Token Cap:** 100K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Edge Function deployed:
- [ ] system-health function deployed to Supabase

RPC/SQL:
- [ ] Database size query works
- [ ] Active connections query works
- [ ] Slow queries query works

Features implemented:
- [ ] JWT-verified endpoint
- [ ] Admin-only access
- [ ] JSON response with timestamp, db_size, connections, slow_queries

Verification:
- [ ] curl test returns valid JSON
- [ ] Unauthorized requests get 401
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
