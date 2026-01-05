# BACKLOG-156: Auto-Refresh Data Sources on App Load

## Summary

Automatically sync all available data sources when the user opens the application, eliminating the need to manually click "Auto Detect". This provides a seamless experience where users see their latest emails, texts, and contacts immediately.

## Priority

**High** - Significant UX improvement, reduces friction for daily use

## Category

**service/enhancement**

## Problem

Currently, users must manually trigger sync/detection after opening the app. This adds unnecessary friction, especially for users who check the app daily. The data sources that don't require device connection should refresh automatically.

## Solution

On app startup (after authentication and database initialization), automatically trigger sync for all available data sources based on platform:

### Platform Matrix

| Data Source | Windows | macOS | Method |
|-------------|---------|-------|--------|
| Gmail | Yes | Yes | API - fetch new emails since last sync |
| Outlook | Yes | Yes | API - fetch new emails since last sync |
| Text Messages | No | Yes | Local iMessage database |
| Contacts | No | Yes | Local Contacts database |
| iPhone Backup | No | No | Requires manual trigger (device must be connected) |

### Behavior

1. **Trigger point**: After successful authentication AND database initialization
2. **Parallel execution**: Sync all available sources concurrently
3. **Background operation**: Don't block UI - show subtle progress indicator
4. **AI Detection**: After sync completes, run AI transaction detection on new items
5. **Error handling**: Silent failures for individual sources (log but don't alert user)
6. **Incremental**: Only fetch new data since last sync (use existing incremental sync from BACKLOG-090)

### UI Considerations

- Show subtle sync indicator in dashboard/header during refresh
- Don't show modal or blocking UI
- Show toast notification when new transactions are detected
- Allow user to disable in Settings (optional - discuss with user)

## Acceptance Criteria

- [ ] Email sync triggers automatically on app load (Gmail + Outlook)
- [ ] Text message sync triggers automatically on macOS
- [ ] Contact sync triggers automatically on macOS
- [ ] AI auto-detection runs after sync completes
- [ ] User sees their latest data without clicking any buttons
- [ ] Sync uses incremental approach (only new data)
- [ ] UI remains responsive during background sync
- [ ] Errors are logged but don't interrupt user

## Technical Notes

- Leverage existing sync services (emailSyncService, contactsService, etc.)
- Use existing incremental sync infrastructure from SPRINT-014 (BACKLOG-090)
- Coordinate with state machine - trigger after `authenticated` + `databaseReady` states
- Consider adding a brief delay (2-3 seconds) after UI renders to avoid startup slowdown

## Dependencies

- BACKLOG-090 (Incremental Sync) - **Completed**
- BACKLOG-142 (State Coordination) - **Completed**

## Related Items

- BACKLOG-024: Auto-Start Sync on Launch (similar scope - consider merging or marking duplicate)

## Estimate

- **Est. Tokens**: ~40K
- **Category Adjustment**: service × 0.50 = ~20K implementation
- **SR Review Overhead**: +15-25K
- **Total Estimate**: ~35-45K tokens

## Status

**Pending** - Ready for sprint assignment
