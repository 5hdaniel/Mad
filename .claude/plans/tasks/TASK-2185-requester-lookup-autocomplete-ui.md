# Task TASK-2185: Requester Lookup Autocomplete UI

**Status:** Completed
**Completed:** 2026-03-16
**PR:** #1157 (merged)

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

Rewrite the `CreateTicketDialog` to replace manual requester email/name inputs with a search-first autocomplete workflow. When an agent takes a phone call, they search for the caller by name/email/org, auto-fill contact info, see recent tickets for duplicate prevention, and capture phone number and preferred contact method.

## Non-Goals

- Do NOT modify `TicketSidebar.tsx` — that's TASK-2186's territory
- Do NOT create the `ActivityTimeline` component — that's TASK-2187
- Do NOT modify `ConversationThread.tsx` or `EventsTimeline.tsx`
- Do NOT create or apply database migrations — TASK-2184 handles that
- Do NOT add the phone/preferred_contact display to the ticket detail sidebar (can be a follow-up)

## Deliverables

1. Rewrite: `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx` — major rewrite with search autocomplete
2. Update: `admin-portal/lib/support-queries.ts` — add `searchRequesters()` and `getRequesterRecentTickets()` functions
3. Update: `admin-portal/lib/support-types.ts` — add `RequesterSearchResult`, `RecentTicket`, `PreferredContact` types, update `CreateTicketParams`

## File Boundaries

> **Purpose:** Prevents semantic conflicts when tasks run in parallel.

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx`
- `admin-portal/lib/support-queries.ts` — ONLY add new functions at the end of the "Query functions" section, before the analytics section. Do NOT modify existing functions.
- `admin-portal/lib/support-types.ts` — ONLY add new types/interfaces. Add them in a new section labeled `// --- Requester Lookup types ---` BEFORE the `// --- Analytics types ---` section (around line 168). Also update `CreateTicketParams` interface to add optional `requester_phone` and `preferred_contact` fields.

### Files this task must NOT modify:

- `admin-portal/app/dashboard/support/components/TicketSidebar.tsx` — owned by TASK-2186
- `admin-portal/app/dashboard/support/components/ConversationThread.tsx` — owned by TASK-2187
- `admin-portal/app/dashboard/support/components/EventsTimeline.tsx` — owned by TASK-2187
- `admin-portal/app/dashboard/support/[id]/page.tsx` — owned by TASK-2187
- Any files under `supabase/` — owned by TASK-2184

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Search autocomplete field at top of CreateTicketDialog — replaces separate email/name inputs
- [ ] Debounced search (300ms, minimum 2 characters) queries `support_search_requesters` RPC
- [ ] Results dropdown shows: Name -- email -- Organization (open ticket count)
- [ ] Selecting a result auto-fills: email, name, phone (if on profile), organization
- [ ] "No match -- enter manually" option reveals manual entry fields
- [ ] Organization badge shown after requester selection (org name from search result)
- [ ] Phone number text input field present in form
- [ ] Preferred contact method radio group: Email | Phone | Either (default: Email)
- [ ] Phone and preferred_contact passed to `createTicket()` and saved
- [ ] Recent tickets panel appears after requester selection (by email)
- [ ] Recent tickets show: ticket #, subject, status badge, created date (max 5)
- [ ] Warning notice if requester has open tickets: "This customer has X open ticket(s)"
- [ ] Clicking a recent ticket navigates to ticket detail page
- [ ] Form still works for brand new contacts (manual entry path)
- [ ] Form resets properly on close
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass

## Implementation Notes

### 1. Type Additions (support-types.ts)

Add these types in a new `// --- Requester Lookup types ---` section:

```typescript
// --- Requester Lookup types ---

export type PreferredContact = 'email' | 'phone' | 'either';

export interface RequesterSearchResult {
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  open_ticket_count: number;
}

export interface RecentTicket {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}
```

Also update `CreateTicketParams`:
```typescript
export interface CreateTicketParams {
  // ... existing fields ...
  requester_phone?: string;
  preferred_contact?: PreferredContact;
}
```

### 2. Query Functions (support-queries.ts)

Add BEFORE the `// --- Analytics functions ---` section:

```typescript
// --- Requester Lookup functions ---

export async function searchRequesters(query: string): Promise<RequesterSearchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_search_requesters', {
    p_query: query,
  });
  if (error) throw error;
  return (data ?? []) as unknown as RequesterSearchResult[];
}

export async function getRequesterRecentTickets(email: string): Promise<RecentTicket[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_requester_recent_tickets', {
    p_email: email,
  });
  if (error) throw error;
  return (data ?? []) as unknown as RecentTicket[];
}
```

Also update `createTicket()` to pass the new optional params:
```typescript
// In createTicket(), add to the RPC call:
p_requester_phone: params.requester_phone || null,
p_preferred_contact: params.preferred_contact || 'email',
```

### 3. CreateTicketDialog Rewrite

The current component is ~253 lines. The rewrite will be larger (~400-500 lines) due to the search autocomplete, results dropdown, recent tickets panel, and new fields.

**Component State:**
```typescript
// Search state
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<RequesterSearchResult[]>([]);
const [searching, setSearching] = useState(false);
const [showResults, setShowResults] = useState(false);
const [selectedRequester, setSelectedRequester] = useState<RequesterSearchResult | null>(null);
const [manualEntry, setManualEntry] = useState(false);

// Recent tickets state
const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
const [loadingRecent, setLoadingRecent] = useState(false);

// Existing + new form fields
const [requesterEmail, setRequesterEmail] = useState('');
const [requesterName, setRequesterName] = useState('');
const [requesterPhone, setRequesterPhone] = useState('');
const [preferredContact, setPreferredContact] = useState<PreferredContact>('email');
// ... existing subject, description, priority, category, subcategory
```

**Search Flow:**
1. Use `useEffect` with a debounce timer (300ms) on `searchQuery`
2. Only search if query length >= 2
3. Call `searchRequesters(searchQuery)`
4. Show results in a dropdown below the search input
5. On result selection: auto-fill email, name, phone, set `selectedRequester`
6. After selection, call `getRequesterRecentTickets(email)` to load recent tickets

**UI Layout (top to bottom):**
1. Search field: "Search for requester..." with dropdown
2. OR "No match -- enter contact details manually" link
3. If selected: org badge (if org present), contact info summary
4. If selected: recent tickets panel with warning
5. Phone number input
6. Preferred contact radio: Email | Phone | Either
7. Subject input
8. Description textarea
9. Category + Priority selects
10. Subcategory (conditional)
11. Disclaimer (conditional)
12. Cancel + Create buttons

**Important patterns:**
- Use `useRef` for debounce timer and clean up on unmount
- Close dropdown on blur (with a small delay so clicks register)
- Show loading spinner in dropdown during search
- When switching from selected requester back to search, clear recent tickets

### 4. Style Consistency

Match the existing Tailwind patterns from the current `CreateTicketDialog`:
- Input classes: `w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`
- Label classes: `block text-sm font-medium text-gray-700 mb-1`
- Button classes: match existing Cancel/Create patterns

For the recent tickets panel, use a subtle background similar to the compliance disclaimer:
- `bg-gray-50 border border-gray-200 rounded-md p-3`
- Warning notice: `bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800`

## Integration Notes

- Imports from: `support-queries.ts` (searchRequesters, getRequesterRecentTickets, createTicket)
- Imports from: `support-types.ts` (RequesterSearchResult, RecentTicket, PreferredContact, CreateTicketParams)
- Used by: The support queue page imports `CreateTicketDialog`
- Depends on: TASK-2184 (RPCs must exist in Supabase)

## Do / Don't

### Do:
- Preserve the existing category/subcategory/priority/disclaimer logic exactly
- Use the same modal structure (fixed overlay, backdrop, white card)
- Clean up debounce timers on unmount
- Show a clear empty state when search returns no results
- Reset all state (including search/selection) when dialog closes

### Don't:
- Don't remove the `source_channel: 'admin_created'` default
- Don't make phone number required (it's optional)
- Don't use a third-party autocomplete library — use a simple custom dropdown
- Don't modify the `createTicket` function signature beyond adding new params to the RPC call
- Don't navigate away from the create dialog when clicking a recent ticket — open in new tab or show a confirmation

## When to Stop and Ask

- If `support_search_requesters` RPC is not callable (TASK-2184 may not be merged yet)
- If `CreateTicketParams` type needs fields beyond `requester_phone` and `preferred_contact`
- If the dialog exceeds 600 lines — consider extracting sub-components
- If you need to modify `TicketSidebar.tsx` or any restricted file

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI component — tested via integration/manual)
- Nice-to-have: Test debounce helper if extracted as utility

### Coverage

- Coverage impact: Must not decrease existing coverage

### Integration / Feature Tests

- Required scenarios:
  - Search returns results for known user email
  - Search returns results for org name
  - Auto-fill populates email, name, phone
  - Recent tickets load after selection
  - Manual entry path works when no match found
  - Form submits successfully with new fields

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npx tsc --noEmit`)
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(support): add requester lookup autocomplete to CreateTicketDialog`
- **Labels**: `support`, `admin-portal`, `ui`
- **Depends on**: TASK-2184 (DB migrations must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~35K-45K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 3 files (1 major rewrite + 2 small updates) | +25K |
| Code volume | ~400 lines new/rewritten code | +15K |
| Test complexity | Low (no unit tests required) | +0K |

**Confidence:** Medium

**Risk factors:**
- CreateTicketDialog rewrite is a significant UI change
- Debounce + dropdown behavior can be tricky to get right
- Recent tickets panel adds complexity

**Similar past tasks:** TASK-2183 (search highlight rendering, actual: ~18K) — but this is more complex (rewrite vs enhancement)

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
- [ ] (none — all modifications)

Files modified:
- [ ] admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx
- [ ] admin-portal/lib/support-queries.ts
- [ ] admin-portal/lib/support-types.ts

Features implemented:
- [ ] Search autocomplete with debounce
- [ ] Results dropdown with org + open ticket count
- [ ] Auto-fill on selection
- [ ] Manual entry fallback
- [ ] Org badge after selection
- [ ] Phone number field
- [ ] Preferred contact method radio
- [ ] Recent tickets panel
- [ ] Open ticket warning

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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~40K | ~XK | +/-X% |
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
