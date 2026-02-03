# BACKLOG-612: Sync complete notification shows success even when sync fails

**Category:** bug
**Priority:** critical
**Status:** pending
**Created:** 2026-02-03

## Problem

The OS notification shows "Magic Audit is ready to use. Your data has been synced." even when sync operations failed. This misleads users into thinking everything worked when it didn't.

## Observed Behavior

1. User completes onboarding (or returns to dashboard)
2. Sync starts for contacts, messages, emails
3. Sync fails with errors (e.g., "No valid user found in database")
4. OS notification appears: "Magic Audit is ready to use. Your data has been synced."
5. User thinks everything is fine, but no data was actually synced

## Expected Behavior

When any sync operation fails:
- Show error notification: "Sync failed. Some data could not be imported."
- OR show partial success: "Sync completed with errors. X of Y items synced."
- Include actionable info if possible: "Check Settings for details"

## Console Errors (Actual)

```
[SyncOrchestrator] contacts sync failed: Error: No valid user found in database
[SyncOrchestrator] messages sync failed: Error: No valid user found in database
```

But notification still shows success message.

## Root Cause

The notification logic likely triggers when sync "completes" without checking if it completed successfully. The SyncOrchestrator tracks success/failure state, but the notification sender doesn't use it.

## Location

Need to find where the "ready to use" notification is triggered. Likely in:
- SyncOrchestratorService (completion handler)
- useAutoRefresh (sync completion callback)
- OS notification service

## Proposed Fix

```typescript
// In sync completion handler:
if (syncResult.hasErrors) {
  showNotification({
    title: "Sync Failed",
    body: "Some data could not be imported. Check the app for details.",
  });
} else {
  showNotification({
    title: "Magic Audit is ready to use",
    body: "Your data has been synced.",
  });
}
```

## Notification States

| Scenario | Notification |
|----------|--------------|
| All syncs succeed | "Magic Audit is ready to use. Your data has been synced." |
| Some syncs fail | "Sync completed with errors. Some data could not be imported." |
| All syncs fail | "Sync failed. Please check your connection and try again." |
| User not in DB | "Setup incomplete. Please complete onboarding." |

## Acceptance Criteria

- [ ] Failed sync shows error notification, not success
- [ ] Partial failure shows appropriate message
- [ ] Full success still shows current success message
- [ ] Notification text is clear and actionable

## Related

- BACKLOG-611: New users skip keychain setup (causes the sync failures)
- SyncOrchestratorService error handling
- OS notification integration
