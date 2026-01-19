# TASK-978: Manual Link Messages UI

**Sprint**: SPRINT-026 (deferred from SPRINT-025)
**Priority**: P1
**Estimate**: 5,000 tokens
**Status**: Ready
**Dependencies**: TASK-979, TASK-980

---

## Objective

Add UI in transaction view to manually link/unlink text messages to transactions.

## Context

SPRINT-025 delivered:
- TASK-975: Communications junction table (`messages` → `communications` → `transactions`)
- TASK-977: Auto-link texts from contacts assigned to transaction

This task adds the UI to manually manage these links.

## Scope

### Must Implement

1. **Messages Tab Enhancement** (`TransactionMessagesTab.tsx`)
   - Show all messages linked to transaction
   - Add "Link Message" button
   - Add "Unlink" action per message

2. **Contact Message Search Modal** (new component)
   - Search contacts assigned to transaction
   - Show text threads from selected contact
   - Checkbox to select messages to link

3. **Backend Handlers** (if needed)
   - `transactions:link-message` - manually link a message
   - `transactions:unlink-message` - remove link

### Out of Scope

- Linking emails (handled by existing flow)
- Bulk link/unlink
- Message preview in modal

## Files to Modify

| File | Action |
|------|--------|
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Add link/unlink UI |
| `src/components/ContactMessageSearchModal.tsx` | Create |
| `electron/transaction-handlers.ts` | Add link/unlink handlers |
| `electron/preload/transactionBridge.ts` | Add bridge methods |

## Acceptance Criteria

- [ ] "Link Message" button in Messages tab
- [ ] Modal shows contacts and their text threads
- [ ] Can select and link messages to transaction
- [ ] Can unlink messages from transaction
- [ ] Changes persist to database
- [ ] UI updates after link/unlink

## UI Mockup

```
Transaction Details > Messages Tab
┌─────────────────────────────────────────────┐
│ Messages (5)                    [Link Message] │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ From: John Smith                   [⋮]  │ │
│ │ "Meeting at 3pm for inspection"         │ │
│ │ Jan 5, 2026 2:30 PM              Unlink │ │
│ └─────────────────────────────────────────┘ │
│ ...                                         │
└─────────────────────────────────────────────┘
```

## Testing

1. **Manual test**: Link a text message to transaction
2. **Manual test**: Unlink a text message
3. **Unit tests**: Modal component renders correctly

## Branch

```
feature/TASK-978-manual-link-messages
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (record when Task tool returns) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |
