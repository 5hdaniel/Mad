# BACKLOG-634: Agent Portal / Dashboard

**Status:** Pending
**Priority:** Medium
**Category:** feature
**Effort:** ~80K tokens
**Created:** 2026-02-06

## Overview

Web-based dashboard for agent users to view their submitted transactions and statuses. Agents currently use the desktop app to submit transactions, but need a way to check status and view their submissions from any browser.

## Requirements

1. Agent-specific dashboard at `/agent` or `/agent/dashboard`
2. List of agent's submitted transactions with status (pending, approved, rejected, etc.)
3. View individual transaction details (read-only)
4. Filter/search by status, date range
5. Auth: agents sign in with same OAuth flow, redirected to agent dashboard instead of broker portal

## Acceptance Criteria

- [ ] Agent can sign in and see their dashboard
- [ ] Transaction list shows all agent's submissions
- [ ] Status badges (pending, approved, rejected, etc.)
- [ ] Click to view transaction details (read-only)
- [ ] Proper RLS: agents only see their own submissions
- [ ] Callback route redirects agents to agent dashboard instead of /download

## Technical Considerations

- Reuse existing submission/transaction types and Supabase queries
- RLS already enforces per-user access on submissions
- May need new RLS policies for agent-specific views
- Should share auth flow with broker portal but have separate layout
- Once built, update callback route to redirect agents here instead of /download

## Dependencies

- Current invite claim flow must be working (BACKLOG fix in progress)

## References

- Existing submissions table and RLS
- Broker portal dashboard patterns
- Current `/download` redirect for agents (placeholder until this is built)
