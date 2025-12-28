# Task TASK-704: Attach/Unlink Messages Modal

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Implement the ability to attach new message threads to a transaction and unlink existing message threads. This includes a modal for searching/browsing unlinked message threads and action buttons for unlinking.

## Non-Goals

- Do NOT modify the message thread display UI (done in TASK-703)
- Do NOT change database schema
- Do NOT add message editing
- Do NOT implement message deletion (only unlink from transaction)

## Deliverables

1. Create `AttachMessagesModal.tsx` for browsing and attaching unlinked messages
2. Add unlink button to `MessageThreadCard.tsx`
3. Create IPC handlers for linking/unlinking messages if needed
4. Add confirmation dialog for unlink action

## Dependencies

- **Requires:** TASK-702 (Tab Infrastructure) - must be merged
- **Requires:** TASK-703 (Thread Display) - must be merged

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx` | Modal for finding and attaching messages |
| `src/components/transactionDetailsModule/components/modals/UnlinkMessageModal.tsx` | Confirmation dialog for unlink |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Add unlink button |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Add "Attach Messages" button, handle modals |
| `src/components/transactionDetailsModule/components/modals/index.ts` | Export new modals |

## Acceptance Criteria

- [ ] "Attach Messages" button visible in Messages tab header
- [ ] Modal shows unlinked message threads (not attached to any transaction)
- [ ] Can search/filter message threads by contact name or phone
- [ ] Can select multiple threads to attach
- [ ] Unlink button appears on each thread card
- [ ] Confirmation required before unlinking
- [ ] Success/error feedback via toast notifications
- [ ] Message list refreshes after attach/unlink
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### IPC for Message Linking - CRITICAL

**IMPORTANT:** These IPC handlers DO NOT EXIST and MUST be created as part of this task.

**Required New Endpoints:**
```typescript
// Get unlinked messages for a user
window.api.transactions.getUnlinkedMessages(userId: string): Promise<Communication[]>

// Link message(s) to transaction
window.api.transactions.linkMessages(
  messageIds: string[],
  transactionId: string
): Promise<void>

// Unlink message from transaction (sets transaction_id to null)
window.api.transactions.unlinkMessages(messageIds: string[]): Promise<void>
```

**Implementation Locations (REQUIRED):**

1. **Extend `transactionBridge.ts`** (recommended approach):
   - Add `linkMessages`, `unlinkMessages`, `getUnlinkedMessages` methods
   - Follow existing patterns in this file

2. **Update `preload.ts`**:
   - Expose new methods in `window.api.transactions`

3. **Add Database Queries**:
   - `getUnlinkedMessages`: SELECT from communications WHERE transaction_id IS NULL AND channel IN ('sms', 'imessage')
   - `linkMessages`: UPDATE communications SET transaction_id = ? WHERE id IN (?)
   - `unlinkMessages`: UPDATE communications SET transaction_id = NULL WHERE id IN (?)

**This is a CRITICAL change** - the engineer MUST create these IPC handlers. This is not optional.

### AttachMessagesModal Component

```tsx
interface AttachMessagesModalProps {
  userId: string;
  transactionId: string;
  propertyAddress?: string;
  onClose: () => void;
  onAttached: () => void; // Refresh callback
}

export function AttachMessagesModal({
  userId,
  transactionId,
  propertyAddress,
  onClose,
  onAttached,
}: AttachMessagesModalProps) {
  const [threads, setThreads] = useState<Message[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);

  // Load unlinked messages
  useEffect(() => {
    async function load() {
      const unlinked = await window.api.messages.getUnlinked(userId);
      // Filter to SMS/iMessage only
      const texts = unlinked.filter(m =>
        m.channel === 'sms' || m.channel === 'imessage'
      );
      setThreads(groupAndFlatten(texts));
      setLoading(false);
    }
    load();
  }, [userId]);

  const handleAttach = async () => {
    setAttaching(true);
    try {
      await window.api.messages.linkToTransaction(selectedIds, transactionId);
      onAttached();
      onClose();
    } catch (err) {
      // Show error
    } finally {
      setAttaching(false);
    }
  };

  // ... render similar to ContactSelectModal pattern
}
```

### Unlink Button Pattern

Follow the pattern from email unlink in TransactionDetailsTab:

```tsx
// In MessageThreadCard.tsx
<button
  onClick={() => onShowUnlinkConfirm(threadId)}
  className="text-red-600 hover:bg-red-50 rounded p-1 transition-all"
  title="Remove from transaction"
>
  <svg className="w-4 h-4" ...>
    {/* X or unlink icon */}
  </svg>
</button>
```

### Confirmation Modal (Reuse Pattern)

```tsx
// UnlinkMessageModal.tsx - similar to UnlinkEmailModal
interface UnlinkMessageModalProps {
  threadId: string;
  phoneNumber: string;
  messageCount: number;
  isUnlinking: boolean;
  onCancel: () => void;
  onUnlink: () => void;
}

export function UnlinkMessageModal({
  threadId,
  phoneNumber,
  messageCount,
  isUnlinking,
  onCancel,
  onUnlink,
}: UnlinkMessageModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h3 className="font-semibold text-lg mb-2">
          Remove messages from transaction?
        </h3>
        <p className="text-gray-600 mb-4">
          This will remove {messageCount} message(s) from {phoneNumber} from
          this transaction. The messages will not be deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isUnlinking}>
            Cancel
          </button>
          <button
            onClick={onUnlink}
            disabled={isUnlinking}
            className="bg-red-600 text-white"
          >
            {isUnlinking ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Do / Don't

### Do:

- Follow existing modal patterns (ContactSelectModal, UnlinkEmailModal)
- Reuse existing styling and UI components
- Provide clear feedback for all actions
- Handle loading and error states
- Group unlinked messages by thread for cleaner selection

### Don't:

- Don't delete messages (only unlink from transaction)
- Don't modify the thread display component beyond adding button
- Don't change the database schema
- Don't add complex search (simple filter is enough)

## When to Stop and Ask

- If IPC endpoints for linking/unlinking don't exist and creation is complex
- If message data doesn't include necessary fields for grouping
- If unlink action affects emails (should only affect messages)
- If performance issues with large message lists

## Integration Notes

- **Depends on:** TASK-702, TASK-703 (must be merged first)
- **Imports from:** Types, existing modal patterns
- **Exports to:** TransactionMessagesTab
- **Creates:** New IPC handlers if needed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `AttachMessagesModal.test.tsx` - modal behavior
  - `UnlinkMessageModal.test.tsx` - confirmation dialog
  - Thread selection/deselection logic
- Existing tests to update:
  - MessageThreadCard tests (add unlink button)

### Coverage

- Coverage impact: Should improve (new functionality)

### Integration / Feature Tests

- Required scenarios:
  - Open attach modal -> select threads -> attach -> verify linked
  - Click unlink -> confirm -> verify unlinked
  - Cancel operations work correctly

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(transaction): add attach/unlink messages functionality`
- **Labels**: `enhancement`, `transaction-details`, `sms`
- **Depends on**: TASK-702, TASK-703 merged

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 10-14
- **Tokens:** ~55K-75K
- **Time:** ~2-3h

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 2 modals | +2-3 |
| Files to modify | 3 UI files | +1-2 |
| IPC handlers | MUST create 3 new handlers | +3-4 |
| Bridge/preload updates | Required for new IPC | +2-3 |
| Code volume | ~350-450 lines | +2-3 |
| Test complexity | Medium-High (IPC + UI) | +2-3 |

**Confidence:** Medium (IPC handler creation is required, not optional)

**Risk factors:**
- IPC endpoint may not exist, requiring backend work
- Thread selection UX may need iteration

**Similar past tasks:** Modal implementations typically 5-8 turns

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] AttachMessagesModal.tsx
- [ ] UnlinkMessageModal.tsx

Files modified:
- [ ] MessageThreadCard.tsx
- [ ] TransactionMessagesTab.tsx
- [ ] modals/index.ts

IPC handlers (if created):
- [ ] getUnlinked
- [ ] linkToTransaction
- [ ] unlinkFromTransaction

Features implemented:
- [ ] Attach modal with search
- [ ] Multi-select for attachment
- [ ] Unlink button
- [ ] Confirmation dialog

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document IPC approach and any UI decisions>

**Issues encountered:**
<Document any challenges>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 2 | X | +/- X | <reason> |
| Files to modify | 3 | X | +/- X | <reason> |
| IPC handlers | 0-2 | X | +/- X | <reason> |
| Code volume | ~250-300 lines | ~X lines | +/- X | <reason> |
| Test complexity | Medium | Low/Med/High | - | <reason> |

**Total Variance:** Est 6-8 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review Notes (Pre-Implementation)

**Reviewed:** 2025-12-28
**Reviewer:** SR Engineer

### CRITICAL Technical Corrections

1. **IPC Handlers DO NOT EXIST:**
   - `window.api.messages.*` namespace does not exist
   - MUST create new handlers in `transactionBridge.ts`:
     - `linkMessages(messageIds: string[], transactionId: string)`
     - `unlinkMessages(messageIds: string[])`
     - `getUnlinkedMessages(userId: string)`
   - MUST expose in `preload.ts` under `window.api.transactions`

2. **Estimate Updated:**
   - Increased to 10-14 turns due to required IPC handler creation
   - This is backend + frontend work, not just UI

3. **Execution Recommendation:**
   - **Parallel Safe:** No - must wait for TASK-702 and TASK-703 to merge first
   - Sequence: TASK-702 -> TASK-703 -> TASK-704

4. **Dependencies:**
   - REQUIRES: TASK-702 (Messages Tab Infrastructure)
   - REQUIRES: TASK-703 (Message Thread Display)

5. **Scope Expansion:**
   - Original estimate underestimated IPC work
   - Engineer should plan for bridge/preload modifications

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
