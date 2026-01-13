# BACKLOG-220: Unlink Communications UI Not Refreshing

## Type
Bug / UI

## Priority
High

## Description
When attempting to remove/unlink a communication (email or iMessage) from a transaction, the UI does not update. The backend operation appears to succeed (visible in console logs), but the communication remains visible in the UI until page refresh.

## Symptoms
- Click to unlink/remove a message from transaction
- Nothing visually changes
- Backend logs show successful operation
- Manual page refresh shows the communication is removed

## Likely Cause
- State not being invalidated after unlink operation
- Missing refetch or optimistic update
- Callback not propagating to parent component

## Reproduction Steps
1. Open a transaction with linked communications
2. Click to remove/unlink a communication
3. Observe no UI change
4. Check console - backend shows success
5. Refresh page - communication is now gone

## Acceptance Criteria
- [ ] Unlinking communication immediately removes it from UI
- [ ] No page refresh required
- [ ] Works for both emails and iMessages

## Related
- TASK-1037 (Auto-Link) - Found during verification testing
- SPRINT-034

## Created
2025-01-12
