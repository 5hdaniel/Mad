# Task TASK-1988: Add Outlook Filter Toggle to ContactSearchList

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

Add an "Outlook" filter toggle to `ContactSearchList.tsx` so users can filter contacts by Outlook source, matching the existing toggle pattern for Manual, Imported, Contacts App, and Messages.

## Non-Goals

- Do NOT modify the `SourcePill.tsx` component (the "outlook" variant already exists and is styled correctly)
- Do NOT add backend changes to contact fetching logic
- Do NOT change the contact categorization logic beyond adding the Outlook category
- Do NOT touch `MacOSContactsImportSettings.tsx` (that is TASK-1989)

## Deliverables

1. Update: `src/components/shared/ContactSearchList.tsx`
   - Add `outlook: boolean` to `CategoryFilter` interface
   - Add `outlook: true` to `DEFAULT_CATEGORY_FILTER`
   - Update `getContactCategory()` to return `"outlook"` for Outlook-sourced contacts
   - Add Outlook filter toggle button in the filter UI (indigo color, matching SourcePill)

## Acceptance Criteria

- [ ] `CategoryFilter` interface includes `outlook: boolean`
- [ ] Default filter has `outlook: true` (Outlook contacts shown by default)
- [ ] `getContactCategory()` returns `"outlook"` when `contact.source === "outlook"`
- [ ] Filter toggle button renders with indigo styling (matching `SourcePill` outlook variant: `bg-indigo-100`, `text-indigo-700`)
- [ ] Toggling the Outlook filter shows/hides Outlook-sourced contacts
- [ ] Existing filter behavior for Manual, Imported, Contacts App, Messages is unchanged
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Current State

The `ContactSearchList.tsx` file (at `src/components/shared/ContactSearchList.tsx`) has:

```typescript
// Lines 159-164 - Current CategoryFilter
interface CategoryFilter {
  manual: boolean;
  imported: boolean;
  external: boolean;
  messages: boolean;
}

// Lines 166-171 - Current defaults
const DEFAULT_CATEGORY_FILTER: CategoryFilter = {
  manual: true,
  imported: true,
  external: true,
  messages: false,
};
```

### Changes Required

1. **Extend `CategoryFilter`:**
```typescript
interface CategoryFilter {
  manual: boolean;
  imported: boolean;
  external: boolean;
  messages: boolean;
  outlook: boolean;  // ADD THIS
}
```

2. **Extend `DEFAULT_CATEGORY_FILTER`:**
```typescript
const DEFAULT_CATEGORY_FILTER: CategoryFilter = {
  manual: true,
  imported: true,
  external: true,
  messages: false,
  outlook: true,  // ADD THIS - shown by default
};
```

3. **Update `getContactCategory()` to handle Outlook source:**
Add a case before the existing logic:
```typescript
function getContactCategory(contact: ExtendedContact, isExternalContact: boolean = false): keyof CategoryFilter {
  // Outlook contacts (from Outlook Graph API import)
  if (contact.source === "outlook") {
    return "outlook";
  }
  // SMS/messages source shows as "Message" pill
  if (contact.source === "sms" || contact.source === "messages") {
    return "messages";
  }
  // ... rest unchanged
}
```

4. **Add the filter toggle button** in the filter UI section. Find where the existing toggles are rendered (look for the toggle buttons for Manual, Imported, etc.) and add an Outlook toggle:
```tsx
<button
  onClick={() => setCategoryFilter(prev => ({ ...prev, outlook: !prev.outlook }))}
  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
    categoryFilter.outlook
      ? "bg-indigo-100 text-indigo-700 border-indigo-300"
      : "bg-gray-100 text-gray-400 border-gray-200"
  }`}
>
  Outlook
</button>
```

### Important Details

- The `SourcePill.tsx` at `src/components/shared/SourcePill.tsx` already defines the "outlook" variant with `bg-indigo-100` / `text-indigo-700` styling. Match these colors for the filter toggle.
- The `external_contacts` table stores contacts with `source = 'outlook'`. These contacts flow into the contact list and carry the `source` property.
- The filter toggle UI pattern follows the existing buttons. Examine the current toggle rendering code and replicate the pattern.

## Integration Notes

- Imports from: No new imports needed
- Exports to: N/A
- Used by: All contact selection screens (EditContactsModal, ImportContactsModal)
- Depends on: None (first task in sprint)

## Do / Don't

### Do:
- Match existing toggle button styling patterns in the file
- Use indigo color family to match SourcePill outlook variant
- Test that contacts with `source: "outlook"` are correctly categorized
- Preserve all existing filter behavior

### Don't:
- Don't rearrange existing filter toggles or change their order
- Don't modify SourcePill.tsx
- Don't add Outlook import functionality (that is TASK-1989)
- Don't change the `getVariant()` function in SourcePill.tsx

## When to Stop and Ask

- If `ContactSearchList.tsx` structure has significantly changed from the described layout
- If the contact `source` field does not include `"outlook"` as a valid value
- If there are more than 5 filter toggles already and adding another would break the layout

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that `getContactCategory()` returns `"outlook"` for contacts with `source: "outlook"`
  - Test that toggling the Outlook filter shows/hides Outlook contacts
- Existing tests to update:
  - If `ContactSearchList` has existing filter tests, extend them to include Outlook

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios: N/A (unit tests sufficient)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(contacts): add Outlook filter toggle to ContactSearchList`
- **Labels**: `ui`, `outlook`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file (ContactSearchList.tsx) | +5K |
| Code volume | ~30 lines added | +3K |
| Test complexity | Low (pattern replication) | +2K |

**Confidence:** High

**Risk factors:**
- ContactSearchList may have changed since investigation

**Similar past tasks:** BACKLOG-659 (source filter, actual ~30K -- but that was adding the full filter system, not extending it)

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
- [ ] N/A

Files modified:
- [ ] src/components/shared/ContactSearchList.tsx

Features implemented:
- [ ] Outlook category added to CategoryFilter interface
- [ ] Outlook default set to true
- [ ] getContactCategory returns "outlook" for outlook-sourced contacts
- [ ] Outlook filter toggle button rendered in UI

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

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~10K | ~XK | +/-X% |
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
