# BACKLOG-468: Show Agent Name in Broker Portal Submissions

## Summary

Broker portal needs to display the agent's name in the submissions list (dashboard and recent submissions) so brokers can see who submitted each transaction.

## Category

Broker Portal / UX

## Priority

P2 - Medium

## Description

### Current State

The broker portal shows submissions but doesn't display which agent submitted them. Brokers managing multiple agents need to see at a glance who submitted each transaction.

### Expected

**Dashboard - Recent Submissions:**
```
Recent Submissions
- 123 Main St | Submitted by John Smith | 2 hours ago
- 456 Oak Ave | Submitted by Jane Doe | Yesterday
```

**All Submissions View:**
| Property | Agent | Status | Submitted |
|----------|-------|--------|-----------|
| 123 Main St | John Smith | Under Review | Jan 24 |
| 456 Oak Ave | Jane Doe | Approved | Jan 23 |

## Acceptance Criteria

- [ ] Agent name shown in dashboard recent submissions list
- [ ] Agent name column in full submissions table
- [ ] Name from `users.raw_user_meta_data.name` or email fallback
- [ ] Sortable/filterable by agent name

## Technical Notes

- Agent info available via `submissions.user_id` -> `auth.users`
- Use `raw_user_meta_data->>'name'` for display name
- Fallback to email if name not set

## Files to Modify

- `broker-portal/app/dashboard/page.tsx` - Recent submissions widget
- `broker-portal/app/submissions/page.tsx` - Submissions list table
- `broker-portal/lib/submissions.ts` - Include agent info in queries

## Dependencies

- Broker portal foundation (SPRINT-050) must be complete

## Estimated Effort

~15K tokens
