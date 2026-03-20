# Task TASK-2187: Unified Activity Timeline

**Status:** Completed
**Completed:** 2026-03-16
**PR:** #1158 (merged)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Replace the separated messages-in-thread + events-in-sidebar layout with a single unified chronological timeline. Messages, status changes, assignee changes, priority changes, ticket links, and participant additions all appear as entries in one stream, giving agents a complete picture of what happened and when.

## Non-Goals

- Do NOT modify `CreateTicketDialog.tsx` — that's TASK-2185's territory
- Do NOT modify or create `RelatedTicketsPanel.tsx` — that's TASK-2186
- Do NOT create or apply database migrations — TASK-2184 handles that
- Do NOT change the ReplyComposer component
- Do NOT modify the ticket queue (list) page
- Do NOT add real-time WebSocket subscriptions

## Deliverables

1. New component: `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx` — unified timeline rendering
2. Update: `admin-portal/app/dashboard/support/components/ConversationThread.tsx` — keep `TicketDescription` export, keep `MessageList` for potential reuse, but the `[id]/page.tsx` will use `ActivityTimeline` instead
3. Update: `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` — remove `EventsTimeline` import/usage
4. Update: `admin-portal/app/dashboard/support/[id]/page.tsx` — wire `ActivityTimeline`, pass events to it, move composer to bottom, remove events from sidebar props
5. Update: `admin-portal/lib/support-types.ts` — add `TimelineEntry` union type

## File Boundaries

> **Purpose:** Prevents semantic conflicts when tasks run in parallel.

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx` (new)
- `admin-portal/app/dashboard/support/components/ConversationThread.tsx`
- `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` — ONLY remove `EventsTimeline` import and usage. Do NOT modify status/priority/assignee/category/requester/participants/dates/details sections.
- `admin-portal/app/dashboard/support/[id]/page.tsx`
- `admin-portal/lib/support-types.ts` — ONLY add `TimelineEntry` type. Add it in a new section labeled `// --- Timeline types ---` AFTER any existing sections. Do NOT modify existing types.

### Files this task must NOT modify:

- `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx` — owned by TASK-2185
- `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx` — owned by TASK-2186
- `admin-portal/lib/support-queries.ts` — no query changes needed for this task
- Any files under `supabase/` — owned by TASK-2184

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] New `ActivityTimeline` component renders messages and events in a single chronological stream
- [ ] Sort order is oldest-first (chronological reading order)
- [ ] Messages render as cards (same styling as current `MessageList`)
- [ ] Internal notes retain amber/yellow styling with lock icon
- [ ] Events render as compact inline system cards (gray background strip, centered)
- [ ] Each event card shows: icon, description, actor name (if available), timestamp
- [ ] Status change events show: "Status: Old -> New"
- [ ] Priority change events show: "Priority: Old -> New"
- [ ] Assignment events show: "Assigned to [Name]"
- [ ] `message_added` events are excluded from timeline (message itself is already shown)
- [ ] `ticket_linked`/`ticket_unlinked` events render if present (graceful — no crash if absent)
- [ ] `participant_added`/`participant_removed` events render if present
- [ ] Attachment display on messages unaffected
- [ ] Reply composer positioned at the bottom of the timeline (below all entries)
- [ ] `EventsTimeline` removed from sidebar (sidebar still shows status/priority/assignee/category/requester/participants/dates/details)
- [ ] Ticket detail page layout (two-column grid) otherwise unchanged
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### 1. Type Addition (support-types.ts)

Add at the end of the file in a `// --- Timeline types ---` section:

```typescript
// --- Timeline types ---

export type TimelineEntry =
  | { type: 'message'; data: SupportTicketMessage; timestamp: string }
  | { type: 'event'; data: SupportTicketEvent; timestamp: string };
```

### 2. ActivityTimeline Component

Create `admin-portal/app/dashboard/support/components/ActivityTimeline.tsx`:

**Props:**
```typescript
interface ActivityTimelineProps {
  messages: SupportTicketMessage[];
  events: SupportTicketEvent[];
  attachments: SupportTicketAttachment[];
  showAttachments?: boolean;
}
```

**Core logic — merge and sort:**
```typescript
function buildTimeline(
  messages: SupportTicketMessage[],
  events: SupportTicketEvent[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...messages.map(m => ({
      type: 'message' as const,
      data: m,
      timestamp: m.created_at,
    })),
    ...events
      .filter(e => e.event_type !== 'message_added') // Skip — message itself shown
      .map(e => ({
        type: 'event' as const,
        data: e,
        timestamp: e.created_at,
      })),
  ];
  // Sort oldest first (chronological reading order)
  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
```

**Message rendering:** Reuse the existing message card rendering pattern from `ConversationThread.tsx` > `MessageList`. You can either:
- Import and use `MessageList` inline (but it reverses order — not ideal)
- Copy the message card JSX into a `MessageCard` sub-component within `ActivityTimeline`
- **Recommended:** Extract a `MessageCard` component from `ConversationThread.tsx` that renders a single message, then import it in both places

**Event rendering — EventInlineCard sub-component:**

```typescript
function EventInlineCard({ event }: { event: SupportTicketEvent }) {
  const icon = getEventIcon(event.event_type);
  const description = getEventDescription(event);

  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full text-xs text-gray-500">
        <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold ${icon.color}`}>
          {icon.symbol}
        </span>
        <span>{description}</span>
        {/* Actor name from metadata if available */}
        <span className="text-gray-400">·</span>
        <span className="text-gray-400">{formatEventTime(event.created_at)}</span>
      </div>
    </div>
  );
}
```

**Reuse from EventsTimeline.tsx:**
- The `getEventIcon()` and `getEventDescription()` functions from `EventsTimeline.tsx` are excellent. Copy them into `ActivityTimeline.tsx` (or extract to a shared util).
- Extend `getEventIcon` to handle new event types:
  - `ticket_linked` -> `{ symbol: '🔗', color: 'bg-gray-100 text-gray-600' }` (use link icon or text)
  - `ticket_unlinked` -> `{ symbol: '✕', color: 'bg-gray-100 text-gray-600' }`
  - `participant_added` -> `{ symbol: '+', color: 'bg-gray-100 text-gray-600' }`
  - `participant_removed` -> `{ symbol: '-', color: 'bg-gray-100 text-gray-600' }`
- Extend `getEventDescription` to handle new event types:
  - `ticket_linked` -> `"Linked to ${event.new_value}"`
  - `ticket_unlinked` -> `"Unlinked from ${event.old_value}"`
  - `participant_added` -> `"Added ${event.new_value}"`
  - `participant_removed` -> `"Removed ${event.old_value}"`

### 3. ConversationThread.tsx Changes

Keep `TicketDescription` export unchanged — it's used by `[id]/page.tsx` for the pinned description card.

Keep `MessageList` export — it may be useful for other contexts, and removing it could break things if anything else imports it.

If you extract a `MessageCard` sub-component for reuse in `ActivityTimeline`, export it from `ConversationThread.tsx`:
```typescript
export function MessageCard({ message, attachments, showAttachments, onPreview }: {...}) {
  // Single message rendering logic extracted from MessageList
}
```

### 4. TicketSidebar.tsx Changes

**Remove EventsTimeline:**
```diff
- import { EventsTimeline } from './EventsTimeline';

  // In the JSX, remove:
- {/* Events Timeline */}
- <EventsTimeline events={events} />
```

**Update the props interface** — `events` prop is no longer needed:
```diff
  interface TicketSidebarProps {
    ticket: SupportTicket;
    participants: SupportTicketParticipant[];
-   events: SupportTicketEvent[];
    onTicketUpdated: () => void;
  }
```

**Important:** If TASK-2186 has already merged, `RelatedTicketsPanel` will be between Participants and EventsTimeline. After removing EventsTimeline, the RelatedTicketsPanel remains (which is correct).

### 5. [id]/page.tsx Changes

**Layout change — move composer to bottom:**

Current order: Description -> Composer -> Messages (newest first)
New order: Description -> ActivityTimeline (oldest first) -> Composer

```tsx
{/* Left: Description → Timeline → Composer */}
<div className="lg:col-span-2 space-y-4">
  {/* 1. Original ticket description (pinned) */}
  <TicketDescription ... />

  {/* 2. Activity Timeline — messages + events, oldest first */}
  <ActivityTimeline
    messages={messages}
    events={events}
    attachments={attachments}
    showAttachments={showAttachments}
  />

  {/* 3. Reply Composer — at the bottom */}
  <ReplyComposer ... />

  <div ref={threadEndRef} />
</div>
```

**Sidebar change — remove events prop:**
```tsx
<TicketSidebar
  ticket={ticket}
  participants={participants}
- events={events}
  onTicketUpdated={loadDetail}
/>
```

**Scroll behavior:** After a new message is sent, scroll to the bottom (where the new message appears in chronological order). The existing `handleMessageSent` with `threadEndRef.current?.scrollIntoView` should still work.

### 6. EventsTimeline.tsx

Do NOT delete this file — just remove its usage from `TicketSidebar.tsx`. Keeping the file avoids any import errors from other potential consumers. It can be cleaned up in a future task.

## Integration Notes

- Imports from: `support-types.ts` (TimelineEntry, SupportTicketMessage, SupportTicketEvent, SupportTicketAttachment)
- Imports from: `ConversationThread.tsx` (TicketDescription — still used in `[id]/page.tsx`)
- May import from: `ConversationThread.tsx` (MessageCard if extracted, or InlineAttachments/AttachmentThumbnail)
- Used by: `[id]/page.tsx`
- Depends on: TASK-2184 (for new event types `ticket_linked`, `ticket_unlinked` — but graceful degradation if those events don't exist yet)

## Do / Don't

### Do:
- Use oldest-first sort order (chronological)
- Keep the pinned description card at the top (before the timeline)
- Keep the reply composer at the bottom (after the timeline)
- Make event inline cards visually distinct from message cards (smaller, muted, no border)
- Center event cards horizontally in the timeline
- Handle unknown event types gracefully (default case in switch)
- Preserve the existing internal note styling (amber/yellow)

### Don't:
- Don't delete `EventsTimeline.tsx` — just remove its usage
- Don't change the `ReplyComposer` component
- Don't change the ticket detail header (back button, ticket number, subject, status badge)
- Don't change the sidebar layout beyond removing EventsTimeline
- Don't add pagination to the timeline (all entries loaded at once)
- Don't change the `getTicketDetail` query — it already returns both messages and events

## When to Stop and Ask

- If `ConversationThread.tsx` has been significantly modified by another task
- If `TicketSidebar.tsx` props have changed (e.g., events prop already removed)
- If `[id]/page.tsx` has been modified to pass different data structures
- If the timeline exceeds 500 lines — consider splitting into sub-components

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes — test `buildTimeline()` sort logic
  - Test with empty messages/events
  - Test with only messages
  - Test with only events
  - Test with mixed entries (verify chronological order)
  - Test that `message_added` events are filtered out

### Coverage

- Coverage impact: New `buildTimeline` function should have unit tests

### Integration / Feature Tests

- Required scenarios:
  - Timeline renders messages and events interleaved
  - Events show correct descriptions and icons
  - Internal notes retain amber styling
  - Composer at bottom works correctly
  - EventsTimeline no longer visible in sidebar
  - Attachments still render on messages

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (buildTimeline tests)
- [ ] Type checking (`npx tsc --noEmit`)
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): unify activity timeline with messages and events`
- **Labels**: `support`, `admin-portal`, `ui`
- **Depends on**: TASK-2184 (DB migrations — for new event types)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new component (~200 lines) | +10K |
| Files to modify | 4 files (ConversationThread, TicketSidebar, page, types) | +12K |
| Code volume | ~300 lines total changes | +8K |
| Test complexity | Low (1 unit test for buildTimeline) | +5K |

**Confidence:** Medium-High

**Risk factors:**
- MessageCard extraction from ConversationThread may be tricky
- Attachment grouping logic needs to carry over correctly
- Sort order change (newest-first to oldest-first) is intentional but visible

**Similar past tasks:** TASK-2183 (search highlight rendering, actual: ~18K) — similar scope of new component + page integration

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/app/dashboard/support/components/ActivityTimeline.tsx

Files modified:
- [ ] admin-portal/app/dashboard/support/components/ConversationThread.tsx
- [ ] admin-portal/app/dashboard/support/components/TicketSidebar.tsx
- [ ] admin-portal/app/dashboard/support/[id]/page.tsx
- [ ] admin-portal/lib/support-types.ts

Features implemented:
- [ ] ActivityTimeline component with merged messages + events
- [ ] EventInlineCard sub-component for compact event rendering
- [ ] buildTimeline() merge/sort function with message_added filtering
- [ ] Composer moved to bottom of timeline
- [ ] EventsTimeline removed from sidebar
- [ ] Unit tests for buildTimeline()

Verification:
- [ ] npx tsc --noEmit passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Lessons / Insights:**
<What did you learn? Patterns that worked well, estimation surprises, codebase discoveries, reusable approaches, or "None — straightforward implementation">

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

**Lessons / Insights:**
<Architecture observations, quality patterns worth replicating, review findings that inform future work, or "None">

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
