# TASK-985: Fix Messages Not Loading in Attach Modal

**Sprint**: SPRINT-026
**Priority**: Critical
**Estimate**: 20,000 tokens
**Status**: In Progress
**Dependencies**: None
**Backlog**: BACKLOG-170

---

## Objective

Fix the "Attach Messages" modal showing no messages when it should display unlinked message threads.

## Context

User reports:
- Opens transaction details for "571 Dale Dr, Incline Village, NV 89451, USA"
- Goes to Messages tab
- Clicks "Attach Messages" button
- Modal shows "No unlinked messages available"
- Expected: Should show message threads that can be linked

## Investigation Plan

1. Check `AttachMessagesModal.tsx` to understand how it fetches messages
2. Trace the API call to find the IPC handler
3. Check the database query for unlinked messages
4. Verify messages exist in the database
5. Identify why they're not being returned

## Scope

### Must Fix

1. Identify root cause of empty message list
2. Fix the query/logic so messages appear
3. Verify messages can be attached after fix

### Out of Scope

- Message import from iPhone (separate feature)
- UI redesign of the modal

## Acceptance Criteria

- [ ] Unlinked messages appear in attach modal
- [ ] Messages can be searched
- [ ] Messages can be selected and attached
- [ ] Attached messages show in Messages tab

## Branch

```
fix/TASK-985-messages-not-loading
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (record when Task tool returns) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |
