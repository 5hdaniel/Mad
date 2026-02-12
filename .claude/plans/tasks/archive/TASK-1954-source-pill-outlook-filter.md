# Task TASK-1954: Add "outlook" source to SourcePill and source filter to contact selection screens

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

Add "outlook" as a recognized contact source in the SourcePill component so Outlook-imported contacts display a distinct badge (instead of falling back to generic "Imported"). Also add a simple source filter dropdown/toggle to the ContactSelectModal so users can filter contacts by source (All, Contacts App, Outlook, Message, Email, Manual).

## Non-Goals

- Do NOT add source filtering to the standalone ImportContactsModal (it already shows source badges inline)
- Do NOT refactor the ContactSelectModal architecture
- Do NOT change how contacts are stored or their source values in the database
- Do NOT add source filtering to the ContactSelector component (that is a simpler inline selector, not the full modal)
- Do NOT add complex multi-select filter UI -- a simple dropdown or pill-toggle row is sufficient

## Deliverables

1. Update: `src/components/shared/SourcePill.tsx` -- Add "outlook" to ContactSource type and mapping
2. Update: `src/components/ContactSelectModal.tsx` -- Add source filter UI

## Acceptance Criteria

- [ ] SourcePill renders a distinct "Outlook" badge (purple/indigo color, not falling back to "Imported")
- [ ] ContactSource type includes "outlook" as a valid value
- [ ] ContactSelectModal has a source filter (dropdown or pill toggles) that filters contacts by source
- [ ] Filter defaults to "All" (showing all contacts)
- [ ] Filter options include: All, Contacts App, Outlook, Email, Message, Manual
- [ ] Filter correctly narrows the displayed contact list
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### SourcePill Changes

In `src/components/shared/SourcePill.tsx`:

1. Add `"outlook"` to the `ContactSource` type union (line 7-14):
```typescript
export type ContactSource =
  | "imported"
  | "external"
  | "manual"
  | "contacts_app"
  | "outlook"  // NEW
  | "sms"
  | "messages"
  | "email";
```

2. Add an "outlook" variant to `VARIANT_STYLES`:
```typescript
outlook: {
  bg: "bg-indigo-100",
  text: "text-indigo-700",
  label: "Outlook",
},
```

3. Update the `Variant` type to include "outlook":
```typescript
type Variant = "imported" | "external" | "message" | "manual" | "email" | "outlook";
```

4. Add "outlook" case to `getVariant()`:
```typescript
case "outlook":
  return "outlook";
```

### ContactSelectModal Source Filter

In `src/components/ContactSelectModal.tsx`:

1. Add source filter state:
```typescript
const [sourceFilter, setSourceFilter] = useState<string>("all");
```

2. Add filter options (derive from available contacts to only show relevant sources):
```typescript
const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "contacts_app", label: "Contacts App" },
  { value: "outlook", label: "Outlook" },
  { value: "email", label: "Email" },
  { value: "sms", label: "Message" },
  { value: "manual", label: "Manual" },
] as const;
```

3. Add filter UI below the search bar (pill-toggle style for compact UX):
```tsx
<div className="flex items-center gap-2 mt-3 flex-wrap">
  {SOURCE_FILTER_OPTIONS.map((opt) => (
    <button
      key={opt.value}
      onClick={() => setSourceFilter(opt.value)}
      className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
        sourceFilter === opt.value
          ? "bg-purple-500 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

4. Apply source filter to the contact list. The ContactSelectModal already has filtering logic. Add the source filter after the existing `showMessageContacts` filter:
```typescript
// Apply source filter
const sourceFilteredContacts = sourceFilter === "all"
  ? filteredContacts
  : filteredContacts.filter((c) => {
      // Map "sms" filter to include both "sms" and "messages" sources
      if (sourceFilter === "sms") {
        return c.source === "sms" || c.source === "messages";
      }
      return c.source === sourceFilter;
    });
```

### Contact source field

The ExtendedContact type has a `source` field. Values stored in the database include:
- `"contacts_app"` -- from macOS Contacts
- `"outlook"` -- from Outlook Graph API (stored by externalContactDbService)
- `"manual"` -- manually created
- `"sms"` / `"messages"` -- discovered from text messages
- `"email"` -- discovered from email conversations

Verify what value is stored for Outlook contacts by checking `electron/services/db/externalContactDbService.ts`.

## Integration Notes

- Imports from: `src/components/shared/SourcePill.tsx` (used across many components)
- Exports to: ContactSelectModal, ContactRow, ContactSearchList, etc.
- Used by: All contact display components
- Depends on: Nothing

## Do / Don't

### Do:
- Keep the SourcePill change backward-compatible (existing sources still work)
- Use Tailwind indigo-100/indigo-700 for Outlook badge (distinct from existing colors)
- Keep the filter UI simple (pill toggles, one line)
- Handle the case where contacts have no source field gracefully

### Don't:
- Add multi-select complex filter UI with checkboxes
- Modify the ContactSelector component (different from ContactSelectModal)
- Change the ImportContactsModal (it has its own inline source display)
- Change how source values are stored in the database

## When to Stop and Ask

- If the ExtendedContact type does not have a `source` field
- If the ContactSelectModal has been significantly refactored since investigation
- If Outlook contacts use a different source value than "outlook" in the database

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test SourcePill renders "Outlook" label for source="outlook"
  - Test SourcePill uses indigo color variant for outlook
- Existing tests to update:
  - Any SourcePill snapshot tests (if they exist) need "outlook" added

### Coverage

- Coverage impact: Slight increase (new variant test)

### Integration / Feature Tests

- Manual verification required:
  - Open ContactSelectModal -> see source filter pills
  - Select "Outlook" filter -> only Outlook contacts shown
  - Select "All" -> all contacts shown
  - SourcePill shows "Outlook" badge on Outlook-imported contacts

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(contacts): add Outlook source pill and contact source filter`
- **Labels**: `feature`, `contacts`, `ui`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K-30K (apply ui multiplier x1.0 = ~25K-30K billable)

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 2 files (scope: medium) | +20K |
| Code volume | ~60-80 lines | +5K |
| Test complexity | Low (1-2 unit tests) | +5K |

**Confidence:** High

**Risk factors:**
- ContactSelectModal complexity (already a large component)
- Need to verify source field values in database

**Similar past tasks:** SPRINT-066 TASK-1761 (SourcePill component, actual: ~8K billable)

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
- [ ] (none expected)

Features implemented:
- [ ] "outlook" added to ContactSource type and SourcePill variant
- [ ] Source filter UI added to ContactSelectModal
- [ ] Filter logic applied to contact list

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

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
