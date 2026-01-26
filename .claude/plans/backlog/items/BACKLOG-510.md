# BACKLOG-510: Gmail Sync Freezes UI During Background Message Loading

## Type
bug

## Priority
high

## Status
backlog

## Description

When connecting Gmail for the first time, the application freezes/becomes unresponsive while messages are being loaded in the background. The UI should remain responsive during sync operations.

### Steps to Reproduce
1. Delete database for fresh start
2. Connect Gmail account
3. Gmail connects successfully
4. Messages start loading in background
5. **UI becomes frozen/unresponsive**

### Expected Behavior
- UI remains responsive during message sync
- Loading indicator shows sync progress
- User can navigate the app while sync happens in background
- Sync operations don't block the main thread

### Actual Behavior
- UI freezes completely
- Cannot interact with the application
- Must wait for sync to complete (or kill the app)

### Technical Investigation Needed
- Is the sync happening on the main Electron thread?
- Are database writes blocking the UI?
- Is there a batch size issue (too many messages at once)?
- Should sync use web workers or move to a background process?

### Potential Solutions
1. **Move sync to background process** - Use Electron's background/utility process
2. **Batch processing with yields** - Process messages in smaller batches with `setTimeout` breaks
3. **Database write optimization** - Use transactions and batch inserts
4. **Progress UI** - Show non-blocking progress indicator
5. **Defer full sync** - Initial sync gets recent messages only, full sync happens later

## Acceptance Criteria
- [ ] UI remains responsive during Gmail sync
- [ ] User can see sync progress
- [ ] User can cancel sync if needed
- [ ] No perceived freezing even with large mailboxes

## Related
- Gmail integration
- Message import services
- Database write performance
