# Task TASK-1946: Responsive Toolbar Layout Redesign

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Redesign the toolbar layout in both `TransactionsToolbar.tsx` and `TransactionToolbar.tsx` to be responsive. On narrow viewports, the search bar should be on its own row stretching full width, with filter tabs and action buttons on a second row. On wide viewports, everything fits in a single row.

## Non-Goals

- Do NOT modify the header section of `TransactionToolbar.tsx` (the gradient back-button area)
- Do NOT change toolbar functionality (same buttons, same filters, same search)
- Do NOT modify scan progress, error, or success alert sections
- Do NOT modify the `LicenseGate` logic or status info tooltip behavior
- Do NOT add any new props or change the component interfaces

## Deliverables

1. Update: `src/components/transaction/components/TransactionsToolbar.tsx`
2. Update: `src/components/transaction/components/TransactionToolbar.tsx`

## Acceptance Criteria

- [ ] **Narrow viewport (below `md` breakpoint):**
  - Search bar is on its own row, full width
  - Second row contains: filter tabs (All/Active/Closed or the full filter set) + Edit button + New Transaction button, all together, shrinking/growing to fit
- [ ] **Wide viewport (`md` breakpoint and above):**
  - Single row layout: search bar on left, filter tabs in center, Edit + New Transaction aligned to right
- [ ] Both `TransactionsToolbar.tsx` and `TransactionToolbar.tsx` follow the same responsive pattern
- [ ] Scan/Stop button (LicenseGate wrapped) remains in the action buttons area
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No changes to component props/interfaces

## Implementation Notes

### Current Layout (Both Files)

Currently both toolbars have:
1. A filter tabs row (`inline-flex items-center bg-gray-200 rounded-lg p-1 mb-3`)
2. A second row (`flex items-center gap-3`) with: search (flex-1), Edit button, New Transaction button, Scan button

### Target Layout

**Narrow (default / mobile):**
```
┌──────────────────────────────────────────┐
│  [Search input ........................] │  <- full width
├──────────────────────────────────────────┤
│  [All][Active][Closed]  [Edit] [+ New]  │  <- flex-wrap, gap
└──────────────────────────────────────────┘
```

**Wide (`md:` and above):**
```
┌──────────────────────────────────────────────────────────────────┐
│  [Search input ........]  [All][Active][Closed]  [Edit] [+ New] │
│  left                     center                 right           │
└──────────────────────────────────────────────────────────────────┘
```

### Implementation Strategy

Use Tailwind responsive utilities to switch layouts:

```tsx
{/* Toolbar container */}
<div className="flex flex-col md:flex-row md:items-center gap-3">
  {/* Search - full width on mobile, auto width on desktop */}
  <div className="w-full md:w-auto md:flex-1 relative">
    <input ... />
  </div>

  {/* Filter tabs + actions - wrap on mobile, inline on desktop */}
  <div className="flex items-center gap-3 flex-wrap">
    {/* Filter tabs */}
    <div className="inline-flex items-center bg-gray-200 rounded-lg p-1">
      ...filter buttons...
    </div>

    {/* Action buttons */}
    <button>Edit</button>
    <button>New Transaction</button>
    {/* Scan button inside LicenseGate */}
  </div>
</div>
```

Key Tailwind classes:
- `flex flex-col` (mobile: stack vertically)
- `md:flex-row` (desktop: single row)
- `md:items-center` (desktop: vertically center items)
- `w-full md:w-auto md:flex-1` for search input container
- `flex-wrap` on the filters+actions group so they wrap gracefully

### TransactionsToolbar.tsx Specifics

Current structure has filter tabs ABOVE the search/actions row with `mb-3`. The new layout should:
1. Remove the separate filter tabs row
2. Merge filter tabs into the same flex container as search and actions
3. Apply the responsive pattern above

### TransactionToolbar.tsx Specifics

Same pattern as above. This file has more filter tabs (All, Pending Review, Active, Closed, Rejected) plus a status info tooltip button. Keep all the LicenseGate-wrapped tabs and the info button. The responsive behavior is the same -- they all go in the second-row group on narrow, or center section on wide.

### Important: Do NOT change these sections

Both files have identical sections after the toolbar that must not be modified:
- `{/* Scan Progress */}` section
- `{/* Error */}` section
- `{/* Quick Export Success */}` section
- `{/* Bulk Action Success */}` section

## Integration Notes

- `TransactionsToolbar.tsx` is used on the main transactions page
- `TransactionToolbar.tsx` is used in the transaction detail/list view
- No other tasks in this sprint touch these files
- No shared dependencies with other sprint tasks

## Do / Don't

### Do:
- Use Tailwind responsive classes (`sm:`, `md:`, `lg:`) -- prefer `md:` as the breakpoint
- Keep all existing button styles, colors, and hover states
- Preserve all existing functionality (click handlers, disabled states)
- Test both layouts visually if possible

### Don't:
- Do NOT change any component props or interfaces
- Do NOT modify the TransactionToolbar header (gradient back button section)
- Do NOT change button labels, icons, or colors
- Do NOT add CSS files -- Tailwind only
- Do NOT modify scan progress / error / success sections

## When to Stop and Ask

- If the toolbar structure has changed significantly from what's described here
- If modifying layout requires changing component props
- If you need to add new CSS classes beyond Tailwind utilities
- If tests fail due to structural changes in the toolbar

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (layout-only change)
- Existing tests to verify: All existing tests must still pass (no text content changes)

### Coverage

- Coverage impact: None (no logic changes)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(ui): responsive toolbar layout for transactions pages`
- **Base**: `develop`
- **Labels**: `ui`, `enhancement`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K (ui multiplier x1.0)

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 toolbar files | +10K |
| Code volume | ~100 lines restructured per file | +10K |
| Complexity | Responsive CSS layout work | +5K |

**Confidence:** Medium

**Risk factors:**
- Layout restructuring may require iteration to get right
- Two files need consistent treatment

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-02-10*

### Agent ID

```
Engineer Agent ID: (auto-captured by SubagentStop hook)
```

### Checklist

```
Files modified:
- [x] src/components/transaction/components/TransactionsToolbar.tsx
- [x] src/components/transaction/components/TransactionToolbar.tsx

Features implemented:
- [x] Narrow viewport: search on top, filters+actions below
- [x] Wide viewport: single row layout
- [x] Both toolbars consistent

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (14/14)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |

**Variance:** PM Est ~25K vs Actual ~(auto-captured)

### Notes

**Issues encountered:**
- Worktree did not have node_modules installed; ran `npm install` to resolve. Minor delay (~10s).
- No other issues. Both files followed the exact same pattern so the restructuring was straightforward.

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
