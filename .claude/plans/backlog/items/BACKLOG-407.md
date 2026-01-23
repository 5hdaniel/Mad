# BACKLOG-407: Show Agent Name on Transaction Card

**Priority:** P2 (Medium)
**Category:** ui / transactions
**Created:** 2026-01-22
**Status:** Pending
**Estimated Tokens:** ~8K

---

## Summary

Display the agent name (buyer agent or seller agent) on the transaction card in the main transaction list view.

---

## Problem Statement

Currently, transaction cards show property address, status, and communication counts, but don't display which agent is associated with the transaction. Users need to click into the transaction details to see agent information.

Showing the agent name on the card would:
1. Help users quickly identify transactions by agent
2. Improve scanning/filtering of the transaction list
3. Provide context without requiring extra clicks

---

## Proposed Solution

Add agent name display to `TransactionCard.tsx`:

1. **Determine which agent to show:**
   - If user is the buyer agent → show seller agent name
   - If user is the seller agent → show buyer agent name
   - Or simply show the "primary" agent based on transaction type

2. **Display location:** Below property address or in the metadata row

3. **Fallback:** Show "No agent assigned" or hide if no agent linked

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transaction/components/TransactionCard.tsx` | Add agent name display |
| `electron/services/db/transactionDbService.ts` | May need to include agent name in query |

---

## Acceptance Criteria

- [ ] Agent name visible on transaction card
- [ ] Graceful handling when no agent assigned
- [ ] Name truncates properly for long names
- [ ] Consistent styling with existing card metadata

---

## Technical Notes

The transaction already has `buyer_agent_id` and `seller_agent_id` fields. The `getTransactionWithContacts()` function returns the full agent contact info. May need to ensure the list query also fetches agent names efficiently.

---

## Related Items

- Transaction card component
- Contact management system
