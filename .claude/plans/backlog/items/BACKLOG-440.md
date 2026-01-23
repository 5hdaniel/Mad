# BACKLOG-440: Sync Communications Button Needs Visual Feedback

## Summary

When clicking "Sync Communications", there is no visual feedback indicating:
- That sync started
- What is being synced
- When it completed
- What was found/updated

Users have no way to know if the action worked.

## Category

Bug / UX

## Priority

P1 - High (Users can't tell if action worked)

## Description

### Problem

After clicking "Sync Communications":
- Button click has no visible response
- No loading spinner
- No progress indicator
- No success/completion message
- No summary of what was synced
- User doesn't know if it worked

### Expected Behavior

1. **Immediate feedback**: Button shows loading state (spinner)
2. **During sync**: Optional progress or status text
3. **On completion**: Toast/notification with summary:
   ```
   ✓ Sync Complete
   - 2 contacts updated
   - 5 new emails found
   - 0 new texts found
   ```
4. **On error**: Clear error message with retry option

### UI Mockup

**During sync:**
```
[🔄 Syncing...]  (button disabled with spinner)
```

**On complete:**
```
┌─────────────────────────────────────┐
│ ✓ Sync Complete                     │
│   • 1 contact updated (Madison)     │
│   • 3 new emails imported           │
│   • 0 new texts                     │
└─────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Button shows loading state during sync
- [ ] Button disabled while sync in progress
- [ ] Completion toast shows summary of changes
- [ ] Summary includes: contacts updated, emails found, texts found
- [ ] Error state shown if sync fails
- [ ] Works for both quick syncs and longer operations

## Estimated Effort

~10K tokens

## Dependencies

- BACKLOG-434: Progress bar infrastructure (related)

## Related Items

- BACKLOG-434: Progress bar for background tasks
- BACKLOG-438: Sync all contact emails
- BACKLOG-439: Button naming
