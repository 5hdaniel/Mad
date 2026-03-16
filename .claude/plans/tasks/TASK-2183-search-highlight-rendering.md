# Task TASK-2183: Search Highlight Snippet Rendering (Frontend)

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

Update the admin portal frontend to display search highlight snippets below ticket rows when a search is active, showing where the match occurred (subject, description, requester, or message) with matched terms visually highlighted.

## Non-Goals

- Do NOT modify the ticket detail page
- Do NOT add new filter types
- Do NOT change pagination logic
- Do NOT restructure page layout
- Do NOT modify database/migration files
- Do NOT add search-as-you-type or autocomplete

## Deliverables

1. Update: `admin-portal/lib/support-types.ts` — add `SearchHighlight` interface
2. Update: `admin-portal/app/dashboard/support/components/TicketTable.tsx` — render snippet rows
3. Update: `admin-portal/app/dashboard/support/page.tsx` — pass `searchActive` prop
4. Update: `admin-portal/app/dashboard/support/my-tickets/page.tsx` — pass `searchActive` prop
5. Update: `admin-portal/app/dashboard/support/components/SearchBar.tsx` — update placeholder

## File Boundaries

N/A — sequential execution (TASK-2182 completed first).

### Files to modify (owned by this task):

- `admin-portal/lib/support-types.ts`
- `admin-portal/app/dashboard/support/components/TicketTable.tsx`
- `admin-portal/app/dashboard/support/page.tsx`
- `admin-portal/app/dashboard/support/my-tickets/page.tsx`
- `admin-portal/app/dashboard/support/components/SearchBar.tsx`

### Files this task must NOT modify:

- `admin-portal/lib/support-queries.ts` — the `search_highlights` field flows through automatically via existing `to_jsonb(t.*)` pattern
- Any migration files
- Any other components

## Acceptance Criteria

- [ ] `SearchHighlight` interface defined in support-types.ts
- [ ] `SupportTicket` interface includes optional `search_highlights` field
- [ ] TicketTable renders snippet rows below matching tickets when search is active
- [ ] Matched terms are visually highlighted (styled text)
- [ ] Snippet shows match source context ("Matched in subject", "Message by X on Y")
- [ ] Snippet rows do not appear when search is cleared
- [ ] My Tickets page also shows snippets during search
- [ ] SearchBar placeholder updated to "Search tickets, messages, requesters..."
- [ ] HTML in snippets is sanitized before rendering (use DOMPurify or equivalent)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### 1. Type definitions (`support-types.ts`)

```typescript
export interface SearchHighlight {
  field: 'subject' | 'description' | 'requester_name' | 'requester_email' | 'message';
  snippet: string;  // Contains <mark> tags from ts_headline
  sender_name?: string;  // Only for field: 'message'
  sent_at?: string;      // Only for field: 'message'
}
```

Add to the `SupportTicket` interface:
```typescript
search_highlights?: SearchHighlight[] | null;
```

### 2. TicketTable snippet rows

Add a `searchActive` prop to TicketTable:
```typescript
interface TicketTableProps {
  // ... existing props
  searchActive?: boolean;
}
```

After each ticket `<tr>`, conditionally render a snippet row when `searchActive && ticket.search_highlights?.length`:

```tsx
{searchActive && ticket.search_highlights?.length > 0 && (
  <tr className="border-b border-gray-100">
    <td colSpan={7} className="px-4 py-1.5 bg-gray-50">
      <div className="flex items-start gap-2 text-xs text-gray-500 pl-4">
        {/* Render first highlight (most relevant) */}
        <HighlightSnippet highlight={ticket.search_highlights[0]} />
      </div>
    </td>
  </tr>
)}
```

### 3. HighlightSnippet component (inline in TicketTable)

Create a small inline component to render each snippet:

- For `field: 'message'`: Show "Message by {sender_name}, {relative_date}: {snippet}"
- For `field: 'subject'`: Show "Matched in subject: {snippet}"
- For `field: 'description'`: Show "Matched in description: {snippet}"
- For `field: 'requester_name'` or `'requester_email'`: Show "Requester: {snippet}"

**Rendering the snippet HTML safely:** The `snippet` field contains `<mark>` tags from PostgreSQL's `ts_headline`. To render them:

1. Install `isomorphic-dompurify` (works in both SSR and client): `npm install isomorphic-dompurify && npm install -D @types/dompurify`
2. Sanitize with: `DOMPurify.sanitize(snippet, { ALLOWED_TAGS: ['mark'] })`
3. Render the sanitized output
**NOTE:** Do NOT use standard `dompurify` — it requires `window`/`document` which breaks Next.js SSR. Use `isomorphic-dompurify` instead.

Style the `<mark>` tags with CSS:
```css
mark {
  background-color: #fef08a; /* yellow-200 */
  padding: 0 2px;
  border-radius: 2px;
}
```

Or use Tailwind by targeting `mark` in a parent class.

### 4. Page wiring

In both `page.tsx` and `my-tickets/page.tsx`, pass the search state to TicketTable:

```tsx
<TicketTable
  tickets={tickets}
  searchActive={!!searchQuery}
  // ... existing props
/>
```

### 5. SearchBar placeholder

Change the default placeholder from `'Search tickets...'` to `'Search tickets, messages, requesters...'`.

### Important Details

- Only show the FIRST highlight per ticket (most relevant). Showing all would clutter the list.
- The snippet row should be visually subordinate — smaller text, lighter background, indented.
- Use relative dates for message timestamps (e.g., "2d ago" using the existing date formatting utility).
- When search is cleared, all snippet rows must disappear immediately.

## Integration Notes

- Imports from: `support-types.ts` (SearchHighlight interface)
- Depends on: TASK-2182 (the `search_highlights` field in the RPC response)
- The `listTickets()` function in `support-queries.ts` does NOT need changes — the field flows through automatically via the existing `to_jsonb(t.*)` pattern in the RPC.

## Do / Don't

### Do:
- Use DOMPurify to sanitize snippet HTML before rendering
- Only allow `<mark>` tags through sanitization
- Match existing TicketTable styling patterns
- Keep snippet rows visually subordinate (smaller, lighter)
- Show only the first/most relevant highlight per ticket

### Don't:
- Don't render raw HTML without sanitization
- Don't show ALL highlights for each ticket (clutters the list)
- Don't add new npm dependencies beyond DOMPurify
- Don't modify support-queries.ts (data flows through automatically)
- Don't add loading states for highlights (they come with the ticket data)

## When to Stop and Ask

- If the `SupportTicket` type structure has changed since task creation
- If TicketTable uses a different rendering pattern than expected (not a standard `<table>`)
- If DOMPurify has compatibility issues with the Next.js version
- If the `search_highlights` field is not present in the RPC response (TASK-2182 dependency)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI rendering, would need e2e)

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Required scenarios (manual browser verification):
  - Search for a term → snippets appear below matching tickets
  - Highlight tags render as yellow-highlighted text
  - Clear search → snippets disappear
  - Pagination still works during search
  - My Tickets page also shows snippets
  - SearchBar shows updated placeholder

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check`)
- [ ] Lint (`npm run lint`)
- [ ] Build step (`npm run build`)

## PR Preparation

- **Title**: `feat(support): add search highlight snippets to ticket queue`
- **Labels**: `support`, `admin-portal`, `ui`
- **Depends on**: TASK-2182

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K-18K

**Token Cap:** 72K

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 5 existing files | +5K |
| Code volume | ~80-120 lines TSX/TS | +8K |
| Complexity | Low — conditional render + type additions | +3K |
| Dependencies | DOMPurify install | +2K |

**Confidence:** High

**Risk factors:**
- DOMPurify SSR compatibility with Next.js (may need dynamic import)
- TicketTable may have unexpected structure

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] admin-portal/lib/support-types.ts
- [ ] admin-portal/app/dashboard/support/components/TicketTable.tsx
- [ ] admin-portal/app/dashboard/support/page.tsx
- [ ] admin-portal/app/dashboard/support/my-tickets/page.tsx
- [ ] admin-portal/app/dashboard/support/components/SearchBar.tsx

Features implemented:
- [ ] SearchHighlight interface
- [ ] Snippet row rendering in TicketTable
- [ ] HTML sanitization with DOMPurify
- [ ] searchActive prop wiring
- [ ] Updated SearchBar placeholder

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~14K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Lessons / Insights:**

**Reviewer notes:**

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~14K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**

**Suggestion for similar tasks:**

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

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

**Lessons / Insights:**

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
