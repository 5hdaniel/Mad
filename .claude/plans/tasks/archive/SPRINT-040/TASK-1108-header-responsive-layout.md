# Task TASK-1108: Transaction Details Header Responsive Layout

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

Make the Transaction Details header responsive by stacking the layout into two rows on narrow viewports: title/address/close on top, action buttons on bottom.

## Non-Goals

- Do NOT change button functionality or event handlers
- Do NOT modify the sub-components (`PendingReviewActions`, `RejectedActions`, `ActiveActions`)
- Do NOT change header colors, gradients, or styling beyond layout
- Do NOT add media query CSS files (use Tailwind responsive utilities only)
- Do NOT implement a mobile hamburger menu or action dropdown

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/TransactionHeader.tsx`

## Acceptance Criteria

- [ ] Header stacks vertically on viewports < 768px (`md:` breakpoint)
- [ ] Top row contains: title, status badge, address, and close button (right-aligned)
- [ ] Bottom row contains: action buttons (Edit, Reject, Export, etc.)
- [ ] Layout returns to single-row on viewports >= 768px
- [ ] Close button remains visually in the top-right corner at all viewport sizes
- [ ] No visual regressions on desktop/wide screens
- [ ] Works for all header states: active, pending review, rejected
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All CI checks pass

## Implementation Notes

### Current Structure (lines 58-124)

The header currently uses a single-row flex layout:

```tsx
<div className="flex-shrink-0 px-6 py-4 flex items-center justify-between rounded-t-xl ...">
  {/* Left: Title + Address */}
  <div>...</div>
  {/* Right: Action buttons + Close */}
  <div className="flex items-center gap-2">...</div>
</div>
```

### Recommended Approach

Restructure to use nested flex containers with responsive classes:

```tsx
<div className={`flex-shrink-0 px-6 py-4 rounded-t-xl ${getHeaderStyle()}`}>
  {/* Container: column on mobile, row on md+ */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-2">

    {/* Top row: Title/Address + Close button */}
    <div className="flex items-center justify-between md:flex-1">
      {/* Left side: Title + Address */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-white">{getHeaderTitle()}</h3>
          {/* Status badges */}
        </div>
        <p className={`text-sm ${getHeaderTextStyle()}`}>{transaction.property_address}</p>
      </div>

      {/* Close button: visible on mobile in top row, hidden on md+ */}
      <button className="md:hidden ...">X</button>
    </div>

    {/* Bottom row (mobile) / Right side (desktop): Action buttons */}
    <div className="flex items-center gap-2 justify-end">
      {/* Action buttons (Edit/Reject/Export via sub-components) */}

      {/* Close button: hidden on mobile, visible on md+ */}
      <button className="hidden md:block ...">X</button>
    </div>
  </div>
</div>
```

### Key Implementation Details

1. **Duplicate close button pattern**: Render the close button twice - once in the mobile top row (`md:hidden`) and once in the desktop action area (`hidden md:block`). This avoids complex positioning while keeping the button accessible.

2. **Tailwind breakpoints**:
   - Default (no prefix): < 768px (mobile)
   - `md:`: >= 768px (tablet/desktop)

3. **Gap spacing**: Use `gap-3` for vertical spacing on mobile, `gap-2` for horizontal on desktop.

4. **Button row alignment**: Use `justify-end` on the action button row to right-align on mobile.

### Alternative: Single Close Button with Absolute Positioning

If duplicate buttons feel wrong, you can use absolute positioning:

```tsx
<div className="relative ...">
  {/* Absolute close button in top-right */}
  <button className="absolute top-4 right-4 md:static md:order-last ...">X</button>
  {/* Rest of content */}
</div>
```

Choose whichever approach feels cleaner. Both are acceptable.

## Integration Notes

- Imports from: None (isolated component)
- Exports to: Used by `TransactionDetailsPanel.tsx`
- Used by: No other tasks
- Depends on: None

## Do / Don't

### Do:

- Use Tailwind responsive utilities (`md:`, etc.)
- Test all three header states (active, pending review, rejected)
- Maintain the existing visual appearance at wide viewports
- Keep the close button accessible at all sizes

### Don't:

- Add custom CSS or media queries outside Tailwind
- Modify the action button sub-components
- Change the existing color scheme or gradients
- Remove any existing functionality

## When to Stop and Ask

- If the existing sub-components need modification to work with the new layout
- If you discover the header is used in unexpected contexts
- If the stacked layout causes buttons to overflow or wrap unexpectedly
- If you find conflicting responsive styles elsewhere in the component

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (visual/layout change only)
- New tests to write: None
- Existing tests to update: None expected

### Coverage

- Coverage impact: Not enforced (no logic changes)

### Integration / Feature Tests

- Required scenarios:
  - Manual resize testing at various viewport widths
  - Visual verification of all three header states

### Manual Testing Checklist

- [ ] Resize browser from wide (>1024px) to narrow (<768px)
- [ ] Verify layout switches at ~768px breakpoint
- [ ] Test header with active transaction
- [ ] Test header with pending review transaction
- [ ] Test header with rejected transaction
- [ ] Verify all buttons remain clickable and functional
- [ ] Verify close button position (top-right at all sizes)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(ui): make transaction header responsive on narrow viewports`
- **Labels**: `ui`, `responsive`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~12K-18K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (scope: medium) | +8K |
| Code volume | ~30-50 lines changed | +4K |
| Test complexity | None (manual only) | +0K |
| Iteration | Layout tweaking | +3K |

**Confidence:** High

**Risk factors:**
- Tailwind responsive classes may require iteration to get spacing right
- Close button positioning might need refinement

**Similar past tasks:** None in recent sprints (first responsive UI task)

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
- [ ] (none)

Files modified:
- [ ] src/components/transactionDetailsModule/components/TransactionHeader.tsx

Features implemented:
- [ ] Responsive header layout with stacked rows on narrow viewports
- [ ] Close button accessible at all viewport sizes
- [ ] All header states (active, pending, rejected) work correctly

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

<REQUIRED: Document the following>

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
| **Tokens** | ~15K | ~XK | +/-X% |
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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** N/A (visual change only)

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
