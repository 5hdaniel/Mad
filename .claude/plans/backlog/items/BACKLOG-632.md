# BACKLOG-632: Agent-Broker Review Assignment

**Status:** Pending
**Priority:** Medium
**Category:** feature
**Effort:** ~80K tokens
**Created:** 2026-02-06

## Overview

Auto-route submissions to assigned brokers for review. Agents can have a direct broker assignment, or inherit one through their group. When `enforce_broker_assignment` is enabled (BACKLOG-630), submissions must have an assigned reviewer. Admins always bypass assignment restrictions.

## Business Value

- Ensures submissions go to the correct reviewer automatically
- Reduces manual assignment overhead for large orgs
- Supports team-based workflows (group routing)
- Admin override ensures nothing gets stuck

## Requirements

### Database Changes

1. **Add `assigned_broker_id`** to `org_members` table
   - UUID FK → org_members (nullable)
   - Direct broker assignment for an agent

2. **Add `assigned_to`** to `submissions` table
   - UUID FK → org_members (nullable)
   - The broker assigned to review this submission

3. **DB Trigger: `auto_assign_broker`**
   - On INSERT to submissions:
     a. Check agent's `assigned_broker_id` on org_members → use if set
     b. Else check agent's groups for `assigned_broker_id` → use first match
     c. Else leave NULL (unassigned)
   - Trigger runs as SECURITY DEFINER to read across tables

4. **RLS Policy Updates**
   - When `enforce_broker_assignment` is enabled (from org settings):
     - Brokers can only see submissions assigned to them
     - Admins bypass — can see all submissions
   - When disabled: existing behavior (brokers see all org submissions)

### UI Changes

5. **Agent Profile / User Management**
   - Add "Assigned Broker" dropdown on agent's profile/edit page
   - Show current assignment in user table

6. **Submissions Table**
   - Add "Assigned To" column showing broker name
   - Filter by assigned broker

7. **Settings Integration**
   - `enforce_broker_assignment` toggle from BACKLOG-630
   - When enabled, show info banner explaining assignment enforcement

### Server Actions

8. `assignBrokerToAgent(memberId, brokerId)` — admin only
9. `reassignSubmission(submissionId, brokerId)` — admin only manual override

## Acceptance Criteria

- [ ] `assigned_broker_id` column on org_members
- [ ] `assigned_to` column on submissions
- [ ] DB trigger auto-assigns broker on submission create
- [ ] Assignment priority: direct > group > null
- [ ] RLS enforces assignment visibility when `enforce_broker_assignment` enabled
- [ ] Admins always see all submissions regardless of setting
- [ ] UI shows assigned broker in user management
- [ ] UI shows assigned reviewer in submissions table
- [ ] Manual reassignment available to admins

## Technical Considerations

- Trigger must handle edge cases: broker deleted, broker role changed, multiple group matches
- When broker is removed from org, clear their assignments (CASCADE or trigger)
- Performance: trigger should be efficient — single query with COALESCE pattern
- Migration must be backwards-compatible (all new columns nullable)

## Dependencies

- **BACKLOG-630** — `enforce_broker_assignment` toggle in org settings
- **BACKLOG-631** — `user_groups` table for group-based routing

## References

- Existing `org_members` and submissions tables
- Existing RLS patterns on submissions
- Organization settings from BACKLOG-630
