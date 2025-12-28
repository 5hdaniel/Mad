# Task TASK-703: Message Thread Display Component

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

Implement the message thread display component that shows text messages in conversation-style format within the Messages tab. Messages should be grouped by conversation thread and displayed in a chat-like UI.

## Non-Goals

- Do NOT implement attach/unlink modal (TASK-704)
- Do NOT modify email display components
- Do NOT add new database schema
- Do NOT implement message search

## Deliverables

1. Create `MessageThreadCard.tsx` component for individual conversation threads
2. Create `MessageBubble.tsx` component for individual messages
3. Update `TransactionMessagesTab.tsx` to render message threads
4. Handle empty states and loading within thread display

## Dependencies

- **Requires:** TASK-702 (Messages Tab Infrastructure) - must be merged first

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Thread container with header |
| `src/components/transactionDetailsModule/components/MessageBubble.tsx` | Individual message display |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Integrate thread display |
| `src/components/transactionDetailsModule/components/index.ts` | Export new components |

## Acceptance Criteria

- [ ] Messages grouped by thread_id (conversation)
- [ ] Each thread shows contact/phone number header
- [ ] Messages display in chronological order within thread
- [ ] Inbound vs outbound messages visually distinguished (left/right alignment)
- [ ] Message timestamps shown
- [ ] Conversation-style chat bubble UI
- [ ] Scrollable when many messages
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Message Data Structure

From the database schema, messages have:
```typescript
interface Message {
  id: string;
  channel: 'email' | 'sms' | 'imessage';
  direction: 'inbound' | 'outbound';
  subject?: string;      // null for SMS
  body_text: string;     // Plain text content
  participants: string;  // JSON: {"from": "...", "to": [...]}
  thread_id?: string;    // Conversation grouping
  sent_at: string;
  received_at?: string;
  transaction_id?: string;
}
```

### Grouping by Thread

```typescript
// Group messages by thread_id
function groupByThread(messages: Message[]): Map<string, Message[]> {
  const threads = new Map<string, Message[]>();
  messages.forEach(msg => {
    const threadId = msg.thread_id || msg.id; // Use message ID if no thread
    const thread = threads.get(threadId) || [];
    thread.push(msg);
    threads.set(threadId, thread);
  });
  // Sort messages within each thread by date
  threads.forEach((msgs, key) => {
    threads.set(key, msgs.sort((a, b) =>
      new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ));
  });
  return threads;
}
```

### MessageThreadCard Component

```tsx
interface MessageThreadCardProps {
  threadId: string;
  messages: Message[];
  contactName?: string;
  phoneNumber: string;
}

export function MessageThreadCard({
  threadId,
  messages,
  contactName,
  phoneNumber,
}: MessageThreadCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden">
      {/* Thread Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
          {contactName?.charAt(0) || '#'}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">
            {contactName || phoneNumber}
          </h4>
          {contactName && (
            <p className="text-sm text-gray-500">{phoneNumber}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
}
```

### MessageBubble Component

```tsx
interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-gray-200 text-gray-900 rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.body_text}</p>
        <p
          className={`text-xs mt-1 ${
            isOutbound ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formatMessageTime(message.sent_at)}
        </p>
      </div>
    </div>
  );
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
```

### Integration with TransactionMessagesTab

```tsx
// In TransactionMessagesTab.tsx
export function TransactionMessagesTab({
  messages,
  loading,
}: TransactionMessagesTabProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (messages.length === 0) {
    return <EmptyState />;
  }

  const threads = groupByThread(messages);

  return (
    <div className="space-y-4">
      {Array.from(threads.entries()).map(([threadId, threadMessages]) => (
        <MessageThreadCard
          key={threadId}
          threadId={threadId}
          messages={threadMessages}
          phoneNumber={extractPhoneFromThread(threadMessages)}
          // contactName could be looked up from contact service
        />
      ))}
    </div>
  );
}
```

## Do / Don't

### Do:

- Follow existing component patterns in transactionDetailsModule
- Use consistent color scheme (green for SMS, matching app theme)
- Handle long messages with proper wrapping
- Sort threads by most recent message
- Use accessible contrast ratios for text

### Don't:

- Don't add unlink/attach buttons (TASK-704)
- Don't fetch messages in this component (already done in parent)
- Don't add modal functionality
- Don't modify the useTransactionMessages hook

## When to Stop and Ask

- If message data structure differs significantly from expected
- If thread grouping logic is unclear
- If contact name lookup requires new IPC calls
- If the UI pattern doesn't match app design language

## Integration Notes

- **Depends on:** TASK-702 (must be merged first)
- **Blocks:** TASK-704 (Attach/Unlink Modal)
- **Imports from:** Types from transactionDetailsModule
- **Exports to:** TransactionMessagesTab

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `MessageThreadCard.test.tsx` - renders thread correctly
  - `MessageBubble.test.tsx` - renders inbound/outbound correctly
  - Thread grouping utility function tests
- Existing tests to update:
  - TransactionMessagesTab.test.tsx (integrate thread display)

### Coverage

- Coverage impact: Should improve (new UI tested)

### Integration / Feature Tests

- Required scenarios:
  - Multiple threads render correctly
  - Single thread with many messages
  - Mixed inbound/outbound messages

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(transaction): add message thread display component`
- **Labels**: `enhancement`, `transaction-details`, `sms`
- **Depends on**: TASK-702 merged

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 6-8
- **Tokens:** ~35K-45K
- **Time:** ~1-1.5h

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 2 new components | +2-3 |
| Files to modify | 2 files (scope: medium) | +1-2 |
| Code volume | ~200-250 lines | +2 |
| Test complexity | Medium (UI rendering) | +1-2 |

**Confidence:** High (clear UI pattern, follows existing designs)

**Risk factors:**
- Thread grouping may have edge cases
- Contact name lookup may need additional work

**Similar past tasks:** UI component tasks typically 4-6 turns

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
- [ ] MessageThreadCard.tsx
- [ ] MessageBubble.tsx

Files modified:
- [ ] TransactionMessagesTab.tsx
- [ ] components/index.ts

Features implemented:
- [ ] Thread grouping
- [ ] Chat bubble UI
- [ ] Inbound/outbound styling
- [ ] Timestamps

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
| Files to modify | 2 | X | +/- X | <reason> |
| Code volume | ~200-250 lines | ~X lines | +/- X | <reason> |
| Test complexity | Medium | Low/Med/High | - | <reason> |

**Total Variance:** Est 6-8 turns -> Actual X turns (X% over/under)

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
