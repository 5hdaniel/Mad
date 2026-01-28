# BACKLOG-460: Dashboard Notifications for Status Changes

**Created**: 2026-01-23
**Status**: Ready
**Priority**: P1 (High)
**Category**: Feature / Notifications
**Sprint**: -
**Estimate**: ~25K tokens

---

## Problem

When a broker reviews a transaction (approves, rejects, or requests changes), the agent only sees the status change when they manually open the transaction details. There's no proactive notification to alert the agent.

## User Story

**As a** real estate agent (Team license user)
**I want** to be notified when my broker takes action on my submission
**So that** I can respond promptly to review feedback

## Current Behavior

1. Agent submits transaction
2. Broker reviews and clicks "Request Changes"
3. Agent opens app later
4. Agent must manually check each transaction to see if status changed
5. Agent may miss time-sensitive feedback

## Expected Behavior

1. Agent submits transaction
2. Broker reviews and clicks "Request Changes"
3. Agent opens app later
4. Dashboard shows notification: "1 transaction needs attention"
5. Clicking notification navigates to the transaction
6. Status badge shows "Changes Requested" with notes visible

## Implementation

### Dashboard Notification Badge

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [!] 2 transactions need attention                 │ │
│  │     - 123 Main St: Changes Requested              │ │
│  │     - 456 Oak Ave: Rejected                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Recent Transactions                                    │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Status Change Detection

1. On app load (and periodic refresh), check `submission_status` changes
2. Track "last seen" status per transaction
3. If status changed since last seen -> show notification
4. Dismiss notification when user views transaction

### Notification Types

| Status Change | Notification | Priority |
|---------------|--------------|----------|
| `submitted` -> `under_review` | "Being reviewed" | Low (info only) |
| `*` -> `changes_requested` | "Needs attention" | High |
| `*` -> `rejected` | "Rejected" | High |
| `*` -> `approved` | "Approved!" | Medium (success) |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Dashboard/Dashboard.tsx` | Add notification banner |
| `src/components/Dashboard/StatusNotificationBanner.tsx` | **NEW** - notification component |
| `src/hooks/useStatusNotifications.ts` | **NEW** - detect status changes |
| `electron/services/transactionService.ts` | Add `getStatusChanges()` method |
| `src/contexts/NotificationContext.tsx` | May extend existing context |

## Acceptance Criteria

- [ ] Dashboard shows notification banner when status changes detected
- [ ] Notification shows transaction address and new status
- [ ] Clicking notification navigates to transaction detail
- [ ] Notification dismissed after viewing transaction
- [ ] "Changes Requested" and "Rejected" shown with high priority styling
- [ ] "Approved" shown with success styling
- [ ] TypeScript compiles
- [ ] Tests pass

## Dependencies

- BACKLOG-395: Desktop - Status Sync (provides status data)
- BACKLOG-289: Unified Notification System (completed - can use existing components)

## Related

- BACKLOG-400: Portal - Review Actions (triggers the status changes)
