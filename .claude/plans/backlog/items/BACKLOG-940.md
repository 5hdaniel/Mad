# BACKLOG-940: Apply Support Platform Migration RPCs to Supabase

## Parent

BACKLOG-938 (Support Platform — Core Ticketing)

## Problem

Two new Supabase RPCs were created as migration files during the BACKLOG-938 session on 2026-03-13, but they have not been applied to the Supabase database yet. The analytics page and delete ticket feature depend on these RPCs being live.

## Migration Files

1. `supabase/migrations/20260313_support_analytics_rpc.sql` — Creates `support_agent_analytics(p_period_days)` RPC for the analytics page agent performance table.
2. `supabase/migrations/20260313_support_delete_ticket_rpc.sql` — Creates `support_delete_ticket` RPC with `support.admin` permission check for the delete ticket feature.

## Steps

1. Review both migration SQL files for correctness
2. Apply migrations via Supabase MCP or dashboard
3. Verify RPCs are callable from the admin portal
4. Test analytics page loads agent data correctly
5. Test delete ticket flow works end-to-end

## Acceptance Criteria

- [ ] `support_agent_analytics` RPC is live and returns correct data
- [ ] `support_delete_ticket` RPC is live and enforces `support.admin` permission
- [ ] Analytics page displays agent performance metrics
- [ ] Delete ticket confirmation modal successfully deletes and redirects

## Estimation

~10K tokens (migration review + application + smoke test)

## Dependencies

- BACKLOG-938 branch `feature/BACKLOG-938-support-platform-phase1` must be merged first (or migrations applied independently)
