# BACKLOG-501: Message Tab Counter Not Updating on Remove

## Priority: Medium
## Category: Bug
## Estimate: ~5K tokens

## Problem

When removing an email or message from a transaction's details tab, the counter displayed on the tab name does not update to reflect the new count.

### Steps to Reproduce
1. Open a transaction's details
2. Go to the Messages/Communications tab
3. Note the count shown on the tab (e.g., "Messages (5)")
4. Remove a message from the transaction
5. **Bug:** The tab still shows "Messages (5)" instead of "Messages (4)"

### Expected Behavior
The tab counter should immediately update when a message is removed.

## Solution

The component displaying the tab needs to:
1. Re-fetch the message count after removal, OR
2. Listen to state changes that affect the count, OR
3. Derive the count from the same data source that the list uses

## Files to Investigate

- `src/components/transactionDetailsModule/` - Transaction details tabs
- `src/components/TransactionDetails.tsx` - Main transaction details component
- Look for where tab counts are calculated vs where removal happens

## Acceptance Criteria

- [ ] Removing a message updates the tab counter immediately
- [ ] Counter stays in sync with actual message count
- [ ] No need to refresh or navigate away to see correct count

## Created
2026-01-26
