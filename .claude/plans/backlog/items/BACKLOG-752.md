# BACKLOG-752: Messages Tab Doesn't Update Until Transaction Is Reopened

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Bug                    |
| **Area**    | UI                     |
| **Priority**| Critical               |
| **Status**  | In Progress            |
| **Created** | 2026-02-20             |
| **Sprint**  | SPRINT-089             |
| **Task**    | TASK-2023              |

## Description

When messages (emails or texts) are linked to a transaction, the Messages tab in Transaction Details does not show the newly linked messages until the user exits the transaction details view and reopens it. The data saves correctly to the database, but the UI component does not re-render to reflect the change.

## Expected Behavior

After linking a message to a transaction, the Messages tab should immediately display the newly linked message without requiring the user to close and reopen the transaction details.

## Actual Behavior

The Messages tab continues to show its previous state after linking a message. Only closing the transaction details panel and reopening it causes the tab to display the updated message list.

## Investigation Areas

- **TransactionMessagesTab.tsx** -- Check if the component subscribes to changes in linked messages or only fetches on mount
- **TransactionDetails.tsx** -- Check if the parent component passes updated data to the Messages tab
- **transactionDetailsModule/** -- Review the entire module for state management patterns
- **How the Emails tab handles refresh** -- The Emails tab may already have a working pattern for reactivity that can be replicated
- State management: Is the linked-messages list stored in local state, context, or fetched via query? Does linking trigger a re-fetch or state update?

## Acceptance Criteria

- [ ] After linking a message to a transaction, the Messages tab updates immediately without requiring navigation away and back
- [ ] After unlinking a message, the Messages tab updates immediately
- [ ] No regression in Emails tab or other Transaction Details tabs
- [ ] Pattern is consistent with how other tabs handle data refresh

## Related Items

- TASK-2023: Sprint task for this fix
