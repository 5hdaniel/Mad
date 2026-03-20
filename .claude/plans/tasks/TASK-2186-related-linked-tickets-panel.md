# Task TASK-2186: Related & Linked Tickets Panel

**Status:** Completed
**Completed:** 2026-03-16
**PR:** #1156 (merged)

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

Add a "Related Tickets" section to the ticket detail sidebar showing two categories: auto-related tickets (same requester) and manually linked tickets (agent-created bidirectional links). Include a "Link Ticket" inline search for agents to connect related issues across requesters.

## Non-Goals

- Do NOT modify `CreateTicketDialog.tsx` — that's TASK-2185's territory
- Do NOT modify `ConversationThread.tsx` or `EventsTimeline.tsx` — that's TASK-2187
- Do NOT create or apply database migrations — TASK-2184 handles that
- Do NOT implement ticket merging (combining two tickets into one)
- Do NOT add real-time subscription for link updates

## Deliverables

1. New component: `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx`
2. Update: `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` — add RelatedTicketsPanel between Participants and EventsTimeline
3. Update: `admin-portal/lib/support-queries.ts` — add `getRelatedTickets()`, `linkTickets()`, `unlinkTickets()`, `searchTicketsForLink()`
4. Update: `admin-portal/lib/support-types.ts` — add `RelatedTicket`, `ManualLink`, `RelatedTicketsResponse`, `TicketLinkSearchResult` types

## File Boundaries

> **Purpose:** Prevents semantic conflicts when tasks run in parallel.

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx` (new)
- `admin-portal/app/dashboard/support/components/TicketSidebar.tsx`
- `admin-portal/lib/support-queries.ts` — ONLY add new functions. Add them in a new section labeled `// --- Related Tickets functions ---` AFTER the requester lookup section (added by TASK-2185) or after the participant functions section if TASK-2185 hasn't merged yet.
- `admin-portal/lib/support-types.ts` — ONLY add new types. Add them in a new section labeled `// --- Related Tickets types ---` AFTER the requester lookup types section or AFTER the `SupportResponseTemplate` interface (around line 166) if TASK-2185 hasn't merged yet.

### Files this task must NOT modify:

- `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx` — owned by TASK-2185
- `admin-portal/app/dashboard/support/components/ConversationThread.tsx` — owned by TASK-2187
- `admin-portal/app/dashboard/support/components/EventsTimeline.tsx` — owned by TASK-2187
- `admin-portal/app/dashboard/support/[id]/page.tsx` — owned by TASK-2187
- Any files under `supabase/` — owned by TASK-2184

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] New `RelatedTicketsPanel` component renders in sidebar between Participants and EventsTimeline
- [ ] Auto-related tickets shown (same requester email, excluding current ticket, max 5)
- [ ] Manually linked tickets shown separately (with link icon to distinguish)
- [ ] Linked tickets show link type label if not "related" (e.g., "duplicate", "parent")
- [ ] Visual separator between manual links and auto-related
- [ ] Section header shows count: "Related Tickets (X)"
- [ ] Section is collapsible (same pattern as EventsTimeline)
- [ ] "Link Ticket" button opens inline search at bottom
- [ ] Link search is debounced (300ms), searches by ticket # or subject
- [ ] Selecting a search result creates a bidirectional link via `support_link_tickets` RPC
- [ ] Link type selectable in search UI (dropdown: related, duplicate, parent, child)
- [ ] Unlink button available on manually linked tickets
- [ ] Link/unlink triggers `onTicketUpdated` callback to refresh ticket detail
- [ ] Clicking any related/linked ticket navigates to its detail page
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### 1. Type Additions (support-types.ts)

Add in a new `// --- Related Tickets types ---` section:

```typescript
// --- Related Tickets types ---

export type TicketLinkType = 'related' | 'duplicate' | 'parent' | 'child';

export interface RelatedTicket {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  link_source: 'auto' | 'manual';
  link_type?: TicketLinkType;
  link_id?: string;
}

export interface RelatedTicketsResponse {
  auto_related: RelatedTicket[];
  manual_links: RelatedTicket[];
}

export interface TicketLinkSearchResult {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  requester_name: string;
}
```

### 2. Query Functions (support-queries.ts)

Add in a new `// --- Related Tickets functions ---` section:

```typescript
// --- Related Tickets functions ---

export async function getRelatedTickets(ticketId: string): Promise<RelatedTicketsResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_related_tickets', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data as unknown as RelatedTicketsResponse;
}

export async function linkTickets(
  ticketId: string,
  linkedTicketId: string,
  linkType: string = 'related'
): Promise<{ link_id: string; linked: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_link_tickets', {
    p_ticket_id: ticketId,
    p_linked_ticket_id: linkedTicketId,
    p_link_type: linkType,
  });
  if (error) throw error;
  return data as unknown as { link_id: string; linked: boolean };
}

export async function unlinkTickets(
  ticketId: string,
  linkedTicketId: string
): Promise<{ unlinked: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_unlink_tickets', {
    p_ticket_id: ticketId,
    p_linked_ticket_id: linkedTicketId,
  });
  if (error) throw error;
  return data as unknown as { unlinked: boolean };
}

export async function searchTicketsForLink(
  query: string,
  excludeTicketId: string
): Promise<TicketLinkSearchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_search_tickets_for_link', {
    p_query: query,
    p_exclude_ticket_id: excludeTicketId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TicketLinkSearchResult[];
}
```

### 3. RelatedTicketsPanel Component

Create `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx`:

**Props:**
```typescript
interface RelatedTicketsPanelProps {
  ticketId: string;
  onTicketUpdated: () => void;
}
```

**Component Structure:**
- Collapsible section (same pattern as `EventsTimeline`)
- On mount/ticketId change: fetch `getRelatedTickets(ticketId)`
- Display manual links first (with link icon and link type badge)
- Subtle divider: "-- same requester --"
- Display auto-related tickets below
- "Link Ticket" button at bottom toggles inline search
- Inline search: text input + link type dropdown + results list

**UI Reference (from BACKLOG-951):**
```
RELATED TICKETS (4)
  [link] #167 Can't export PDF
     In Progress - Mar 12

  [link] #152 Login issue iPad
     Resolved - Mar 5

  -- same requester --

  #139 Missing transaction
     Pending - Feb 28

  #128 Sync not working
     Closed - Feb 20

  [+ Link Ticket]

  [Search by # or subject...]
  [Type: related v]
  #201 Password reset fail
  #198 Billing question
```

**Key behaviors:**
- Each ticket row is a `Link` or `<a>` to `/dashboard/support/${ticket.id}`
- Manual links show an "x" button to unlink (calls `unlinkTickets`)
- After link/unlink, call `onTicketUpdated()` to refresh parent and refetch related tickets
- Link type dropdown defaults to "related"
- Status badge uses `StatusBadge` component (same as queue page)
- Debounce link search at 300ms, minimum 1 character (ticket # can be 1 digit)

**Style patterns (match sidebar):**
- Container: `px-4 py-3` (same as other sidebar sections)
- Section label: `text-xs font-medium text-gray-500 uppercase tracking-wider`
- Ticket rows: `text-sm text-gray-700`, clickable with hover state
- Link icon: use `Link2` from lucide-react
- Divider: `text-xs text-gray-400 text-center my-2`

### 4. TicketSidebar Integration

In `TicketSidebar.tsx`, add the `RelatedTicketsPanel` between `ParticipantsPanel` and `EventsTimeline`:

```tsx
{/* Participants */}
<ParticipantsPanel ... />

{/* Related Tickets — NEW */}
<RelatedTicketsPanel
  ticketId={ticket.id}
  onTicketUpdated={onTicketUpdated}
/>

{/* Events Timeline */}
<EventsTimeline events={events} />
```

Import:
```typescript
import { RelatedTicketsPanel } from './RelatedTicketsPanel';
```

This is a minimal change to `TicketSidebar.tsx` — just adding the import and one JSX element.

## Integration Notes

- Imports from: `support-queries.ts` (getRelatedTickets, linkTickets, unlinkTickets, searchTicketsForLink)
- Imports from: `support-types.ts` (RelatedTicket, RelatedTicketsResponse, TicketLinkSearchResult, TicketLinkType)
- Imports from: `./StatusBadge` (for status badges on ticket rows)
- Used by: `TicketSidebar.tsx`
- Depends on: TASK-2184 (RPCs must exist in Supabase)

## Do / Don't

### Do:
- Match the collapsible section pattern from `EventsTimeline` (expanded by default, toggle with header click)
- Use `useEffect` to fetch related tickets on mount and when `ticketId` changes
- Show loading state while fetching
- Handle errors gracefully (show error text, don't crash)
- Use `Link` from `next/link` for ticket navigation

### Don't:
- Don't fetch related tickets on every render — only on mount and after link/unlink
- Don't use `window.location` for navigation — use Next.js router or Link
- Don't add real-time subscriptions
- Don't modify the EventsTimeline component
- Don't put the link search in a separate modal — keep it inline in the sidebar

## When to Stop and Ask

- If `support_get_related_tickets` RPC returns a different shape than expected
- If `TicketSidebar.tsx` has been significantly modified by another task (check git status)
- If `StatusBadge` component is not importable from the expected path
- If you need to modify `[id]/page.tsx` to pass additional props to the sidebar

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI component)

### Coverage

- Coverage impact: Must not decrease existing coverage

### Integration / Feature Tests

- Required scenarios:
  - Related tickets panel renders in sidebar
  - Auto-related tickets appear for tickets with same requester
  - Link search returns results by ticket number
  - Link creation creates bidirectional link
  - Unlink removes the link
  - Empty state shown when no related tickets

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npx tsc --noEmit`)
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): add related & linked tickets panel to ticket sidebar`
- **Labels**: `support`, `admin-portal`, `ui`
- **Depends on**: TASK-2184 (DB migrations must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~30K-40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new component (~250 lines) | +15K |
| Files to modify | 3 files (TicketSidebar + queries + types) | +10K |
| Code volume | ~350 lines total | +10K |
| Test complexity | Low (no unit tests) | +0K |

**Confidence:** Medium

**Risk factors:**
- Bidirectional link display logic may need debugging
- Inline search in sidebar may need careful UX tuning
- Merge conflict with TASK-2185 in shared files (mitigated by file boundary rules)

**Similar past tasks:** TASK-2183 (search highlight rendering, actual: ~18K) — similar scope of new component + query integration

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
- [ ] admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx

Files modified:
- [ ] admin-portal/app/dashboard/support/components/TicketSidebar.tsx
- [ ] admin-portal/lib/support-queries.ts
- [ ] admin-portal/lib/support-types.ts

Features implemented:
- [ ] Auto-related tickets display
- [ ] Manual linked tickets display
- [ ] Link Ticket inline search
- [ ] Link type selection
- [ ] Unlink functionality
- [ ] Collapsible section
- [ ] Navigation to related tickets

Verification:
- [ ] npx tsc --noEmit passes
- [ ] npm run lint passes
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

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~35K | ~XK | +/-X% |
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
