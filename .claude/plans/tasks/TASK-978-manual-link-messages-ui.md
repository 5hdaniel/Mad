# TASK-978: Manual Link Messages UI

**Sprint**: SPRINT-025-communications-architecture
**Priority**: P2
**Estimate**: 5,000 tokens
**Status**: Not Started
**Depends on**: TASK-975, TASK-977

---

## Objective

Add UI in the transaction view allowing users to:
1. Browse all messages from contacts linked to the transaction
2. Manually link/unlink specific messages
3. Search for and link messages from other contacts

---

## UI Design

### Location: Transaction Details Panel

Add a new section/tab: "Manage Communications"

```
┌─────────────────────────────────────────────────────────────┐
│ Transaction: 123 Main Street                                │
├─────────────────────────────────────────────────────────────┤
│ [Overview] [Documents] [Contacts] [Communications]          │
│                                           ^^^^^^^^^^        │
├─────────────────────────────────────────────────────────────┤
│ Linked Communications (24)          [+ Add Messages]        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✓ RE: Inspection Report          john@email.com         │ │
│ │   Jan 15, 2024 10:30 AM                    [Unlink]     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ✓ Can we schedule inspection?    +1-555-123-4567        │ │
│ │   Jan 14, 2024 2:15 PM                     [Unlink]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Show Unlinked Messages from Transaction Contacts]          │
└─────────────────────────────────────────────────────────────┘
```

### Add Messages Modal

```
┌───────────────────────────────────────────────────────────────┐
│ Add Messages to Transaction                           [X]    │
├───────────────────────────────────────────────────────────────┤
│ Search: [_________________________] [Search]                  │
│                                                               │
│ Filter: [All] [Emails] [Texts] [From Contacts Only]          │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ □ RE: Offer Details              seller@email.com         │ │
│ │   Jan 10, 2024                   Auto-detected: 85%       │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ □ "Perfect, see you Thursday"    +1-555-123-4567          │ │
│ │   Jan 14, 2024                   Contact: John Smith      │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ ☑ Inspection confirmed           inspector@home.com       │ │
│ │   Jan 15, 2024                   Already linked ✓         │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│                              [Cancel]  [Link Selected (2)]   │
└───────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: New Components

1. **ManageMessagesPanel.tsx**: Main section in transaction details
2. **AddMessagesModal.tsx**: Modal for searching/linking
3. **MessageListItem.tsx**: Individual message row with link/unlink

```typescript
interface ManageMessagesPanelProps {
  transactionId: string;
  onRefresh: () => void;
}

interface AddMessagesModalProps {
  transactionId: string;
  isOpen: boolean;
  onClose: () => void;
  onMessagesLinked: (count: number) => void;
}
```

### Phase 2: IPC Handlers

Add to `communication-handlers.ts`:

```typescript
// Get linked messages for transaction
ipcMain.handle('communications:get-linked', async (event, transactionId) => {
  return await getLinkedMessages(transactionId);
});

// Get unlinked messages from transaction contacts
ipcMain.handle('communications:get-unlinked-from-contacts', async (event, transactionId) => {
  return await getUnlinkedMessagesFromContacts(transactionId);
});

// Search all messages
ipcMain.handle('communications:search', async (event, { userId, query, filters }) => {
  return await searchMessages(userId, query, filters);
});

// Link message to transaction
ipcMain.handle('communications:link', async (event, { messageId, transactionId }) => {
  return await linkMessageToTransaction(messageId, transactionId, 'manual');
});

// Unlink message from transaction
ipcMain.handle('communications:unlink', async (event, { messageId, transactionId }) => {
  return await unlinkMessageFromTransaction(messageId, transactionId);
});
```

### Phase 3: Database Service Functions

In `communicationDbService.ts`:

```typescript
// Get all linked messages with full content
async function getLinkedMessages(transactionId: string): Promise<MessageWithLink[]> {
  const sql = `
    SELECT m.*, c.link_source, c.linked_at
    FROM communications c
    JOIN messages m ON c.message_id = m.id
    WHERE c.transaction_id = ?
    ORDER BY m.sent_at DESC
  `;
  return dbAll(sql, [transactionId]);
}

// Get unlinked messages from contacts assigned to transaction
async function getUnlinkedMessagesFromContacts(transactionId: string): Promise<Message[]> {
  // 1. Get contact phones for this transaction
  // 2. Find messages matching those phones
  // 3. Exclude already linked messages
}

// Manual link with source = 'manual'
async function linkMessageToTransaction(
  messageId: string,
  transactionId: string,
  source: 'auto' | 'manual'
): Promise<void> {
  const sql = `
    INSERT OR IGNORE INTO communications (id, message_id, transaction_id, user_id, link_source)
    VALUES (?, ?, ?, ?, ?)
  `;
  dbRun(sql, [crypto.randomUUID(), messageId, transactionId, userId, source]);
}

// Unlink (delete reference)
async function unlinkMessageFromTransaction(
  messageId: string,
  transactionId: string
): Promise<void> {
  const sql = `DELETE FROM communications WHERE message_id = ? AND transaction_id = ?`;
  dbRun(sql, [messageId, transactionId]);
}
```

### Phase 4: Search Functionality

```typescript
interface MessageSearchFilters {
  channel?: 'email' | 'sms' | 'imessage' | 'all';
  fromContacts?: boolean;  // Only show messages from transaction contacts
  dateFrom?: string;
  dateTo?: string;
  excludeLinked?: boolean; // Hide already linked messages
}

async function searchMessages(
  userId: string,
  query: string,
  filters: MessageSearchFilters
): Promise<Message[]> {
  // Build dynamic query based on filters
  // Search subject, body_text, participants
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/ManageMessagesPanel.tsx` | Create | Main UI panel |
| `src/components/AddMessagesModal.tsx` | Create | Search/link modal |
| `src/components/MessageListItem.tsx` | Create | Message row component |
| `electron/communication-handlers.ts` | Modify | Add IPC handlers |
| `electron/services/db/communicationDbService.ts` | Modify | Add query functions |
| `src/components/TransactionDetails.tsx` | Modify | Add new tab/section |

---

## Acceptance Criteria

- [ ] Users can view all linked messages for a transaction
- [ ] Users can unlink messages with confirmation
- [ ] Users can search for messages to link
- [ ] Search supports filtering by type (email/text)
- [ ] Already-linked messages shown as disabled in search
- [ ] Link source tracked ('auto' vs 'manual')
- [ ] UI updates immediately after link/unlink
- [ ] Empty states handled gracefully

---

## Testing

1. **Component Tests**:
   - ManageMessagesPanel renders linked messages
   - AddMessagesModal search functionality
   - Link/unlink button actions

2. **Integration Tests**:
   - Full flow: open modal -> search -> link -> verify in list
   - Unlink flow with confirmation

---

## UI/UX Considerations

1. **Confirmation for unlink**: "Remove this message from the transaction? The message won't be deleted."
2. **Batch operations**: Allow multi-select for linking
3. **Visual distinction**: Different icons for emails vs texts
4. **Link source badge**: Show "Auto" or "Manual" tag
5. **Loading states**: Show spinner during search/link operations

---

## Dependencies

- **Requires**: TASK-975 (communications as reference table)
- **Requires**: TASK-977 (auto-link provides foundation)
- **Uses**: Existing modal patterns from ContactSelectModal

---

## Notes

This task provides the user interface layer on top of the auto-linking functionality from TASK-977. While TASK-977 handles automatic linking based on contacts, this task allows users to:
1. Override auto-link decisions (unlink irrelevant messages)
2. Manually link messages that weren't auto-detected
3. Review and manage all linked communications
