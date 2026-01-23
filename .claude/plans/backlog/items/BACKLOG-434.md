# BACKLOG-434: Universal Progress Bar Component for Background Tasks

## Summary

Create a reusable progress bar/feedback component that can be used across the platform for any background operation: text import, sync communications, contact sync, data loading, etc. Currently there is no visual feedback for background tasks.

## Category

UX / Feedback

## Priority

P1 - High (Users don't know import is happening)

## Description

### Problem

Multiple background operations have no visual feedback:
1. **Text message import** - After DB reset or new user setup
2. **Sync Communications** - No indication it's running or complete
3. **Contact sync** - No feedback on updates
4. **Data loading** - Large datasets load with no progress

Users don't know:
- That an operation is happening
- Progress (count, percentage)
- How long it will take
- When it's complete
- If it succeeded or failed

This leads to confusion - users may think the app is broken, click buttons multiple times, or try to use features before data is ready.

### Proposed Solution

#### 1. Universal Progress Component
- Create a **reusable** progress component for ALL background tasks
- Single component, multiple use cases:
  - Text import
  - Sync Communications
  - Contact sync
  - Data export
  - Any future background operation
- Show in a non-intrusive location (e.g., bottom status bar, toast area)
- Display:
  - Task name ("Importing text messages...", "Syncing communications...")
  - Progress percentage or count (e.g., "1,234 / 5,678 messages")
  - Estimated time remaining (optional)

#### 2. Background Task Reporting
- Backend services emit progress events via IPC
- Track: total items, processed items, current status
- Emit updates at reasonable intervals (not every item)

#### 3. Completion Notification
- Show completion toast/notification
- Summary: "Imported 5,678 messages from 23 conversations"
- Auto-dismiss after a few seconds

#### 4. Error Handling
- Show errors clearly if import fails
- Allow retry option
- Don't silently fail

### UI Mockup

```
┌─────────────────────────────────────────────────────┐
│  Importing text messages...                         │
│  ████████████████░░░░░░░░░░░░░░  2,345 / 5,678     │
│                                          ~2 min     │
└─────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Universal progress component created and documented
- [ ] Works for text import, sync, contact sync, export, etc.
- [ ] Shows current count / total count
- [ ] Updates in real-time as operation progresses
- [ ] Shows completion notification with summary
- [ ] Shows error state if operation fails
- [ ] Does not freeze UI (relates to BACKLOG-433)
- [ ] Easy for devs to integrate into new features
- [ ] Works after database deletion
- [ ] Works during new user onboarding

## Estimated Effort

~15K tokens

## Dependencies

- BACKLOG-433: UI freezing must be fixed for progress bar to animate smoothly

## Related Items

- BACKLOG-433: Prevent UI Freezing
- Message import service
- Background task infrastructure
