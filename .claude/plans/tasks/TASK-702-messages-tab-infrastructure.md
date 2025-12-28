# Task TASK-702: Add Messages Tab Infrastructure

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

Add the basic tab infrastructure for a "Messages" tab in the TransactionDetails component. This task sets up the tab UI, data fetching hook, and empty state - without the full message display (that comes in TASK-703).

## Non-Goals

- Do NOT implement full message thread display (TASK-703)
- Do NOT implement attach/unlink modal (TASK-704)
- Do NOT modify email display in Details tab
- Do NOT add new database queries beyond basic fetch

## Deliverables

1. Add "Messages" tab to `TransactionTabs` component
2. Create `TransactionMessagesTab` component with empty state
3. Create `useTransactionMessages` hook for data fetching
4. Update types as needed

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Messages tab container |
| `src/components/transactionDetailsModule/hooks/useTransactionMessages.ts` | Data fetching hook |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/TransactionTabs.tsx` | Add "Messages" tab |
| `src/components/TransactionDetails.tsx` | Render Messages tab content |
| `src/components/transactionDetailsModule/types.ts` | Add message-related types |
| `src/components/transactionDetailsModule/hooks/index.ts` | Export new hook |
| `src/components/transactionDetailsModule/components/index.ts` | Export new component |

## Acceptance Criteria

- [ ] "Messages" tab appears alongside "Details" and "Contacts" tabs
- [ ] Clicking "Messages" tab switches to messages view
- [ ] Empty state shows when no messages linked to transaction
- [ ] Messages count badge on tab (like contacts have)
- [ ] Hook fetches messages from IPC
- [ ] Loading state while fetching
- [ ] Types properly defined
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Tab Structure Reference

Current tab implementation in `TransactionTabs.tsx`:

```typescript
const tabs = [
  { id: 'details', label: 'Details', icon: DetailsIcon },
  { id: 'contacts', label: 'Contacts', icon: ContactsIcon, count: contactCount },
];
```

Add:
```typescript
{ id: 'messages', label: 'Messages', icon: MessageIcon, count: messageCount }
```

### Message Query (IPC)

Check if `window.api.messages.getByTransaction(transactionId)` exists. If not, the hook should use:

```typescript
// May need to use communications endpoint and filter by channel
const messages = await window.api.communications.getByTransaction(transactionId);
const textMessages = messages.filter(m =>
  m.channel === 'sms' || m.channel === 'imessage'
);
```

### Hook Pattern (Follow Existing)

```typescript
// Follow pattern from useTransactionDetails.ts
export function useTransactionMessages(transaction: Transaction) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch messages linked to this transaction
      const result = await window.api.communications.getByTransaction(transaction.id);
      const textMessages = result.filter(m =>
        m.channel === 'sms' || m.channel === 'imessage'
      );
      setMessages(textMessages);
    } catch (err) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return { messages, loading, error, refresh: loadMessages };
}
```

### Empty State UI

```tsx
// Consistent with other empty states in the app
<div className="text-center py-12">
  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" ...>
    {/* Message icon */}
  </svg>
  <p className="text-gray-600 mb-2">No text messages linked</p>
  <p className="text-sm text-gray-500">
    Messages will appear here once linked to this transaction
  </p>
</div>
```

## Do / Don't

### Do:

- Follow existing component patterns in transactionDetailsModule
- Use consistent styling with other tabs
- Handle loading and error states
- Export from barrel files

### Don't:

- Don't implement full message rendering (TASK-703)
- Don't add attach/unlink buttons yet (TASK-704)
- Don't modify the Details or Contacts tabs
- Don't create new IPC handlers unless absolutely necessary

## When to Stop and Ask

- If the messages IPC endpoint doesn't exist or returns unexpected format
- If the tab count badge approach differs significantly from contacts
- If the hook pattern requires significant deviation from existing

## Integration Notes

- **Depends on:** None
- **Blocks:** TASK-703 (Message Thread Display), TASK-704 (Attach/Unlink Modal)
- **Imports from:** Existing transactionDetailsModule components and hooks
- **Exports to:** TransactionDetails.tsx

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `useTransactionMessages.test.ts` - hook behavior
  - `TransactionMessagesTab.test.tsx` - component rendering
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: Should improve (new functionality)

### Integration / Feature Tests

- Required scenarios:
  - Tab navigation works correctly
  - Empty state renders when no messages
  - Loading state shows while fetching

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(transaction): add messages tab infrastructure`
- **Labels**: `enhancement`, `transaction-details`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 4-6
- **Tokens:** ~25K-35K
- **Time:** ~45-75m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 2 new files | +2 |
| Files to modify | 5 files (scope: small changes) | +1-2 |
| Code volume | ~150-200 lines | +1-2 |
| Test complexity | Low (following patterns) | +1 |

**Confidence:** High (well-defined scope, clear patterns to follow)

**Risk factors:**
- IPC endpoint may need verification
- Tab component may have unexpected complexity

**Similar past tasks:** Component extraction tasks in SPRINT-008 averaged 3-5 turns

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
- [ ] TransactionMessagesTab.tsx
- [ ] useTransactionMessages.ts

Files modified:
- [ ] TransactionTabs.tsx
- [ ] TransactionDetails.tsx
- [ ] types.ts
- [ ] hooks/index.ts
- [ ] components/index.ts

Features implemented:
- [ ] Messages tab in tab bar
- [ ] Empty state
- [ ] Loading state
- [ ] Message count badge

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
<Document any design decisions>

**Issues encountered:**
<Document any challenges>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 2 | X | +/- X | <reason> |
| Files to modify | 5 | X | +/- X | <reason> |
| Code volume | ~150-200 lines | ~X lines | +/- X | <reason> |
| Test complexity | Low | Low/Med/High | - | <reason> |

**Total Variance:** Est 4-6 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

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
